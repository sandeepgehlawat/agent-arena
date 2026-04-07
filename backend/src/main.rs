use axum::{
    routing::{get, post},
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod error;
mod models;
mod routes;
mod services;

use services::{
    match_service::MatchService,
    oracle_service::OracleService,
    price_feed::PriceFeed,
    trade_engine::TradeEngine,
    x402_service::X402Service,
};

#[derive(Clone)]
pub struct AppState {
    pub match_service: Arc<MatchService>,
    pub trade_engine: Arc<TradeEngine>,
    pub price_feed: Arc<PriceFeed>,
    pub x402_service: Arc<X402Service>,
    pub oracle_service: Arc<OracleService>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "agent_arena_backend=debug,tower_http=debug".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let rpc_url = std::env::var("XLAYER_RPC").unwrap_or_else(|_| "https://rpc.xlayer.tech".to_string());
    let usdc_address = std::env::var("USDC_ADDRESS")
        .unwrap_or_else(|_| "0x74b7F16337b8972027F6196A17a631aC6dE26d22".to_string());
    let platform_wallet = std::env::var("PLATFORM_WALLET").unwrap_or_default();

    // Initialize services
    let price_feed = Arc::new(PriceFeed::new());
    let trade_engine = Arc::new(TradeEngine::new(price_feed.clone()));
    let match_service = Arc::new(MatchService::new(trade_engine.clone()));
    let oracle_service = Arc::new(OracleService::new(
        rpc_url.clone(),
        std::env::var("MATCH_MANAGER").ok(),
        std::env::var("ORACLE_PRIVATE_KEY").ok(),
    ));

    let x402_service = Arc::new(X402Service::new(
        std::env::var("OKX_API_KEY").unwrap_or_default(),
        std::env::var("OKX_API_SECRET").unwrap_or_default(),
        std::env::var("OKX_PASSPHRASE").unwrap_or_default(),
        rpc_url,
        usdc_address,
        platform_wallet,
    ));

    let state = AppState {
        match_service,
        trade_engine,
        price_feed: price_feed.clone(),
        x402_service,
        oracle_service,
    };

    // Start price feed
    let pf = price_feed.clone();
    tokio::spawn(async move {
        if let Err(e) = pf.start().await {
            tracing::error!("Price feed error: {:?}", e);
        }
    });

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(routes::health::health_check))
        // Arena registration
        .route("/api/arena/register", post(routes::arena::register_for_arena))
        .route("/api/arena/stats/:agent_id", get(routes::arena::get_stats))
        // Matches
        .route("/api/matches/challenge", post(routes::matches::create_challenge))
        .route("/api/matches/:match_id/accept", post(routes::matches::accept_challenge))
        .route("/api/matches/:match_id/trade", post(routes::matches::submit_trade))
        .route("/api/matches/:match_id/state", get(routes::matches::get_match_state))
        .route("/api/matches/:match_id", get(routes::matches::get_match))
        // Leaderboard
        .route("/api/leaderboard", get(routes::leaderboard::get_leaderboard))
        .route("/api/leaderboard/season", get(routes::leaderboard::get_season_leaderboard))
        // Prices
        .route("/api/prices", get(routes::prices::get_prices))
        // WebSocket for live match updates
        .route("/ws/matches/:match_id", get(routes::ws::match_websocket))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    // Start server
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3460".to_string())
        .parse()
        .unwrap_or(3460);

    let addr = format!("{}:{}", host, port).parse::<SocketAddr>().unwrap();
    tracing::info!("AgentArena backend listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
