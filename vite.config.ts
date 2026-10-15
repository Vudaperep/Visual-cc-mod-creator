import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { modCreatorApi } from './server/api'

export default defineConfig({
  plugins: [react(), modCreatorApi()],
  server: { host: '127.0.0.1', port: 5177 },
})
