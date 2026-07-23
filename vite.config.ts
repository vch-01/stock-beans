import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
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
      '/api/alpaca': {
        target: 'https://data.alpaca.markets',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/api\/alpaca/, ''),
      },
    },
  },
})
