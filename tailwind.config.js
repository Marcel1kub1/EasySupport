/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#050708',
        panel: '#0a0c0f',
        border: '#12181f',
        text: '#f8fafc',
        muted: '#94a3b8',
        accent: '#5865f2',
        accent2: '#ec4899',
        ok: '#10b981',
        warn: '#f59e0b',
        err: '#ef4444',
        slate: '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        drift: 'drift 14s ease-in-out infinite alternate',
        marquee: 'marquee 22s linear infinite',
        'glitch-1': 'glitch-1 3s infinite linear alternate-reverse',
        'glitch-2': 'glitch-2 2.5s infinite linear alternate-reverse',
      },
      keyframes: {
        drift: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '100%': { transform: 'translate(45px, -70px) scale(1.18)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'glitch-1': {
          '0%': { clip: 'rect(60px, 9999px, 75px, 0)' },
          '20%': { clip: 'rect(340px, 9999px, 8px, 0)' },
          '40%': { clip: 'rect(58px, 9999px, 86px, 0)' },
          '60%': { clip: 'rect(12px, 9999px, 55px, 0)' },
          '80%': { clip: 'rect(210px, 9999px, 14px, 0)' },
          '100%': { clip: 'rect(16px, 9999px, 88px, 0)' },
        },
        'glitch-2': {
          '0%': { clip: 'rect(12px, 9999px, 82px, 0)' },
          '30%': { clip: 'rect(92px, 9999px, 4px, 0)' },
          '50%': { clip: 'rect(14px, 9999px, 68px, 0)' },
          '70%': { clip: 'rect(10px, 9999px, 88px, 0)' },
          '100%': { clip: 'rect(72px, 9999px, 18px, 0)' },
        },
      },
      borderRadius: {
        xl: '10px',
      },
    },
  },
  plugins: [],
};
