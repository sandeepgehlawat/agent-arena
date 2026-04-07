use crate::error::{AppError, Result};
use crate::models::{
    AgentMatchState, Position, PositionSide, TradeAction, TradeRecord, TradeRequest,
    TradeResponse, TradeSide, INITIAL_BALANCE, MAX_LEVERAGE, MAX_POSITION_SIZE, MIN_TRADE_SIZE,
    SUPPORTED_SYMBOLS,
};
use crate::services::price_feed::PriceFeed;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Simulated trade engine for match competitions
pub struct TradeEngine {
    pub price_feed: Arc<PriceFeed>,
    // match_id => agent_id => AgentMatchState
    states: RwLock<HashMap<String, HashMap<u64, AgentMatchState>>>,
    // match_id => Vec<TradeRecord>
    trades: RwLock<HashMap<String, Vec<TradeRecord>>>,
}

impl TradeEngine {
    pub fn new(price_feed: Arc<PriceFeed>) -> Self {
        Self {
            price_feed,
            states: RwLock::new(HashMap::new()),
            trades: RwLock::new(HashMap::new()),
        }
    }

    /// Initialize a match with two agents
    pub async fn init_match(&self, match_id: &str, agent1_id: u64, agent2_id: u64) {
        let mut states = self.states.write().await;

        let mut match_states = HashMap::new();
        match_states.insert(
            agent1_id,
            AgentMatchState {
                agent_id: agent1_id,
                balance: INITIAL_BALANCE,
                positions: vec![],
                pnl: 0.0,
                trades_count: 0,
            },
        );
        match_states.insert(
            agent2_id,
            AgentMatchState {
                agent_id: agent2_id,
                balance: INITIAL_BALANCE,
                positions: vec![],
                pnl: 0.0,
                trades_count: 0,
            },
        );

        states.insert(match_id.to_string(), match_states);

        let mut trades = self.trades.write().await;
        trades.insert(match_id.to_string(), vec![]);
    }

