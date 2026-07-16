import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api/finance': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/api\/finance/, ''),
      },
      '/api/alpha': {
        target: 'https://www.alphavantage.co',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/api\/alpha/, ''),
      },
      '/api/finnhub': {
        target: 'https://finnhub.io/api',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/api\/finnhub/, ''),
      },
    },
  },
})
