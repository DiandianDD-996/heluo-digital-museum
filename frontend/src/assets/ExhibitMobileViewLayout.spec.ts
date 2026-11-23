import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const exhibit = readFileSync(resolve(process.cwd(), 'src/views/ExhibitDetailView.vue'), 'utf8')

describe('mobile exhibit view layout (Heluo Editorial 2.0 Studio Darkroom)', () => {
  it('keeps viewpoints reachable on mobile without horizontal page overflow', () => {
    const mobile = exhibit.slice(exhibit.indexOf('@media (max-width: 760px)'))
    expect(mobile).toMatch(/\.view-switcher\s*\{[^}]*overflow-x:\s*auto;/s)
    expect(exhibit).not.toContain('exhibit-wall-copy')
    expect(exhibit).not.toContain('route-exhibit-detail-legacy.css')
  })

  it('keeps the 3D scene uncluttered with darkroom spotlight and 3 compact control modules', () => {
    expect(exhibit).toContain('class="darkroom-topbar"')
    expect(exhibit).toContain('class="exhibit-dock"')
    expect(exhibit).toContain('class="exhibit-panel exhibit-panel-desktop"')
  })
})
