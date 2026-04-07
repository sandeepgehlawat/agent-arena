use crate::error::{AppError, Result};
use crate::models::{
    default_tiers, AgentMatchState, Match, MatchState, MatchStatus,
};
use crate::services::trade_engine::TradeEngine;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// Match duration in seconds (15 minutes)
const MATCH_DURATION_SECS: u64 = 900;

/// Challenge timeout in seconds (5 minutes)
const CHALLENGE_TIMEOUT_SECS: u64 = 300;

/// Match lifecycle service
pub struct MatchService {
    trade_engine: Arc<TradeEngine>,
    matches: RwLock<HashMap<String, Match>>,
    // Broadcast channels for match updates
    broadcasters: RwLock<HashMap<String, broadcast::Sender<MatchUpdate>>>,
}

#[derive(Debug, Clone)]
pub enum MatchUpdate {
    StateUpdate(MatchState),
    TradeExecuted {
        agent_id: u64,
        symbol: String,
        side: String,
        size: f64,
        price: f64,
    },
    MatchStarted,
    MatchEnded {
        winner_id: Option<u64>,
        agent1_pnl: i64,
        agent2_pnl: i64,
    },
}

impl MatchService {
    pub fn new(trade_engine: Arc<TradeEngine>) -> Self {
        Self {
            trade_engine,
            matches: RwLock::new(HashMap::new()),
            broadcasters: RwLock::new(HashMap::new()),
        }
    }

    /// Create a new match challenge
    pub async fn create_challenge(
        &self,
        challenger_id: u64,
        challenged_id: u64,
        tier: u64,
    ) -> Result<Match> {
        // Validate tier
        let tiers = default_tiers();
        if tier as usize >= tiers.len() {
            return Err(AppError::BadRequest("Invalid tier".to_string()));
        }

        let entry_fee = tiers[tier as usize].entry_fee_usdc;

        // Check neither agent is in a match
        let matches = self.matches.read().await;
        for m in matches.values() {
            if m.status != MatchStatus::Settled && m.status != MatchStatus::Cancelled {
                if m.agent1_id == challenger_id || m.agent2_id == challenger_id {
                    return Err(AppError::Conflict("Challenger already in a match".to_string()));
                }
                if m.agent1_id == challenged_id || m.agent2_id == challenged_id {
                    return Err(AppError::Conflict("Challenged agent already in a match".to_string()));
                }
            }
        }
        drop(matches);

        // Create match
        let m = Match::new(challenger_id, challenged_id, tier, entry_fee);
        let match_id = m.match_id.clone();

        let mut matches = self.matches.write().await;
        matches.insert(match_id.clone(), m.clone());

        // Create broadcaster
        let (tx, _) = broadcast::channel(100);
        let mut broadcasters = self.broadcasters.write().await;
        broadcasters.insert(match_id, tx);

        Ok(m)
    }

    /// Fund a match (mark agent as having paid)
    pub async fn fund_match(&self, match_id: &str, agent_id: u64) -> Result<Match> {
        let mut matches = self.matches.write().await;
        let m = matches
            .get_mut(match_id)
            .ok_or_else(|| AppError::NotFound("Match not found".to_string()))?;

        if m.status != MatchStatus::Created {
            return Err(AppError::BadRequest("Match not in funding state".to_string()));
        }

        if agent_id == m.agent1_id {
            m.agent1_funded = true;
        } else if agent_id == m.agent2_id {
            m.agent2_funded = true;
        } else {
            return Err(AppError::BadRequest("Agent not in this match".to_string()));
        }

        m.prize_pool += m.entry_fee;

        if m.is_fully_funded() {
            m.status = MatchStatus::Funded;
        }

        Ok(m.clone())
    }

