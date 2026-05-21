import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/proxy-metrics': {
        target: process.env.VITE_GOST_METRICS_TARGET ?? 'http://192.168.193.130:9000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy-metrics/, '/metrics'),
      },
      '/proxy-logs': {
        target: process.env.VITE_GOST_LOGFEED_TARGET ?? 'http://192.168.193.130:19090',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy-logs/, ''),
      },
    },
  },
})
