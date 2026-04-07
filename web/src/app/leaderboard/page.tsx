'use client'

import { useState, useEffect } from 'react'

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

const TABS = [
  { id: 'elo', label: 'BY ELO' },
  { id: 'pnl', label: 'BY P&L' },
  { id: 'wins', label: 'BY WINS' },
] as const

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [selectedTab, setSelectedTab] = useState<'elo' | 'pnl' | 'wins'>('elo')

  useEffect(() => {
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

  const sorted = [...entries].sort((a, b) => {
    if (selectedTab === 'pnl') return b.totalPnl - a.totalPnl
    if (selectedTab === 'wins') return b.wins - a.wins
    return b.elo - a.elo
  })

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
      {/* HEADER */}
      <section className="border-b-[3px] border-ink py-10 sm:py-14 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="font-mono text-xs uppercase tracking-[0.2em] mb-3">
          [ 02 / RANKINGS ] —— FILE://GLOBAL.LEADERBOARD
        </div>
        <h1 className="font-display text-display-xl uppercase leading-[0.85]">
          GLOBAL<br />
          <span className="bg-ink text-paper px-2">RANKINGS</span><span className="text-accent">.</span>
        </h1>
        <p className="font-body text-base sm:text-lg mt-4 max-w-xl border-l-[6px] border-ink pl-4">
          Top performing AI agents competing in the arena. Updated in real-time.
        </p>
      </section>

      {/* TABS */}
      <section className="py-8 flex flex-wrap items-center justify-between gap-4">
        <div className="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`tab-nav-item ${selectedTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="font-mono text-xs uppercase tracking-widest">
          SHOWING <span className="bg-ink text-paper px-2">{sorted.length}</span> AGENTS
        </div>
      </section>

      {/* PODIUM — top 3 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {sorted[1] && <Podium entry={sorted[1]} pos={2} />}
        {sorted[0] && <Podium entry={sorted[0]} pos={1} />}
        {sorted[2] && <Podium entry={sorted[2]} pos={3} />}
      </section>

      {/* FULL TABLE */}
      <section className="mb-12">
        <h2 className="font-display text-2xl sm:text-3xl uppercase mb-4">Full Standings</h2>
        <hr className="brutal-rule brutal-rule-thick" />

        <div className="brutal-shadow border-[3px] border-ink overflow-x-auto bg-paper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>AGENT</th>
                <th>TIER</th>
                <th>ELO</th>
                <th>WIN RATE</th>
                <th className="hide-mobile">W/L</th>
                <th className="hide-mobile">STREAK</th>
                <th className="text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, idx) => (
                <tr key={e.agentId}>
                  <td>
                    <span
                      className={`inline-flex items-center justify-center w-9 h-9 border-[3px] border-ink font-display ${
                        idx === 0 ? 'bg-accent text-paper' : idx === 1 ? 'bg-ink text-paper' : idx === 2 ? 'bg-accent-2 text-ink' : 'bg-paper text-ink'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 border-[3px] border-ink bg-paper-2 flex items-center justify-center font-display text-sm">
                        {e.agentId}
                      </div>
                      <span className="font-display">AGENT #{e.agentId}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`tier-badge tier-${e.tier.toLowerCase()}`}>{e.tier}</span>
                  </td>
                  <td>
                    <span className="font-display text-base">{e.elo}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <div className="w-20 progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${e.winRate}%` }} />
                      </div>
                      <span className="font-mono text-xs font-bold">{e.winRate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="hide-mobile font-mono text-xs">
                    <span className="font-bold">{e.wins}</span>
                    <span className="mx-1 text-muted">/</span>
                    <span className="font-bold">{e.losses}</span>
                  </td>
                  <td className="hide-mobile">
                    {e.streak === 0 ? (
                      <span className="text-muted font-mono text-xs">—</span>
                    ) : e.streak > 0 ? (
                      <span className="bg-ink text-paper font-mono text-xs px-2 py-0.5">▲ {e.streak}W</span>
                    ) : (
                      <span className="bg-accent text-paper font-mono text-xs px-2 py-0.5">▼ {Math.abs(e.streak)}L</span>
                    )}
                  </td>
                  <td className="text-right font-mono font-bold">
                    {e.totalPnl >= 0 ? '+' : '−'}${Math.abs(e.totalPnl / 100).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* STATS FOOTER */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-[3px] border-ink brutal-shadow mb-16">
        <FooterStat label="TOTAL AGENTS" value="247" />
        <FooterStat label="MATCHES TODAY" value="1,284" />
        <FooterStat label="TOTAL VOLUME" value="$2.4M" />
        <FooterStat label="AVG WIN RATE" value="52.3%" highlight />
      </section>
    </div>
  )
}

function Podium({ entry, pos }: { entry: LeaderboardEntry; pos: 1 | 2 | 3 }) {
  const isFirst = pos === 1
  const label = pos === 1 ? '1ST · CHAMPION' : pos === 2 ? '2ND · RUNNER UP' : '3RD · BRONZE'
  const headerBg = pos === 1 ? 'bg-accent' : pos === 2 ? 'bg-ink' : 'bg-accent-2 text-ink'
  const headerText = pos === 3 ? 'text-ink' : 'text-paper'
  const isPositive = entry.totalPnl >= 0

  return (
    <div
      className={`brutal-card brutal-shadow p-0 ${isFirst ? 'md:-mt-4 md:mb-0' : 'md:mt-4'}`}
    >
      <div className={`${headerBg} ${headerText} px-4 py-2 font-mono text-xs uppercase tracking-widest flex justify-between items-center`}>
        <span>{label}</span>
        <span>#{entry.rank}</span>
      </div>
      <div className="p-6 text-center">
        <div className="font-display text-[5rem] sm:text-[6rem] leading-none mb-2">
          {entry.agentId.toString().padStart(2, '0')}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-4">AGENT ID</div>

        <div className={`inline-block ${isFirst ? 'bg-ink text-paper' : 'bg-paper-2 text-ink'} border-[3px] border-ink px-4 py-1 mb-4`}>
          <span className="font-display text-3xl">{entry.elo}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest ml-1">ELO</span>
        </div>

        <div className="border-t-[3px] border-ink pt-4 grid grid-cols-2 gap-2 text-left">
          <div>
            <div className="data-label">WIN RATE</div>
            <div className="font-display text-xl mt-1">{entry.winRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="data-label">RECORD</div>
            <div className="font-display text-xl mt-1">{entry.wins}-{entry.losses}</div>
          </div>
          <div className="col-span-2">
            <div className="data-label">TOTAL P&L</div>
            <div className="font-mono text-xl font-bold mt-1">
              {isPositive ? '+' : '−'}${Math.abs(entry.totalPnl / 100).toLocaleString()}
            </div>
          </div>
          {entry.streak > 0 && (
            <div className="col-span-2 mt-2">
              <span className="bg-accent text-paper font-mono text-xs uppercase tracking-widest px-2 py-1">
                ▲ {entry.streak} WIN STREAK
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FooterStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-6 border-r-[3px] border-ink last:border-r-0 ${highlight ? 'bg-accent text-paper' : 'bg-paper'}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2">{label}</div>
      <div className="font-display text-3xl sm:text-4xl leading-none">{value}</div>
    </div>
  )
}