    /// Execute a trade
    pub async fn execute_trade(
        &self,
        match_id: &str,
        request: TradeRequest,
    ) -> Result<TradeResponse> {
        // Validate symbol
        if !SUPPORTED_SYMBOLS.contains(&request.symbol.as_str()) {
            return Ok(TradeResponse {
                success: false,
                trade_id: String::new(),
                symbol: request.symbol,
                side: request.side,
                action: request.action,
                size_usd: request.size_usd,
                price: 0.0,
                realized_pnl: None,
                new_balance: 0.0,
                error: Some("Unsupported symbol".to_string()),
            });
        }

        // Validate leverage
        let leverage = request.leverage.unwrap_or(1.0).min(MAX_LEVERAGE).max(1.0);

        // Validate size
        if request.size_usd < MIN_TRADE_SIZE {
            return Ok(TradeResponse {
                success: false,
                trade_id: String::new(),
                symbol: request.symbol,
                side: request.side,
                action: request.action,
                size_usd: request.size_usd,
                price: 0.0,
                realized_pnl: None,
                new_balance: 0.0,
                error: Some(format!("Minimum trade size is ${}", MIN_TRADE_SIZE)),
            });
        }

        // Get current price
        let price = self
            .price_feed
            .get_price_or_fetch(&request.symbol)
            .await
            .map_err(|e| AppError::Internal(format!("Price fetch error: {:?}", e)))?;

        let mut states = self.states.write().await;
        let match_states = states
            .get_mut(match_id)
            .ok_or_else(|| AppError::NotFound("Match not found".to_string()))?;

        let state = match_states
            .get_mut(&request.agent_id)
            .ok_or_else(|| AppError::NotFound("Agent not in match".to_string()))?;

        let trade_id = Uuid::new_v4().to_string();
        let mut realized_pnl: Option<f64> = None;

        match request.action {
            TradeAction::Open => {
                // Check if already have position in this symbol
                if state.positions.iter().any(|p| p.symbol == request.symbol) {
                    return Ok(TradeResponse {
                        success: false,
                        trade_id,
                        symbol: request.symbol,
                        side: request.side,
                        action: request.action,
                        size_usd: request.size_usd,
                        price,
                        realized_pnl: None,
                        new_balance: state.balance,
                        error: Some("Already have position in this symbol".to_string()),
                    });
                }

                // Check balance (margin required = size / leverage)
                let margin_required = request.size_usd / leverage;
                if margin_required > state.balance {
                    return Ok(TradeResponse {
                        success: false,
                        trade_id,
                        symbol: request.symbol,
                        side: request.side,
                        action: request.action,
                        size_usd: request.size_usd,
                        price,
                        realized_pnl: None,
                        new_balance: state.balance,
                        error: Some("Insufficient balance".to_string()),
                    });
                }

                // Check max position size
                if request.size_usd > MAX_POSITION_SIZE {
                    return Ok(TradeResponse {
                        success: false,
                        trade_id,
                        symbol: request.symbol,
                        side: request.side,
                        action: request.action,
                        size_usd: request.size_usd,
                        price,
                        realized_pnl: None,
                        new_balance: state.balance,
                        error: Some(format!("Max position size is ${}", MAX_POSITION_SIZE)),
                    });
                }

                // Open position
                state.balance -= margin_required;
                state.positions.push(Position {
                    symbol: request.symbol.clone(),
                    side: if request.side == TradeSide::Long {
                        PositionSide::Long
                    } else {
                        PositionSide::Short
                    },
                    size: request.size_usd,
                    entry_price: price,
                    current_price: price,
                    unrealized_pnl: 0.0,
                    leverage,
                });
            }

            TradeAction::Close => {
                // Find and close position
                let pos_idx = state
                    .positions
                    .iter()
                    .position(|p| p.symbol == request.symbol);

                if let Some(idx) = pos_idx {
                    let pos = state.positions.remove(idx);

                    // Calculate P&L
                    let pnl = match pos.side {
                        PositionSide::Long => {
                            (price - pos.entry_price) / pos.entry_price * pos.size
                        }
                        PositionSide::Short => {
                            (pos.entry_price - price) / pos.entry_price * pos.size
                        }
                    };

                    // Return margin + P&L
                    let margin = pos.size / pos.leverage;
                    state.balance += margin + pnl;
                    state.pnl += pnl;
                    realized_pnl = Some(pnl);
                } else {
                    return Ok(TradeResponse {
                        success: false,
                        trade_id,
                        symbol: request.symbol,
                        side: request.side,
                        action: request.action,
                        size_usd: request.size_usd,
                        price,
                        realized_pnl: None,
                        new_balance: state.balance,
                        error: Some("No position to close".to_string()),
                    });
                }
            }

            TradeAction::Increase => {
                // Find existing position
                let pos = state
                    .positions
                    .iter_mut()
                    .find(|p| p.symbol == request.symbol);

                if let Some(pos) = pos {
                    // Check same direction
                    let is_same_side = (request.side == TradeSide::Long
                        && pos.side == PositionSide::Long)
                        || (request.side == TradeSide::Short && pos.side == PositionSide::Short);

                    if !is_same_side {
                        return Ok(TradeResponse {
                            success: false,
                            trade_id,
                            symbol: request.symbol,
                            side: request.side,
                            action: request.action,
                            size_usd: request.size_usd,
                            price,
                            realized_pnl: None,
                            new_balance: state.balance,
                            error: Some("Cannot increase opposite direction".to_string()),
                        });
                    }

                    // Check margin
                    let margin_required = request.size_usd / leverage;
                    if margin_required > state.balance {
                        return Ok(TradeResponse {
                            success: false,
                            trade_id,
                            symbol: request.symbol,
                            side: request.side,
                            action: request.action,
                            size_usd: request.size_usd,
                            price,
                            realized_pnl: None,
                            new_balance: state.balance,
                            error: Some("Insufficient balance".to_string()),
                        });
                    }

                    // Check max size
                    if pos.size + request.size_usd > MAX_POSITION_SIZE {
                        return Ok(TradeResponse {
                            success: false,
                            trade_id,
                            symbol: request.symbol,
                            side: request.side,
                            action: request.action,
                            size_usd: request.size_usd,
                            price,
                            realized_pnl: None,
                            new_balance: state.balance,
                            error: Some(format!("Max position size is ${}", MAX_POSITION_SIZE)),
                        });
                    }

                    // Calculate new average entry
                    let old_cost = pos.size;
                    let new_cost = request.size_usd;
                    let total_size = old_cost + new_cost;
                    pos.entry_price =
                        (pos.entry_price * old_cost + price * new_cost) / total_size;
                    pos.size = total_size;

                    state.balance -= margin_required;
                } else {
                    return Ok(TradeResponse {
                        success: false,
                        trade_id,
                        symbol: request.symbol,
                        side: request.side,
                        action: request.action,
                        size_usd: request.size_usd,
                        price,
                        realized_pnl: None,
                        new_balance: state.balance,
                        error: Some("No position to increase".to_string()),
                    });
                }
            }

            TradeAction::Decrease => {
                let pos = state
                    .positions
                    .iter_mut()
                    .find(|p| p.symbol == request.symbol);

                if let Some(pos) = pos {
                    let close_size = request.size_usd.min(pos.size);
                    let close_ratio = close_size / pos.size;

                    // Calculate partial P&L
                    let pnl = match pos.side {
                        PositionSide::Long => {
                            (price - pos.entry_price) / pos.entry_price * close_size
                        }
                        PositionSide::Short => {
                            (pos.entry_price - price) / pos.entry_price * close_size
                        }
                    };

                    // Return partial margin + P&L
                    let margin_return = close_size / pos.leverage;
                    state.balance += margin_return + pnl;
                    state.pnl += pnl;
                    realized_pnl = Some(pnl);

                    pos.size -= close_size;

                    // Remove if fully closed
                    if pos.size < 0.01 {
                        state.positions.retain(|p| p.symbol != request.symbol);
                    }
                } else {
                    return Ok(TradeResponse {
                        success: false,
                        trade_id,
                        symbol: request.symbol,
                        side: request.side,
                        action: request.action,
                        size_usd: request.size_usd,
                        price,
                        realized_pnl: None,
                        new_balance: state.balance,
                        error: Some("No position to decrease".to_string()),
                    });
                }
            }
        }

        state.trades_count += 1;

        // Record trade
        let record = TradeRecord {
            trade_id: trade_id.clone(),
            match_id: match_id.to_string(),
            agent_id: request.agent_id,
            symbol: request.symbol.clone(),
            side: request.side,
            action: request.action,
            size_usd: request.size_usd,
            price,
            leverage,
            realized_pnl,
            timestamp: chrono::Utc::now().timestamp() as u64,
        };

        drop(states); // Release lock before acquiring trades lock

        let mut trades = self.trades.write().await;
        if let Some(match_trades) = trades.get_mut(match_id) {
            match_trades.push(record);
        }

        let states = self.states.read().await;
        let new_balance = states
            .get(match_id)
            .and_then(|m| m.get(&request.agent_id))
            .map(|s| s.balance)
            .unwrap_or(0.0);

        Ok(TradeResponse {
            success: true,
            trade_id,
            symbol: request.symbol,
            side: request.side,
            action: request.action,
            size_usd: request.size_usd,
            price,
            realized_pnl,
            new_balance,
            error: None,
        })
    }

