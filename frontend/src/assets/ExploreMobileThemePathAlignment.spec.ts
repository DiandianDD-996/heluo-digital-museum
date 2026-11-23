import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const explore = readFileSync(resolve(process.cwd(), 'src/views/ExploreView.vue'), 'utf8')

describe('mobile Explore theme navigation (Heluo Editorial 2.0)', () => {
  it('keeps live theme labels in normal flow rather than artwork coordinates', () => {
    expect(explore).toContain('class="gallery-themes__links"')
    expect(explore).toContain('categoryName(category)')
    expect(explore).not.toContain('collection-theme-path__river-artwork')
    expect(explore).toMatch(/\.gallery-themes__links\s*\{[^}]*display:\s*(?:grid|flex);/s)
  })

  it('stacks the theme introduction and keeps links touch-sized on mobile', () => {
    const mobile = explore.slice(explore.indexOf('@media (max-width: 760px)'))
    expect(mobile).toMatch(/\.gallery-themes__links\s*\{[^}]*grid-template-columns:\s*1fr;/s)
    expect(mobile).toMatch(/\.gallery-themes__links > a\s*\{[^}]*min-height:\s*76px;/s)
  })
})
