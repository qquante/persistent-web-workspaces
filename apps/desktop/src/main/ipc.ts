import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import {
  CreateProfileInputSchema,
  NavigateInputSchema,
  ProfileIdSchema,
  ViewBoundsInputSchema,
  ipcChannels,
} from '@multi-idle/contracts'

import type { Repository } from './repository.js'
import type { SessionManager } from './session-manager.js'

export function registerIpc(
  window: BrowserWindow,
  repository: Repository,
  sessionManager: SessionManager,
): () => void {
  const assertTrustedSender = (event: IpcMainInvokeEvent): void => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Origem IPC não autorizada.')
    }
  }

  ipcMain.handle(ipcChannels.bootstrap, (event) => {
    assertTrustedSender(event)
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.createProfile, (event, rawInput: unknown) => {
    assertTrustedSender(event)
    repository.createProfile(CreateProfileInputSchema.parse(rawInput))
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.startSession, async (event, rawProfileId: unknown) => {
    assertTrustedSender(event)
    await sessionManager.start(ProfileIdSchema.parse(rawProfileId))
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.stopSession, (event, rawProfileId: unknown) => {
    assertTrustedSender(event)
    sessionManager.stop(ProfileIdSchema.parse(rawProfileId))
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.showSession, (event, rawProfileId: unknown) => {
    assertTrustedSender(event)
    sessionManager.show(ProfileIdSchema.parse(rawProfileId))
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.hideSession, (event, rawProfileId: unknown) => {
    assertTrustedSender(event)
    sessionManager.hide(ProfileIdSchema.parse(rawProfileId))
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.navigate, async (event, rawInput: unknown) => {
    assertTrustedSender(event)
    const input = NavigateInputSchema.parse(rawInput)
    await sessionManager.navigate(input.profileId, input.url)
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.goBack, (event, rawProfileId: unknown) => {
    assertTrustedSender(event)
    sessionManager.goBack(ProfileIdSchema.parse(rawProfileId))
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.goForward, (event, rawProfileId: unknown) => {
    assertTrustedSender(event)
    sessionManager.goForward(ProfileIdSchema.parse(rawProfileId))
    return sessionManager.snapshot()
  })

  ipcMain.handle(ipcChannels.reload, (event, rawProfileId: unknown) => {
    assertTrustedSender(event)
    sessionManager.reload(ProfileIdSchema.parse(rawProfileId))
    return sessionManager.snapshot()
  })

  ipcMain.on(ipcChannels.setViewBounds, (event, rawInput: unknown) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      return
    }
    const input = ViewBoundsInputSchema.parse(rawInput)
    sessionManager.setBounds(input.profileId, input.bounds)
  })

  ipcMain.on(ipcChannels.setShellOverlay, (event, active: unknown) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      return
    }
    if (typeof active !== 'boolean') return
    sessionManager.setShellOverlay(active)
  })

  return () => {
    for (const channel of Object.values(ipcChannels)) {
      if (channel === ipcChannels.snapshot || channel === ipcChannels.setViewBounds) continue
      ipcMain.removeHandler(channel)
    }
    ipcMain.removeAllListeners(ipcChannels.setViewBounds)
    ipcMain.removeAllListeners(ipcChannels.setShellOverlay)
  }
}
