import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Heluo Editorial 2.0 Daylight Paper light-theme material contract', () => {
  const tokens = read('src/styles/01-tokens.css')
  const base = read('src/styles/02-reset-base.css')
  const surfaces = read('src/styles/03-surfaces.css')
  const components = read('src/styles/04-components.css')

  it('uses warm daylight paper tones, hairline edges and restrained bronze accents', () => {
    expect(tokens).toContain('--surface-canvas: oklch(98.2% 0.003 90)')
    expect(tokens).toContain('--surface-subtle: oklch(95.4% 0.005 90)')
    expect(tokens).toContain('--surface-elevated: oklch(99.8% 0.001 90)')
    expect(tokens).toContain('--border-hairline:')
    expect(tokens).toContain('--accent-jade:')
    expect(tokens).toContain('--accent-bronze:')
    expect(tokens).toContain('--accent-seal:')
  })

  it('keeps search and native inputs clean and flat without recessed thick frames', () => {
    expect(components).toContain('.museum-search-field__control')
    expect(components).toContain('height: 46px;')
    expect(components).not.toContain('!important')
    expect(base).toContain(':focus-visible')
  })

  it('keeps degradation paths explicit across reduced motion, contrast and forced colors', () => {
    expect(surfaces).toContain('@media (prefers-reduced-transparency: reduce)')
    expect(surfaces).toContain('@media (prefers-contrast: more)')
    expect(surfaces).toContain('@media (forced-colors: active)')
    expect(components).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
