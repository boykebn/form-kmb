import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const apiPort = env.PORT || '4100'

  return {
    plugins: [react()],
    envDir: '..',
    server: {
      proxy: {
        '/api': `http://localhost:${apiPort}`,
        '/uploads': `http://localhost:${apiPort}`,
      },
    },
  }
})
