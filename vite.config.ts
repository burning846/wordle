/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devApi } from './scripts/dev-api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi()],
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    // The API tests share one in-process Postgres, so they must not run concurrently.
    fileParallelism: false,
  },
})
