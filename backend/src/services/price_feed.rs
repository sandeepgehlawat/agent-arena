use crate::error::{AppError, Result};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Real-time price feed from Binance WebSocket
pub struct PriceFeed {
    prices: Arc<RwLock<HashMap<String, f64>>>,
    subscribers: Arc<RwLock<Vec<tokio::sync::broadcast::Sender<PriceUpdate>>>>,
    connected: Arc<RwLock<bool>>,
    last_update: Arc<RwLock<u64>>,
}

#[derive(Debug, Clone)]
pub struct PriceUpdate {
    pub symbol: String,
    pub price: f64,
    pub timestamp: u64,
}

#[derive(Debug, Deserialize)]
struct BinanceTickerStream {
    stream: String,
    data: BinanceTicker,
}

#[derive(Debug, Deserialize)]
struct BinanceTicker {
    #[serde(rename = "s")]
    symbol: String,
    #[serde(rename = "c")]
    price: String,
    #[serde(rename = "E")]
    event_time: u64,
}

impl PriceFeed {
    pub fn new() -> Self {
        Self {
            prices: Arc::new(RwLock::new(HashMap::new())),
            subscribers: Arc::new(RwLock::new(Vec::new())),
            connected: Arc::new(RwLock::new(false)),
            last_update: Arc::new(RwLock::new(0)),
        }
    }

    /// Check if the price feed is connected and receiving data
    pub async fn is_connected(&self) -> bool {
        let connected = *self.connected.read().await;
        if !connected {
            return false;
        }

        // Also check that we've received data recently (within 30 seconds)
        let last_update = *self.last_update.read().await;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        now - last_update < 30
    }

    /// Start the price feed connection
    pub async fn start(&self) -> Result<()> {
        // Binance combined stream for BTC, ETH, SOL
        let url = "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker";

        loop {
            match self.connect_and_stream(url).await {
                Ok(_) => {
                    tracing::info!("Price feed disconnected, reconnecting...");
                }
                Err(e) => {
                    tracing::error!("Price feed error: {:?}, reconnecting in 5s...", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }
            }
        }
    }

    async fn connect_and_stream(&self, url: &str) -> Result<()> {
        tracing::info!("Connecting to Binance WebSocket...");

        let (ws_stream, _) = connect_async(url)
            .await
            .map_err(|e| AppError::Internal(format!("WebSocket connect error: {}", e)))?;

        tracing::info!("Connected to Binance price feed");

        // Mark as connected
        {
            let mut connected = self.connected.write().await;
            *connected = true;
        }

        let (mut write, mut read) = ws_stream.split();

        // Clone references for the loop
        let prices = self.prices.clone();
        let subscribers = self.subscribers.clone();
        let last_update = self.last_update.clone();
        let connected = self.connected.clone();

        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Ok(ticker) = serde_json::from_str::<BinanceTickerStream>(&text) {
                        let symbol = ticker.data.symbol.replace("USDT", "");
                        if let Ok(price) = ticker.data.price.parse::<f64>() {
                            // Update price
                            {
                                let mut prices = prices.write().await;
                                prices.insert(symbol.clone(), price);
                            }

                            // Update last_update timestamp
                            {
                                let mut lu = last_update.write().await;
                                *lu = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_secs();
                            }

                            // Notify subscribers
                            let update = PriceUpdate {
                                symbol: symbol.clone(),
                                price,
                                timestamp: ticker.data.event_time,
                            };

                            let subs = subscribers.read().await;
                            for sub in subs.iter() {
                                let _ = sub.send(update.clone());
                            }
                        }
                    }
                }
                Ok(Message::Ping(data)) => {
                    let _ = write.send(Message::Pong(data)).await;
                }
                Ok(Message::Close(_)) => {
                    tracing::warn!("WebSocket closed by server");
                    break;
                }
                Err(e) => {
                    tracing::error!("WebSocket error: {:?}", e);
                    break;
                }
                _ => {}
            }
        }

        // Mark as disconnected
        {
            let mut connected = connected.write().await;
            *connected = false;
        }

        Ok(())
    }

    /// Get current price for a symbol
    pub async fn get_price(&self, symbol: &str) -> Option<f64> {
        let prices = self.prices.read().await;
        prices.get(symbol).copied()
    }

    /// Get all current prices
    pub async fn get_all_prices(&self) -> HashMap<String, f64> {
        self.prices.read().await.clone()
    }

    /// Subscribe to price updates
    pub async fn subscribe(&self) -> tokio::sync::broadcast::Receiver<PriceUpdate> {
        let (tx, rx) = tokio::sync::broadcast::channel(100);
        let mut subs = self.subscribers.write().await;
        subs.push(tx);
        rx
    }

    /// Get price or fetch from HTTP fallback
    pub async fn get_price_or_fetch(&self, symbol: &str) -> Result<f64> {
        if let Some(price) = self.get_price(symbol).await {
            return Ok(price);
        }

        // Fallback to HTTP API
        let url = format!(
            "https://api.binance.com/api/v3/ticker/price?symbol={}USDT",
            symbol
        );

        let response: serde_json::Value = reqwest::get(&url)
            .await
            .map_err(|e| AppError::Internal(format!("Binance API error: {}", e)))?
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Parse error: {}", e)))?;

        let price = response["price"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .ok_or_else(|| AppError::Internal("Invalid price response".to_string()))?;

        // Cache it
        {
            let mut prices = self.prices.write().await;
            prices.insert(symbol.to_string(), price);
        }

        Ok(price)
    }
}

impl Default for PriceFeed {
    fn default() -> Self {
        Self::new()
    }
}
