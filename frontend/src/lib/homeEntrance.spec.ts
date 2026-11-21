import { afterEach, beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => { vi.resetModules(); sessionStorage.clear() })
afterEach(() => vi.restoreAllMocks())

it('plays only once across route returns and module reloads in a tab session', async () => {
  const { claimHomeEntrance } = await import('./homeEntrance')
  expect(claimHomeEntrance()).toBe(true)
  expect(claimHomeEntrance()).toBe(false)
  vi.resetModules()
  expect((await import('./homeEntrance')).claimHomeEntrance()).toBe(false)
})

it('falls back to memory when session storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  const { claimHomeEntrance } = await import('./homeEntrance')
  expect(claimHomeEntrance()).toBe(true)
  expect(claimHomeEntrance()).toBe(false)
})
