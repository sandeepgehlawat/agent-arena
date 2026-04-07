import WebSocket from 'ws';
import type {
  AgentStats,
  ChallengeResponse,
  Leaderboard,
  Match,
  MatchState,
  PaymentProof,
  PaymentRequest,
  TradeRequest,
  TradeResponse,
  WsMessage,
} from './types';
import { toCamelCase, toSnakeCase } from './types';
import { X402Handler } from './x402';

export interface ArenaClientOptions {
  baseUrl: string;
  privateKey?: string;
  rpcUrl?: string;
  usdcAddress?: string;
}

/**
 * Arena client for interacting with AgentArena backend
 */
export class ArenaClient {
  private baseUrl: string;
  private wsUrl: string;
  private x402Handler?: X402Handler;

  constructor(options: ArenaClientOptions | string, privateKey?: string) {
    if (typeof options === 'string') {
      // Legacy constructor: new ArenaClient(baseUrl, privateKey)
      this.baseUrl = options.replace(/\/$/, '');
      if (privateKey) {
        this.x402Handler = new X402Handler(privateKey);
      }
    } else {
      this.baseUrl = options.baseUrl.replace(/\/$/, '');
      if (options.privateKey) {
        this.x402Handler = new X402Handler(
          options.privateKey,
          options.rpcUrl,
          options.usdcAddress
        );
      }
    }

    this.wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  }

  /**
   * Make an HTTP request to the API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(toSnakeCase(body)) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 402) {
        throw new PaymentRequiredError(toCamelCase(data.payment));
      }
      throw new ApiError(data.error || 'Unknown error', response.status);
    }

    return toCamelCase<T>(data);
  }

  /**
   * Handle payment if required
   */
  private async handlePaymentRequired(
    payment: PaymentRequest,
    retryFn: (proof: PaymentProof) => Promise<unknown>
  ): Promise<unknown> {
    if (!this.x402Handler) {
      throw new Error(
        `Payment required: ${payment.amount} ${payment.token} to ${payment.recipient}. ` +
          'Configure a private key to enable automatic payments.'
      );
    }

    const proof = await this.x402Handler.executePayment(payment);
    return retryFn(proof);
  }

  /**
   * Get agent stats
   */
  async getAgentStats(agentId: number): Promise<AgentStats> {
    return this.request<AgentStats>('GET', `/api/arena/stats/${agentId}`);
  }

  /**
   * Create a challenge to another agent
   */
  async createChallenge(
    challengerId: number,
    challengedId: number,
    tier: number
  ): Promise<ChallengeResponse> {
    const body = { challengerId, challengedId, tier };

    try {
      return await this.request<ChallengeResponse>('POST', '/api/matches/challenge', body);
    } catch (e) {
      if (e instanceof PaymentRequiredError) {
        return (await this.handlePaymentRequired(e.payment, async (proof) => {
          return this.request<ChallengeResponse>(
            'POST',
            '/api/matches/challenge',
            body,
            { 'X-Payment-Proof': JSON.stringify(toSnakeCase(proof)) }
          );
        })) as ChallengeResponse;
      }
      throw e;
    }
  }

  /**
   * Accept a challenge
   */
  async acceptChallenge(matchId: string, agentId: number): Promise<Match> {
    const body = { agentId };

    try {
      return await this.request<Match>('POST', `/api/matches/${matchId}/accept`, body);
    } catch (e) {
      if (e instanceof PaymentRequiredError) {
        return (await this.handlePaymentRequired(e.payment, async (proof) => {
          return this.request<Match>(
            'POST',
            `/api/matches/${matchId}/accept`,
            body,
            { 'X-Payment-Proof': JSON.stringify(toSnakeCase(proof)) }
          );
        })) as Match;
      }
      throw e;
    }
  }

  /**
   * Submit a trade during a match
   */
  async submitTrade(matchId: string, trade: TradeRequest): Promise<TradeResponse> {
    return this.request<TradeResponse>('POST', `/api/matches/${matchId}/trade`, trade);
  }

  /**
   * Get current match state
   */
  async getMatchState(matchId: string): Promise<MatchState> {
    return this.request<MatchState>('GET', `/api/matches/${matchId}/state`);
  }

  /**
   * Get match details
   */
  async getMatch(matchId: string): Promise<Match> {
    return this.request<Match>('GET', `/api/matches/${matchId}`);
  }

  /**
   * Get current prices
   */
  async getPrices(): Promise<Record<string, number>> {
    const data = await this.request<{ prices: Record<string, number> }>('GET', '/api/prices');
    return data.prices;
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(): Promise<Leaderboard> {
    return this.request<Leaderboard>('GET', '/api/leaderboard');
  }

  /**
   * Subscribe to match updates via WebSocket
   */
  subscribeToMatch(
    matchId: string,
    callbacks: {
      onState?: (state: MatchState) => void;
      onTrade?: (trade: WsMessage & { type: 'trade' }) => void;
      onStarted?: () => void;
      onEnded?: (event: WsMessage & { type: 'ended' }) => void;
      onError?: (error: string) => void;
      onClose?: () => void;
    }
  ): WebSocket {
    const url = `${this.wsUrl}/ws/matches/${matchId}`;
    const ws = new WebSocket(url);

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = toCamelCase<WsMessage>(JSON.parse(data.toString()));

        switch (message.type) {
          case 'state':
            callbacks.onState?.(message.data);
            break;
          case 'trade':
            callbacks.onTrade?.(message as WsMessage & { type: 'trade' });
            break;
          case 'started':
            callbacks.onStarted?.();
            break;
          case 'ended':
            callbacks.onEnded?.(message as WsMessage & { type: 'ended' });
            break;
          case 'error':
            callbacks.onError?.(message.error);
            break;
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    });

    ws.on('close', () => {
      callbacks.onClose?.();
    });

    ws.on('error', (err) => {
      callbacks.onError?.(err.message);
    });

    return ws;
  }

  /**
   * Get USDC balance (if wallet configured)
   */
  async getUsdcBalance(): Promise<bigint> {
    if (!this.x402Handler) {
      throw new Error('No wallet configured');
    }
    return this.x402Handler.getBalance();
  }

  /**
   * Get formatted USDC balance
   */
  async getFormattedUsdcBalance(): Promise<string> {
    if (!this.x402Handler) {
      throw new Error('No wallet configured');
    }
    return this.x402Handler.getFormattedBalance();
  }

  /**
   * Get wallet address
   */
  get walletAddress(): string | undefined {
    return this.x402Handler?.address;
  }
}

/**
 * Error thrown when payment is required
 */
export class PaymentRequiredError extends Error {
  payment: PaymentRequest;

  constructor(payment: PaymentRequest) {
    super(`Payment required: ${payment.amount} ${payment.token}`);
    this.name = 'PaymentRequiredError';
    this.payment = payment;
  }
}

/**
 * General API error
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}
