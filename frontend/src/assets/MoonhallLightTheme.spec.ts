import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Heluo Editorial 2.0 light and dark surface hierarchy contract', () => {
  const entry = read('src/main.ts')
  const tokens = read('src/styles/01-tokens.css')
  const surfaces = read('src/styles/03-surfaces.css')
  const shell = read('src/styles/05-shell.css')

  it('loads the unified Cascade Layers styles from main.ts without old conflicting patches', () => {
    expect(entry).toContain("import './styles/00-layers.css'")
    expect(entry).toContain("import './styles/01-tokens.css'")
    expect(entry).toContain("import './styles/05-shell.css'")
    expect(entry).not.toContain('tactile-ui.css')
    expect(entry).not.toContain('light-ui-material-depth.css')
    expect(entry).not.toContain('moonhall-light.css')
  })

  it('defines four distinct surface layers in both light paper and dark nocturne modes', () => {
    expect(tokens).toContain('--surface-canvas:')
    expect(tokens).toContain('--surface-subtle:')
    expect(tokens).toContain('--surface-elevated:')
    expect(tokens).toContain('--surface-plinth:')
    expect(tokens).toContain('--surface-spotlight:')
    expect(tokens).toContain('html[data-theme="dark"]')
  })

  it('provides clean translucent mobile bottom tab bar and structured 3-column footer', () => {
    expect(surfaces).toContain('.surface-plinth')
    expect(shell).toContain('.site-footer__inner')
    expect(shell).toContain('.mobile-tab-bar')
    expect(shell).toContain('min-height: 50px')
  })
})
