import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('public responsive polish (Heluo Editorial 2.0)', () => {
  const home = source('src/views/HomeView.vue')
  const explore = source('src/views/ExploreView.vue')
  const viewer = source('src/components/ThreeExhibitViewer.vue')
  const pointCloudQuality = source('src/lib/pointCloudQuality.ts')

  it('keeps mobile home cards in responsive flow with wrappable titles', () => {
    expect(home).toContain('grid-template-columns: 112px minmax(0, 1fr) 20px')
    expect(home).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(home).not.toContain('public-responsive-polish.css')
  })

  it('keeps Explore scoped cleanly without legacy patch imports', () => {
    expect(explore).not.toContain('explore-gallery.css')
    expect(explore).not.toContain('control-surface-polish.css')
    expect(explore).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
  })

  it('caps mobile point DPR and uses theme-adapted luminous soft-edged particles', () => {
    expect(viewer).toContain("quality === 'mobile' ? 1.25 : 2")
    expect(viewer).toContain('selectPointCloudPointSize(quality, sceneTheme)')
    expect(pointCloudQuality).toContain("return theme === 'dark' ? 1.14 : 1.02")
    expect(pointCloudQuality).toContain("if (quality !== 'mobile' && quality !== 'fallback') return theme === 'dark' ? 1.34 : 1.26")
    expect(viewer).toContain('pow(disc,1.12)*uPointOpacity')
  })
})
