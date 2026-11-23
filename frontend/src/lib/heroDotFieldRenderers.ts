/**
 * Hero Luminous Dot-Field Renderer —「浑仪磁阵」(Harmonic Magnetic Dot Matrix)
 *
 * Tailored for the Heluo Digital Museum cover (`PointerDotField variant="image"`):
 *   - Spatial curatorial masking that gently attenuates resting dots behind the
 *     left editorial headline/copy and over the central bronze ding silhouette.
 *   - Hooke's-law spring-damper physics with velocity-anisotropic comet wake
 *     and 0.4 Hz hover micro-breathing.
 *   - Pre-baked 48x48 offscreen optical glow stamps (zero Canvas2D `shadowBlur`,
 *     zero dark smudge circle).
 *   - Bespoke astrolabe 4-point star needles & concentric rings on energized
 *     star pivot nodes ("金镶玉" in light mode, Obsidian-Champagne in dark mode).
 *   - Ordered 2-nearest-neighbor linear-gradient constellation filaments and
 *     click-triggered elastic shockwaves.
 */

export interface HeroGridNode {
  bx: number
  by: number
  x: number
  y: number
  vx: number
  vy: number
  energy: number
  bronze: boolean
  seed: number
  /** 0.16..1.0 spatial curatorial mask (attenuates behind left copy & central bronze ding). */
  restWeight: number
}

export interface HeroWaveRing {
  x: number
  y: number
  age: number
  maxAge: number
  maxRadius: number
  strength: number
}

export interface HeroDotFieldState {
  dark: boolean
  width: number
  height: number
  timeMs: number
  pointerInside: boolean
  pointerX: number
  pointerY: number
  smoothX: number
  smoothY: number
  velX: number
  velY: number
  presence: number
  nodes: HeroGridNode[]
  waves: HeroWaveRing[]
}

const TAU = Math.PI * 2

interface GlowSprites {
  goldDark: HTMLCanvasElement
  goldLight: HTMLCanvasElement
  amberDark: HTMLCanvasElement
}

let cachedSprites: GlowSprites | null = null

function makeGlowSprite(inner: string, mid: string, outer: string): HTMLCanvasElement {
  const size = 48
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (g) {
    const r = size / 2
    const grad = g.createRadialGradient(r, r, 0, r, r, r)
    grad.addColorStop(0, inner)
    grad.addColorStop(0.28, mid)
    grad.addColorStop(0.62, outer)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }
  return c
}

function getSprites(): GlowSprites | null {
  if (typeof document === 'undefined') return null
  if (!cachedSprites) {
    cachedSprites = {
      goldDark: makeGlowSprite('rgba(255,250,236,1)', 'rgba(238,200,128,0.68)', 'rgba(204,154,72,0.14)'),
      goldLight: makeGlowSprite('rgba(255,252,242,0.96)', 'rgba(218,174,92,0.52)', 'rgba(176,128,46,0.10)'),
      amberDark: makeGlowSprite('rgba(255,244,220,0.92)', 'rgba(212,172,106,0.48)', 'rgba(168,126,64,0.10)'),
    }
  }
  return cachedSprites
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function computeSpatialWeight(u: number, v: number): number {
  // 1) Left editorial reading zone (headline + intro copy + primary actions)
  const dxCopy = (u - 0.19) / 0.165
  const dyCopy = (v - 0.46) / 0.255
  const dCopy = Math.hypot(dxCopy, dyCopy)
  const copyMask = dCopy < 1 ? 0.20 + 0.80 * (dCopy * dCopy * (3 - 2 * dCopy)) : 1

  // 2) Central bronze ding silhouette inside the vitrine (keep artifact unoccluded)
  const dxDing = (u - 0.50) / 0.082
  const dyDing = (v - 0.50) / 0.155
  const dDing = Math.hypot(dxDing, dyDing)
  const dingMask = dDing < 1 ? 0.16 + 0.84 * (dDing * dDing * (3 - 2 * dDing)) : 1

  return Math.min(copyMask, dingMask)
}

export function createHeroGridNodes(width: number, height: number): HeroGridNode[] {
  const spacing = width >= 1200 ? 28 : 26
  const cols = Math.max(Math.ceil(width / spacing), 1)
  const rows = Math.max(Math.ceil(height / spacing), 1)
  const ox = (width - (cols - 1) * spacing) * 0.5
  const oy = (height - (rows - 1) * spacing) * 0.5
  const invW = 1 / Math.max(width, 1)
  const invH = 1 / Math.max(height, 1)
  const nodes: HeroGridNode[] = []
  let idx = 0
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const bx = ox + c * spacing
      const by = oy + r * spacing
      nodes.push({
        bx,
        by,
        x: bx,
        y: by,
        vx: 0,
        vy: 0,
        energy: 0,
        bronze: (c * 7 + r * 3) % 11 === 0,
        seed: hash(++idx),
        restWeight: computeSpatialWeight(bx * invW, by * invH),
      })
    }
  }
  return nodes
}