    /// Accept challenge and start match
    pub async fn accept_challenge(&self, match_id: &str) -> Result<Match> {
        let mut matches = self.matches.write().await;
        let m = matches
            .get_mut(match_id)
            .ok_or_else(|| AppError::NotFound("Match not found".to_string()))?;

        if m.status != MatchStatus::Funded {
            return Err(AppError::BadRequest("Match not fully funded".to_string()));
        }

        // Check challenge hasn't expired
        let now = chrono::Utc::now().timestamp() as u64;
        if now > m.created_at + CHALLENGE_TIMEOUT_SECS {
            m.status = MatchStatus::Cancelled;
            return Err(AppError::BadRequest("Challenge expired".to_string()));
        }

        m.status = MatchStatus::InProgress;
        m.started_at = Some(now);

        let match_id_clone = m.match_id.clone();
        let agent1 = m.agent1_id;
        let agent2 = m.agent2_id;
        let m_clone = m.clone();

        drop(matches);

        // Initialize trade engine
        self.trade_engine
            .init_match(&match_id_clone, agent1, agent2)
            .await;

        // Broadcast match start
        self.broadcast_update(&match_id_clone, MatchUpdate::MatchStarted)
            .await;

        // Schedule match end
        let service = self.clone_for_task();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(MATCH_DURATION_SECS)).await;
            if let Err(e) = service.end_match(&match_id_clone).await {
                tracing::error!("Error ending match {}: {:?}", match_id_clone, e);
            }
        });

        Ok(m_clone)
    }

    /// End a match and calculate results
    pub async fn end_match(&self, match_id: &str) -> Result<Match> {
        let mut matches = self.matches.write().await;
        let m = matches
            .get_mut(match_id)
            .ok_or_else(|| AppError::NotFound("Match not found".to_string()))?;

        if m.status != MatchStatus::InProgress {
            return Err(AppError::BadRequest("Match not in progress".to_string()));
        }

        m.status = MatchStatus::Completed;
        m.ended_at = Some(chrono::Utc::now().timestamp() as u64);

        let match_id_str = m.match_id.clone();

        drop(matches);

        // Close all positions and get final P&L
        let (agent1_pnl, agent2_pnl) = self.trade_engine.close_all_positions(&match_id_str).await?;

        let mut matches = self.matches.write().await;
        let m = matches.get_mut(&match_id_str).unwrap();

        m.agent1_pnl = Some(agent1_pnl);
        m.agent2_pnl = Some(agent2_pnl);

        // Determine winner
        if agent1_pnl > agent2_pnl {
            m.winner_id = Some(m.agent1_id);
        } else if agent2_pnl > agent1_pnl {
            m.winner_id = Some(m.agent2_id);
        }
        // If equal, no winner (draw)

        let m_clone = m.clone();

        drop(matches);

        // Broadcast match end
        self.broadcast_update(
            &match_id_str,
            MatchUpdate::MatchEnded {
                winner_id: m_clone.winner_id,
                agent1_pnl,
                agent2_pnl,
            },
        )
        .await;

        Ok(m_clone)
    }

    /// Settle match (mark as settled after on-chain settlement)
    pub async fn settle_match(&self, match_id: &str) -> Result<Match> {
        let mut matches = self.matches.write().await;
        let m = matches
            .get_mut(match_id)
            .ok_or_else(|| AppError::NotFound("Match not found".to_string()))?;

        if m.status != MatchStatus::Completed {
            return Err(AppError::BadRequest("Match not completed".to_string()));
        }

        m.status = MatchStatus::Settled;

        let m_clone = m.clone();
        let match_id_str = m.match_id.clone();

        drop(matches);

        // Cleanup trade engine data
        self.trade_engine.cleanup_match(&match_id_str).await;

        Ok(m_clone)
    }

    /// Get match by ID
    pub async fn get_match(&self, match_id: &str) -> Option<Match> {
        let matches = self.matches.read().await;
        matches.get(match_id).cloned()
    }

    /// Get current match state
    pub async fn get_match_state(&self, match_id: &str) -> Result<MatchState> {
        let matches = self.matches.read().await;
        let m = matches
            .get(match_id)
            .ok_or_else(|| AppError::NotFound("Match not found".to_string()))?;

        // Calculate time remaining
        let time_remaining = if m.status == MatchStatus::InProgress {
            if let Some(started) = m.started_at {
                let now = chrono::Utc::now().timestamp() as u64;
                let end_time = started + MATCH_DURATION_SECS;
                if now < end_time {
                    end_time - now
                } else {
                    0
                }
            } else {
                MATCH_DURATION_SECS
            }
        } else {
            0
        };

        let match_id_str = m.match_id.clone();
        let status = m.status;
        let agent1_id = m.agent1_id;
        let agent2_id = m.agent2_id;

        drop(matches);

        // Get agent states from trade engine
        let agent1_state = self
            .trade_engine
            .get_agent_state(&match_id_str, agent1_id)
            .await
            .unwrap_or(AgentMatchState {
                agent_id: agent1_id,
                ..Default::default()
            });

        let agent2_state = self
            .trade_engine
            .get_agent_state(&match_id_str, agent2_id)
            .await
            .unwrap_or(AgentMatchState {
                agent_id: agent2_id,
                ..Default::default()
            });

        // Get current prices
        let prices = self
            .trade_engine
            .price_feed
            .get_all_prices()
            .await;

        Ok(MatchState {
            match_id: match_id_str,
            status,
            time_remaining_secs: time_remaining,
            agent1_state,
            agent2_state,
            prices,
        })
    }

    /// Subscribe to match updates
    pub async fn subscribe(&self, match_id: &str) -> Option<broadcast::Receiver<MatchUpdate>> {
        let broadcasters = self.broadcasters.read().await;
        broadcasters.get(match_id).map(|tx| tx.subscribe())
    }

    /// Broadcast an update to all subscribers
    pub async fn broadcast_update(&self, match_id: &str, update: MatchUpdate) {
        let broadcasters = self.broadcasters.read().await;
        if let Some(tx) = broadcasters.get(match_id) {
            let _ = tx.send(update);
        }
    }

    /// Check for expired challenges
    pub async fn cleanup_expired_challenges(&self) {
        let now = chrono::Utc::now().timestamp() as u64;
        let mut matches = self.matches.write().await;

        for m in matches.values_mut() {
            if m.status == MatchStatus::Created || m.status == MatchStatus::Funded {
                if now > m.created_at + CHALLENGE_TIMEOUT_SECS {
                    m.status = MatchStatus::Cancelled;
                }
            }
        }
    }

    /// Get price feed reference
    pub fn price_feed(&self) -> &Arc<crate::services::price_feed::PriceFeed> {
        &self.trade_engine.price_feed
    }

    fn clone_for_task(&self) -> MatchServiceHandle {
        MatchServiceHandle {
            matches: self.matches.clone(),
            trade_engine: self.trade_engine.clone(),
            broadcasters: self.broadcasters.clone(),
        }
    }
}

