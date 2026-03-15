import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/manga-bookshelf/',  // ← important for GitHub Pages
  plugins: [react()]
})
