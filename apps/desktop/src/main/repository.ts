import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

import {
  CreateProfileInputSchema,
  ProfileSchema,
  WorkspaceSchema,
  type CreateProfileInput,
  type Profile,
  type Workspace,
} from '@multi-idle/contracts'

import { normalizeHttpUrl } from './url-policy.js'

interface WorkspaceRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface ProfileRow {
  id: string
  workspace_id: string
  name: string
  start_url: string
  priority: string
  enabled: number
  created_at: string
  updated_at: string
}

const migrationSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_url TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('high', 'normal', 'economy')),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS profiles_workspace_id_idx ON profiles(workspace_id);
`

export class Repository {
  readonly #database: DatabaseSync

  constructor(path: string) {
    this.#database = new DatabaseSync(path)
    this.#database.exec('PRAGMA foreign_keys = ON;')
    if (path !== ':memory:') {
      this.#database.exec('PRAGMA journal_mode = WAL;')
      this.#database.exec('PRAGMA synchronous = NORMAL;')
    }
    this.#migrate()
    this.#seedDefaultWorkspace()
  }

  #migrate(): void {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#database.exec(migrationSql)
      this.#database
        .prepare(
          'INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)',
        )
        .run(1, new Date().toISOString())
      this.#database.exec('COMMIT;')
    } catch (error) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  #seedDefaultWorkspace(): void {
    const existing = this.#database.prepare('SELECT id FROM workspaces LIMIT 1').get()
    if (existing) return

    const now = new Date().toISOString()
    this.#database
      .prepare(
        'INSERT INTO workspaces(id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run(randomUUID(), 'Workspace principal', now, now)
  }

  listWorkspaces(): Workspace[] {
    const rows = this.#database
      .prepare(
        'SELECT id, name, created_at, updated_at FROM workspaces ORDER BY created_at ASC',
      )
      .all() as unknown as WorkspaceRow[]
    return rows.map(mapWorkspace)
  }

  listProfiles(): Profile[] {
    const rows = this.#database
      .prepare(
        `SELECT id, workspace_id, name, start_url, priority, enabled, created_at, updated_at
         FROM profiles
         ORDER BY created_at ASC`,
      )
      .all() as unknown as ProfileRow[]
    return rows.map(mapProfile)
  }

  getProfile(profileId: string): Profile | null {
    const row = this.#database
      .prepare(
        `SELECT id, workspace_id, name, start_url, priority, enabled, created_at, updated_at
         FROM profiles
         WHERE id = ?`,
      )
      .get(profileId) as unknown as ProfileRow | undefined
    return row ? mapProfile(row) : null
  }

  createProfile(rawInput: CreateProfileInput): Profile {
    const input = CreateProfileInputSchema.parse(rawInput)
    const workspace = this.#database
      .prepare('SELECT id FROM workspaces WHERE id = ?')
      .get(input.workspaceId)
    if (!workspace) throw new Error('Workspace não encontrado.')

    const now = new Date().toISOString()
    const profile = ProfileSchema.parse({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      startUrl: normalizeHttpUrl(input.startUrl),
      priority: input.priority,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })

    this.#database
      .prepare(
        `INSERT INTO profiles(
          id, workspace_id, name, start_url, priority, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profile.id,
        profile.workspaceId,
        profile.name,
        profile.startUrl,
        profile.priority,
        profile.enabled ? 1 : 0,
        profile.createdAt,
        profile.updatedAt,
      )
    return profile
  }

  close(): void {
    this.#database.close()
  }
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return WorkspaceSchema.parse({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

function mapProfile(row: ProfileRow): Profile {
  return ProfileSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    startUrl: row.start_url,
    priority: row.priority,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

