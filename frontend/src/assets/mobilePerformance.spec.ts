/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const surfacesCss = readFileSync(resolve(root, 'src/styles/03-surfaces.css'), 'utf8')
const motionCss = readFileSync(resolve(root, 'src/styles/06-motion.css'), 'utf8')
const baseCss = readFileSync(resolve(root, 'src/styles/02-reset-base.css'), 'utf8')
const mainTs = readFileSync(resolve(root, 'src/main.ts'), 'utf8')

describe('mobile performance CSS contract (Heluo Editorial 2.0)', () => {
  it('loads the Cascade Layers styles cleanly from main.ts without legacy patch sheets', () => {
    expect(mainTs).toContain("import './styles/00-layers.css'")
    expect(mainTs).toContain("import './styles/03-surfaces.css'")
    expect(mainTs).toContain("import './styles/06-motion.css'")
    expect(mainTs).not.toContain('route-admin-legacy.css')
    expect(mainTs).not.toContain('route-explore-legacy.css')
    expect(mainTs).not.toContain('route-exhibit-detail-legacy.css')
  })

  it('removes heavy glass compositing for coarse pointers and constrained devices without !important wars', () => {
    expect(surfacesCss).toContain('@media (pointer: coarse)')
    expect(surfacesCss).toContain('html[data-performance-tier="constrained"] [data-glass]')
    expect(surfacesCss).toContain('backdrop-filter: none;')
  })

  it('prevents horizontal overflow at document level and provides content-visibility helpers', () => {
    expect(baseCss).toContain('overflow-x: clip;')
    expect(motionCss).toContain('content-visibility: auto;')
  })
})
