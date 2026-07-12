import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/deepwalk/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})