    /// Update all positions with current prices
    pub async fn update_positions(&self, match_id: &str) -> Result<()> {
        let mut states = self.states.write().await;
        let match_states = states.get_mut(match_id).ok_or_else(|| {
            AppError::NotFound("Match not found".to_string())
        })?;

        for state in match_states.values_mut() {
            for pos in &mut state.positions {
                if let Some(price) = self.price_feed.get_price(&pos.symbol).await {
                    pos.current_price = price;
                    pos.unrealized_pnl = match pos.side {
                        PositionSide::Long => {
                            (price - pos.entry_price) / pos.entry_price * pos.size
                        }
                        PositionSide::Short => {
                            (pos.entry_price - price) / pos.entry_price * pos.size
                        }
                    };
                }
            }
        }

        Ok(())
    }

    /// Get agent state for a match
    pub async fn get_agent_state(&self, match_id: &str, agent_id: u64) -> Option<AgentMatchState> {
        let states = self.states.read().await;
        states
            .get(match_id)
            .and_then(|m| m.get(&agent_id))
            .cloned()
    }

    /// Get both agent states for a match
    pub async fn get_match_states(
        &self,
        match_id: &str,
    ) -> Option<(AgentMatchState, AgentMatchState)> {
        let states = self.states.read().await;
        let match_states = states.get(match_id)?;

        let mut agents: Vec<_> = match_states.values().cloned().collect();
        if agents.len() != 2 {
            return None;
        }

        agents.sort_by_key(|a| a.agent_id);
        Some((agents.remove(0), agents.remove(0)))
    }

