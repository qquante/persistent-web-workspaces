import { describe, expect, it } from 'vitest'

import { CreateProfileInputSchema, ViewBoundsInputSchema } from './index.js'

describe('contracts', () => {
  it('normalizes a valid profile input', () => {
    const value = CreateProfileInputSchema.parse({
      workspaceId: 'd9428888-122b-4a1b-9c11-4a4de484b4ce',
      name: '  Conta principal  ',
      startUrl: '  https://example.com  ',
    })

    expect(value).toEqual({
      workspaceId: 'd9428888-122b-4a1b-9c11-4a4de484b4ce',
      name: 'Conta principal',
      startUrl: 'https://example.com',
      priority: 'normal',
    })
  })

  it('rejects negative view coordinates', () => {
    expect(() =>
      ViewBoundsInputSchema.parse({
        profileId: 'd9428888-122b-4a1b-9c11-4a4de484b4ce',
        bounds: { x: -1, y: 0, width: 100, height: 100 },
      }),
    ).toThrow()
  })
})
