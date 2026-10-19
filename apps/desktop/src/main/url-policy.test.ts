import { describe, expect, it } from 'vitest'

import { isAllowedNavigation, normalizeHttpUrl } from './url-policy.js'

describe('URL policy', () => {
  it('defaults hostnames to HTTPS', () => {
    expect(normalizeHttpUrl('example.com')).toBe('https://example.com/')
  })

  it('removes embedded credentials', () => {
    expect(normalizeHttpUrl('https://user:secret@example.com/path')).toBe(
      'https://example.com/path',
    )
  })

  it('rejects privileged protocols', () => {
    expect(() => normalizeHttpUrl('file:///C:/Windows')).toThrow()
    expect(isAllowedNavigation('javascript:alert(1)')).toBe(false)
  })
})

