import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Dev only: forward /api to a local backend when VITE_API_URL is not set.
      proxy: env.VITE_API_URL ? undefined : { '/api': env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000' },
    },
  }
})
