import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const electronCommand = process.platform === 'win32' ? 'electron.cmd' : 'electron'
const children = new Set()

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  return child
}

function stopAll() {
  for (const child of children) {
    child.kill()
  }
}

process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)

const contractsBuild = run(npmCommand, ['run', 'build', '--workspace', '@multi-idle/contracts'], {
  cwd: new URL('../../../', import.meta.url),
})

contractsBuild.once('exit', (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1
    return
  }

  const mainBuild = run(npmCommand, ['run', 'build:main', '--', '--watch'])
  const vite = run(npmCommand, ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', '5173'])

  const waitForVite = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const response = await fetch('http://127.0.0.1:5173')
        if (response.ok) return
      } catch {
        // Vite is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('Vite did not start within 10 seconds')
  }

  waitForVite()
    .then(() => {
      const electron = run(electronCommand, ['.'], {
        env: {
          ...process.env,
          MULTI_IDLE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
        },
      })
      electron.once('exit', (electronCode) => {
        mainBuild.kill()
        vite.kill()
        process.exitCode = electronCode ?? 0
      })
    })
    .catch((error) => {
      console.error(error)
      stopAll()
      process.exitCode = 1
    })
})
