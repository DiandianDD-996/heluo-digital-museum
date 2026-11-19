import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('audio preferences', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('defaults to silent without matchMedia or AudioContext', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const { audioSystem } = await import('./audioSystem')
    expect(audioSystem.isEnabled()).toBe(false)
    await expect(audioSystem.playInteraction('click')).resolves.toBeUndefined()
  })

  it('honors explicit saved opt-in and reduced motion', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect((await import('./audioSystem')).audioSystem.isEnabled()).toBe(true)
    vi.resetModules()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect((await import('./audioSystem')).audioSystem.isEnabled()).toBe(false)
  })

  it('stays silent when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const { audioSystem } = await import('./audioSystem')
    expect(audioSystem.isEnabled()).toBe(false)
    expect(() => audioSystem.disable()).not.toThrow()
  })
})
