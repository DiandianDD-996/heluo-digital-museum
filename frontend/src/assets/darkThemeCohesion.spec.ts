/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const tokens = read('src/styles/01-tokens.css')
const surfaces = read('src/styles/03-surfaces.css')
const components = read('src/styles/04-components.css')
const shell = read('src/styles/05-shell.css')
const homeView = read('src/views/HomeView.vue')
const explore = read('src/views/ExploreView.vue')
const exhibits = read('src/views/ExhibitsView.vue')
const shop = read('src/views/ShopView.vue')

describe('dark theme cohesion contract (Heluo Editorial 2.0 Nocturne Gallery)', () => {
  it('uses a dedicated architectural cold-obsidian v3 night scene instead of dimming the light hero', () => {
    expect(existsSync(resolve(process.cwd(), 'public/media/editorial/home-hero-dark-v3.webp'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'public/media/editorial/home-hero-dark-v3-1280w.webp'))).toBe(true)
    expect(homeView).toContain("src: '/media/editorial/home-hero-dark-v3.webp'")
    expect(homeView).toContain('home-hero-dark-v5-portrait.webp 483w')
  })

  it('defines Cold Obsidian Gallery OKLCH dark surface hierarchy and champagne-gold/patina actions without muddy brown', () => {
    const darkBlock = tokens.slice(tokens.indexOf('html[data-theme="dark"]'))
    expect(darkBlock).toContain('--surface-canvas: oklch(12.2% 0.006 238)')
    expect(darkBlock).toContain('--surface-subtle: oklch(14.8% 0.007 238)')
    expect(darkBlock).toContain('--surface-elevated: oklch(17.6% 0.008 238)')
    expect(darkBlock).toContain('--surface-plinth: oklch(14.2% 0.007 238)')
    expect(darkBlock).toContain('--pattern-yunlei:')
    expect(darkBlock).toContain('--pattern-brocade:')
    expect(darkBlock).toContain('--pattern-plinth-lattice:')
    expect(darkBlock).toContain('--surface-spotlight:')
    expect(darkBlock).toContain('--ink-primary: oklch(95.0% 0.004 86)')
    expect(darkBlock).toContain('--accent-jade: oklch(82% 0.054 78)')
    expect(darkBlock).toContain('--accent-patina: oklch(68% 0.072 168)')
    expect(darkBlock).toContain('--accent-jade-ink: oklch(13% 0.007 238)')
  })

  it('keeps the shared search single-layer and controls touch-sized across themes', () => {
    const search = read('src/components/MuseumSearchField.vue')
    expect(search).not.toContain('<form class="museum-search-field" data-glass=')
    expect(search).toContain('class="museum-search-field__control"')
    expect(components).toContain('.museum-search-field__control')
    expect(components).toContain('height: 46px;')
    expect(tokens).toContain('--control-min: 44px;')
    expect(shell).toContain('html[data-theme="dark"] .mobile-tab-bar')
    expect(surfaces).toContain('[data-glass="dark"]')
  })

  it('keeps async errors exclusive from empty content across public views', () => {
    expect(explore).toContain('const submittedQuery = ref')
    expect(explore).toContain('v-if="hasSubmittedSearch"')
    expect(explore).toContain('v-else-if="contentError"')
    expect(explore).toContain('v-else-if="searchError"')
    expect(exhibits).toContain('v-else-if="!error && items.length===0"')
    expect(shop).toContain('v-else-if="productError"')
    expect(shop).toContain('const cartPanelError = computed')
  })

  it('keeps Explore media and geometry stable across themes', () => {
    const button = read('src/components/FluidButton.vue')
    expect(existsSync(resolve(process.cwd(), 'public/media/editorial/explore-jade-bi-user-v2.webp'))).toBe(true)
    expect(explore).toContain('const editorialArtifactMedia')
    expect(explore).toContain("'river-map-jade-bi': '/media/editorial/explore-jade-bi-user-v2.webp'")
    expect(explore).toContain('return editorialArtifactMedia[artifact.slug] ?? artifact.coverImageUrl')
    expect(explore).toContain(':media-src="searchVisual(item)"')
    expect(explore).not.toContain("import { useTheme } from '../stores/theme'")
    expect(explore).toContain('gallery-themes')
    expect(explore).toContain('gallery-object__media')
    expect(explore).toContain('categoryName(category)')
    expect(button).toContain('<button')
    expect(button).not.toContain('motion-v')
  })
})
