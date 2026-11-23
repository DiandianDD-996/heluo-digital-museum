/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcPath = resolve(process.cwd(), 'src')
const tokens = readFileSync(resolve(srcPath, 'styles/01-tokens.css'), 'utf8')
const surfaces = readFileSync(resolve(srcPath, 'styles/03-surfaces.css'), 'utf8')

function vueSources(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name)
    if (entry.isDirectory()) return vueSources(target)
    return extname(entry.name) === '.vue' ? [readFileSync(target, 'utf8')] : []
  })
}

describe('museum glass and surface material contract (Heluo Editorial 2.0)', () => {
  it('defines canonical glass tier tokens in the single authoritative token sheet', () => {
    for (const token of [
      '--glass-light-bg',
      '--glass-light-border',
      '--glass-dark-bg',
      '--glass-dark-border',
      '--glass-compact-bg',
      '--glass-compact-border',
      '--glass-blur',
      '--glass-blur-compact',
    ]) {
      expect(tokens).toContain(token)
    }
  })

  it('keeps raw colors inside tokens, not semantic surface rules', () => {
    expect(surfaces).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/i)
    expect(surfaces).toContain('@media (prefers-reduced-transparency: reduce)')
    expect(surfaces).toContain('@media (prefers-contrast: more)')
    expect(surfaces).toContain('@media (forced-colors: active)')
    expect(surfaces).toContain('[data-glass-interactive]:disabled')
  })

  it('uses only the three approved literal glass surface tiers across Vue templates', () => {
    const sources = vueSources(srcPath).join('\n')
    const tiers = [...sources.matchAll(/(?:^|\s)data-glass="([^"]+)"/gm)].map((match) => match[1])

    expect(new Set(tiers)).toEqual(new Set(['light', 'dark', 'compact']))
    expect(tiers.length).toBeGreaterThanOrEqual(5)
  })

  it('provides zero !important overrides in the surface material layer', () => {
    expect(surfaces).not.toContain('!important')
  })
})