export function createHeroDotFieldState(): HeroDotFieldState {
  return {
    dark: false,
    width: 0,
    height: 0,
    timeMs: 0,
    pointerInside: false,
    pointerX: 0,
    pointerY: 0,
    smoothX: 0,
    smoothY: 0,
    velX: 0,
    velY: 0,
    presence: 0,
    nodes: [],
    waves: [],
  }
}

export function spawnHeroWave(state: HeroDotFieldState, x: number, y: number) {
  if (state.waves.length >= 10) state.waves.shift()
  const diag = Math.hypot(state.width, state.height) || 1200
  state.waves.push({
    x,
    y,
    age: 0,
    maxAge: 1450,
    maxRadius: Math.min(diag * 0.48, 560),
    strength: 1.0,
  })
}

export function stepHeroDotField(state: HeroDotFieldState, deltaMs: number): boolean {
  const dt = Math.min(deltaMs, 48)
  const dtSec = dt * 0.001
  state.timeMs += dt

  const followAlpha = 1 - Math.exp(-dt / 52)
  const prevX = state.smoothX
  const prevY = state.smoothY
  if (state.pointerInside) {
    state.smoothX += (state.pointerX - state.smoothX) * followAlpha
    state.smoothY += (state.pointerY - state.smoothY) * followAlpha
    const instantVx = (state.smoothX - prevX) / Math.max(dtSec, 0.008)
    const instantVy = (state.smoothY - prevY) / Math.max(dtSec, 0.008)
    state.velX += (instantVx - state.velX) * 0.28
    state.velY += (instantVy - state.velY) * 0.28
  } else {
    state.velX *= Math.exp(-dt / 120)
    state.velY *= Math.exp(-dt / 120)
  }

  const targetPresence = state.pointerInside ? 1 : 0
  const presTau = state.pointerInside ? 180 : 460
  state.presence += (targetPresence - state.presence) * (1 - Math.exp(-dt / presTau))
  if (Math.abs(targetPresence - state.presence) < 0.002) state.presence = targetPresence

  for (let i = state.waves.length - 1; i >= 0; i -= 1) {
    const w = state.waves[i]!
    w.age += dt
    if (w.age >= w.maxAge) state.waves.splice(i, 1)
  }

  let settled = !state.pointerInside && state.presence < 0.003 && state.waves.length === 0

  const influenceR = 200
  const stiffness = 28
  const damping = Math.exp(-dtSec * 7.2)
  const nodes = state.nodes

  const speed = Math.hypot(state.velX, state.velY)
  const speedNorm = Math.min(1, speed / 950)
  const dirX = speed > 12 ? state.velX / speed : 1
  const dirY = speed > 12 ? state.velY / speed : 0
  const tailScale = 1 + speedNorm * 0.48
  const breathPhase = state.timeMs * 0.0024

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    let targetEnergy = 0

    if (state.presence > 0.01) {
      const dx = n.x - state.smoothX
      const dy = n.y - state.smoothY
      const along = dx * dirX + dy * dirY
      const perp = -dx * dirY + dy * dirX
      const scaledAlong = along < 0 ? along / tailScale : along
      const effDist = Math.hypot(scaledAlong, perp)

      if (effDist < influenceR && effDist > 0.01) {
        const fall = 1 - effDist / influenceR
        const smoothFall = fall * fall * (3 - 2 * fall)
        const breathe = 1 + 0.11 * Math.sin(breathPhase - effDist * 0.036 + n.seed * 3.14)
        targetEnergy = Math.max(targetEnergy, Math.min(1, smoothFall * breathe * state.presence))

        const realD = Math.hypot(dx, dy) || 1
        const push = smoothFall * (195 + 18 * Math.sin(breathPhase - realD * 0.04)) * state.presence * dtSec
        n.vx += (dx / realD) * push
        n.vy += (dy / realD) * push
        n.vx += state.velX * smoothFall * 0.085 * dtSec
        n.vy += state.velY * smoothFall * 0.085 * dtSec
      }
    }

    for (let wi = 0; wi < state.waves.length; wi += 1) {
      const w = state.waves[wi]!
      const p = w.age / w.maxAge
      const easeP = 1 - (1 - p) * (1 - p)
      const ringR = easeP * w.maxRadius
      const band = 56
      const dx = n.bx - w.x
      const dy = n.by - w.y
      const d = Math.hypot(dx, dy)
      const delta = Math.abs(d - ringR)
      if (delta < band && d > 0.01) {
        const crest = Math.cos((delta / band) * Math.PI * 0.5)
        const fade = (1 - p) * (1 - p) * Math.min(1, p * 8)
        const amp = crest * crest * fade * w.strength
        targetEnergy = Math.max(targetEnergy, amp * 1.15)
        const wavePush = amp * 360 * dtSec
        n.vx += (dx / d) * wavePush
        n.vy += (dy / d) * wavePush
      }
    }

    n.vx += (n.bx - n.x) * stiffness * dtSec
    n.vy += (n.by - n.y) * stiffness * dtSec
    n.vx *= damping
    n.vy *= damping
    n.x += n.vx * dtSec * 14
    n.y += n.vy * dtSec * 14

    const eTau = targetEnergy > n.energy ? 55 : 220
    n.energy += (targetEnergy - n.energy) * (1 - Math.exp(-dt / eTau))
    if (n.energy < 0.002) n.energy = 0

    if (settled && (Math.abs(n.x - n.bx) > 0.08 || Math.abs(n.y - n.by) > 0.08 || n.energy > 0.01)) {
      settled = false
    }
  }

  if (state.pointerInside) settled = false
  return settled
}

