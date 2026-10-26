import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the app works under https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react()],
})
