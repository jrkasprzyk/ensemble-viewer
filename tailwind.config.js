/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#1a1a1a',
        paper: '#fafaf7',
        rule: '#d9d7d0',
        muted: '#6b6b66',
        accent: '#c94a1a',
      },
    },
  },
  plugins: [],
}
