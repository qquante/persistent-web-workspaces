import { mkdirSync } from 'node:fs'
import path from 'node:path'

import {
  app,
  BrowserWindow,
  session,
  WebContentsView,
  type Session,
} from 'electron'
import type {
  DashboardSnapshot,
  Profile,
  SessionSnapshot,
  SessionState,
  ViewBounds,
} from '@multi-idle/contracts'
import { ipcChannels } from '@multi-idle/contracts'

import type { Repository } from './repository.js'
import { isAllowedNavigation, normalizeHttpUrl } from './url-policy.js'

interface ManagedSession {
  profile: Profile
  view: WebContentsView
  state: Exclude<SessionState, 'stopped' | 'hidden'>
  userVisible: boolean
  bounds: ViewBounds | null
  title: string
  url: string
  cpuPercent: number
  memoryMb: number
  lastError: string | null
}

const allowedPassivePermissions = new Set(['fullscreen', 'pointerLock'])

export class SessionManager {
  readonly #window: BrowserWindow
  readonly #repository: Repository
  readonly #sessions = new Map<string, ManagedSession>()
  readonly #configuredPartitions = new Set<string>()
  readonly #metricsTimer: NodeJS.Timeout
  #hostVisible = true
  #shellOverlay = false

  constructor(window: BrowserWindow, repository: Repository) {
    this.#window = window
    this.#repository = repository
    this.#metricsTimer = setInterval(() => this.#sampleMetrics(), 2_000)
    this.#metricsTimer.unref()
  }

  snapshot(): DashboardSnapshot {
    const profiles = this.#repository.listProfiles()
    return {
      workspaces: this.#repository.listWorkspaces(),
      profiles,
      sessions: profiles.map((profile) => this.#sessionSnapshot(profile)),
      gpu: {
        enabled: app.isHardwareAccelerationEnabled(),
        status: app.isHardwareAccelerationEnabled()
          ? 'Aceleração por hardware ativa'
          : 'Modo gráfico seguro',
      },
    }
  }

  async start(profileId: string): Promise<void> {
    const existing = this.#sessions.get(profileId)
    if (existing) {
      existing.userVisible = true
      this.#syncVisibility(existing)
      this.#emitSnapshot()
      return
    }

    const profile = this.#requiredProfile(profileId)
    if (!profile.enabled) throw new Error('Este perfil está desabilitado.')

    const partition = `persist:profile-${profile.id}`
    const isolatedSession = session.fromPartition(partition, { cache: true })
    this.#configureSession(partition, isolatedSession, profile)

    const view = new WebContentsView({
      webPreferences: {
        session: isolatedSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: false,
      },
    })
    view.setBackgroundColor('#0b1018')
    view.setVisible(false)

    const managed: ManagedSession = {
      profile,
      view,
      state: 'starting',
      userVisible: true,
      bounds: null,
      title: profile.name,
      url: profile.startUrl,
      cpuPercent: 0,
      memoryMb: 0,
      lastError: null,
    }
    this.#sessions.set(profile.id, managed)
    this.#window.contentView.addChildView(view)
    this.#attachWebContentsEvents(managed)
    this.#emitSnapshot()

    try {
      await view.webContents.loadURL(profile.startUrl)
    } catch (error) {
      managed.state = 'error'
      managed.lastError = error instanceof Error ? error.message : 'Falha ao carregar a sessão.'
      this.#emitSnapshot()
    }
  }

  stop(profileId: string): void {
    const managed = this.#sessions.get(profileId)
    if (!managed) return

    this.#sessions.delete(profileId)
    this.#window.contentView.removeChildView(managed.view)
    if (!managed.view.webContents.isDestroyed()) managed.view.webContents.close()
    this.#emitSnapshot()
  }

  show(profileId: string): void {
    const managed = this.#requiredSession(profileId)
    managed.userVisible = true
    this.#syncVisibility(managed)
    this.#emitSnapshot()
  }

  hide(profileId: string): void {
    const managed = this.#requiredSession(profileId)
    managed.userVisible = false
    this.#syncVisibility(managed)
    this.#emitSnapshot()
  }

  setHostVisible(visible: boolean): void {
    this.#hostVisible = visible
    for (const managed of this.#sessions.values()) this.#syncVisibility(managed)
  }

  setShellOverlay(active: boolean): void {
    this.#shellOverlay = active
    for (const managed of this.#sessions.values()) this.#syncVisibility(managed)
  }

  setBounds(profileId: string, bounds: ViewBounds | null): void {
    const managed = this.#sessions.get(profileId)
    if (!managed) return
    managed.bounds = bounds
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      managed.view.setBounds(bounds)
    }
    this.#syncVisibility(managed)
  }

  async navigate(profileId: string, rawUrl: string): Promise<void> {
    const managed = this.#requiredSession(profileId)
    const url = normalizeHttpUrl(rawUrl)
    managed.url = url
    managed.lastError = null
    managed.state = 'starting'
    this.#emitSnapshot()
    await managed.view.webContents.loadURL(url)
  }

  goBack(profileId: string): void {
    const contents = this.#requiredSession(profileId).view.webContents
    if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
  }

  goForward(profileId: string): void {
    const contents = this.#requiredSession(profileId).view.webContents
    if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
  }

  reload(profileId: string): void {
    this.#requiredSession(profileId).view.webContents.reload()
  }

  async capturePng(profileId: string): Promise<Buffer> {
    const image = await this.#requiredSession(profileId).view.webContents.capturePage()
    return image.toPNG()
  }

  destroy(): void {
    clearInterval(this.#metricsTimer)
    for (const profileId of this.#sessions.keys()) this.stop(profileId)
  }

  #requiredProfile(profileId: string): Profile {
    const profile = this.#repository.getProfile(profileId)
    if (!profile) throw new Error('Perfil não encontrado.')
    return profile
  }

  #requiredSession(profileId: string): ManagedSession {
    const managed = this.#sessions.get(profileId)
    if (!managed) throw new Error('A sessão não está em execução.')
    return managed
  }

  #configureSession(partition: string, isolatedSession: Session, profile: Profile): void {
    if (this.#configuredPartitions.has(partition)) return
    this.#configuredPartitions.add(partition)

    isolatedSession.setPermissionCheckHandler((_contents, permission) =>
      allowedPassivePermissions.has(permission),
    )
    isolatedSession.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(allowedPassivePermissions.has(permission))
    })
    isolatedSession.setDevicePermissionHandler(() => false)
    isolatedSession.on('will-download', (_event, item) => {
      const safeProfileName = profile.name.replaceAll(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 80)
      const downloadDirectory = path.join(
        app.getPath('downloads'),
        'Multi Idle',
        `${safeProfileName}-${profile.id.slice(0, 8)}`,
      )
      mkdirSync(downloadDirectory, { recursive: true })
      const fileName = path.basename(item.getFilename())
      item.setSavePath(path.join(downloadDirectory, fileName))
    })
  }

