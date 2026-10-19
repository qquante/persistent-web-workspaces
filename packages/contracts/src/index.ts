import { z } from 'zod'

export { ipcChannels } from './channels.js'

export const ProfilePrioritySchema = z.enum(['high', 'normal', 'economy'])
export type ProfilePriority = z.infer<typeof ProfilePrioritySchema>

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Workspace = z.infer<typeof WorkspaceSchema>

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(80),
  startUrl: z.string().url(),
  priority: ProfilePrioritySchema,
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Profile = z.infer<typeof ProfileSchema>

export const CreateProfileInputSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  startUrl: z.string().trim().min(1).max(2_048),
  priority: ProfilePrioritySchema.default('normal'),
})
export type CreateProfileInput = z.input<typeof CreateProfileInputSchema>

export const ViewBoundsSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(0).max(16_384),
  height: z.number().int().min(0).max(16_384),
})
export type ViewBounds = z.infer<typeof ViewBoundsSchema>

export const SessionStateSchema = z.enum([
  'stopped',
  'starting',
  'online',
  'hidden',
  'error',
  'crashed',
])
export type SessionState = z.infer<typeof SessionStateSchema>

export const SessionSnapshotSchema = z.object({
  profileId: z.string().uuid(),
  state: SessionStateSchema,
  title: z.string(),
  url: z.string(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  cpuPercent: z.number().nonnegative(),
  memoryMb: z.number().nonnegative(),
  lastError: z.string().nullable(),
})
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>

export const GpuSnapshotSchema = z.object({
  enabled: z.boolean(),
  status: z.string(),
})
export type GpuSnapshot = z.infer<typeof GpuSnapshotSchema>

export const DashboardSnapshotSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
  profiles: z.array(ProfileSchema),
  sessions: z.array(SessionSnapshotSchema),
  gpu: GpuSnapshotSchema,
})
export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>

export const ProfileIdSchema = z.string().uuid()
export const NavigateInputSchema = z.object({
  profileId: ProfileIdSchema,
  url: z.string().trim().min(1).max(2_048),
})

export const ViewBoundsInputSchema = z.object({
  profileId: ProfileIdSchema,
  bounds: ViewBoundsSchema.nullable(),
})

export interface MultiIdleDesktopApi {
  bootstrap(): Promise<DashboardSnapshot>
  createProfile(input: CreateProfileInput): Promise<DashboardSnapshot>
  startSession(profileId: string): Promise<DashboardSnapshot>
  stopSession(profileId: string): Promise<DashboardSnapshot>
  showSession(profileId: string): Promise<DashboardSnapshot>
  hideSession(profileId: string): Promise<DashboardSnapshot>
  navigate(profileId: string, url: string): Promise<DashboardSnapshot>
  goBack(profileId: string): Promise<DashboardSnapshot>
  goForward(profileId: string): Promise<DashboardSnapshot>
  reload(profileId: string): Promise<DashboardSnapshot>
  setViewBounds(profileId: string, bounds: ViewBounds | null): void
  setShellOverlay(active: boolean): void
  onSnapshot(listener: (snapshot: DashboardSnapshot) => void): () => void
}
