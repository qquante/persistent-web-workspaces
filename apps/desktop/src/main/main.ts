import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Tray,
} from 'electron'

import { registerIpc } from './ipc.js'
import { Repository } from './repository.js'
import { SessionManager } from './session-manager.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const smokeMode = process.env.MULTI_IDLE_SMOKE === '1'
const customUserDataPath = process.env.MULTI_IDLE_USER_DATA

if (customUserDataPath) {
  mkdirSync(customUserDataPath, { recursive: true })
  app.setPath('userData', customUserDataPath)
}

app.setName('Multi Idle')

const hasSingleInstanceLock = app.requestSingleInstanceLock()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let repository: Repository | null = null
let sessionManager: SessionManager | null = null
let unregisterIpc: (() => void) | null = null
let quitting = false

function createTray(): void {
  if (smokeMode || tray) return
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#101722"/>
      <path d="M8 23V9h4l4 7 4-7h4v14h-4v-8l-4 7-4-7v8z" fill="#f3b329"/>
    </svg>`
  const icon = nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    .resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Multi Idle')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Abrir Multi Idle',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        },
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

async function createMainWindow(): Promise<void> {
  repository = new Repository(path.join(app.getPath('userData'), 'multi-idle.sqlite'))
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1_080,
    minHeight: 680,
    show: false,
    title: 'Multi Idle',
    backgroundColor: '#080d14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDirectory, '..', 'preload', 'index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  sessionManager = new SessionManager(mainWindow, repository)
  unregisterIpc = registerIpc(mainWindow, repository, sessionManager)

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.MULTI_IDLE_DEV_SERVER_URL
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file:')
    if (!allowed) event.preventDefault()
  })

  mainWindow.on('minimize', () => sessionManager?.setHostVisible(false))
  mainWindow.on('hide', () => sessionManager?.setHostVisible(false))
  mainWindow.on('restore', () => sessionManager?.setHostVisible(true))
  mainWindow.on('show', () => sessionManager?.setHostVisible(true))
  mainWindow.on('close', (event) => {
    if (quitting || smokeMode) return
    event.preventDefault()
    mainWindow?.hide()
  })

  const devServerUrl = process.env.MULTI_IDLE_DEV_SERVER_URL
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl)
  } else {
    await mainWindow.loadFile(path.join(currentDirectory, '..', 'renderer', 'index.html'))
  }

  mainWindow.show()
  createTray()

  if (smokeMode) {
    const smokeState = (await mainWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        let attempts = 0
        const check = () => {
          const value = {
            hasDesktopApi: typeof window.multiIdle !== 'undefined',
            hasShell: document.querySelector('.app-shell') !== null
          }
          if (value.hasShell || attempts >= 100) {
            resolve(value)
            return
          }
          attempts += 1
          setTimeout(check, 50)
        }
        check()
      })
    `)) as { hasDesktopApi: boolean; hasShell: boolean }
    if (!smokeState.hasDesktopApi || !smokeState.hasShell) {
      throw new Error(`Renderer smoke failed: ${JSON.stringify(smokeState)}`)
    }

    const smokeUrl = process.env.MULTI_IDLE_SMOKE_URL
    const smokeSessionPath = process.env.MULTI_IDLE_SMOKE_SESSION_PATH
    if (smokeUrl && smokeSessionPath) {
      const workspace = repository.listWorkspaces()[0]
      if (!workspace) throw new Error('Smoke workspace was not created')
      const profile = repository.createProfile({
        workspaceId: workspace.id,
        name: 'Smoke profile',
        startUrl: smokeUrl,
        priority: 'normal',
      })
      await sessionManager.start(profile.id)
      sessionManager.setBounds(profile.id, { x: 360, y: 120, width: 800, height: 560 })
      const sessionState = sessionManager
        .snapshot()
        .sessions.find((candidate) => candidate.profileId === profile.id)?.state
      if (sessionState !== 'online') {
        throw new Error(`Session smoke failed with state: ${sessionState ?? 'missing'}`)
      }
      mkdirSync(path.dirname(smokeSessionPath), { recursive: true })
      writeFileSync(smokeSessionPath, await sessionManager.capturePng(profile.id))
    }
    const image = await mainWindow.webContents.capturePage()
    const outputPath = process.env.MULTI_IDLE_SMOKE_PATH
    if (!outputPath) throw new Error('MULTI_IDLE_SMOKE_PATH is required in smoke mode')
    mkdirSync(path.dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, image.toPNG())
    quitting = true
    app.quit()
  }
}

if (hasSingleInstanceLock) {
  app.whenReady().then(createMainWindow).catch((error: unknown) => {
    console.error(error)
    quitting = true
    app.exit(1)
  })
} else {
  app.quit()
}

app.on('second-instance', () => {
  mainWindow?.show()
  mainWindow?.focus()
})

app.on('activate', () => {
  mainWindow?.show()
  mainWindow?.focus()
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  unregisterIpc?.()
  unregisterIpc = null
  sessionManager?.destroy()
  sessionManager = null
  repository?.close()
  repository = null
  tray?.destroy()
  tray = null
})
