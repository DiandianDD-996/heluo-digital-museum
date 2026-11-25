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
      goldDark: makeGlowSprite('rgba(255,252,245,1)', 'rgba(232,206,158,0.62)', 'rgba(186,154,102,0.12)'),
      goldLight: makeGlowSprite('rgba(255,252,240,0.98)', 'rgba(226,184,104,0.64)', 'rgba(196,150,72,0.14)'),
      amberDark: makeGlowSprite('rgba(255,249,238,0.92)', 'rgba(214,186,136,0.44)', 'rgba(168,136,86,0.09)'),
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

  // 2) Right-of-center bronze ding silhouette on monolithic plinth (keep artifact unoccluded)
  const dxDing = (u - 0.68) / 0.125
  const dyDing = (v - 0.52) / 0.24
  const dDing = Math.hypot(dxDing, dyDing)
  const dingMask = dDing < 1 ? 0.14 + 0.86 * (dDing * dDing * (3 - 2 * dDing)) : 1

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
        const push = smoothFall * 38 * state.presence * dtSec
        n.vx += (dx / realD) * push
        n.vy += (dy / realD) * push
        n.vx += state.velX * smoothFall * 0.025 * dtSec
        n.vy += state.velY * smoothFall * 0.025 * dtSec
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
        targetEnergy = Math.max(targetEnergy, amp * 0.65)
        const wavePush = amp * 72 * dtSec
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
  const baseField = dark ? 'rgba(216, 198, 168, 0.14)' : 'rgba(198, 174, 134, 0.14)'
  const baseStar = dark ? 'rgba(236, 210, 162, 0.30)' : 'rgba(210, 174, 112, 0.28)'

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

  // 2) Soft ambient champagne-pearl aura around cursor.
  if (presence > 0.03) {
    const auraR = 175
    const aura = ctx.createRadialGradient(state.smoothX, state.smoothY, 0, state.smoothX, state.smoothY, auraR)
    if (dark) {
      aura.addColorStop(0, `rgba(236, 210, 162, ${(0.10 * presence).toFixed(3)})`)
      aura.addColorStop(0.55, `rgba(192, 160, 108, ${(0.04 * presence).toFixed(3)})`)
      aura.addColorStop(1, 'rgba(192, 160, 108, 0)')
    } else {
      aura.addColorStop(0, `rgba(255, 250, 234, ${(0.34 * presence).toFixed(3)})`)
      aura.addColorStop(0.5, `rgba(226, 186, 112, ${(0.14 * presence).toFixed(3)})`)
      aura.addColorStop(1, 'rgba(226, 186, 112, 0)')
    }
    ctx.beginPath()
    ctx.arc(state.smoothX, state.smoothY, auraR, 0, TAU)
    ctx.fillStyle = aura
    ctx.fill()
  }

  // 3) Quiet energized micro-motes (no flashy spiderweb filaments or spinning star needles).
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (n.energy <= 0.08) continue
    const spatialFade = 0.40 + 0.60 * n.restWeight
    const e = Math.min(1, n.energy) * spatialFade
    if (e <= 0.06) continue
    const r = (n.bronze ? 1.15 : 0.78) + e * (n.bronze ? 1.05 : 0.62)

    if (sprites) {
      const stamp = dark
        ? (n.bronze ? sprites.goldDark : sprites.amberDark)
        : sprites.goldLight
      const s = r * (n.bronze ? 5.2 : 4.0)
      ctx.globalAlpha = e * (dark ? 0.56 : 0.52)
      ctx.drawImage(stamp, n.x - s * 0.5, n.y - s * 0.5, s, s)
    }
    ctx.globalAlpha = 1

    if (dark) {
      const rr = Math.round(216 + e * 32)
      const gg = Math.round(188 + e * 44)
      const bb = Math.round(140 + e * 68)
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, TAU)
      ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${(0.34 + e * 0.40).toFixed(3)})`
      ctx.fill()
    } else if (n.bronze) {
      ctx.beginPath()
      ctx.arc(n.x, n.y, r * 1.08, 0, TAU)
      ctx.fillStyle = `rgba(218, 178, 106, ${(0.42 + e * 0.34).toFixed(3)})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(n.x, n.y, r * 0.56, 0, TAU)
      ctx.fillStyle = `rgba(255, 253, 246, ${(0.76 + e * 0.20).toFixed(3)})`
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, TAU)
      ctx.fillStyle = `rgba(224, 190, 128, ${(0.32 + e * 0.34).toFixed(3)})`
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}
