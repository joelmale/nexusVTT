import { describe, expect, it } from 'vitest'
import { resolveAdminUiBase } from './adminUiBase'

describe('resolveAdminUiBase', () => {
  it('defaults to the root the private admin listener serves', () => {
    expect(resolveAdminUiBase(undefined)).toBe('/')
    expect(resolveAdminUiBase('')).toBe('/')
    expect(resolveAdminUiBase('/')).toBe('/')
  })

  it('normalizes a path to leading and trailing slashes', () => {
    expect(resolveAdminUiBase('codex-admin')).toBe('/codex-admin/')
    expect(resolveAdminUiBase('/codex-admin')).toBe('/codex-admin/')
    expect(resolveAdminUiBase('/a//b')).toBe('/a/b/')
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(() => resolveAdminUiBase('https://cdn.example/')).toThrow()
    expect(() => resolveAdminUiBase('//cdn.example/')).toThrow()
  })
})
