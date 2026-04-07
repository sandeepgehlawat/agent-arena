use crate::error::{Error, Result};
use crate::models::*;
use crate::x402::X402Handler;
use futures::{SinkExt, StreamExt};
use reqwest::{header, Client};
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Arena client for interacting with AgentArena backend
pub struct ArenaClient {
    base_url: String,
    ws_url: String,
    http_client: Client,
    x402_handler: Option<X402Handler>,
    agent_id: Option<u64>,
}

impl ArenaClient {
    /// Create a new client with optional wallet for payments
    pub fn new(base_url: &str, private_key: Option<&str>) -> Result<Self> {
        let base_url = base_url.trim_end_matches('/').to_string();

        // Convert HTTP URL to WebSocket URL
        let ws_url = base_url
            .replace("http://", "ws://")
            .replace("https://", "wss://");

        let x402_handler = if let Some(pk) = private_key {
            Some(X402Handler::new(
                pk,
                "https://rpc.xlayer.tech",
                "0x74b7F16337b8972027F6196A17a631aC6dE26d22", // USDC on XLayer
            )?)
        } else {
            None
        };

        Ok(Self {
            base_url,
            ws_url,
            http_client: Client::new(),
            x402_handler,
            agent_id: None,
        })
    }

    /// Set the agent ID for this client
    pub fn with_agent_id(mut self, agent_id: u64) -> Self {
        self.agent_id = Some(agent_id);
        self
    }

    /// Get agent stats
    pub async fn get_agent_stats(&self, agent_id: u64) -> Result<AgentStats> {
        let url = format!("{}/api/arena/stats/{}", self.base_url, agent_id);

        let response = self
            .http_client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(response.json().await?)
    }

    /// Create a challenge to another agent
    pub async fn create_challenge(
        &self,
        challenger_id: u64,
        challenged_id: u64,
        tier: u64,
    ) -> Result<ChallengeResponse> {
        let url = format!("{}/api/matches/challenge", self.base_url);

        let body = serde_json::json!({
            "challenger_id": challenger_id,
            "challenged_id": challenged_id,
            "tier": tier
        });

        // First request without payment
        let response = self
            .http_client
            .post(&url)
            .json(&body)
            .send()
            .await?;

        // Handle 402 Payment Required
        if response.status().as_u16() == 402 {
            let payment_required: serde_json::Value = response.json().await?;

            // Extract payment request
            let payment_request: PaymentRequest =
                serde_json::from_value(payment_required["payment"].clone())
                    .map_err(|e| Error::Api(format!("Invalid payment request: {}", e)))?;

            // Execute payment if we have a handler
            let handler = self.x402_handler.as_ref().ok_or_else(|| {
                Error::PaymentRequired(format!(
                    "Payment required: {} {} to {}",
                    payment_request.amount, payment_request.token, payment_request.recipient
                ))
            })?;

            let proof = handler.execute_payment(&payment_request).await?;

            // Retry with payment proof
            let proof_json = serde_json::to_string(&proof)?;
            let response = self
                .http_client
                .post(&url)
                .json(&body)
                .header("X-Payment-Proof", proof_json)
                .send()
                .await?;

            if !response.status().is_success() {
                let error: serde_json::Value = response.json().await?;
                return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
            }

            return Ok(response.json().await?);
        }

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(response.json().await?)
    }

    /// Accept a challenge
    pub async fn accept_challenge(&self, match_id: &str, agent_id: u64) -> Result<Match> {
        let url = format!("{}/api/matches/{}/accept", self.base_url, match_id);

        let body = serde_json::json!({
            "agent_id": agent_id
        });

        // First request without payment
        let response = self
            .http_client
            .post(&url)
            .json(&body)
            .send()
            .await?;

        // Handle 402 Payment Required
        if response.status().as_u16() == 402 {
            let payment_required: serde_json::Value = response.json().await?;

            let payment_request: PaymentRequest =
                serde_json::from_value(payment_required["payment"].clone())
                    .map_err(|e| Error::Api(format!("Invalid payment request: {}", e)))?;

            let handler = self.x402_handler.as_ref().ok_or_else(|| {
                Error::PaymentRequired(format!(
                    "Payment required: {} {} to {}",
                    payment_request.amount, payment_request.token, payment_request.recipient
                ))
            })?;

            let proof = handler.execute_payment(&payment_request).await?;

            let proof_json = serde_json::to_string(&proof)?;
            let response = self
                .http_client
                .post(&url)
                .json(&body)
                .header("X-Payment-Proof", proof_json)
                .send()
                .await?;

            if !response.status().is_success() {
                let error: serde_json::Value = response.json().await?;
                return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
            }

            return Ok(response.json().await?);
        }

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(response.json().await?)
    }

    /// Submit a trade during a match
    pub async fn submit_trade(
        &self,
        match_id: &str,
        trade: TradeRequest,
    ) -> Result<TradeResponse> {
        let url = format!("{}/api/matches/{}/trade", self.base_url, match_id);

        let response = self
            .http_client
            .post(&url)
            .json(&trade)
            .send()
            .await?;

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(response.json().await?)
    }

    /// Get current match state
    pub async fn get_match_state(&self, match_id: &str) -> Result<MatchState> {
        let url = format!("{}/api/matches/{}/state", self.base_url, match_id);

        let response = self
            .http_client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(response.json().await?)
    }

    /// Get match details
    pub async fn get_match(&self, match_id: &str) -> Result<Match> {
        let url = format!("{}/api/matches/{}", self.base_url, match_id);

        let response = self
            .http_client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(response.json().await?)
    }

    /// Get current prices
    pub async fn get_prices(&self) -> Result<std::collections::HashMap<String, f64>> {
        let url = format!("{}/api/prices", self.base_url);

        let response = self
            .http_client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        let result: serde_json::Value = response.json().await?;
        let prices: std::collections::HashMap<String, f64> =
            serde_json::from_value(result["prices"].clone())?;

        Ok(prices)
    }

    /// Get leaderboard
    pub async fn get_leaderboard(&self) -> Result<Leaderboard> {
        let url = format!("{}/api/leaderboard", self.base_url);

        let response = self
            .http_client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error: serde_json::Value = response.json().await?;
            return Err(Error::Api(error["error"].as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(response.json().await?)
    }

    /// Subscribe to match updates via WebSocket
    pub async fn subscribe_to_match(
        &self,
        match_id: &str,
    ) -> Result<impl futures::Stream<Item = Result<WsMessage>>> {
        let url = format!("{}/ws/matches/{}", self.ws_url, match_id);

        let (ws_stream, _) = connect_async(&url).await?;
        let (_, read) = ws_stream.split();

        Ok(read.filter_map(|msg| async {
            match msg {
                Ok(Message::Text(text)) => {
                    match serde_json::from_str::<WsMessage>(&text) {
                        Ok(ws_msg) => Some(Ok(ws_msg)),
                        Err(e) => Some(Err(Error::Json(e))),
                    }
                }
                Ok(Message::Close(_)) => None,
                Err(e) => Some(Err(Error::WebSocket(e))),
                _ => None,
            }
        }))
    }

    /// Get USDC balance (if wallet configured)
    pub async fn get_usdc_balance(&self) -> Result<u64> {
        let handler = self
            .x402_handler
            .as_ref()
            .ok_or_else(|| Error::Config("No wallet configured".to_string()))?;

        handler.get_balance().await
    }
}
