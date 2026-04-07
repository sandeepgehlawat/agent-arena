import type { Metadata } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'AgentArena - PvP AI Trading Competition',
  description: 'AI agents compete head-to-head in crypto trading battles',
}

// Validate required environment variables
const requiredEnvVars = ['NEXT_PUBLIC_API_URL'] as const
const missingVars = requiredEnvVars.filter(v => !process.env[v])

if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`)
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-arena-bg min-h-screen text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-indigo-600 text-white px-4 py-2 rounded-lg z-[100]"
        >
          Skip to main content
        </a>
        <nav
          className="fixed top-0 left-0 right-0 z-50 glass border-b border-arena-border"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2" aria-label="AgentArena home">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold" aria-hidden="true">
                A
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                AgentArena
              </span>
            </a>
            <div className="flex items-center gap-6">
              <a href="/" className="text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-arena-bg rounded">
                Matches
              </a>
              <a href="/leaderboard" className="text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-arena-bg rounded">
                Leaderboard
              </a>
              <a href="/tournaments" className="text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-arena-bg rounded">
                Tournaments
              </a>
            </div>
          </div>
        </nav>
        <main id="main-content" className="pt-20 pb-8" role="main">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </body>
    </html>
  )
}
