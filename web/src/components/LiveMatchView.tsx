'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Clock, Zap, WifiOff, Loader2 } from 'lucide-react'

interface Position {
  symbol: string
  side: string
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  leverage: number
}

interface AgentState {
  agentId: number
  balance: number
  positions: Position[]
  pnl: number
  tradesCount: number
}

interface MatchState {
  matchId: string
  status: string
  timeRemainingSecs: number
  agent1State: AgentState
  agent2State: AgentState
  prices: Record<string, number>
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3460'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3460'

// WebSocket connection states
type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

export function LiveMatchView({ matchId }: { matchId: string }) {
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [pnlHistory, setPnlHistory] = useState<
    Array<{ time: number; agent1: number; agent2: number }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const maxReconnectAttempts = 5

  // Fetch initial state via REST
  const fetchInitialState = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/matches/${matchId}/state`)
      if (!response.ok) throw new Error('Failed to fetch match state')
      const data = await response.json()
      setMatchState(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch initial state:', err)
      setError('Failed to load match data')
    }
  }, [matchId])

  // Connect to WebSocket with reconnection logic
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionState('connecting')
    const ws = new WebSocket(`${WS_URL}/ws/matches/${matchId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionState('connected')
      setError(null)
      reconnectAttemptRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'state') {
          setMatchState(data.data)
          // Update P&L history
          setPnlHistory(prev => {
            const newPoint = {
              time: prev.length,
              agent1: data.data.agent1State.pnl,
              agent2: data.data.agent2State.pnl,
            }
            // Keep last 60 data points (1 minute at 1 update/sec)
            const updated = [...prev, newPoint].slice(-60)
            return updated
          })
        } else if (data.type === 'trade') {
          // Trade notification - could show a toast here
          console.log('Trade executed:', data)
        } else if (data.type === 'ended') {
          setConnectionState('disconnected')
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection error')
    }

    ws.onclose = () => {
      wsRef.current = null

      // Don't reconnect if match ended or we've exceeded attempts
      if (matchState?.status === 'Completed' || matchState?.status === 'Settled') {
        setConnectionState('disconnected')
        return
      }

      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        setConnectionState('reconnecting')
        reconnectAttemptRef.current += 1
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000)

        setTimeout(() => {
          connectWebSocket()
        }, delay)
      } else {
        setConnectionState('error')
        setError('Connection lost. Please refresh the page.')
      }
    }
  }, [matchId, matchState?.status])

  useEffect(() => {
    // Fetch initial state
    fetchInitialState()

    // Connect WebSocket
    connectWebSocket()

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [matchId, fetchInitialState, connectWebSocket])

  // Connection status indicator
  const ConnectionStatus = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <div className="flex items-center gap-1 text-green-400 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
        )
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1 text-yellow-400 text-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            Reconnecting...
          </div>
        )
      case 'error':
      case 'disconnected':
        return (
          <div className="flex items-center gap-1 text-red-400 text-sm">
            <WifiOff className="w-3 h-3" />
            Disconnected
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-1 text-gray-400 text-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting...
          </div>
        )
    }
  }

  if (!matchState) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>
    )
  }

  const minutes = Math.floor(matchState.timeRemainingSecs / 60)
  const seconds = matchState.timeRemainingSecs % 60

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Chart */}
      <div className="lg:col-span-2 bg-arena-card rounded-xl border border-arena-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold">P&L Over Time</h3>
            <ConnectionStatus />
          </div>
          <div className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-gray-400" aria-hidden="true" />
            <span className="font-mono" aria-label={`${minutes} minutes and ${seconds} seconds remaining`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={pnlHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="time" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip
              contentStyle={{
                background: '#12121a',
                border: '1px solid #1e1e2e',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="agent1"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Agent #1"
            />
            <Line
              type="monotone"
              dataKey="agent2"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="Agent #2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Agent 1 */}
        <AgentPanel agent={matchState.agent1State} color="blue" />

        {/* Agent 2 */}
        <AgentPanel agent={matchState.agent2State} color="red" />

        {/* Prices */}
        <div className="bg-arena-card rounded-xl border border-arena-border p-4">
          <h4 className="font-bold mb-3">Live Prices</h4>
          <div className="space-y-2">
            {Object.entries(matchState.prices).map(([symbol, price]) => (
              <div key={symbol} className="flex justify-between">
                <span className="text-gray-400">{symbol}</span>
                <span className="font-mono">${price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentPanel({ agent, color }: { agent: AgentState; color: 'blue' | 'red' }) {
  const isPositive = agent.pnl >= 0
  const bgColor = color === 'blue' ? 'from-blue-500/20' : 'from-red-500/20'

  return (
    <div className="bg-arena-card rounded-xl border border-arena-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full bg-gradient-to-br ${
              color === 'blue' ? 'from-blue-500 to-blue-600' : 'from-red-500 to-red-600'
            } flex items-center justify-center text-sm font-bold`}
          >
            #{agent.agentId}
          </div>
          <span className="font-bold">Agent #{agent.agentId}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400 text-sm">
          <Zap className="w-4 h-4" />
          {agent.tradesCount} trades
        </div>
      </div>

      {/* P&L */}
      <div
        className={`rounded-lg p-3 mb-3 bg-gradient-to-r ${bgColor} to-transparent`}
      >
        <div className="text-sm text-gray-400 mb-1">Total P&L</div>
        <div
          className={`text-2xl font-bold flex items-center gap-1 ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          {isPositive ? '+' : ''}${agent.pnl.toFixed(2)}
        </div>
      </div>

      {/* Positions */}
      {agent.positions.length > 0 && (
        <div>
          <div className="text-sm text-gray-400 mb-2">Open Positions</div>
          {agent.positions.map((pos, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-t border-arena-border">
              <span>
                {pos.symbol} {pos.side} {pos.leverage}x
              </span>
              <span className={pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
