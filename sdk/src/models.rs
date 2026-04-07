use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Agent types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStats {
    pub agent_id: u64,
    pub elo: u64,
    pub wins: u64,
    pub losses: u64,
    pub draws: u64,
    pub total_pnl_usdc: i64,
    pub trading_endpoint: String,
    pub registered: bool,
    pub registered_at: u64,
    pub last_match_at: u64,
}

// Match types

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MatchStatus {
    Created,
    Funded,
    InProgress,
    Completed,
    Settled,
    Cancelled,
    Disputed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub match_id: String,
    pub agent1_id: u64,
    pub agent2_id: u64,
    pub tier: u64,
    pub entry_fee: u64,
    pub prize_pool: u64,
    pub agent1_funded: bool,
    pub agent2_funded: bool,
    pub status: MatchStatus,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub ended_at: Option<u64>,
    pub agent1_pnl: Option<i64>,
    pub agent2_pnl: Option<i64>,
    pub winner_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeResponse {
    pub match_id: String,
    pub entry_fee: u64,
    pub payment_required: Option<PaymentRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchState {
    pub match_id: String,
    pub status: MatchStatus,
    pub time_remaining_secs: u64,
    pub agent1_state: AgentMatchState,
    pub agent2_state: AgentMatchState,
    pub prices: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMatchState {
    pub agent_id: u64,
    pub balance: f64,
    pub positions: Vec<Position>,
    pub pnl: f64,
    pub trades_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub symbol: String,
    pub side: PositionSide,
    pub size: f64,
    pub entry_price: f64,
    pub current_price: f64,
    pub unrealized_pnl: f64,
    pub leverage: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PositionSide {
    Long,
    Short,
}

// Trade types

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TradeAction {
    Open,
    Close,
    Increase,
    Decrease,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TradeSide {
    Long,
    Short,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeRequest {
    pub agent_id: u64,
    pub symbol: String,
    pub action: TradeAction,
    pub side: TradeSide,
    pub size_usd: f64,
    pub leverage: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeResponse {
    pub success: bool,
    pub trade_id: String,
    pub symbol: String,
    pub side: TradeSide,
    pub action: TradeAction,
    pub size_usd: f64,
    pub price: f64,
    pub realized_pnl: Option<f64>,
    pub new_balance: f64,
    pub error: Option<String>,
}

// Payment types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentRequest {
    pub network: String,
    pub token: String,
    pub amount: u64,
    pub recipient: String,
    pub nonce: String,
    pub expires: u64,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentProof {
    pub nonce: String,
    pub tx_hash: String,
}

// Leaderboard types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub agent_id: u64,
    pub elo: u64,
    pub wins: u64,
    pub losses: u64,
    pub win_rate: f64,
    pub total_pnl: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Leaderboard {
    pub entries: Vec<LeaderboardEntry>,
    pub total_agents: u64,
}

// WebSocket message types

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    #[serde(rename = "state")]
    State { data: MatchState },
    #[serde(rename = "trade")]
    Trade { data: TradeEvent },
    #[serde(rename = "started")]
    Started,
    #[serde(rename = "ended")]
    Ended { data: MatchEndEvent },
    #[serde(rename = "error")]
    Error { error: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeEvent {
    pub agent_id: u64,
    pub symbol: String,
    pub side: String,
    pub size: f64,
    pub price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchEndEvent {
    pub winner_id: Option<u64>,
    pub agent1_pnl: i64,
    pub agent2_pnl: i64,
}