  #attachWebContentsEvents(managed: ManagedSession): void {
    const contents = managed.view.webContents

    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event, url) => {
      if (!isAllowedNavigation(url)) event.preventDefault()
    })
    contents.on('did-start-loading', () => {
      managed.state = 'starting'
      managed.lastError = null
      this.#emitSnapshot()
    })
    contents.on('did-finish-load', () => {
      managed.state = 'online'
      managed.title = contents.getTitle() || managed.profile.name
      managed.url = contents.getURL() || managed.url
      this.#emitSnapshot()
    })
    contents.on('page-title-updated', (_event, title) => {
      managed.title = title || managed.profile.name
      this.#emitSnapshot()
    })
    contents.on('did-navigate', (_event, url) => {
      managed.url = url
      this.#emitSnapshot()
    })
    contents.on('did-navigate-in-page', (_event, url) => {
      managed.url = url
      this.#emitSnapshot()
    })
    contents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return
        managed.state = 'error'
        managed.lastError = errorDescription
        this.#emitSnapshot()
      },
    )
    contents.on('render-process-gone', (_event, details) => {
      managed.state = 'crashed'
      managed.lastError = `Renderer encerrado: ${details.reason}`
      this.#emitSnapshot()
    })
  }

  #syncVisibility(managed: ManagedSession): void {
    const bounds = managed.bounds
    const hasArea = Boolean(bounds && bounds.width > 0 && bounds.height > 0)
    managed.view.setVisible(
      this.#hostVisible && !this.#shellOverlay && managed.userVisible && hasArea,
    )
  }

  #sessionSnapshot(profile: Profile): SessionSnapshot {
    const managed = this.#sessions.get(profile.id)
    if (!managed) {
      return {
        profileId: profile.id,
        state: 'stopped',
        title: profile.name,
        url: profile.startUrl,
        canGoBack: false,
        canGoForward: false,
        cpuPercent: 0,
        memoryMb: 0,
        lastError: null,
      }
    }

    const contents = managed.view.webContents
    const state = managed.userVisible ? managed.state : 'hidden'
    return {
      profileId: profile.id,
      state,
      title: managed.title,
      url: managed.url,
      canGoBack: !contents.isDestroyed() && contents.navigationHistory.canGoBack(),
      canGoForward: !contents.isDestroyed() && contents.navigationHistory.canGoForward(),
      cpuPercent: managed.cpuPercent,
      memoryMb: managed.memoryMb,
      lastError: managed.lastError,
    }
  }

  #sampleMetrics(): void {
    const metrics = app.getAppMetrics()
    for (const managed of this.#sessions.values()) {
      if (managed.view.webContents.isDestroyed()) continue
      const pid = managed.view.webContents.getOSProcessId()
      const metric = metrics.find((candidate) => candidate.pid === pid)
      managed.cpuPercent = metric?.cpu.percentCPUUsage ?? 0
      managed.memoryMb = (metric?.memory.workingSetSize ?? 0) / 1_024
    }
    this.#emitSnapshot()
  }

  #emitSnapshot(): void {
    if (this.#window.isDestroyed()) return
    this.#window.webContents.send(ipcChannels.snapshot, this.snapshot())
  }
}
