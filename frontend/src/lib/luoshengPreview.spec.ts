import { describe, expect, it } from 'vitest'
import { createGuideVisit, readGuideHandoff, readGuideReturn } from './luoshengPreview'

describe('Luosheng preview handoff', () => {
  it('restores only a known observation', () => {
    for (const stop of ['ear', 'feet', 'motif']) {
      expect(readGuideHandoff({ luoshengPreviewHandoff: stop })).toBe(stop)
    }
    for (const state of [null, undefined, {}, { luoshengPreviewHandoff: 'left' }, { luoshengPreviewHandoff: true }]) {
      expect(readGuideHandoff(state)).toBeNull()
    }
  })

  it('validates return state independently from automatic exhibit handoff', () => {
    for (const stop of ['ear', 'feet', 'motif']) {
      expect(readGuideReturn({ luoshengPreviewReturn: stop })).toBe(stop)
      expect(readGuideHandoff({ luoshengPreviewReturn: stop })).toBeNull()
    }
    for (const state of [null, { luoshengPreviewReturn: null }, { luoshengPreviewReturn: 'top' }, { luoshengPreviewHandoff: 'motif' }]) {
      expect(readGuideReturn(state)).toBeNull()
    }
  })
})

describe('Luosheng preview invitation', () => {
  it('claims one invitation per tab, including after reload', () => {
    const values = new Map<string, string>()
    const storage = () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    })
    const visit = createGuideVisit(storage)
    expect(visit.claimInvitation()).toBe(true)
    expect(visit.claimInvitation()).toBe(false)
    expect(createGuideVisit(storage).claimInvitation()).toBe(false)
  })

  it('keeps the entry passive when session storage is not writable', () => {
    const visit = createGuideVisit(() => ({
      getItem: () => null,
      setItem: () => { throw new Error('storage denied') },
    }))
    expect(visit.claimInvitation()).toBe(false)
    expect(visit.claimInvitation()).toBe(false)
  })
})
