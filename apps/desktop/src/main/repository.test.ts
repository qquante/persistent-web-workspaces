import { afterEach, describe, expect, it } from 'vitest'

import { Repository } from './repository.js'

const repositories: Repository[] = []

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close()
})

describe('Repository', () => {
  it('creates the default workspace once', () => {
    const repository = new Repository(':memory:')
    repositories.push(repository)

    expect(repository.listWorkspaces()).toHaveLength(1)
    expect(repository.listWorkspaces()[0]?.name).toBe('Workspace principal')
  })

  it('persists a normalized isolated profile definition', () => {
    const repository = new Repository(':memory:')
    repositories.push(repository)
    const workspace = repository.listWorkspaces()[0]
    if (!workspace) throw new Error('Missing workspace fixture')

    const profile = repository.createProfile({
      workspaceId: workspace.id,
      name: 'Conta 1',
      startUrl: 'example.com',
      priority: 'normal',
    })

    expect(profile.startUrl).toBe('https://example.com/')
    expect(repository.getProfile(profile.id)).toEqual(profile)
  })
})
