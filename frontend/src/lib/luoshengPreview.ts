export const GUIDE_ARTIFACT = 'heluo-bronze-ding'
export const GUIDE_EXHIBIT = 'heluo-bronze-ding-3d'

export type GuideStop = 'ear' | 'feet' | 'motif'
export type GuideView = 'top' | 'back' | 'front'

function parseGuideStop(stop: unknown): GuideStop | null {
  return stop === 'ear' || stop === 'feet' || stop === 'motif' ? stop : null
}

export function readGuideHandoff(state: unknown): GuideStop | null {
  if (!state || typeof state !== 'object' || !('luoshengPreviewHandoff' in state)) return null
  return parseGuideStop(state.luoshengPreviewHandoff)
}

export function readGuideReturn(state: unknown): GuideStop | null {
  if (!state || typeof state !== 'object' || !('luoshengPreviewReturn' in state)) return null
  return parseGuideStop(state.luoshengPreviewReturn)
}

const visitKey = 'heluo.luosheng.seen'

export function createGuideVisit(storage: () => Pick<Storage, 'getItem' | 'setItem'>) {
  let seen = false

  return {
    claimInvitation() {
      if (seen) return false
      seen = true
      try {
        const session = storage()
        if (session.getItem(visitKey) !== null) return false
        session.setItem(visitKey, '1')
        return true
      } catch {
        return false
      }
    },
  }
}

export const guideVisit = createGuideVisit(() => window.sessionStorage)
