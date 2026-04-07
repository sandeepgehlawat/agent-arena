'use client'

import { useEffect, useState } from 'react'
import { Clock, DollarSign, Zap, TrendingUp, TrendingDown } from 'lucide-react'

interface Match {
  matchId: string
  agent1Id: number
  agent2Id: number
  tier: number
  status: string
  entryFee: number
  prizePool: number
  startedAt?: number
  agent1Pnl?: number
  agent2Pnl?: number
}

const TIER_NAMES = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Diamond']

export function MatchCard({
  match,
  onClick,
}: {
  match: Match
  onClick?: () => void
}) {
  const [timeRemaining, setTimeRemaining] = useState(900)

  useEffect(() => {
    if (!match.startedAt) return

    const updateTime = () => {
      const remaining = Math.max(0, 900 - (Date.now() / 1000 - match.startedAt!))
      setTimeRemaining(Math.floor(remaining))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [match.startedAt])

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const timeProgress = ((900 - timeRemaining) / 900) * 100

  const tierClass = `tier-${TIER_NAMES[match.tier].toLowerCase()}`

  // Determine who's winning
  const agent1Leading = (match.agent1Pnl || 0) > (match.agent2Pnl || 0)
  const agent2Leading = (match.agent2Pnl || 0) > (match.agent1Pnl || 0)

  return (
    <div
      onClick={onClick}
      className="glass-panel p-5 cursor-pointer card-hover group relative overflow-hidden"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      aria-label={`Match: Agent ${match.agent1Id} vs Agent ${match.agent2Id}`}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-cyan/5 to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-magenta/5 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className={`tier-badge ${tierClass}`}>
            {TIER_NAMES[match.tier]}
          </span>
          <div className="live-indicator text-xs">
            Live
          </div>
        </div>

        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm font-medium text-white">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Time Progress Bar */}
      <div className="relative mb-6">
        <div className="progress-bar">
          <div
            className="progress-bar-fill bg-gradient-to-r from-cyan via-magenta to-cyan"
            style={{ width: `${timeProgress}%` }}
          />
        </div>
      </div>

      {/* Agents Battle View */}
      <div className="relative flex items-center justify-between mb-6">
        {/* Agent 1 (Cyan) */}
        <AgentBattleCard
          agentId={match.agent1Id}
          pnl={match.agent1Pnl || 0}
          side="cyan"
          isLeading={agent1Leading}
        />

        {/* VS Divider */}
        <div className="vs-divider flex-shrink-0 mx-2">
          <span>VS</span>
        </div>

        {/* Agent 2 (Magenta) */}
        <AgentBattleCard
          agentId={match.agent2Id}
          pnl={match.agent2Pnl || 0}
          side="magenta"
          isLeading={agent2Leading}
        />
      </div>

      {/* Prize Pool */}
      <div className="relative flex items-center justify-center gap-3 py-3 rounded-lg bg-elevated border border-arena-border group-hover:border-gold/30 transition-colors">
        <DollarSign className="w-5 h-5 text-gold" />
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold text-gold">
            ${(match.prizePool / 1000000).toFixed(2)}
          </span>
          <span className="text-text-tertiary text-sm font-body">Prize Pool</span>
        </div>
      </div>

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-cyan/30 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-magenta/30 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-cyan/30 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-magenta/30 rounded-br-xl" />
    </div>
  )
}

function AgentBattleCard({
  agentId,
  pnl,
  side,
  isLeading,
}: {
  agentId: number
  pnl: number
  side: 'cyan' | 'magenta'
  isLeading: boolean
}) {
  const isPositive = pnl >= 0
  const color = side === 'cyan' ? 'cyan' : 'magenta'

  return (
    <div className={`flex-1 text-center ${side === 'magenta' ? 'order-last' : ''}`}>
      {/* Agent Avatar */}
      <div className="relative inline-block mb-3">
        <div
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center
            font-display text-2xl font-bold
            bg-gradient-to-br transition-all duration-300
            ${side === 'cyan'
              ? 'from-cyan/20 to-cyan/5 text-cyan border border-cyan/30'
              : 'from-magenta/20 to-magenta/5 text-magenta border border-magenta/30'
            }
            ${isLeading ? 'scale-110 shadow-lg' : ''}
            ${isLeading && side === 'cyan' ? 'shadow-glow-cyan' : ''}
            ${isLeading && side === 'magenta' ? 'shadow-glow-magenta' : ''}
          `}
        >
          #{agentId}
        </div>
        {isLeading && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
            <Zap className="w-2.5 h-2.5 text-void" />
          </div>
        )}
      </div>

      {/* Agent Label */}
      <div className="text-text-tertiary text-xs font-body mb-2 uppercase tracking-wider">
        Agent
      </div>

      {/* P&L */}
      <div
        className={`
          flex items-center justify-center gap-1 font-mono text-sm font-medium
          ${isPositive ? 'text-success' : 'text-danger'}
        `}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {isPositive ? '+' : ''}${Math.abs(pnl / 100).toFixed(2)}
      </div>
    </div>
  )
}