// Helper struct for spawned tasks
struct MatchServiceHandle {
    matches: RwLock<HashMap<String, Match>>,
    trade_engine: Arc<TradeEngine>,
    broadcasters: RwLock<HashMap<String, broadcast::Sender<MatchUpdate>>>,
}

impl MatchServiceHandle {
    async fn end_match(&self, match_id: &str) -> Result<()> {
        let mut matches = self.matches.write().await;
        let m = matches.get_mut(match_id);

        if m.is_none() {
            return Ok(());
        }

        let m = m.unwrap();
        if m.status != MatchStatus::InProgress {
            return Ok(());
        }

        m.status = MatchStatus::Completed;
        m.ended_at = Some(chrono::Utc::now().timestamp() as u64);

        let match_id_str = m.match_id.clone();
        let agent1_id = m.agent1_id;
        let agent2_id = m.agent2_id;

        drop(matches);

        // Close all positions
        let (agent1_pnl, agent2_pnl) = self.trade_engine.close_all_positions(&match_id_str).await?;

        let mut matches = self.matches.write().await;
        if let Some(m) = matches.get_mut(&match_id_str) {
            m.agent1_pnl = Some(agent1_pnl);
            m.agent2_pnl = Some(agent2_pnl);

            if agent1_pnl > agent2_pnl {
                m.winner_id = Some(agent1_id);
            } else if agent2_pnl > agent1_pnl {
                m.winner_id = Some(agent2_id);
            }
        }

        drop(matches);

        // Broadcast
        let broadcasters = self.broadcasters.read().await;
        if let Some(tx) = broadcasters.get(&match_id_str) {
            let _ = tx.send(MatchUpdate::MatchEnded {
                winner_id: if agent1_pnl > agent2_pnl {
                    Some(agent1_id)
                } else if agent2_pnl > agent1_pnl {
                    Some(agent2_id)
                } else {
                    None
                },
                agent1_pnl,
                agent2_pnl,
            });
        }

        Ok(())
    }
}

// Make RwLock cloneable
impl Clone for MatchServiceHandle {
    fn clone(&self) -> Self {
        Self {
            matches: RwLock::new(HashMap::new()), // Not a real clone, just for the task
            trade_engine: self.trade_engine.clone(),
            broadcasters: RwLock::new(HashMap::new()),
        }
    }
}
