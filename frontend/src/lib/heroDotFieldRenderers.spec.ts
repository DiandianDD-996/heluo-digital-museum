import { describe, expect, it } from 'vitest'
import {
  createHeroDotFieldState,
  createHeroGridNodes,
  spawnHeroWave,
  stepHeroDotField,
} from './heroDotFieldRenderers'

describe('heroDotFieldRenderers physics and settlement', () => {
  it('builds spatially masked grid nodes for hero dimensions', () => {
    const nodes = createHeroGridNodes(1440, 828)
    expect(nodes.length).toBeGreaterThan(800)
    expect(nodes.some(n => n.bronze)).toBe(true)
    // Nodes over the left headline or central ding are attenuated (< 0.4)
    expect(nodes.some(n => n.restWeight < 0.35)).toBe(true)
    expect(nodes.some(n => n.restWeight === 1)).toBe(true)
  })

  it('displaces nodes under magnetic pointer force and settles back to rest after leave', () => {
    const state = createHeroDotFieldState()
    state.width = 800
    state.height = 500
    state.nodes = createHeroGridNodes(800, 500)

    state.pointerInside = true
    state.pointerX = 400
    state.pointerY = 250
    state.smoothX = 400
    state.smoothY = 250
    for (let i = 0; i < 15; i += 1) stepHeroDotField(state, 16)

    const energized = state.nodes.filter(n => n.energy > 0.2)
    expect(energized.length).toBeGreaterThan(10)

    state.pointerInside = false
    let settled = false
    for (let i = 0; i < 240; i += 1) {
      if (stepHeroDotField(state, 32)) {
        settled = true
        break
      }
    }
    expect(settled).toBe(true)
  })

  it('spawns and retires click shockwaves cleanly', () => {
    const state = createHeroDotFieldState()
    state.width = 800
    state.height = 500
    state.nodes = createHeroGridNodes(800, 500)
    spawnHeroWave(state, 400, 250)
    expect(state.waves).toHaveLength(1)

    for (let i = 0; i < 60; i += 1) stepHeroDotField(state, 32)
    expect(state.waves).toHaveLength(0)
  })
})
