import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: currentDirectory,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
