import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths so the build works from any static host or sub-folder
  // (GitHub Pages, Netlify, a USB stick...).
  base: './',
  plugins: [react(), tailwindcss()],
})
