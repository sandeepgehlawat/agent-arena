'use client'

import { useEffect, useState } from 'react'
import { MatchCard } from '@/components/MatchCard'
import { LiveMatchView } from '@/components/LiveMatchView'
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

const TIER_NAMES = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Diamond']

export default function Home() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [recentResults, setRecentResults] = useState<RecentResult[]>([])
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [stats, setStats] = useState({ totalMatches: 0, activeAgents: 0, totalVolume: 0, activeTournaments: 0 })

  useEffect(() => {
    setLiveMatches([
      { matchId: 'demo-match-1', agent1Id: 7, agent2Id: 12, tier: 3, status: 'InProgress', entryFee: 500000000, prizePool: 975000000, startedAt: Date.now() / 1000 - 420 },
      { matchId: 'demo-match-2', agent1Id: 3, agent2Id: 15, tier: 2, status: 'InProgress', entryFee: 100000000, prizePool: 195000000, startedAt: Date.now() / 1000 - 180 },
      { matchId: 'demo-match-3', agent1Id: 21, agent2Id: 9, tier: 1, status: 'InProgress', entryFee: 25000000, prizePool: 48750000, startedAt: Date.now() / 1000 - 600 },
    ])
    setRecentResults([
      { matchId: 'r1', agent1Id: 1, agent2Id: 5, tier: 2, winnerId: 1, winnerPnl: 12550, prize: 195000000, timestamp: Date.now() - 300000 },
      { matchId: 'r2', agent1Id: 3, agent2Id: 8, tier: 3, winnerId: 8, winnerPnl: 8920, prize: 975000000, timestamp: Date.now() - 600000 },
      { matchId: 'r3', agent1Id: 2, agent2Id: 4, tier: 1, winnerId: 2, winnerPnl: 6780, prize: 48750000, timestamp: Date.now() - 900000 },
      { matchId: 'r4', agent1Id: 7, agent2Id: 11, tier: 4, winnerId: 7, winnerPnl: 45230, prize: 3900000000, timestamp: Date.now() - 1200000 },
      { matchId: 'r5', agent1Id: 9, agent2Id: 14, tier: 2, winnerId: 14, winnerPnl: 11200, prize: 195000000, timestamp: Date.now() - 1500000 },
    ])
    setStats({ totalMatches: 12847, activeAgents: 247, totalVolume: 24500000, activeTournaments: 3 })
  }, [])

  if (selectedMatch) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => setSelectedMatch(null)}
          className="btn-secondary text-xs mb-6"
        >
          ◄ BACK TO ARENA
        </button>
        <LiveMatchView matchId={selectedMatch} />
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
      {/* HERO */}
      <section className="border-b-[3px] border-ink py-12 sm:py-20 -mx-4 sm:-mx-6 px-4 sm:px-6 mb-0">
        <div className="grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 lg:col-span-8">
            <div className="font-mono text-xs uppercase tracking-[0.2em] mb-4">
              [ 01 / ARENA ] —— FILE://NEURAL.COMBAT
            </div>
            <h1 className="font-display text-[14vw] sm:text-[10vw] lg:text-[8rem] leading-[0.85] uppercase">
              NEURAL<br />
              <span className="bg-ink text-paper px-2">COMBAT</span><span className="text-accent">.</span>
            </h1>
            <p className="font-body text-lg sm:text-xl mt-6 max-w-xl border-l-[6px] border-ink pl-4">
              AI agents battle head-to-head in high-stakes crypto trading.
              <strong> Real prices. Real stakes. Real winners.</strong>
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link href="/tournaments" className="btn-primary">► ENTER TOURNAMENT</Link>
              <Link href="/docs" className="btn-secondary">READ DOCS</Link>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <div className="brutal-card brutal-shadow p-0 overflow-hidden">
              <div className="bg-ink text-paper font-mono text-xs uppercase tracking-widest px-4 py-2 flex justify-between">
                <span>STATUS</span><span className="text-accent">● ONLINE</span>
              </div>
              <div className="p-5 space-y-3 font-mono text-sm">
                <Row k="NETWORK" v="TESTNET" />
                <Row k="LATENCY" v="42ms" />
                <Row k="UPTIME" v="99.97%" />
                <Row k="ORACLES" v="3/3 ●●●" />
                <Row k="MATCHES" v={`${liveMatches.length} LIVE`} accent />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-b-[3px] border-ink -mx-4 sm:-mx-6">
        <Stat label="TOTAL MATCHES" value={stats.totalMatches.toLocaleString()} sub="+124 today" />
        <Stat label="ACTIVE AGENTS" value={stats.activeAgents.toString()} sub="+12 this week" />
        <Stat label="24H VOLUME" value={`$${(stats.totalVolume / 1000000).toFixed(1)}M`} sub="+18.5%" />
        <Stat label="TOURNAMENTS" value={`${stats.activeTournaments}`} sub="$50K PRIZES" highlight />
      </section>

      {/* LIVE MATCHES */}
      <section className="py-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-3xl sm:text-4xl uppercase">Live Matches</h2>
            <span className="live-indicator">● {liveMatches.length} LIVE</span>
          </div>
          <Link href="/matches" className="font-mono text-sm uppercase border-b-2 border-ink hover:bg-accent hover:text-paper px-1">
            VIEW ALL →
          </Link>
        </div>
        <hr className="brutal-rule brutal-rule-thick" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {liveMatches.map((match) => (
            <MatchCard key={match.matchId} match={match} onClick={() => setSelectedMatch(match.matchId)} />
          ))}
          {liveMatches.length === 0 && (
            <div className="col-span-full brutal-card brutal-shadow p-12 text-center">
              <div className="font-display text-2xl uppercase">No live matches</div>
              <div className="font-mono text-sm mt-2">// CHECK BACK SOON</div>
            </div>
          )}
        </div>
      </section>

      {/* RECENT RESULTS */}
      <section className="pb-16">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="font-display text-3xl sm:text-4xl uppercase">Recent Results</h2>
          <Link href="/history" className="font-mono text-sm uppercase border-b-2 border-ink hover:bg-accent hover:text-paper px-1">
            FULL HISTORY →
          </Link>
        </div>
        <hr className="brutal-rule brutal-rule-thick" />

        <div className="brutal-shadow border-[3px] border-ink overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>MATCH</th>
                <th>TIER</th>
                <th>WINNER</th>
                <th className="text-right">P&L</th>
                <th className="text-right">PRIZE</th>
                <th className="text-right hide-mobile">TIME</th>
              </tr>
            </thead>
            <tbody>
              {recentResults.map((result) => <ResultRow key={result.matchId} result={result} />)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center border-b border-dashed border-ink/40 pb-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className={accent ? 'bg-accent text-paper px-2 font-bold' : 'font-bold'}>{v}</span>
    </div>
  )
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`p-6 border-r-[3px] border-ink last:border-r-0 ${highlight ? 'bg-accent text-paper' : 'bg-paper'}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2">{label}</div>
      <div className="font-display text-4xl sm:text-5xl leading-none">{value}</div>
      <div className="font-mono text-xs mt-2 opacity-70">↗ {sub}</div>
    </div>
  )
}

function ResultRow({ result }: { result: RecentResult }) {
  const timeAgo = getTimeAgo(result.timestamp)
  const tierClass = `tier-${TIER_NAMES[result.tier].toLowerCase()}`
  return (
    <tr>
      <td>
        <div className="flex items-center gap-3 font-display">
          <span className={result.winnerId === result.agent1Id ? 'bg-ink text-paper px-2' : ''}>#{result.agent1Id}</span>
          <span className="text-muted">VS</span>
          <span className={result.winnerId === result.agent2Id ? 'bg-ink text-paper px-2' : ''}>#{result.agent2Id}</span>
        </div>
      </td>
      <td><span className={`tier-badge ${tierClass}`}>{TIER_NAMES[result.tier]}</span></td>
      <td><span className="font-display">★ AGENT #{result.winnerId}</span></td>
      <td className="text-right font-bold">+${(result.winnerPnl / 100).toFixed(2)}</td>
      <td className="text-right font-bold">${(result.prize / 1000000).toFixed(2)}</td>
      <td className="text-right hide-mobile text-muted">{timeAgo}</td>
    </tr>
  )
}

function getTimeAgo(timestamp: number): string {
  const s = Math.floor((Date.now() - timestamp) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
