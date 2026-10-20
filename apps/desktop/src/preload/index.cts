import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels } from '@multi-idle/contracts/channels'
import type {
  CreateProfileInput,
  DashboardSnapshot,
  MultiIdleDesktopApi,
  ViewBounds,
} from '@multi-idle/contracts'

async function snapshotFrom(channel: string, ...args: unknown[]): Promise<DashboardSnapshot> {
  return (await ipcRenderer.invoke(channel, ...args)) as DashboardSnapshot
}

const api: MultiIdleDesktopApi = {
  bootstrap: () => snapshotFrom(ipcChannels.bootstrap),
  createProfile: (input: CreateProfileInput) =>
    snapshotFrom(ipcChannels.createProfile, input),
  startSession: (profileId: string) =>
    snapshotFrom(ipcChannels.startSession, profileId),
  stopSession: (profileId: string) => snapshotFrom(ipcChannels.stopSession, profileId),
  showSession: (profileId: string) => snapshotFrom(ipcChannels.showSession, profileId),
  hideSession: (profileId: string) => snapshotFrom(ipcChannels.hideSession, profileId),
  navigate: (profileId: string, url: string) =>
    snapshotFrom(ipcChannels.navigate, { profileId, url }),
  goBack: (profileId: string) => snapshotFrom(ipcChannels.goBack, profileId),
  goForward: (profileId: string) => snapshotFrom(ipcChannels.goForward, profileId),
  reload: (profileId: string) => snapshotFrom(ipcChannels.reload, profileId),
  setViewBounds: (profileId: string, bounds: ViewBounds | null) => {
    ipcRenderer.send(ipcChannels.setViewBounds, { profileId, bounds })
  },
  setShellOverlay: (active: boolean) => {
    ipcRenderer.send(ipcChannels.setShellOverlay, active)
  },
  onSnapshot: (listener: (snapshot: DashboardSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
      listener(value as DashboardSnapshot)
    }
    ipcRenderer.on(ipcChannels.snapshot, handler)
    return () => ipcRenderer.removeListener(ipcChannels.snapshot, handler)
  },
}

contextBridge.exposeInMainWorld('multiIdle', api)