    /// Close all positions and calculate final P&L
    pub async fn close_all_positions(&self, match_id: &str) -> Result<(i64, i64)> {
        let mut states = self.states.write().await;
        let match_states = states.get_mut(match_id).ok_or_else(|| {
            AppError::NotFound("Match not found".to_string())
        })?;

        let mut results: Vec<(u64, i64)> = vec![];

        for (agent_id, state) in match_states.iter_mut() {
            // Close each position at current price
            for pos in state.positions.drain(..) {
                let price = self
                    .price_feed
                    .get_price(&pos.symbol)
                    .await
                    .unwrap_or(pos.current_price);

                let pnl = match pos.side {
                    PositionSide::Long => (price - pos.entry_price) / pos.entry_price * pos.size,
                    PositionSide::Short => (pos.entry_price - price) / pos.entry_price * pos.size,
                };

                let margin = pos.size / pos.leverage;
                state.balance += margin + pnl;
                state.pnl += pnl;
            }

            // Convert to USDC micro units (6 decimals)
            let pnl_usdc = (state.pnl * 1_000_000.0) as i64;
            results.push((*agent_id, pnl_usdc));
        }

        results.sort_by_key(|(id, _)| *id);

        if results.len() != 2 {
            return Err(AppError::Internal("Invalid match state".to_string()));
        }

        Ok((results[0].1, results[1].1))
    }

    /// Get trade history for a match
    pub async fn get_trades(&self, match_id: &str) -> Vec<TradeRecord> {
        let trades = self.trades.read().await;
        trades.get(match_id).cloned().unwrap_or_default()
    }

