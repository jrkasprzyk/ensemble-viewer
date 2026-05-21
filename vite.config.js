import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  // Use the automatic JSX runtime everywhere (jsx imported from react/jsx-runtime).
  // App source intentionally never imports React; this keeps the vitest transform
  // consistent with the dev build so component tests don't hit "React is not defined".
  esbuild: { jsx: 'automatic' },
  test: {
    // Default env is Node — lib tests are pure functions with no DOM. Component
    // tests opt into jsdom per-file with a `// @vitest-environment jsdom` pragma.
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
