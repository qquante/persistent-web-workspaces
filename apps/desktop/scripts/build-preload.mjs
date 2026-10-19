import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const appDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

await build({
  entryPoints: [path.join(appDirectory, 'src', 'preload', 'index.cts')],
  outfile: path.join(appDirectory, 'dist', 'preload', 'index.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
  logLevel: 'info',
})
