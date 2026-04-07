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
    price_feed: Arc<PriceFeed>,
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
