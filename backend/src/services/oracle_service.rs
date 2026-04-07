use crate::error::{AppError, Result};
use ethers::{
    prelude::*,
    types::{Address, H256, U256},
};
use std::sync::Arc;

abigen!(
    MatchManagerContract,
    r#"[
        function submitResult(bytes32 matchId, int256 agent1Pnl, int256 agent2Pnl, bytes32 resultHash) external
        function settleMatch(bytes32 matchId) external
    ]"#
);

/// Oracle service for submitting match results on-chain
pub struct OracleService {
    rpc_url: String,
    contract_address: Option<String>,
    private_key: Option<String>,
}

impl OracleService {
    pub fn new(
        rpc_url: String,
        contract_address: Option<String>,
        private_key: Option<String>,
    ) -> Self {
        Self {
            rpc_url,
            contract_address,
            private_key,
        }
    }

    /// Submit match result on-chain
    pub async fn submit_result(
        &self,
        match_id: &str,
        agent1_pnl: i64,
        agent2_pnl: i64,
    ) -> Result<String> {
        let contract_address = self
            .contract_address
            .as_ref()
            .ok_or_else(|| AppError::Internal("Contract address not configured".to_string()))?;

        let private_key = self
            .private_key
            .as_ref()
            .ok_or_else(|| AppError::Internal("Oracle private key not configured".to_string()))?;

        // Create provider
        let provider = Provider::<Http>::try_from(&self.rpc_url)
            .map_err(|e| AppError::Internal(format!("Provider error: {}", e)))?;

        // Create wallet
        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e| AppError::Internal(format!("Invalid private key: {}", e)))?;

        let wallet = wallet.with_chain_id(196u64); // XLayer chain ID

        let client = SignerMiddleware::new(provider.clone(), wallet);
        let client = Arc::new(client);

        // Parse contract address
        let contract_addr: Address = contract_address
            .parse()
            .map_err(|e| AppError::Internal(format!("Invalid contract address: {}", e)))?;

        let contract = MatchManagerContract::new(contract_addr, client);

        // Convert match_id to bytes32
        let match_id_bytes: [u8; 32] = if match_id.starts_with("0x") {
            hex::decode(&match_id[2..])
                .map_err(|e| AppError::Internal(format!("Invalid match ID: {}", e)))?
                .try_into()
                .map_err(|_| AppError::Internal("Match ID must be 32 bytes".to_string()))?
        } else {
            // Hash the match ID string to get bytes32
            let hash = ethers::utils::keccak256(match_id.as_bytes());
            hash
        };

        // Create result hash (hash of results for verification)
        let result_hash = ethers::utils::keccak256(
            ethers::abi::encode(&[
                ethers::abi::Token::Int(I256::from(agent1_pnl).into_raw()),
                ethers::abi::Token::Int(I256::from(agent2_pnl).into_raw()),
            ])
        );

        // Submit result
        let call = contract.submit_result(
            match_id_bytes,
            I256::from(agent1_pnl),
            I256::from(agent2_pnl),
            result_hash,
        );

        let pending_tx = call
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Transaction error: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();
        tracing::info!("Submitted result for match {}: {:?}", match_id, tx_hash);

        Ok(format!("{:?}", tx_hash))
    }

    /// Settle match on-chain (distribute prizes)
    pub async fn settle_match(&self, match_id: &str) -> Result<String> {
        let contract_address = self
            .contract_address
            .as_ref()
            .ok_or_else(|| AppError::Internal("Contract address not configured".to_string()))?;

        let private_key = self
            .private_key
            .as_ref()
            .ok_or_else(|| AppError::Internal("Oracle private key not configured".to_string()))?;

        let provider = Provider::<Http>::try_from(&self.rpc_url)
            .map_err(|e| AppError::Internal(format!("Provider error: {}", e)))?;

        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e| AppError::Internal(format!("Invalid private key: {}", e)))?;

        let wallet = wallet.with_chain_id(196u64);

        let client = SignerMiddleware::new(provider, wallet);
        let client = Arc::new(client);

        let contract_addr: Address = contract_address
            .parse()
            .map_err(|e| AppError::Internal(format!("Invalid contract address: {}", e)))?;

        let contract = MatchManagerContract::new(contract_addr, client);

        let match_id_bytes: [u8; 32] = if match_id.starts_with("0x") {
            hex::decode(&match_id[2..])
                .map_err(|e| AppError::Internal(format!("Invalid match ID: {}", e)))?
                .try_into()
                .map_err(|_| AppError::Internal("Match ID must be 32 bytes".to_string()))?
        } else {
            ethers::utils::keccak256(match_id.as_bytes())
        };

        let call = contract.settle_match(match_id_bytes);

        let pending_tx = call
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Transaction error: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();
        tracing::info!("Settled match {}: {:?}", match_id, tx_hash);

        Ok(format!("{:?}", tx_hash))
    }

    /// Check if oracle is configured
    pub fn is_configured(&self) -> bool {
        self.contract_address.is_some() && self.private_key.is_some()
    }
}
