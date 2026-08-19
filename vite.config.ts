import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devApi } from './scripts/dev-api.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi()],
})
