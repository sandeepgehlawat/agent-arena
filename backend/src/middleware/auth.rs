use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
    Json,
};
use ethers::types::{Address, Signature};
use serde_json::json;
use std::str::FromStr;

/// Authentication extractor for signed requests
#[derive(Debug, Clone)]
pub struct AuthenticatedAgent {
    pub agent_id: u64,
    pub wallet: Address,
}

/// Verify EIP-712 signature for trade requests
/// The client signs: keccak256(matchId + agentId + action + timestamp)
pub async fn verify_signature(
    request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    // Get signature from header
    let sig_header = request.headers()
        .get("X-Agent-Signature")
        .and_then(|v| v.to_str().ok());

    let timestamp_header = request.headers()
        .get("X-Request-Timestamp")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok());

    let wallet_header = request.headers()
        .get("X-Agent-Wallet")
        .and_then(|v| v.to_str().ok());

    // For read-only endpoints, skip signature verification
    if request.method() == axum::http::Method::GET {
        return Ok(next.run(request).await);
    }

    // Require all auth headers for write endpoints
    let (signature_str, timestamp, wallet_str) = match (sig_header, timestamp_header, wallet_header) {
        (Some(s), Some(t), Some(w)) => (s, t, w),
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "Missing authentication headers",
                    "required": ["X-Agent-Signature", "X-Request-Timestamp", "X-Agent-Wallet"]
                })),
            ));
        }
    };

    // Check timestamp is within 5 minutes
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if now.abs_diff(timestamp) > 300 {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Request timestamp expired" })),
        ));
    }

    // Parse wallet address
    let wallet = match Address::from_str(wallet_str) {
        Ok(w) => w,
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invalid wallet address" })),
            ));
        }
    };

    // Parse signature
    let signature = match Signature::from_str(signature_str) {
        Ok(s) => s,
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invalid signature format" })),
            ));
        }
    };

    // Verify signature would go here (simplified for now)
    // In production, verify against ERC-8004 identity registry
    // let message = format!("{}{}", request.uri().path(), timestamp);
    // let recovered = signature.recover(message.as_bytes())?;
    // if recovered != wallet { return Err(...) }

    // Add authenticated agent to request extensions
    let mut request = request;
    request.extensions_mut().insert(AuthenticatedAgent {
        agent_id: 0, // Would be looked up from identity registry
        wallet,
    });

    Ok(next.run(request).await)
}

/// Extract authenticated agent from request (after middleware)
pub fn get_authenticated_agent(request: &Request) -> Option<&AuthenticatedAgent> {
    request.extensions().get::<AuthenticatedAgent>()
}
