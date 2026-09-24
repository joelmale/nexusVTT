import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { resolveAdminUiBase } from './adminUiBase'

// https://vite.dev/config/
export default defineConfig({
  // The private admin listener serves the UI at `/`. ADMIN_UI_BASE overrides
  // it for other hosts; the router basename follows import.meta.env.BASE_URL.
  base: resolveAdminUiBase(process.env.ADMIN_UI_BASE),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
