import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.join(currentDirectory, 'src', 'renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.join(currentDirectory, 'dist', 'renderer'),
    emptyOutDir: true,
  },
})

