import type { MultiIdleDesktopApi } from '@multi-idle/contracts'

declare global {
  interface Window {
    multiIdle: MultiIdleDesktopApi
  }
}

export {}