export function renderHeroDotField(ctx: CanvasRenderingContext2D, state: HeroDotFieldState) {
  const { width, height, dark, presence, nodes } = state
  ctx.clearRect(0, 0, width, height)
  if (!width || !height) return

  const sprites = getSprites()
  const baseField = dark ? 'rgba(214, 192, 154, 0.15)' : 'rgba(86, 76, 62, 0.15)'
  const baseStar = dark ? 'rgba(240, 206, 138, 0.32)' : 'rgba(156, 118, 52, 0.28)'

  // 1) Fast batched resting micro-dots with spatial curatorial masking.
  ctx.beginPath()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (n.bronze || n.energy > 0.06 || n.restWeight < 0.28) continue
    const r = 0.8 * (0.38 + 0.62 * n.restWeight)
    ctx.moveTo(n.x + r, n.y)
    ctx.arc(n.x, n.y, r, 0, TAU)
  }
  ctx.fillStyle = baseField
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (!n.bronze || n.energy > 0.06 || n.restWeight < 0.24) continue
    const r = 1.12 * (0.42 + 0.58 * n.restWeight)
    ctx.moveTo(n.x + r, n.y)
    ctx.arc(n.x, n.y, r, 0, TAU)
  }
  ctx.fillStyle = baseStar
  ctx.fill()

  // 2) Soft ambient champagne aura around cursor.
  if (presence > 0.03) {
    const auraR = 175
    const aura = ctx.createRadialGradient(state.smoothX, state.smoothY, 0, state.smoothX, state.smoothY, auraR)
    if (dark) {
      aura.addColorStop(0, `rgba(238, 200, 128, ${(0.11 * presence).toFixed(3)})`)
      aura.addColorStop(0.55, `rgba(196, 152, 82, ${(0.045 * presence).toFixed(3)})`)
      aura.addColorStop(1, 'rgba(196, 152, 82, 0)')
    } else {
      aura.addColorStop(0, `rgba(255, 248, 232, ${(0.28 * presence).toFixed(3)})`)
      aura.addColorStop(0.55, `rgba(214, 174, 102, ${(0.08 * presence).toFixed(3)})`)
      aura.addColorStop(1, 'rgba(214, 174, 102, 0)')
    }
    ctx.beginPath()
    ctx.arc(state.smoothX, state.smoothY, auraR, 0, TAU)
    ctx.fillStyle = aura
    ctx.fill()
  }

  // 3) Ordered Heluo 2-nearest-neighbor constellation filaments.
  const stars: HeroGridNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (n.bronze && n.energy > 0.16) stars.push(n)
  }

  if (stars.length > 1) {
    const maxDist = 144
    const drawnPairs = new Set<number>()
    ctx.lineWidth = 0.72

    for (let i = 0; i < stars.length; i += 1) {
      const a = stars[i]!
      let best1 = -1
      let best2 = -1
      let dist1 = maxDist
      let dist2 = maxDist

      for (let j = 0; j < stars.length; j += 1) {
        if (i === j) continue
        const b = stars[j]!
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < dist1) {
          dist2 = dist1
          best2 = best1
          dist1 = d
          best1 = j
        } else if (d < dist2) {
          dist2 = d
          best2 = j
        }
      }

      const neighbors = [
        [best1, dist1],
        [best2, dist2],
      ] as const

      for (let k = 0; k < neighbors.length; k += 1) {
        const [j, d] = neighbors[k]!
        if (j < 0) continue
        const pairKey = i < j ? i * 1000 + j : j * 1000 + i
        if (drawnPairs.has(pairKey)) continue
        drawnPairs.add(pairKey)

        const b = stars[j]!
        const alpha = (1 - d / maxDist) * Math.min(a.energy, b.energy) * (dark ? 0.68 : 0.52)
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
        if (dark) {
          grad.addColorStop(0, `rgba(255, 244, 214, ${(alpha * 1.1).toFixed(3)})`)
          grad.addColorStop(0.5, `rgba(232, 194, 122, ${(alpha * 0.62).toFixed(3)})`)
          grad.addColorStop(1, `rgba(255, 244, 214, ${(alpha * 1.1).toFixed(3)})`)
        } else {
          grad.addColorStop(0, `rgba(148, 104, 32, ${(alpha * 1.1).toFixed(3)})`)
          grad.addColorStop(0.5, `rgba(186, 142, 68, ${(alpha * 0.58).toFixed(3)})`)
          grad.addColorStop(1, `rgba(148, 104, 32, ${(alpha * 1.1).toFixed(3)})`)
        }
        ctx.strokeStyle = grad
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
  }

  // 4) Energized luminous nodes + bespoke astrolabe 4-point star needles on star pivots.
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (n.energy <= 0.06) continue
    const spatialFade = 0.45 + 0.55 * n.restWeight
    const e = Math.min(1, n.energy) * spatialFade
    if (e <= 0.05) continue
    const r = (n.bronze ? 1.32 : 0.88) + e * (n.bronze ? 2.3 : 1.45)

    if (sprites) {
      const stamp = dark
        ? (n.bronze ? sprites.goldDark : sprites.amberDark)
        : sprites.goldLight
      const s = r * (n.bronze ? 7.2 : 5.2)
      ctx.globalAlpha = e * (dark ? 0.88 : 0.72)
      ctx.drawImage(stamp, n.x - s * 0.5, n.y - s * 0.5, s, s)
    }
    ctx.globalAlpha = 1

    if (n.bronze && e > 0.26) {
      const starAlpha = ((e - 0.26) / 0.74) * (dark ? 0.68 : 0.56)
      const ringR = r * (1.85 + e * 0.55)
      ctx.lineWidth = 0.65
      ctx.strokeStyle = dark
        ? `rgba(246, 214, 148, ${(starAlpha * 0.78).toFixed(3)})`
        : `rgba(168, 122, 44, ${(starAlpha * 0.78).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(n.x, n.y, ringR, 0, TAU)
      ctx.stroke()

      if (e > 0.36) {
        const arm = r * (2.6 + e * 2.1)
        const rot = (n.seed - 0.5) * 0.35 + state.timeMs * 0.00022
        const cosR = Math.cos(rot)
        const sinR = Math.sin(rot)
        ctx.lineWidth = 0.75
        ctx.strokeStyle = dark
          ? `rgba(255, 246, 222, ${starAlpha.toFixed(3)})`
          : `rgba(154, 108, 32, ${starAlpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(n.x - cosR * arm, n.y - sinR * arm)
        ctx.lineTo(n.x + cosR * arm, n.y + sinR * arm)
        ctx.moveTo(n.x + sinR * arm * 0.78, n.y - cosR * arm * 0.78)
        ctx.lineTo(n.x - sinR * arm * 0.78, n.y + cosR * arm * 0.78)
        ctx.stroke()
      }
    }

    if (dark) {
      const rr = Math.round(206 + e * 49)
      const gg = Math.round(164 + e * 76)
      const bb = Math.round(96 + e * 124)
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, TAU)
      ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${(0.45 + e * 0.55).toFixed(3)})`
      ctx.fill()

      if (n.bronze && e > 0.3) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 0.44, 0, TAU)
        ctx.fillStyle = `rgba(255, 252, 244, ${(e * 0.94).toFixed(3)})`
        ctx.fill()
      }
    } else if (n.bronze) {
      ctx.beginPath()
      ctx.arc(n.x, n.y, r * 1.14, 0, TAU)
      ctx.fillStyle = `rgba(196, 150, 68, ${(0.45 + e * 0.48).toFixed(3)})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(n.x, n.y, r * 0.68, 0, TAU)
      ctx.fillStyle = `rgba(26, 86, 70, ${(0.62 + e * 0.36).toFixed(3)})`
      ctx.fill()
    } else {
      const rr = Math.round(128 + e * 56)
      const gg = Math.round(98 + e * 42)
      const bb = Math.round(52 + e * 18)
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, TAU)
      ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${(0.34 + e * 0.52).toFixed(3)})`
      ctx.fill()

      if (e > 0.42) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 0.38, 0, TAU)
        ctx.fillStyle = `rgba(255, 250, 238, ${(e * 0.85).toFixed(3)})`
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1
}
