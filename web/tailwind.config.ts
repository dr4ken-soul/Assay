/** Tailwind configuration for the Assay landing page. Values are fixed by the spec. */
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        bench: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        indicator: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          glow: 'var(--accent-glow)',
        },
        line: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        tile: '12px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        tile: 'inset 0 1px 1px rgba(255, 255, 255, 0.65), var(--shadow-sm)',
      },
    },
  },
  plugins: [],
}

export default config
