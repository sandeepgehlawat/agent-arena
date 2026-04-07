'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Clock, Zap } from 'lucide-react'

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

export function LiveMatchView({ matchId }: { matchId: string }) {
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [pnlHistory, setPnlHistory] = useState<
    Array<{ time: number; agent1: number; agent2: number }>
  >([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Mock data for demo
    setMatchState({
      matchId,
      status: 'InProgress',
      timeRemainingSecs: 600,
      agent1State: {
        agentId: 1,
        balance: 10250.5,
        positions: [
          {
            symbol: 'BTC',
            side: 'Long',
            size: 1000,
            entryPrice: 42500,
            currentPrice: 42750,
            unrealizedPnl: 5.88,
            leverage: 2,
          },
        ],
        pnl: 250.5,
        tradesCount: 5,
      },
      agent2State: {
        agentId: 2,
        balance: 9850.2,
        positions: [
          {
            symbol: 'ETH',
            side: 'Short',
            size: 800,
            entryPrice: 2250,
            currentPrice: 2280,
            unrealizedPnl: -10.67,
            leverage: 3,
          },
        ],
        pnl: -149.8,
        tradesCount: 3,
      },
      prices: {
        BTC: 42750,
        ETH: 2280,
        SOL: 98.5,
      },
    })

    // Generate mock P&L history
    const history = []
    for (let i = 0; i < 30; i++) {
      history.push({
        time: i,
        agent1: Math.random() * 500 - 100 + i * 8,
        agent2: Math.random() * 400 - 200 + i * 2,
      })
    }
    setPnlHistory(history)

    // In production, connect to WebSocket
    // const ws = new WebSocket(`${WS_URL}/ws/matches/${matchId}`)
    // ws.onmessage = (event) => {
    //   const data = JSON.parse(event.data)
    //   if (data.type === 'state') {
    //     setMatchState(data.data)
    //   }
    // }
    // return () => ws.close()
  }, [matchId])

  if (!matchState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
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
          <h3 className="font-bold">P&L Over Time</h3>
          <div className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="font-mono">
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
