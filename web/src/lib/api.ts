const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3460'
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3460'

export interface Match {
  matchId: string
  agent1Id: number
  agent2Id: number
  tier: number
  status: string
  entryFee: number
  prizePool: number
  agent1Funded: boolean
  agent2Funded: boolean
  startedAt?: number
  endedAt?: number
  agent1Pnl?: number
  agent2Pnl?: number
  winnerId?: number
}

export interface MatchState {
  matchId: string
  status: string
  timeRemainingSecs: number
  agent1State: AgentMatchState
  agent2State: AgentMatchState
  prices: Record<string, number>
}

export interface AgentMatchState {
  agentId: number
  balance: number
  positions: Position[]
  pnl: number
  tradesCount: number
}

export interface Position {
  symbol: string
  side: string
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  leverage: number
}

export interface LeaderboardEntry {
  rank: number
  agentId: number
  elo: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  totalAgents: number
}

// API Functions

export async function getMatches(): Promise<Match[]> {
  const res = await fetch(`${API_URL}/api/matches`)
  if (!res.ok) throw new Error('Failed to fetch matches')
  return res.json()
}

export async function getMatch(matchId: string): Promise<Match> {
  const res = await fetch(`${API_URL}/api/matches/${matchId}`)
  if (!res.ok) throw new Error('Failed to fetch match')
  return res.json()
}

export async function getMatchState(matchId: string): Promise<MatchState> {
  const res = await fetch(`${API_URL}/api/matches/${matchId}/state`)
  if (!res.ok) throw new Error('Failed to fetch match state')
  return res.json()
}

export async function getLeaderboard(): Promise<Leaderboard> {
  const res = await fetch(`${API_URL}/api/leaderboard`)
  if (!res.ok) throw new Error('Failed to fetch leaderboard')
  return res.json()
}

export async function getPrices(): Promise<Record<string, number>> {
  const res = await fetch(`${API_URL}/api/prices`)
  if (!res.ok) throw new Error('Failed to fetch prices')
  const data = await res.json()
  return data.prices
}

// WebSocket

export function subscribeToMatch(
  matchId: string,
  onMessage: (data: any) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(`${WS_URL}/ws/matches/${matchId}`)

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }

  ws.onerror = (event) => {
    onError?.(event)
  }

  ws.onclose = () => {
    onClose?.()
  }

  return ws
}

// Helper functions

export function formatUSDC(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(2)}`
}

export function formatPnL(amount: number): string {
  const formatted = formatUSDC(Math.abs(amount))
  return amount >= 0 ? `+${formatted}` : `-${formatted}`
}

export const TIER_NAMES = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Diamond']

export const TIER_ENTRY_FEES = [5, 25, 100, 500, 2000]
