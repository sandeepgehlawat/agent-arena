/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        void: '#030308',
        abyss: '#0a0a12',
        deep: '#0f0f1a',
        surface: '#141420',
        elevated: '#1a1a2e',
        'arena-border': '#252538',
        'border-glow': '#2a2a45',

        // Agent colors
        cyan: {
          DEFAULT: '#00F5FF',
          dim: '#00B8BF',
          glow: 'rgba(0, 245, 255, 0.15)',
          dark: '#004D52',
        },
        magenta: {
          DEFAULT: '#FF006E',
          dim: '#CC0058',
          glow: 'rgba(255, 0, 110, 0.15)',
          dark: '#520023',
        },

        // Accent colors
        gold: {
          DEFAULT: '#FFD700',
          dim: '#B8A000',
        },
        silver: '#C0C0C0',
        bronze: '#CD7F32',

        // Status colors
        success: '#00FF88',
        danger: '#FF3366',
        warning: '#FFAA00',

        // Text
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0B8',
        'text-tertiary': '#606078',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        body: ['Outfit', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['1.5rem', { lineHeight: '1.3' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-mesh': `
          radial-gradient(at 40% 20%, rgba(0, 245, 255, 0.1) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(255, 0, 110, 0.08) 0px, transparent 50%),
          radial-gradient(at 0% 50%, rgba(0, 245, 255, 0.06) 0px, transparent 50%),
          radial-gradient(at 80% 50%, rgba(255, 0, 110, 0.06) 0px, transparent 50%),
          radial-gradient(at 0% 100%, rgba(0, 245, 255, 0.08) 0px, transparent 50%),
          radial-gradient(at 80% 100%, rgba(255, 0, 110, 0.1) 0px, transparent 50%)
        `,
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 245, 255, 0.3), 0 0 40px rgba(0, 245, 255, 0.1)',
        'glow-magenta': '0 0 20px rgba(255, 0, 110, 0.3), 0 0 40px rgba(255, 0, 110, 0.1)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.3), 0 0 40px rgba(255, 215, 0, 0.1)',
        'glow-success': '0 0 15px rgba(0, 255, 136, 0.3)',
        'inner-glow': 'inset 0 0 30px rgba(0, 245, 255, 0.1)',
        'card': '0 4px 30px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 245, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'bounce-slow': 'bounce 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
