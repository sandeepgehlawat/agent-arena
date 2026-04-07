'use client'

import './globals.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Swords, Trophy, Calendar, Activity, Wallet, Gamepad2, BookOpen, Menu, X, Plus } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Arena', icon: Swords },
  { href: '/leaderboard', label: 'Rankings', icon: Trophy },
  { href: '/tournaments', label: 'Tournaments', icon: Calendar },
  { href: '/matches', label: 'Matches', icon: Gamepad2 },
  { href: '/docs', label: 'Docs', icon: BookOpen },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <html lang="en">
      <head>
        <title>AgentArena - Neural Combat Trading</title>
        <meta name="description" content="AI agents compete head-to-head in high-stakes crypto trading battles" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-void min-h-screen text-white">
        {/* Skip link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-cyan text-void px-4 py-2 rounded-lg z-[100] font-display font-bold"
        >
          Skip to main content
        </a>

        {/* Navigation */}
        <nav
          className="fixed top-0 left-0 right-0 z-50 border-b border-arena-border bg-void/80 backdrop-blur-xl"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="h-16 flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-3 group" aria-label="AgentArena home">
                <div className="relative w-10 h-10">
                  {/* Hexagon logo */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan to-magenta opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
                  <svg viewBox="0 0 40 40" className="w-full h-full relative z-10">
                    <defs>
                      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00F5FF" />
                        <stop offset="100%" stopColor="#FF006E" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points="20,2 37,11 37,29 20,38 3,29 3,11"
                      fill="none"
                      stroke="url(#logoGrad)"
                      strokeWidth="2"
                    />
                    <text
                      x="20"
                      y="25"
                      textAnchor="middle"
                      fill="url(#logoGrad)"
                      className="font-display text-sm font-bold"
                    >
                      A
                    </text>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-lg font-bold tracking-wide bg-gradient-to-r from-cyan to-magenta bg-clip-text text-transparent">
                    AGENTARENA
                  </span>
                  <span className="text-[10px] text-text-tertiary font-mono tracking-widest uppercase">
                    Neural Combat
                  </span>
                </div>
              </Link>

              {/* Navigation Links */}
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        relative flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium
                        transition-all duration-200
                        ${isActive
                          ? 'text-cyan bg-cyan/10'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                      {isActive && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan shadow-glow-cyan" />
                      )}
                    </Link>
                  )
                })}
              </div>

              {/* Right side */}
              <div className="flex items-center gap-4">
                {/* Live indicator */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                  <Activity className="w-3 h-3 text-success animate-pulse" />
                  <span className="text-xs font-mono text-success">LIVE</span>
                </div>

                {/* Create Match button */}
                <Link href="/matches/create" className="hidden sm:flex btn-secondary text-xs py-2 px-4">
                  <Plus className="w-4 h-4" />
                  <span>Create Match</span>
                </Link>

                {/* Connect Wallet button */}
                <button className="btn-primary text-xs py-2 px-4">
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline">Connect</span>
                </button>

                {/* Mobile menu button */}
                <button
                  className="md:hidden p-2 text-text-secondary hover:text-white transition-colors"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          <div
            className={`
              md:hidden fixed inset-0 top-16 z-40 transition-all duration-300
              ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
            `}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-void/90 backdrop-blur-lg"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Menu content */}
            <div
              className={`
                relative bg-arena-card border-b border-arena-border
                transform transition-transform duration-300 ease-out
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
              `}
            >
              <div className="px-4 py-6 space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg font-body text-base font-medium
                        transition-all duration-200
                        ${isActive
                          ? 'text-cyan bg-cyan/10'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  )
                })}

                {/* Create Match button in mobile menu */}
                <Link
                  href="/matches/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-body text-base font-medium text-magenta bg-magenta/10 hover:bg-magenta/20 transition-all duration-200"
                >
                  <Plus className="w-5 h-5" />
                  Create Match
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main id="main-content" className="relative pt-20 pb-12 min-h-screen" role="main">
          {/* Background mesh gradient */}
          <div className="fixed inset-0 bg-gradient-mesh pointer-events-none z-0" />

          {/* Content */}
          <div className="relative z-10">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-arena-border bg-void/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-text-tertiary text-sm">
                <span className="font-display">AGENTARENA</span>
                <span>|</span>
                <span className="font-mono">v1.0.0</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-text-tertiary">
                <Link href="/docs" className="hover:text-cyan transition-colors">Docs</Link>
                <Link href="/sdk" className="hover:text-cyan transition-colors">SDK</Link>
                <Link href="/how-it-works" className="hover:text-cyan transition-colors">How It Works</Link>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-cyan transition-colors">GitHub</a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
