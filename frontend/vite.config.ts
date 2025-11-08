import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Detect environment (so local dev still works fine)
const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [react()],
  base: '/', // ✅ Important! Ensures all assets load from root when served via CloudFront
  server: {
    host: '0.0.0.0',
    port: 8081,
    proxy: {
      // ✅ Forward /api requests to your local backend during dev
      '/api': {
        target: 'http://localhost:3000', // your backend port (or API Gateway invoke URL if testing remotely)
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  build: {
    outDir: 'dist', // default is fine
    sourcemap: !isProd,
  },
})
