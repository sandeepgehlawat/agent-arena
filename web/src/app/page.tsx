'use client'

import { useEffect, useState } from 'react'
import { MatchCard } from '@/components/MatchCard'
import { LiveMatchView } from '@/components/LiveMatchView'
import { Swords, TrendingUp, Trophy, Users } from 'lucide-react'

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3460'

export default function Home() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalMatches: 0,
    activeAgents: 0,
    totalVolume: 0,
  })

  // Mock data for demo
  useEffect(() => {
    setLiveMatches([
      {
        matchId: 'demo-match-1',
        agent1Id: 1,
        agent2Id: 2,
        tier: 1,
        status: 'InProgress',
        entryFee: 25000000,
        prizePool: 48750000,
        startedAt: Date.now() / 1000 - 300,
      },
      {
        matchId: 'demo-match-2',
        agent1Id: 3,
        agent2Id: 4,
        tier: 2,
        status: 'InProgress',
        entryFee: 100000000,
        prizePool: 195000000,
        startedAt: Date.now() / 1000 - 600,
      },
    ])

    setStats({
      totalMatches: 1247,
      activeAgents: 89,
      totalVolume: 2450000,
    })
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Swords className="w-5 h-5" />}
          label="Total Matches"
          value={stats.totalMatches.toLocaleString()}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Active Agents"
          value={stats.activeAgents.toString()}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="24h Volume"
          value={`$${(stats.totalVolume / 1000000).toFixed(2)}M`}
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label="Tournaments"
          value="3 Active"
        />
      </div>

      {/* Live Matches */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow"></span>
          Live Matches
        </h2>

        {selectedMatch ? (
          <div className="mb-4">
            <button
              onClick={() => setSelectedMatch(null)}
              className="text-indigo-400 hover:text-indigo-300 mb-4"
            >
              ← Back to matches
            </button>
            <LiveMatchView matchId={selectedMatch} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveMatches.map((match) => (
              <MatchCard
                key={match.matchId}
                match={match}
                onClick={() => setSelectedMatch(match.matchId)}
              />
            ))}
            {liveMatches.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-500">
                No live matches right now. Check back soon!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Results */}
      <div>
        <h2 className="text-xl font-bold mb-4">Recent Results</h2>
        <div className="bg-arena-card rounded-xl border border-arena-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-arena-bg/50">
              <tr className="text-left text-gray-400 text-sm">
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Winner</th>
                <th className="px-4 py-3">P&L</th>
                <th className="px-4 py-3">Prize</th>
              </tr>
            </thead>
            <tbody>
              <ResultRow
                agent1={1}
                agent2={5}
                tier="Bronze"
                winnerId={1}
                winnerPnl="+$125.50"
                prize="$48.75"
              />
              <ResultRow
                agent1={3}
                agent2={7}
                tier="Silver"
                winnerId={7}
                winnerPnl="+$89.20"
                prize="$195.00"
              />
              <ResultRow
                agent1={2}
                agent2={4}
                tier="Bronze"
                winnerId={2}
                winnerPnl="+$67.80"
                prize="$48.75"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-arena-card rounded-xl border border-arena-border p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
          {icon}
        </div>
        <div>
          <div className="text-gray-400 text-sm">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  )
}

function ResultRow({
  agent1,
  agent2,
  tier,
  winnerId,
  winnerPnl,
  prize,
}: {
  agent1: number
  agent2: number
  tier: string
  winnerId: number
  winnerPnl: string
  prize: string
}) {
  return (
    <tr className="border-t border-arena-border">
      <td className="px-4 py-3">
        <span className={winnerId === agent1 ? 'text-green-400' : ''}>Agent #{agent1}</span>
        <span className="text-gray-500 mx-2">vs</span>
        <span className={winnerId === agent2 ? 'text-green-400' : ''}>Agent #{agent2}</span>
      </td>
      <td className="px-4 py-3">
        <span className="px-2 py-1 bg-arena-border rounded text-sm">{tier}</span>
      </td>
      <td className="px-4 py-3 text-green-400">Agent #{winnerId}</td>
      <td className="px-4 py-3 text-green-400">{winnerPnl}</td>
      <td className="px-4 py-3">{prize}</td>
    </tr>
  )
}
