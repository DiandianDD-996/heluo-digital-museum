/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const layers = read('src/styles/00-layers.css')
const tokens = read('src/styles/01-tokens.css')
const base = read('src/styles/02-reset-base.css')
const surfaces = read('src/styles/03-surfaces.css')
const components = read('src/styles/04-components.css')
const entry = read('src/main.ts')

describe('Heluo Editorial 2.0 theme foundation and shared controls contract', () => {
  it('declares an explicit CSS Cascade Layers hierarchy in entry order', () => {
    expect(layers).toContain('@layer')
    expect(layers).toContain('reset, tokens, base, surface, components, views, overrides')
    expect(entry.indexOf("import './styles/01-tokens.css'")).toBeGreaterThan(entry.indexOf("import './styles/00-layers.css'"))
    expect(entry.indexOf("import './styles/04-components.css'")).toBeGreaterThan(entry.indexOf("import './styles/03-surfaces.css'"))
    expect(entry.indexOf("import './styles/05-shell.css'")).toBeGreaterThan(entry.indexOf("import './styles/04-components.css'"))
  })

  it('defines OKLCH Daylight Paper and Nocturne Gallery semantic tokens with zero hex literals', () => {
    for (const token of [
      '--surface-canvas',
      '--surface-subtle',
      '--surface-elevated',
      '--surface-spotlight',
      '--ink-primary',
      '--ink-secondary',
      '--ink-muted',
      '--border-hairline',
      '--border-strong',
      '--accent-jade',
      '--accent-bronze',
      '--accent-seal',
      '--focus-ring',
      '--ease-curatorial',
    ]) expect(tokens).toContain(token)

    expect(tokens).toContain('html[data-theme="dark"]')
    expect(tokens).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(tokens).not.toMatch(/\brgba?\(/i)
  })

  it('keeps the three glass layers semantic and provides solid and forced-color fallbacks', () => {
    expect(surfaces).toContain('[data-glass="light"]')
    expect(surfaces).toContain('[data-glass="dark"]')
    expect(surfaces).toContain('[data-glass="compact"]')
    expect(surfaces).toContain('@media (prefers-reduced-transparency: reduce)')
    expect(surfaces).toContain('@media (prefers-contrast: more)')
    expect(surfaces).toContain('@media (forced-colors: active)')
  })

  it('gives shared controls unified hairline styling, 44px touch targets and visible focus', () => {
    for (const selector of [
      '.fluid-button',
      '.inline-status',
      '.status-badge',
      '.glass-checkbox__box',
      '.museum-search-field__control',
      '.loading-skeleton',
      '.bottom-sheet',
      '.editorial-card',
    ]) expect(components).toContain(selector)

    expect(tokens).toContain('--control-min: 44px;')
    expect(base).toContain(':focus-visible')
    expect(components).toContain('@media (prefers-reduced-motion: reduce)')
    expect(components).toContain('@media (forced-colors: active)')
  })
})
