/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const motionCss = readFileSync(resolve(process.cwd(), 'src/styles/06-motion.css'), 'utf8')
const appVue = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8')
const homeVue = readFileSync(resolve(process.cwd(), 'src/views/HomeView.vue'), 'utf8')
const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/01-tokens.css'), 'utf8')

describe('Heluo Editorial 2.0 curatorial motion and pointer interaction contract', () => {
  it('mounts PointerCursor in App shell to drive live PointerDotField particle waves on HomeView', () => {
    expect(appVue).toContain('<PointerCursor')
    expect(homeVue).toContain('<PointerDotField v-if="showPointerField" variant="image" />')
    expect(homeVue).toContain("window.matchMedia?.('(pointer: fine) and (hover: hover)')")
    expect(motionCss).toContain('.pointer-cursor__dot')
    expect(motionCss).toContain('.pointer-cursor__halo')
    expect(motionCss).toContain('.pointer-dot-field')
  })

  it('preserves native cursor on form controls/3D canvas and disables pointer effects under reduced motion or touch', () => {
    expect(motionCss).toContain('input, textarea, select')
    expect(motionCss).toContain('.three-viewer')
    expect(motionCss).toContain('@media (pointer: coarse), (hover: none), (prefers-contrast: more), (forced-colors: active)')
    expect(motionCss).toContain('@media (prefers-reduced-motion: reduce)')
    const reducedBlock = motionCss.slice(motionCss.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reducedBlock).toContain('.pointer-dot-field')
    expect(reducedBlock).toContain('display: none')
  })

  it('uses a single unified curatorial easing curve and view-transition timing', () => {
    expect(tokensCss).toContain('--ease-curatorial: cubic-bezier(0.22, 1, 0.36, 1)')
    expect(motionCss).toContain('::view-transition-old(root)')
    expect(motionCss).toContain('::view-transition-new(root)')
  })
})
