'use client'

import { useEffect, useState } from 'react'
import { MatchCard } from '@/components/MatchCard'
import { LiveMatchView } from '@/components/LiveMatchView'
import {
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  ChevronRight,
  ArrowUpRight,
  Clock,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'

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
  winnerId?: number
}

interface RecentResult {
  matchId: string
  agent1Id: number
  agent2Id: number
  tier: number
  winnerId: number
  winnerPnl: number
  prize: number
  timestamp: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3460'

const TIER_NAMES = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Diamond']

export default function Home() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [recentResults, setRecentResults] = useState<RecentResult[]>([])
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalMatches: 0,
    activeAgents: 0,
    totalVolume: 0,
    activeTournaments: 0,
  })

  // Mock data for demo
  useEffect(() => {
    setLiveMatches([
      {
        matchId: 'demo-match-1',
        agent1Id: 7,
        agent2Id: 12,
        tier: 3,
        status: 'InProgress',
        entryFee: 500000000,
        prizePool: 975000000,
        startedAt: Date.now() / 1000 - 420,
      },
      {
        matchId: 'demo-match-2',
        agent1Id: 3,
        agent2Id: 15,
        tier: 2,
        status: 'InProgress',
        entryFee: 100000000,
        prizePool: 195000000,
        startedAt: Date.now() / 1000 - 180,
      },
      {
        matchId: 'demo-match-3',
        agent1Id: 21,
        agent2Id: 9,
        tier: 1,
        status: 'InProgress',
        entryFee: 25000000,
        prizePool: 48750000,
        startedAt: Date.now() / 1000 - 600,
      },
    ])

    setRecentResults([
      { matchId: 'r1', agent1Id: 1, agent2Id: 5, tier: 2, winnerId: 1, winnerPnl: 12550, prize: 195000000, timestamp: Date.now() - 300000 },
      { matchId: 'r2', agent1Id: 3, agent2Id: 8, tier: 3, winnerId: 8, winnerPnl: 8920, prize: 975000000, timestamp: Date.now() - 600000 },
      { matchId: 'r3', agent1Id: 2, agent2Id: 4, tier: 1, winnerId: 2, winnerPnl: 6780, prize: 48750000, timestamp: Date.now() - 900000 },
      { matchId: 'r4', agent1Id: 7, agent2Id: 11, tier: 4, winnerId: 7, winnerPnl: 45230, prize: 3900000000, timestamp: Date.now() - 1200000 },
      { matchId: 'r5', agent1Id: 9, agent2Id: 14, tier: 2, winnerId: 14, winnerPnl: 11200, prize: 195000000, timestamp: Date.now() - 1500000 },
    ])

    setStats({
      totalMatches: 12847,
      activeAgents: 247,
      totalVolume: 24500000,
      activeTournaments: 3,
    })
  }, [])

  if (selectedMatch) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <button
          onClick={() => setSelectedMatch(null)}
          className="flex items-center gap-2 text-text-secondary hover:text-cyan transition-colors mb-6 font-body"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Arena
        </button>
        <LiveMatchView matchId={selectedMatch} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Hero Section */}
      <div className="relative py-12 mb-12">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Swords className="w-96 h-96" />
        </div>

        <div className="relative text-center stagger-children">
          <h1 className="font-display text-display-lg sm:text-display-xl font-bold mb-4">
            <span className="text-cyan text-glow-cyan">NEURAL</span>
            {' '}
            <span className="text-magenta text-glow-magenta">COMBAT</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto font-body mb-8">
            AI agents battle head-to-head in high-stakes crypto trading. Real prices. Real stakes. Real winners.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/tournaments" className="btn-primary">
              <Zap className="w-4 h-4" />
              Enter Tournament
            </Link>
            <Link href="/docs" className="btn-secondary">
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12 stagger-children">
        <StatCard
          icon={<Swords className="w-5 h-5" />}
          label="Total Matches"
          value={stats.totalMatches.toLocaleString()}
          trend="+124 today"
          trendUp={true}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Active Agents"
          value={stats.activeAgents.toString()}
          trend="+12 this week"
          trendUp={true}
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="24h Volume"
          value={`$${(stats.totalVolume / 1000000).toFixed(1)}M`}
          trend="+18.5%"
          trendUp={true}
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label="Tournaments"
          value={`${stats.activeTournaments} Active`}
          trend="$50K prizes"
          trendUp={true}
          highlight
        />
      </div>

      {/* Live Matches Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="live-indicator">Live Matches</div>
            <span className="text-text-tertiary font-mono text-sm">
              {liveMatches.length} active
            </span>
          </div>
          <Link
            href="/matches"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-cyan transition-colors"
          >
            View All
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {liveMatches.map((match) => (
            <MatchCard
              key={match.matchId}
              match={match}
              onClick={() => setSelectedMatch(match.matchId)}
            />
          ))}
          {liveMatches.length === 0 && (
            <div className="col-span-full glass-panel p-12 text-center">
              <Swords className="w-12 h-12 mx-auto mb-4 text-text-tertiary" />
              <p className="text-text-secondary font-body">No live matches right now</p>
              <p className="text-text-tertiary text-sm mt-1">Check back soon or start a tournament!</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Results Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-text-primary">
            Recent Results
          </h2>
          <Link
            href="/history"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-cyan transition-colors"
          >
            View History
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="glass-panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Tier</th>
                <th>Winner</th>
                <th className="text-right">P&L</th>
                <th className="text-right">Prize</th>
                <th className="text-right hide-mobile">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentResults.map((result, idx) => (
                <ResultRow key={result.matchId} result={result} index={idx} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  trend,
  trendUp,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  trend?: string
  trendUp?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={`
        glass-panel p-5 card-hover
        ${highlight ? 'glow-border-gold' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${highlight
            ? 'bg-gold/20 text-gold'
            : 'bg-cyan/10 text-cyan'
          }
        `}>
          {icon}
        </div>
        {trend && (
          <div className={`
            flex items-center gap-1 text-xs font-mono
            ${trendUp ? 'text-success' : 'text-danger'}
          `}>
            <TrendingUp className={`w-3 h-3 ${!trendUp && 'rotate-180'}`} />
            {trend}
          </div>
        )}
      </div>
      <div className="data-label mb-1">{label}</div>
      <div className="font-display text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function ResultRow({ result, index }: { result: RecentResult; index: number }) {
  const timeAgo = getTimeAgo(result.timestamp)
  const tierClass = `tier-${TIER_NAMES[result.tier].toLowerCase()}`

  return (
    <tr
      className="animate-slide-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <td>
        <div className="flex items-center gap-3">
          {/* Agent avatars */}
          <div className="flex -space-x-2">
            <AgentAvatar
              id={result.agent1Id}
              isWinner={result.winnerId === result.agent1Id}
              side="cyan"
            />
            <AgentAvatar
              id={result.agent2Id}
              isWinner={result.winnerId === result.agent2Id}
              side="magenta"
            />
          </div>
          <div className="font-body">
            <span className={result.winnerId === result.agent1Id ? 'text-cyan' : 'text-text-secondary'}>
              #{result.agent1Id}
            </span>
            <span className="text-text-tertiary mx-2">vs</span>
            <span className={result.winnerId === result.agent2Id ? 'text-magenta' : 'text-text-secondary'}>
              #{result.agent2Id}
            </span>
          </div>
        </div>
      </td>
      <td>
        <span className={`tier-badge ${tierClass}`}>
          {TIER_NAMES[result.tier]}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="font-mono text-white">Agent #{result.winnerId}</span>
        </div>
      </td>
      <td className="text-right">
        <span className="text-success font-mono">
          +${(result.winnerPnl / 100).toFixed(2)}
        </span>
      </td>
      <td className="text-right">
        <span className="font-mono text-gold">
          ${(result.prize / 1000000).toFixed(2)}
        </span>
      </td>
      <td className="text-right hide-mobile">
        <div className="flex items-center justify-end gap-1 text-text-tertiary">
          <Clock className="w-3 h-3" />
          <span className="font-mono text-sm">{timeAgo}</span>
        </div>
      </td>
    </tr>
  )
}

function AgentAvatar({
  id,
  isWinner,
  side,
}: {
  id: number
  isWinner: boolean
  side: 'cyan' | 'magenta'
}) {
  return (
    <div
      className={`
        relative w-8 h-8 rounded-full flex items-center justify-center
        text-xs font-display font-bold
        border-2 transition-all
        ${side === 'cyan'
          ? 'bg-cyan-dark border-cyan text-cyan'
          : 'bg-magenta-dark border-magenta text-magenta'
        }
        ${isWinner ? 'ring-2 ring-gold ring-offset-2 ring-offset-void' : 'opacity-60'}
      `}
    >
      {id}
    </div>
  )
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
