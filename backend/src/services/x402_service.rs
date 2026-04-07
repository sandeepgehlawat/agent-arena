use crate::error::{AppError, Result};
use crate::models::{
    OkxTransferRequest, OkxTransferResponse, PaymentNonce, X402PaymentProof, X402PaymentRequest,
    X402VerificationResult,
};
use base64::Engine;
use hmac::{Hmac, Mac};
use reqwest::Client;
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

type HmacSha256 = Hmac<Sha256>;

/// x402 Payment Service for OKX OnchainOS integration
#[derive(Clone)]
pub struct X402Service {
    okx_api_key: String,
    okx_api_secret: String,
    okx_passphrase: String,
    rpc_url: String,
    usdc_address: String,
    platform_wallet: String,
    http_client: Client,
    nonces: Arc<RwLock<HashMap<String, PaymentNonce>>>,
}

impl X402Service {
    pub fn new(
        okx_api_key: String,
        okx_api_secret: String,
        okx_passphrase: String,
        rpc_url: String,
        usdc_address: String,
        platform_wallet: String,
    ) -> Self {
        Self {
            okx_api_key,
            okx_api_secret,
            okx_passphrase,
            rpc_url,
            usdc_address,
            platform_wallet,
            http_client: Client::new(),
            nonces: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a payment request for x402 response
    pub async fn create_payment_request(
        &self,
        amount_usdc: u64,
        recipient: &str,
        match_id: Option<String>,
        agent_id: Option<u64>,
        description: Option<String>,
    ) -> Result<X402PaymentRequest> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let nonce = format!("{:032x}", rand::random::<u128>());
        let expires = now + 300; // 5 minutes

        let request = X402PaymentRequest {
            network: "xlayer".to_string(),
            token: "USDC".to_string(),
            amount: amount_usdc,
            recipient: recipient.to_string(),
            nonce: nonce.clone(),
            expires,
            description,
        };

        // Cache nonce for verification
        let mut nonces = self.nonces.write().await;
        nonces.insert(
            nonce.clone(),
            PaymentNonce {
                nonce,
                recipient: recipient.to_string(),
                amount: amount_usdc,
                expires,
                used: false,
                created_at: now,
                match_id,
                agent_id,
            },
        );

        // Clean up expired nonces
        nonces.retain(|_, v| v.expires > now || v.used);

        Ok(request)
    }

    /// Verify a payment proof
    pub async fn verify_payment(&self, proof: &X402PaymentProof) -> Result<X402VerificationResult> {
        let mut nonces = self.nonces.write().await;
        let cached = nonces.get_mut(&proof.nonce);

        if cached.is_none() {
            return Ok(X402VerificationResult {
                valid: false,
                amount_paid: 0,
                recipient: String::new(),
                error: Some("Unknown nonce".to_string()),
            });
        }

        let cached = cached.unwrap();

        if cached.used {
            return Ok(X402VerificationResult {
                valid: false,
                amount_paid: 0,
                recipient: cached.recipient.clone(),
                error: Some("Nonce already used".to_string()),
            });
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if now > cached.expires {
            return Ok(X402VerificationResult {
                valid: false,
                amount_paid: 0,
                recipient: cached.recipient.clone(),
                error: Some("Payment expired".to_string()),
            });
        }

        // Verify transaction on-chain - NO DEV BYPASS IN PRODUCTION
        // Dev payments should use a testnet with real test transactions
        let tx_verified = self.verify_tx_on_chain(&proof.tx_hash, &cached.recipient, cached.amount)
            .await?;

        if !tx_verified {
            return Ok(X402VerificationResult {
                valid: false,
                amount_paid: 0,
                recipient: cached.recipient.clone(),
                error: Some("Transaction verification failed".to_string()),
            });
        }

        cached.used = true;

        Ok(X402VerificationResult {
            valid: true,
            amount_paid: cached.amount,
            recipient: cached.recipient.clone(),
            error: None,
        })
    }

    /// Get payment nonce details
    pub async fn get_nonce(&self, nonce: &str) -> Option<PaymentNonce> {
        let nonces = self.nonces.read().await;
        nonces.get(nonce).cloned()
    }

    /// Verify transaction on-chain via RPC
    async fn verify_tx_on_chain(
        &self,
        tx_hash: &str,
        expected_recipient: &str,
        expected_amount: u64,
    ) -> Result<bool> {
        // Retry up to 3 times for slow indexing
        let mut receipt_value = None;
        for attempt in 0..3 {
            let response = self
                .http_client
                .post(&self.rpc_url)
                .json(&serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "eth_getTransactionReceipt",
                    "params": [tx_hash],
                    "id": 1
                }))
                .send()
                .await
                .map_err(|e| AppError::Internal(format!("RPC error: {}", e)))?;

            let result: serde_json::Value = response
                .json()
                .await
                .map_err(|e| AppError::Internal(format!("RPC parse error: {}", e)))?;

            match result.get("result") {
                Some(r) if !r.is_null() => {
                    receipt_value = Some(r.clone());
                    break;
                }
                _ => {
                    if attempt < 2 {
                        tracing::info!(
                            "[x402] Receipt not found yet, retrying in 2s (attempt {})",
                            attempt + 1
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    }
                }
            }
        }

        let receipt = match receipt_value {
            Some(r) => r,
            None => return Ok(false),
        };

        let status = receipt
            .get("status")
            .and_then(|s| s.as_str())
            .unwrap_or("0x0");

        if status != "0x1" {
            return Ok(false);
        }

        // Parse logs to verify USDC transfer
        let logs = match receipt.get("logs").and_then(|l| l.as_array()) {
            Some(l) => l,
            None => return Ok(false),
        };

        // Transfer(address,address,uint256) topic
        let transfer_topic =
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

        for log in logs {
            let topics = log.get("topics").and_then(|t| t.as_array());
            let address = log.get("address").and_then(|a| a.as_str());

            if let (Some(topics), Some(addr)) = (topics, address) {
                if addr.to_lowercase() != self.usdc_address.to_lowercase() {
                    continue;
                }

                if topics.len() >= 3 {
                    let topic0 = topics[0].as_str().unwrap_or("");
                    if topic0 != transfer_topic {
                        continue;
                    }

                    let recipient = topics[2].as_str().unwrap_or("");
                    if recipient.len() < 42 {
                        continue;
                    }
                    let recipient_addr = format!("0x{}", &recipient[26..]);

                    if recipient_addr.to_lowercase() == expected_recipient.to_lowercase() {
                        let data = log.get("data").and_then(|d| d.as_str()).unwrap_or("0x0");
                        if data.len() < 3 {
                            continue;
                        }
                        let hex = data.trim_start_matches("0x");
                        let trimmed = if hex.len() > 16 {
                            &hex[hex.len() - 16..]
                        } else {
                            hex
                        };
                        let amount = u64::from_str_radix(trimmed, 16).unwrap_or(0);

                        if amount >= expected_amount {
                            return Ok(true);
                        }
                    }
                }
            }
        }

        Ok(false)
    }

    /// Execute payment via OKX Agentic Wallet (for SDK use)
    pub async fn execute_payment(
        &self,
        from_wallet: &str,
        to_wallet: &str,
        amount_usdc: f64,
    ) -> Result<String> {
        let timestamp = chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        let amount_str = format!("{:.6}", amount_usdc);

        let body = OkxTransferRequest {
            from_addr: from_wallet.to_string(),
            to_addr: to_wallet.to_string(),
            token_symbol: "USDC".to_string(),
            token_amount: amount_str,
            chain_id: "196".to_string(),
        };

        let body_str =
            serde_json::to_string(&body).map_err(|e| AppError::Internal(e.to_string()))?;

        let pre_sign = format!("{}POST/api/v5/wallet/transfer{}", timestamp, body_str);
        let signature = self.sign_okx_request(&pre_sign)?;

        let response = self
            .http_client
            .post("https://www.okx.com/api/v5/wallet/transfer")
            .header("OK-ACCESS-KEY", &self.okx_api_key)
            .header("OK-ACCESS-SIGN", &signature)
            .header("OK-ACCESS-TIMESTAMP", &timestamp)
            .header("OK-ACCESS-PASSPHRASE", &self.okx_passphrase)
            .header("Content-Type", "application/json")
            .body(body_str)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("OKX API error: {}", e)))?;

        let result: OkxTransferResponse = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("OKX response parse error: {}", e)))?;

        if result.code != "0" {
            return Err(AppError::Internal(format!("OKX error: {}", result.msg)));
        }

        let tx_hash = result
            .data
            .and_then(|d| d.into_iter().next())
            .and_then(|d| d.tx_hash)
            .ok_or_else(|| AppError::Internal("No tx hash in OKX response".to_string()))?;

        Ok(tx_hash)
    }

    fn sign_okx_request(&self, message: &str) -> Result<String> {
        let mut mac = HmacSha256::new_from_slice(self.okx_api_secret.as_bytes())
            .map_err(|e| AppError::Internal(e.to_string()))?;
        mac.update(message.as_bytes());
        let result = mac.finalize();
        Ok(base64::engine::general_purpose::STANDARD.encode(result.into_bytes()))
    }

    pub fn platform_wallet(&self) -> &str {
        &self.platform_wallet
    }

    pub fn is_configured(&self) -> bool {
        !self.okx_api_key.is_empty() && !self.okx_api_secret.is_empty()
    }
}
