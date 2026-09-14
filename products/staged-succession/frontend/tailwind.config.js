/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        phase1: '#0ea5e9',
        phase2: '#8b5cf6',
        phase3: '#f59e0b',
        // --- NOREN design system tokens (see src/index.css for the CSS
        // variables these reference). Additive only: none of these names
        // collide with Tailwind's built-in palette, so no existing class
        // (bg-white, text-slate-900, border-slate-200, ...) is affected.
        background: 'var(--noren-background)',
        surface: 'var(--noren-surface)',
        'surface-secondary': 'var(--noren-surface-secondary)',
        stripe: 'var(--noren-stripe)',
        foreground: 'var(--noren-foreground)',
        'muted-foreground': 'var(--noren-secondary-text)',
        border: 'var(--noren-border)',
        accent: 'var(--noren-accent)',
        'accent-secondary': 'var(--noren-accent-secondary)',
        'accent-foreground': 'var(--noren-accent-foreground)',
        gold: 'var(--noren-gold)',
        danger: 'var(--noren-danger)',
        success: 'var(--noren-success)',
      },
      fontFamily: {
        // Additive named families — the default `sans` stack used by
        // existing pages is untouched, so current typography is unchanged.
        mincho: ['"Shippori Mincho"', 'serif'],
        jp: ['"Noto Sans JP"', '"Inter"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px color-mix(in srgb, var(--noren-accent) 6%, transparent), 0 12px 32px -12px color-mix(in srgb, var(--noren-accent) 18%, transparent)',
        float: '0 2px 6px color-mix(in srgb, var(--noren-accent) 8%, transparent), 0 24px 48px -16px color-mix(in srgb, var(--noren-accent) 26%, transparent)',
      },
      keyframes: {
        'noren-rise': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'noren-scale-in': {
          from: { opacity: 0, transform: 'scale(0.96)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        'noren-sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'noren-overlay-fade': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        'noren-shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'noren-rise': 'noren-rise 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'noren-scale-in': 'noren-scale-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'noren-sheet-up': 'noren-sheet-up 0.42s cubic-bezier(0.16,1,0.3,1) both',
        'noren-overlay-fade': 'noren-overlay-fade 0.3s ease both',
        'noren-shimmer': 'noren-shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
