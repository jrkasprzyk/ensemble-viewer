import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  test: {
    // Node environment is sufficient — all lib tests are pure functions with no DOM.
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
