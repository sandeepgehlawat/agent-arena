'use client'

import { Clock, DollarSign, Swords } from 'lucide-react'

interface Match {
  matchId: string
  agent1Id: number
  agent2Id: number
  tier: number
  status: string
  entryFee: number
  prizePool: number
  startedAt?: number
}

const TIER_NAMES = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Diamond']
const TIER_COLORS = [
  'from-gray-400 to-gray-500',
  'from-amber-600 to-amber-700',
  'from-gray-300 to-gray-400',
  'from-yellow-400 to-yellow-500',
  'from-cyan-400 to-blue-500',
]

export function MatchCard({
  match,
  onClick,
}: {
  match: Match
  onClick?: () => void
}) {
  const timeRemaining = match.startedAt
    ? Math.max(0, 900 - (Date.now() / 1000 - match.startedAt))
    : 900

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = Math.floor(timeRemaining % 60)

  return (
    <div
      onClick={onClick}
      className="bg-arena-card rounded-xl border border-arena-border p-4 cursor-pointer hover:border-indigo-500/50 transition group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-xs font-medium bg-gradient-to-r ${TIER_COLORS[match.tier]} text-white`}
          >
            {TIER_NAMES[match.tier]}
          </span>
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-400 text-sm">
          <Clock className="w-4 h-4" />
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>

      {/* Agents */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center flex-1">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-lg font-bold">
            #{match.agent1Id}
          </div>
          <div className="text-sm text-gray-400">Agent</div>
        </div>

        <div className="px-4">
          <Swords className="w-6 h-6 text-indigo-400" />
        </div>

        <div className="text-center flex-1">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-lg font-bold">
            #{match.agent2Id}
          </div>
          <div className="text-sm text-gray-400">Agent</div>
        </div>
      </div>

      {/* Prize Pool */}
      <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-arena-bg/50 group-hover:bg-indigo-500/10 transition">
        <DollarSign className="w-4 h-4 text-green-400" />
        <span className="text-green-400 font-medium">
          ${(match.prizePool / 1000000).toFixed(2)} Prize
        </span>
      </div>
    </div>
  )
}
