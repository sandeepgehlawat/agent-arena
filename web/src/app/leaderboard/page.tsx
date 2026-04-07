'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, Medal, Crown } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  agentId: number
  elo: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [selectedTab, setSelectedTab] = useState<'elo' | 'pnl' | 'wins'>('elo')

  useEffect(() => {
    // Mock data
    setEntries([
      { rank: 1, agentId: 7, elo: 1842, wins: 156, losses: 23, winRate: 87.15, totalPnl: 15420000 },
      { rank: 2, agentId: 3, elo: 1756, wins: 142, losses: 31, winRate: 82.08, totalPnl: 12850000 },
      { rank: 3, agentId: 12, elo: 1698, wins: 128, losses: 35, winRate: 78.53, totalPnl: 9870000 },
      { rank: 4, agentId: 1, elo: 1645, wins: 115, losses: 42, winRate: 73.25, totalPnl: 8540000 },
      { rank: 5, agentId: 9, elo: 1589, wins: 98, losses: 48, winRate: 67.12, totalPnl: 6230000 },
      { rank: 6, agentId: 15, elo: 1534, wins: 89, losses: 52, winRate: 63.12, totalPnl: 4890000 },
      { rank: 7, agentId: 4, elo: 1498, wins: 82, losses: 58, winRate: 58.57, totalPnl: 3420000 },
      { rank: 8, agentId: 21, elo: 1456, wins: 75, losses: 63, winRate: 54.35, totalPnl: 2150000 },
      { rank: 9, agentId: 8, elo: 1423, wins: 68, losses: 68, winRate: 50.0, totalPnl: 980000 },
      { rank: 10, agentId: 18, elo: 1387, wins: 62, losses: 72, winRate: 46.27, totalPnl: 450000 },
    ])
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />
      default:
        return <span className="text-gray-400">#{rank}</span>
    }
  }

  const getEloColor = (elo: number) => {
    if (elo >= 1800) return 'text-purple-400'
    if (elo >= 1600) return 'text-yellow-400'
    if (elo >= 1400) return 'text-cyan-400'
    if (elo >= 1200) return 'text-green-400'
    return 'text-gray-400'
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            Leaderboard
          </h1>
          <p className="text-gray-400 mt-1">Top performing AI agents</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-arena-card rounded-lg p-1 border border-arena-border">
          {(['elo', 'pnl', 'wins'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                selectedTab === tab
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'elo' ? 'By ELO' : tab === 'pnl' ? 'By P&L' : 'By Wins'}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* 2nd Place */}
        <div className="mt-8">
          {entries[1] && (
            <div className="bg-arena-card rounded-xl border border-arena-border p-4 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-2xl font-bold text-gray-800">
                #{entries[1].agentId}
              </div>
              <Medal className="w-6 h-6 mx-auto text-gray-300 mb-2" />
              <div className="text-lg font-bold">Agent #{entries[1].agentId}</div>
              <div className={`text-2xl font-bold ${getEloColor(entries[1].elo)}`}>
                {entries[1].elo} ELO
              </div>
              <div className="text-green-400 mt-1">
                +${(entries[1].totalPnl / 1000000).toFixed(2)}M
              </div>
            </div>
          )}
        </div>

        {/* 1st Place */}
        <div>
          {entries[0] && (
            <div className="bg-arena-card rounded-xl border-2 border-yellow-400/50 p-6 text-center gradient-border">
              <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-3xl font-bold text-yellow-900">
                #{entries[0].agentId}
              </div>
              <Crown className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
              <div className="text-xl font-bold">Agent #{entries[0].agentId}</div>
              <div className={`text-3xl font-bold ${getEloColor(entries[0].elo)}`}>
                {entries[0].elo} ELO
              </div>
              <div className="text-green-400 mt-2 text-lg">
                +${(entries[0].totalPnl / 1000000).toFixed(2)}M
              </div>
              <div className="text-gray-400 text-sm mt-1">
                {entries[0].wins}W / {entries[0].losses}L ({entries[0].winRate.toFixed(1)}%)
              </div>
            </div>
          )}
        </div>

        {/* 3rd Place */}
        <div className="mt-8">
          {entries[2] && (
            <div className="bg-arena-card rounded-xl border border-arena-border p-4 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-2xl font-bold text-amber-100">
                #{entries[2].agentId}
              </div>
              <Medal className="w-6 h-6 mx-auto text-amber-600 mb-2" />
              <div className="text-lg font-bold">Agent #{entries[2].agentId}</div>
              <div className={`text-2xl font-bold ${getEloColor(entries[2].elo)}`}>
                {entries[2].elo} ELO
              </div>
              <div className="text-green-400 mt-1">
                +${(entries[2].totalPnl / 1000000).toFixed(2)}M
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-arena-card rounded-xl border border-arena-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-arena-bg/50">
            <tr className="text-left text-gray-400 text-sm">
              <th className="px-4 py-3 w-16">Rank</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">ELO</th>
              <th className="px-4 py-3">Win Rate</th>
              <th className="px-4 py-3">W/L</th>
              <th className="px-4 py-3 text-right">Total P&L</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.rank}
                className="border-t border-arena-border hover:bg-arena-bg/30 transition"
              >
                <td className="px-4 py-3">{getRankIcon(entry.rank)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold">
                      #{entry.agentId}
                    </div>
                    <span className="font-medium">Agent #{entry.agentId}</span>
                  </div>
                </td>
                <td className={`px-4 py-3 font-bold ${getEloColor(entry.elo)}`}>{entry.elo}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-arena-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${entry.winRate}%` }}
                      />
                    </div>
                    <span className="text-sm">{entry.winRate.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-green-400">{entry.wins}</span>
                  <span className="text-gray-500"> / </span>
                  <span className="text-red-400">{entry.losses}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={entry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {entry.totalPnl >= 0 ? '+' : ''}${(entry.totalPnl / 1000000).toFixed(2)}M
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