    /// Clean up match data
    pub async fn cleanup_match(&self, match_id: &str) {
        let mut states = self.states.write().await;
        states.remove(match_id);

        let mut trades = self.trades.write().await;
        trades.remove(match_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_engine() -> TradeEngine {
        let price_feed = Arc::new(PriceFeed::new());
        TradeEngine::new(price_feed)
    }

    #[tokio::test]
    async fn test_init_match() {
        let engine = create_test_engine();
        engine.init_match("test-match", 1, 2).await;

        let state1 = engine.get_agent_state("test-match", 1).await;
        let state2 = engine.get_agent_state("test-match", 2).await;

        assert!(state1.is_some());
        assert!(state2.is_some());

        let state1 = state1.unwrap();
        assert_eq!(state1.balance, INITIAL_BALANCE);
        assert_eq!(state1.pnl, 0.0);
        assert!(state1.positions.is_empty());
    }

    #[tokio::test]
    async fn test_unsupported_symbol() {
        let engine = create_test_engine();
        engine.init_match("test-match", 1, 2).await;

        let request = TradeRequest {
            agent_id: 1,
            symbol: "INVALID".to_string(),
            action: TradeAction::Open,
            side: TradeSide::Long,
            size_usd: 1000.0,
            leverage: Some(2.0),
        };

        let response = engine.execute_trade("test-match", request).await.unwrap();
        assert!(!response.success);
        assert!(response.error.unwrap().contains("Unsupported"));
    }

    #[tokio::test]
    async fn test_min_trade_size() {
        let engine = create_test_engine();
        engine.init_match("test-match", 1, 2).await;

        let request = TradeRequest {
            agent_id: 1,
            symbol: "BTC".to_string(),
            action: TradeAction::Open,
            side: TradeSide::Long,
            size_usd: 0.5, // Below MIN_TRADE_SIZE
            leverage: Some(1.0),
        };

        let response = engine.execute_trade("test-match", request).await.unwrap();
        assert!(!response.success);
        assert!(response.error.unwrap().contains("Minimum"));
    }

    #[tokio::test]
    async fn test_max_leverage_capped() {
        // Test that leverage is capped at MAX_LEVERAGE
        let requested_leverage: f64 = 10.0;
        let capped = requested_leverage.min(MAX_LEVERAGE).max(1.0);
        assert_eq!(capped, MAX_LEVERAGE);
    }

    #[tokio::test]
    async fn test_pnl_calculation_long_profit() {
        // Long position profit calculation
        let entry_price: f64 = 50000.0;
        let current_price: f64 = 52500.0; // 5% increase
        let size: f64 = 1000.0;

        let pnl = (current_price - entry_price) / entry_price * size;

        // 5% of $1000 = $50
        assert!((pnl - 50.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_pnl_calculation_long_loss() {
        // Long position loss calculation
        let entry_price: f64 = 50000.0;
        let current_price: f64 = 47500.0; // 5% decrease
        let size: f64 = 1000.0;

        let pnl = (current_price - entry_price) / entry_price * size;

        // -5% of $1000 = -$50
        assert!((pnl + 50.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_pnl_calculation_short_profit() {
        // Short position profit calculation
        let entry_price: f64 = 50000.0;
        let current_price: f64 = 47500.0; // 5% decrease (profit for short)
        let size: f64 = 1000.0;

        let pnl = (entry_price - current_price) / entry_price * size;

        // 5% of $1000 = $50
        assert!((pnl - 50.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_pnl_calculation_short_loss() {
        // Short position loss calculation
        let entry_price: f64 = 50000.0;
        let current_price: f64 = 52500.0; // 5% increase (loss for short)
        let size: f64 = 1000.0;

        let pnl = (entry_price - current_price) / entry_price * size;

        // -5% of $1000 = -$50
        assert!((pnl + 50.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_leverage_multiplies_pnl() {
        let entry_price: f64 = 50000.0;
        let current_price: f64 = 51000.0; // 2% increase
        let size: f64 = 1000.0;
        let leverage: f64 = 5.0;

        let pnl_no_leverage = (current_price - entry_price) / entry_price * size;
        let pnl_with_leverage = pnl_no_leverage * leverage;

        // 2% * $1000 * 5x = $100
        assert!((pnl_with_leverage - 100.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_margin_calculation() {
        let size = 5000.0;
        let leverage = 5.0;
        let margin_required = size / leverage;

        // $5000 position at 5x requires $1000 margin
        assert_eq!(margin_required, 1000.0);
    }

    #[tokio::test]
    async fn test_close_nonexistent_position() {
        let engine = create_test_engine();
        engine.init_match("test-match", 1, 2).await;

        let request = TradeRequest {
            agent_id: 1,
            symbol: "BTC".to_string(),
            action: TradeAction::Close,
            side: TradeSide::Long,
            size_usd: 1000.0,
            leverage: None,
        };

        let response = engine.execute_trade("test-match", request).await.unwrap();
        assert!(!response.success);
        assert!(response.error.unwrap().contains("No position"));
    }

    #[tokio::test]
    async fn test_match_not_found() {
        let engine = create_test_engine();

        let request = TradeRequest {
            agent_id: 1,
            symbol: "BTC".to_string(),
            action: TradeAction::Open,
            side: TradeSide::Long,
            size_usd: 1000.0,
            leverage: Some(2.0),
        };

        let result = engine.execute_trade("nonexistent", request).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_match_states() {
        let engine = create_test_engine();
        engine.init_match("test-match", 1, 2).await;

        let states = engine.get_match_states("test-match").await;
        assert!(states.is_some());

        let (state1, state2) = states.unwrap();
        assert_eq!(state1.agent_id, 1);
        assert_eq!(state2.agent_id, 2);
    }

    #[tokio::test]
    async fn test_cleanup_match() {
        let engine = create_test_engine();
        engine.init_match("test-match", 1, 2).await;

        // Verify match exists
        assert!(engine.get_agent_state("test-match", 1).await.is_some());

        engine.cleanup_match("test-match").await;

        // Verify match is cleaned up
        assert!(engine.get_agent_state("test-match", 1).await.is_none());
    }
}
