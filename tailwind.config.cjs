// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{tsx,ts,jsx,js,html}'],
  theme: {
    extend: {
      // ── Color tokens linked to CSS variables ──────────────────────────────
      colors: {
        // Semantic brand colors
        'color-primary':         'var(--color-primary)',
        'color-primary-hover':   'var(--color-primary-hover)',
        'color-primary-active':  'var(--color-primary-active)',
        'color-secondary':       'var(--color-secondary)',
        'color-secondary-hover': 'var(--color-secondary-hover)',
        'color-accent':          'var(--color-accent)',
        'color-accent-hover':    'var(--color-accent-hover)',
        // Status colors
        'color-success':         'var(--color-success)',
        'color-warning':         'var(--color-warning)',
        'color-error':           'var(--color-error)',
        'color-info':            'var(--color-info)',
        // Surface / text (resolved per active theme)
        'surface-primary':       'var(--surface-primary)',
        'surface-secondary':     'var(--surface-secondary)',
        'surface-hover':         'var(--surface-hover)',
        'text-primary':          'var(--text-primary)',
        'text-secondary':        'var(--text-secondary)',
        'text-muted':            'var(--text-muted)',
        'text-strong':           'var(--text-strong)',
        'bg-primary':            'var(--bg-primary)',
        'bg-surface':            'var(--bg-surface)',
        'bg-panel':              'var(--bg-panel)',
        'bg-modal':              'var(--bg-modal)',
        // Glass tokens
        'glass-surface':         'var(--glass-surface)',
        'glass-border':          'var(--glass-border)',
        'glass-text':            'var(--glass-text)',
        'glass-text-muted':      'var(--glass-text-muted)',
        // Border tokens
        'border-primary':        'var(--border-primary)',
        'border-secondary':      'var(--border-secondary)',
        'border-subtle':         'var(--border-subtle)',
      },

      // ── Spacing linked to CSS variables ───────────────────────────────────
      spacing: {
        'xs':  'var(--spacing-xs)',
        'sm':  'var(--spacing-sm)',
        'md':  'var(--spacing-md)',
        'lg':  'var(--spacing-lg)',
        'xl':  'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        '3xl': 'var(--spacing-3xl)',
      },

      // ── Border radius linked to CSS variables ─────────────────────────────
      borderRadius: {
        'token':    'var(--border-radius)',
        'token-lg': 'var(--border-radius-lg)',
        'token-xl': 'var(--border-radius-xl)',
      },

      // ── Box shadow linked to CSS variables ────────────────────────────────
      boxShadow: {
        'glass':    'var(--shadow-glass)',
        'glass-lg': 'var(--shadow-glass-lg)',
        'glass-xl': 'var(--shadow-glass-xl)',
        'token-sm': 'var(--shadow-sm)',
        'token':    'var(--shadow-default)',
        'token-md': 'var(--shadow-md)',
        'token-lg': 'var(--shadow-lg)',
        'token-xl': 'var(--shadow-xl)',
      },

      // ── Font family linked to CSS variables ───────────────────────────────
      fontFamily: {
        sans:  ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        mono:  ['var(--font-mono)'],
      },

      // ── Transition timing linked to CSS variables ─────────────────────────
      transitionDuration: {
        fast:   'var(--duration-150)',
        base:   'var(--duration-200)',
        slow:   'var(--duration-300)',
      },
      transitionTimingFunction: {
        'ease-out-token':    'var(--ease-out)',
        'ease-in-out-token': 'var(--ease-in-out)',
      },

      // ── Backdrop blur linked to CSS variables ─────────────────────────────
      backdropBlur: {
        glass:        '20px',
        'glass-sm':   '10px',
        'glass-lg':   '40px',
      },
    },
  },
  plugins: [],
};
