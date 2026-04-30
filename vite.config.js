import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://13.239.19.148:8000',   // ← use 127.0.0.1 not localhost
        changeOrigin: true,
        rewrite: (path) => path             // keep /api prefix
      }
    }
  }
})