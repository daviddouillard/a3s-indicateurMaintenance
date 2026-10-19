import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En dev : le frontend (Vite, :5173) appelle /api ; on relaie vers le
// backend Express local (:8080) qui détient les clés. Lancer `npm run server`
// en parallèle de `npm run dev`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
