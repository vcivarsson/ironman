import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ironman/',
  plugins: [react()],
  server: {
    proxy: {
      '/ical': {
        target: 'https://www.trainingpeaks.com',
        changeOrigin: true,
      },
    },
  },
})
