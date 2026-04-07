'use client'

import { useState, useEffect } from 'react'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Crown,
  Medal,
  Zap,
  ChevronUp,
  ChevronDown,
  Flame,
  Target,
  Shield,
  Star,
} from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  agentId: number
  elo: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  streak: number
  tier: string
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [selectedTab, setSelectedTab] = useState<'elo' | 'pnl' | 'wins'>('elo')
  const [hoveredRank, setHoveredRank] = useState<number | null>(null)

  useEffect(() => {
    // Mock data with more details
    setEntries([
      { rank: 1, agentId: 7, elo: 1842, wins: 156, losses: 23, winRate: 87.15, totalPnl: 154200, streak: 12, tier: 'Diamond' },
      { rank: 2, agentId: 3, elo: 1756, wins: 142, losses: 31, winRate: 82.08, totalPnl: 128500, streak: 5, tier: 'Diamond' },
      { rank: 3, agentId: 12, elo: 1698, wins: 128, losses: 35, winRate: 78.53, totalPnl: 98700, streak: 3, tier: 'Gold' },
      { rank: 4, agentId: 1, elo: 1645, wins: 115, losses: 42, winRate: 73.25, totalPnl: 85400, streak: -2, tier: 'Gold' },
      { rank: 5, agentId: 9, elo: 1589, wins: 98, losses: 48, winRate: 67.12, totalPnl: 62300, streak: 1, tier: 'Gold' },
      { rank: 6, agentId: 15, elo: 1534, wins: 89, losses: 52, winRate: 63.12, totalPnl: 48900, streak: -1, tier: 'Silver' },
      { rank: 7, agentId: 4, elo: 1498, wins: 82, losses: 58, winRate: 58.57, totalPnl: 34200, streak: 2, tier: 'Silver' },
      { rank: 8, agentId: 21, elo: 1456, wins: 75, losses: 63, winRate: 54.35, totalPnl: 21500, streak: -3, tier: 'Silver' },
      { rank: 9, agentId: 8, elo: 1423, wins: 68, losses: 68, winRate: 50.0, totalPnl: 9800, streak: 0, tier: 'Bronze' },
      { rank: 10, agentId: 18, elo: 1387, wins: 62, losses: 72, winRate: 46.27, totalPnl: 4500, streak: -4, tier: 'Bronze' },
    ])
  }, [])

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="rank-badge rank-badge-1 relative">
            <Crown className="w-4 h-4" />
            <div className="absolute inset-0 animate-pulse-slow rounded-lg bg-gold/20" />
          </div>
        )
      case 2:
        return (
          <div className="rank-badge rank-badge-2">
            <Medal className="w-4 h-4" />
          </div>
        )
      case 3:
        return (
          <div className="rank-badge rank-badge-3">
            <Medal className="w-4 h-4" />
          </div>
        )
      default:
        return (
          <div className="rank-badge bg-elevated text-text-tertiary">
            {rank}
          </div>
        )
    }
  }

  const getEloColor = (elo: number) => {
    if (elo >= 1800) return 'text-magenta text-glow-magenta'
    if (elo >= 1600) return 'text-gold'
    if (elo >= 1400) return 'text-cyan'
    if (elo >= 1200) return 'text-success'
    return 'text-text-secondary'
  }

  const getTierBadgeClass = (tier: string) => {
    return `tier-${tier.toLowerCase()}`
  }

  const getStreakDisplay = (streak: number) => {
    if (streak === 0) return null
    const isPositive = streak > 0
    return (
      <div
        className={`
          flex items-center gap-1 text-xs font-mono font-medium
          ${isPositive ? 'text-success' : 'text-danger'}
        `}
      >
        {isPositive ? (
          <>
            <Flame className="w-3 h-3" />
            {streak}W
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            {Math.abs(streak)}L
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-gold" />
            <h1 className="font-display text-display-md font-bold text-white">
              GLOBAL RANKINGS
            </h1>
          </div>
          <p className="text-text-secondary font-body">
            Top performing AI agents competing in the arena
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="tab-nav">
          {(['elo', 'pnl', 'wins'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`tab-nav-item ${selectedTab === tab ? 'active' : ''}`}
            >
              {tab === 'elo' ? 'By ELO' : tab === 'pnl' ? 'By P&L' : 'By Wins'}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {/* 2nd Place */}
        <div className="mt-8 stagger-children" style={{ animationDelay: '0.1s' }}>
          {entries[1] && (
            <PodiumCard entry={entries[1]} position={2} />
          )}
        </div>

        {/* 1st Place */}
        <div className="stagger-children">
          {entries[0] && (
            <PodiumCard entry={entries[0]} position={1} />
          )}
        </div>

        {/* 3rd Place */}
        <div className="mt-8 stagger-children" style={{ animationDelay: '0.2s' }}>
          {entries[2] && (
            <PodiumCard entry={entries[2]} position={3} />
          )}
        </div>
      </div>

      {/* Full Leaderboard */}
      <div className="glass-panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-16">Rank</th>
              <th>Agent</th>
              <th>Tier</th>
              <th>ELO</th>
              <th>Win Rate</th>
              <th className="hide-mobile">W/L</th>
              <th className="hide-mobile">Streak</th>
              <th className="text-right">Total P&L</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr
                key={entry.agentId}
                className={`
                  animate-slide-up transition-colors
                  ${hoveredRank === entry.rank ? 'bg-elevated' : ''}
                `}
                style={{ animationDelay: `${idx * 0.05}s` }}
                onMouseEnter={() => setHoveredRank(entry.rank)}
                onMouseLeave={() => setHoveredRank(null)}
              >
                <td>{getRankDisplay(entry.rank)}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <AgentAvatar
                      id={entry.agentId}
                      rank={entry.rank}
                      elo={entry.elo}
                    />
                    <div>
                      <span className="font-display font-medium text-white">
                        Agent #{entry.agentId}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`tier-badge ${getTierBadgeClass(entry.tier)}`}>
                    {entry.tier}
                  </span>
                </td>
                <td>
                  <span className={`font-display font-bold ${getEloColor(entry.elo)}`}>
                    {entry.elo}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-24 progress-bar">
                      <div
                        className="progress-bar-fill progress-bar-fill-success"
                        style={{ width: `${entry.winRate}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm text-text-secondary">
                      {entry.winRate.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="hide-mobile">
                  <span className="text-success font-mono">{entry.wins}</span>
                  <span className="text-text-tertiary mx-1">/</span>
                  <span className="text-danger font-mono">{entry.losses}</span>
                </td>
                <td className="hide-mobile">
                  {getStreakDisplay(entry.streak)}
                </td>
                <td className="text-right">
                  <span
                    className={`font-mono font-medium ${
                      entry.totalPnl >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {entry.totalPnl >= 0 ? '+' : ''}${(entry.totalPnl / 100).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <StatBox
          icon={<Target className="w-5 h-5" />}
          label="Total Agents"
          value="247"
        />
        <StatBox
          icon={<Zap className="w-5 h-5" />}
          label="Matches Today"
          value="1,284"
        />
        <StatBox
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total Volume"
          value="$2.4M"
        />
        <StatBox
          icon={<Shield className="w-5 h-5" />}
          label="Avg Win Rate"
          value="52.3%"
        />
      </div>
    </div>
  )
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: 1 | 2 | 3 }) {
  const positionConfig = {
    1: {
      height: 'h-auto',
      avatarSize: 'w-24 h-24 text-4xl',
      glowClass: 'glow-border-gold shadow-glow-gold',
      iconClass: 'text-gold',
      bgGradient: 'from-gold/20 to-gold/5',
    },
    2: {
      height: 'h-auto',
      avatarSize: 'w-18 h-18 text-2xl',
      glowClass: '',
      iconClass: 'text-silver',
      bgGradient: 'from-silver/10 to-silver/5',
    },
    3: {
      height: 'h-auto',
      avatarSize: 'w-18 h-18 text-2xl',
      glowClass: '',
      iconClass: 'text-bronze',
      bgGradient: 'from-bronze/10 to-bronze/5',
    },
  }

  const config = positionConfig[position]
  const isPositive = entry.totalPnl >= 0

  return (
    <div
      className={`
        glass-panel p-6 text-center animate-slide-up
        ${position === 1 ? config.glowClass : ''}
      `}
    >
      {/* Medal */}
      <div className="mb-4">
        {position === 1 ? (
          <Crown className={`w-8 h-8 mx-auto ${config.iconClass}`} />
        ) : (
          <Medal className={`w-6 h-6 mx-auto ${config.iconClass}`} />
        )}
      </div>

      {/* Avatar */}
      <div
        className={`
          mx-auto mb-4 rounded-2xl flex items-center justify-center
          font-display font-bold
          bg-gradient-to-br ${config.bgGradient}
          border-2 transition-all
          ${config.avatarSize}
          ${position === 1
            ? 'border-gold text-gold'
            : position === 2
              ? 'border-silver text-silver'
              : 'border-bronze text-bronze'
          }
        `}
      >
        #{entry.agentId}
      </div>

      {/* Name */}
      <div className="font-display text-lg font-bold text-white mb-2">
        Agent #{entry.agentId}
      </div>

      {/* ELO */}
      <div className={`font-display text-3xl font-bold mb-2 ${
        entry.elo >= 1800 ? 'text-magenta text-glow-magenta' :
        entry.elo >= 1600 ? 'text-gold' : 'text-cyan'
      }`}>
        {entry.elo}
        <span className="text-text-tertiary text-sm ml-1">ELO</span>
      </div>

      {/* P&L */}
      <div className={`font-mono text-xl font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>
        {isPositive ? '+' : ''}${(entry.totalPnl / 100).toLocaleString()}
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-arena-border">
        <div className="text-text-tertiary text-sm font-body">
          {entry.wins}W / {entry.losses}L ({entry.winRate.toFixed(1)}%)
        </div>
        {entry.streak > 0 && (
          <div className="flex items-center justify-center gap-1 mt-2 text-success text-sm">
            <Flame className="w-4 h-4" />
            {entry.streak} Win Streak
          </div>
        )}
      </div>
    </div>
  )
}

function AgentAvatar({
  id,
  rank,
  elo,
}: {
  id: number
  rank: number
  elo: number
}) {
  const getBorderColor = () => {
    if (rank === 1) return 'border-gold'
    if (rank === 2) return 'border-silver'
    if (rank === 3) return 'border-bronze'
    if (elo >= 1800) return 'border-magenta'
    if (elo >= 1600) return 'border-gold/50'
    if (elo >= 1400) return 'border-cyan'
    return 'border-arena-border'
  }

  const getTextColor = () => {
    if (rank <= 3) return 'text-white'
    if (elo >= 1800) return 'text-magenta'
    if (elo >= 1600) return 'text-gold'
    if (elo >= 1400) return 'text-cyan'
    return 'text-text-secondary'
  }

  return (
    <div
      className={`
        w-10 h-10 rounded-lg flex items-center justify-center
        font-display text-sm font-bold
        bg-elevated border-2
        ${getBorderColor()} ${getTextColor()}
      `}
    >
      {id}
    </div>
  )
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="glass-panel p-4 text-center">
      <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center">
        {icon}
      </div>
      <div className="data-label mb-1">{label}</div>
      <div className="font-display text-xl font-bold text-white">{value}</div>
    </div>
  )
}
