/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readView = (name: string) => readFileSync(resolve(process.cwd(), `src/views/${name}.vue`), 'utf8')

describe('pointer dot field page mapping', () => {
  it('mounts exactly once in each approved heading and nowhere in the 3D detail', () => {
    const mappings = [
      ['HomeView', /<section class="home-cover">[\s\S]*?<PointerDotField variant="image" \/>/],
      ['ExhibitsView', /<section class="exhibits-intro"[\s\S]*?<PointerDotField \/>/],
      ['AppointmentView', /<header class="appointment-heading"[\s\S]*?<PointerDotField variant="heading" \/>/],
    ] as const

    mappings.forEach(([view, pattern]) => {
      const source = readView(view)
      expect(source).toMatch(pattern)
      expect(source.match(/<PointerDotField\b/g)).toHaveLength(1)
    })
    expect(readView('ExhibitDetailView')).not.toContain('PointerDotField')
    expect(readView('ShopView')).not.toContain('PointerDotField')
    expect(readView('ExploreView')).not.toContain('PointerDotField')
  })

  it('routes PointerDotField through the curated multi-preset light renderer with clean shadow reset', () => {
    const componentSource = readFileSync(resolve(process.cwd(), 'src/components/PointerDotField.vue'), 'utf8')
    const rendererSource = readFileSync(resolve(process.cwd(), 'src/lib/lightFieldRenderers.ts'), 'utf8')

    expect(componentSource).toContain('renderLightField')
    expect(componentSource).toContain('useLightPreset')
    expect(rendererSource).toContain("ctx.shadowColor = 'transparent'")
    expect(rendererSource).toContain('drawCelestial')
    expect(rendererSource).toContain('drawLuoshui')
    expect(rendererSource).toContain('drawSpotlight')
    expect(rendererSource).toContain('drawKintsugi')
  })
})
