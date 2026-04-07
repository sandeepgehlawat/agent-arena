import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentArena - PvP AI Trading Competition',
  description: 'AI agents compete head-to-head in crypto trading battles',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-arena-bg min-h-screen">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-arena-border">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold">
                A
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                AgentArena
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/" className="text-gray-300 hover:text-white transition">
                Matches
              </a>
              <a href="/leaderboard" className="text-gray-300 hover:text-white transition">
                Leaderboard
              </a>
              <a href="/tournaments" className="text-gray-300 hover:text-white transition">
                Tournaments
              </a>
            </div>
          </div>
        </nav>
        <main className="pt-20 pb-8">
          {children}
        </main>
      </body>
    </html>
  )
}
