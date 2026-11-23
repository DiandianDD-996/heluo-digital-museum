import { DOT_FIELD_CONFIG, type DotFieldPoint } from './pointerDotField'
import type { LightPresetId } from '../stores/lightPreset'

export type LightFieldVariant = 'image' | 'paper' | 'heading'

export interface TrailNode {
  x: number
  y: number
  age: number
  maxAge: number
  speed: number
}

export interface RipplePulse {
  x: number
  y: number
  age: number
  maxAge: number
  maxRadius: number
}

export interface FlowMote {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  gold: boolean
  phase: number
  angle: number
  spin: number
  energy: number
}

export interface LightFieldRuntime {
  preset: LightPresetId
  variant: LightFieldVariant
  dark: boolean
  width: number
  height: number
  radius: number
  timeMs: number
  pointerInside: boolean
  pointerX: number
  pointerY: number
  smoothX: number
  smoothY: number
  pointerSpeed: number
  presence: number
  points: DotFieldPoint[]
  trail: TrailNode[]
  ripples: RipplePulse[]
  motes: FlowMote[]
}

const TAU = Math.PI * 2

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function deterministic(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

export function createFlowMotes(width: number, height: number, variant: LightFieldVariant): FlowMote[] {
  const area = width * height
  const baseCount = variant === 'heading'
    ? Math.round(area / 5200)
    : variant === 'image'
      ? Math.round(area / 4200)
      : Math.round(area / 5600)
  const count = Math.min(Math.max(baseCount, 48), 250)
  const motes: FlowMote[] = []
  for (let i = 0; i < count; i += 1) {
    const gold = deterministic(i, 3) < 0.68
    motes.push({
      x: deterministic(i, 7) * width,
      y: deterministic(i, 11) * height,
      vx: 0,
      vy: 0,
      size: gold ? 1.65 + deterministic(i, 19) * 2.85 : 1.2 + deterministic(i, 23) * 1.95,
      alpha: 0.34 + deterministic(i, 29) * 0.46,
      gold,
      phase: deterministic(i, 37) * TAU,
      angle: deterministic(i, 43) * TAU,
      spin: (deterministic(i, 53) - 0.5) * 0.024,
      energy: 0,
    })
  }
  return motes
}

export function pushTrailSample(runtime: LightFieldRuntime, x: number, y: number, speed: number) {
  const last = runtime.trail[runtime.trail.length - 1]
  if (last && Math.hypot(x - last.x, y - last.y) < 4) return
  runtime.trail.push({
    x,
    y,
    age: 0,
    maxAge: runtime.preset === 'luoshui' ? 1140 : runtime.preset === 'kintsugi' ? 860 : 540,
    speed: Math.min(speed, 1800),
  })
  if (runtime.trail.length > 44) runtime.trail.shift()
}

export function spawnRipplePulse(runtime: LightFieldRuntime, x: number, y: number, strong = false) {
  runtime.ripples.push({
    x,
    y,
    age: 0,
    maxAge: strong ? 1250 : 960,
    maxRadius: strong
      ? Math.min(Math.max(runtime.radius * 1.48, 220), 360)
      : Math.min(Math.max(runtime.radius * 0.96, 140), 230),
  })
  if (runtime.ripples.length > 8) runtime.ripples.shift()
}

export function stepLightFieldEffects(runtime: LightFieldRuntime, deltaMs: number): boolean {
  const dt = Math.min(Math.max(deltaMs, 0), 48)
  runtime.timeMs += dt

  const presenceTarget = runtime.pointerInside ? 1 : 0
  const presenceTau = runtime.pointerInside ? 105 : 320
  const presenceAlpha = 1 - Math.exp(-dt / presenceTau)
  runtime.presence += (presenceTarget - runtime.presence) * presenceAlpha

  const followAlpha = 1 - Math.exp(-dt / 56)
  runtime.smoothX += (runtime.pointerX - runtime.smoothX) * followAlpha
  runtime.smoothY += (runtime.pointerY - runtime.smoothY) * followAlpha
  runtime.pointerSpeed *= Math.exp(-dt / 160)

  for (let i = runtime.trail.length - 1; i >= 0; i -= 1) {
    const node = runtime.trail[i]!
    node.age += dt
    if (node.age >= node.maxAge) runtime.trail.splice(i, 1)
  }

  for (let i = runtime.ripples.length - 1; i >= 0; i -= 1) {
    const ripple = runtime.ripples[i]!
    ripple.age += dt
    if (ripple.age >= ripple.maxAge) runtime.ripples.splice(i, 1)
  }

  let motesEnergetic = false
  if (runtime.preset !== 'celestial' && runtime.motes.length > 0 && (runtime.presence > 0.015 || runtime.ripples.length > 0)) {
    const t = runtime.timeMs * 0.00052
    const wakeRadius = runtime.preset === 'kintsugi' ? runtime.radius * 1.38 : runtime.radius * 1.15
    const speedBoost = clamp01(runtime.pointerSpeed / 1000)
    const stepFactor = dt / 16.67

    for (let i = 0; i < runtime.motes.length; i += 1) {
      const m = runtime.motes[i]!
      const nx = m.x * 0.0038
      const ny = m.y * 0.0038
      const flowAngle = Math.sin(nx + t) * 2.1 + Math.cos(ny - t * 0.9) * 2.1 + m.phase * 0.18
      const baseSpeed = runtime.preset === 'kintsugi' ? 0.56 : runtime.preset === 'luoshui' ? 0.34 : 0.22

      m.vx = m.vx * 0.91 + Math.cos(flowAngle) * baseSpeed * 0.16
      m.vy = m.vy * 0.91 + Math.sin(flowAngle) * baseSpeed * 0.16

      if (runtime.pointerInside) {
        const dx = m.x - runtime.smoothX
        const dy = m.y - runtime.smoothY
        const dist = Math.hypot(dx, dy)
        if (dist < wakeRadius && dist > 0.5) {
          const falloff = 1 - dist / wakeRadius
          const force = falloff * falloff * (0.68 + speedBoost * 1.85)
          const inv = 1 / dist
          const swirlX = -dy * inv
          const swirlY = dx * inv
          const radialX = dx * inv
          const radialY = dy * inv
          if (runtime.preset === 'kintsugi') {
            m.vx += (swirlX * 0.85 + radialX * 0.52) * force * 1.15
            m.vy += (swirlY * 0.85 + radialY * 0.52) * force * 1.15
          } else if (runtime.preset === 'luoshui') {
            m.vx += (swirlX * 0.65 + radialX * 0.32) * force * 0.72
            m.vy += (swirlY * 0.65 + radialY * 0.32) * force * 0.72
          } else {
            m.vx += swirlX * force * 0.24
            m.vy -= (0.20 + force * 0.32)
          }
          m.energy = Math.min(1, m.energy + falloff * 0.24 * stepFactor)
        } else {
          m.energy *= Math.exp(-dt / 360)
        }
      } else {
        m.energy *= Math.exp(-dt / 280)
      }

      for (let r = 0; r < runtime.ripples.length; r += 1) {
        const rip = runtime.ripples[r]!
        const progress = rip.age / rip.maxAge
        const ringR = rip.maxRadius * (1 - Math.pow(1 - progress, 3))
        const dx = m.x - rip.x
        const dy = m.y - rip.y
        const dist = Math.hypot(dx, dy)
        const band = Math.abs(dist - ringR)
        if (band < 44 && dist > 1) {
          const push = (1 - band / 44) * (1 - progress) * 1.45
          m.vx += (dx / dist) * push
          m.vy += (dy / dist) * push
          m.energy = Math.min(1, m.energy + push * 0.85)
        }
      }

      m.x += m.vx * stepFactor
      m.y += m.vy * stepFactor
      m.angle += m.spin * stepFactor * (1 + m.energy * 4.2)

      if (m.x < -14) m.x = runtime.width + 14
      else if (m.x > runtime.width + 14) m.x = -14
      if (m.y < -14) m.y = runtime.height + 14
      else if (m.y > runtime.height + 14) m.y = -14

      if (m.energy > 0.04) motesEnergetic = true
    }
  }

  const pointerLag = Math.hypot(runtime.pointerX - runtime.smoothX, runtime.pointerY - runtime.smoothY)
  const presenceSettled = Math.abs(presenceTarget - runtime.presence) < 0.012
  const keepAliveForAmbient = runtime.pointerInside && (runtime.preset === 'kintsugi' || runtime.preset === 'spotlight')
  return !keepAliveForAmbient
    && presenceSettled
    && pointerLag < 0.6
    && runtime.trail.length === 0
    && runtime.ripples.length === 0
    && !motesEnergetic
}

/**
 * Draw an exquisite optical lens starburst / high-jewelry specular glint:
 * luminous radial pearl core pierced by razor-thin tapered light needles
 * that feather seamlessly to 0% alpha (zero flat polygon clip-art feel).
 */
function drawStarSpark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  arm: number,
  fillStyle: string,
  tilt = 0.28,
) {
  const r = Math.max(arm, 3)
  const coreR = Math.max(1.3, r * 0.28)

  // Soft outer optical bokeh bloom
  const bloom = ctx.createRadialGradient(x, y, 0, x, y, r * 0.62)
  bloom.addColorStop(0, fillStyle)
  bloom.addColorStop(0.28, 'rgba(246, 224, 174, 0.34)')
  bloom.addColorStop(1, 'rgba(246, 224, 174, 0)')
  ctx.fillStyle = bloom
  ctx.beginPath()
  ctx.arc(x, y, r * 0.62, 0, TAU)
  ctx.fill()

  // Two razor-fine optical specular needles fading smoothly to transparent tips
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const axes: ReadonlyArray<readonly [number, number, number, number]> = [
    [cos, sin, r, 0.85],
    [-sin, cos, r * 0.72, 0.7],
  ]

  ctx.lineCap = 'round'
  for (let a = 0; a < axes.length; a += 1) {
    const [dx, dy, len, lw] = axes[a]!
    const x1 = x - dx * len
    const y1 = y - dy * len
    const x2 = x + dx * len
    const y2 = y + dy * len
    const grad = ctx.createLinearGradient(x1, y1, x2, y2)
    grad.addColorStop(0, 'rgba(255, 250, 238, 0)')
    grad.addColorStop(0.36, 'rgba(242, 214, 158, 0.42)')
    grad.addColorStop(0.5, fillStyle)
    grad.addColorStop(0.64, 'rgba(242, 214, 158, 0.42)')
    grad.addColorStop(1, 'rgba(255, 250, 238, 0)')
    ctx.strokeStyle = grad
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // Crisp luminous pearl pinpoint core
  const pin = ctx.createRadialGradient(x, y, 0, x, y, coreR)
  pin.addColorStop(0, fillStyle)
  pin.addColorStop(0.55, 'rgba(255, 248, 232, 0.55)')
  pin.addColorStop(1, 'rgba(255, 248, 232, 0)')
  ctx.fillStyle = pin
  ctx.beginPath()
  ctx.arc(x, y, coreR, 0, TAU)
  ctx.fill()
}

/**
 * Draw a gossamer-thin calligraphic tapered silk wave arc around (cx, cy).
 * Both ends taper gracefully to 0px width and 0 opacity, with gentle organic
 * liquid surface undulation so it reads as flowing water-silk rather than a compass circle.
 */
function drawFeatheredSilkArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRx: number,
  baseRy: number,
  rotation: number,
  startAngle: number,
  sweepAngle: number,
  waveAmp: number,
  waveFreq: number,
  wavePhase: number,
  maxWidth: number,
  color: readonly [number, number, number],
  maxAlpha: number,
) {
  const segments = 22
  const cosR = Math.cos(rotation)
  const sinR = Math.sin(rotation)
  const [r, g, b] = color

  const px = new Float32Array(segments + 1)
  const py = new Float32Array(segments + 1)
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const theta = startAngle + sweepAngle * t
    const ripple = 1 + waveAmp * Math.sin(theta * waveFreq + wavePhase)
    const lx = Math.cos(theta) * baseRx * ripple
    const ly = Math.sin(theta) * baseRy * ripple
    px[i] = cx + lx * cosR - ly * sinR
    py[i] = cy + lx * sinR + ly * cosR
  }

  ctx.lineCap = 'round'
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments
    const envelope = Math.sin(t * Math.PI)
    const alpha = maxAlpha * Math.pow(envelope, 1.35)
    if (alpha < 0.012) continue
    const x0 = (px[i - 1]! + px[i]!) * 0.5
    const y0 = (py[i - 1]! + py[i]!) * 0.5
    const x1 = px[i]!
    const y1 = py[i]!
    const x2 = (px[i]! + px[i + 1]!) * 0.5
    const y2 = (py[i]! + py[i + 1]!) * 0.5
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
    ctx.lineWidth = Math.max(0.35, maxWidth * Math.pow(envelope, 0.85))
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(x1, y1, x2, y2)
    ctx.stroke()
  }
}

/**
 * V1: 河洛星纬 · Celestial Bronze Lattice & Magnetic Filigree
 * High-contrast smoked optical halo + golden constellation filaments + astrolabe arcs + 4-point stars.
 */
function drawCelestial(ctx: CanvasRenderingContext2D, runtime: LightFieldRuntime) {
  const { dark, variant, points, radius, smoothX, smoothY, presence, timeMs } = runtime
  const heading = variant === 'heading'
  const isImage = variant === 'image'

  // 1. Local museum optical contrast lens so golden stars & filaments pop over sunlit architecture
  if (presence > 0.02 && !heading) {
    const lensR = Math.min(radius * 1.28, 285)
    const lens = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, lensR)
    if (isImage) {
      lens.addColorStop(0, `rgba(22, 20, 18, ${((dark ? 0.38 : 0.22) * presence).toFixed(3)})`)
      lens.addColorStop(0.52, `rgba(26, 23, 20, ${((dark ? 0.18 : 0.10) * presence).toFixed(3)})`)
      lens.addColorStop(1, 'rgba(22, 20, 18, 0)')
    } else {
      lens.addColorStop(0, `rgba(212, 174, 108, ${((dark ? 0.16 : 0.14) * presence).toFixed(3)})`)
      lens.addColorStop(0.55, `rgba(186, 152, 96, ${(0.05 * presence).toFixed(3)})`)
      lens.addColorStop(1, 'rgba(186, 152, 96, 0)')
    }
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, lensR, 0, TAU)
    ctx.fillStyle = lens
    ctx.fill()

    // Warm gilded core bloom inside the optical lens
    const coreR = lensR * 0.48
    const core = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, coreR)
    core.addColorStop(0, `rgba(255, 246, 224, ${((dark ? 0.28 : 0.32) * presence).toFixed(3)})`)
    core.addColorStop(0.5, `rgba(224, 190, 132, ${((dark ? 0.12 : 0.11) * presence).toFixed(3)})`)
    core.addColorStop(1, 'rgba(248, 212, 128, 0)')
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, coreR, 0, TAU)
    ctx.fillStyle = core
    ctx.fill()

    // Precision astrolabe golden orbital arcs gently rotating around pointer
    const rot = timeMs * 0.00045
    ctx.strokeStyle = dark
      ? `rgba(244, 216, 158, ${(0.48 * presence).toFixed(3)})`
      : `rgba(204, 162, 88, ${(0.46 * presence).toFixed(3)})`
    ctx.lineWidth = 1.0
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, 54, rot, rot + Math.PI * 0.62)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, 54, rot + Math.PI, rot + Math.PI * 1.62)
    ctx.stroke()

    ctx.strokeStyle = dark
      ? `rgba(218, 192, 148, ${(0.28 * presence).toFixed(3)})`
      : `rgba(186, 152, 96, ${(0.28 * presence).toFixed(3)})`
    ctx.lineWidth = 0.85
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, 96, -rot * 0.7, -rot * 0.7 + Math.PI * 0.45)
    ctx.stroke()
  }

  // 2. Quiet refined star-lattice baseline (warm silver-sand & brushed champagne, zero murky green)
  ctx.globalAlpha = heading ? 0.36 : 1
  const jadeBase = dark ? 'rgba(208, 190, 158, .16)' : isImage ? 'rgba(182, 158, 120, .20)' : 'rgba(176, 152, 116, .18)'
  const goldBase = dark ? 'rgba(234, 206, 154, .34)' : isImage ? 'rgba(202, 162, 92, .34)' : 'rgba(194, 154, 84, .32)'

  ctx.beginPath()
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!
    if (p.bronze) continue
    const r = DOT_FIELD_CONFIG.jadeRadius * 0.9
    ctx.moveTo(p.x + r, p.y)
    ctx.arc(p.x, p.y, r, 0, TAU)
  }
  ctx.fillStyle = jadeBase
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!
    if (!p.bronze) continue
    const r = DOT_FIELD_CONFIG.bronzeRadius * 0.95
    ctx.moveTo(p.x + r, p.y)
    ctx.arc(p.x, p.y, r, 0, TAU)
  }
  ctx.fillStyle = goldBase
  ctx.fill()

  // 3. Collect awakened points & weave crisp gilded constellation filaments near pointer
  const awakenedGold: DotFieldPoint[] = []
  const awakenedJade: DotFieldPoint[] = []
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!
    if (p.activity < 0.04) continue
    if (p.bronze) awakenedGold.push(p)
    else awakenedJade.push(p)
  }

  if (presence > 0.05) {
    // Filament links between awakened bronze stars & nearby bright nodes
    const hubs = awakenedGold.filter((p) => p.activity >= 0.14)
    const maxLink = 148
    ctx.lineWidth = 1.15
    for (let i = 0; i < hubs.length; i += 1) {
      const a = hubs[i]!
      // Connect bronze anchor softly toward cursor core
      const dPtr = Math.hypot(a.x - smoothX, a.y - smoothY)
      if (dPtr < 145) {
        const ptrAlpha = (1 - dPtr / 145) * a.activity * presence * (dark ? 0.68 : 0.64)
        ctx.strokeStyle = dark
          ? `rgba(252, 222, 146, ${ptrAlpha.toFixed(3)})`
          : `rgba(236, 186, 72, ${ptrAlpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(smoothX, smoothY)
        ctx.stroke()
      }
      for (let j = i + 1; j < hubs.length; j += 1) {
        const b = hubs[j]!
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (dist > maxLink) continue
        const lineAlpha = (1 - dist / maxLink) * Math.min(a.activity, b.activity) * presence * (dark ? 0.72 : 0.68)
        if (lineAlpha < 0.04) continue
        ctx.strokeStyle = dark
          ? `rgba(248, 214, 138, ${lineAlpha.toFixed(3)})`
          : `rgba(226, 174, 58, ${lineAlpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }

    // Secondary delicate celadon star-threads linking hottest jade neighbors to bronze hubs
    ctx.lineWidth = 0.8
    for (let i = 0; i < hubs.length; i += 1) {
      const hub = hubs[i]!
      if (hub.activity < 0.34) continue
      let linked = 0
      for (let j = 0; j < awakenedJade.length && linked < 3; j += 1) {
        const jd = awakenedJade[j]!
        if (jd.activity < 0.42) continue
        const dist = Math.hypot(hub.x - jd.x, hub.y - jd.y)
        if (dist > 64) continue
        const a = (1 - dist / 64) * jd.activity * presence * 0.46
        ctx.strokeStyle = dark ? `rgba(238, 218, 180, ${a.toFixed(3)})` : `rgba(204, 168, 106, ${a.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(hub.x, hub.y)
        ctx.lineTo(jd.x, jd.y)
        ctx.stroke()
        linked += 1
      }
    }
  }

  // 4. Awakened pearl-ivory & champagne-gold stars with crisp glow (zero green dots!)
  ctx.globalAlpha = heading ? 0.84 : 1
  if (awakenedJade.length > 0) {
    ctx.beginPath()
    for (let i = 0; i < awakenedJade.length; i += 1) {
      const p = awakenedJade[i]!
      const r = DOT_FIELD_CONFIG.jadeRadius * p.scale * (0.82 + p.activity * 0.48)
      ctx.moveTo(p.x + r, p.y)
      ctx.arc(p.x, p.y, r, 0, TAU)
    }
    ctx.shadowColor = dark ? 'rgba(242, 218, 172, .56)' : 'rgba(212, 174, 106, .52)'
    ctx.shadowBlur = 7
    ctx.fillStyle = dark ? 'rgba(248, 236, 212, .92)' : 'rgba(232, 200, 142, .92)'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }

  if (awakenedGold.length > 0) {
    ctx.beginPath()
    for (let i = 0; i < awakenedGold.length; i += 1) {
      const p = awakenedGold[i]!
      const r = DOT_FIELD_CONFIG.bronzeRadius * p.scale * (0.9 + p.activity * 0.52)
      ctx.moveTo(p.x + r, p.y)
      ctx.arc(p.x, p.y, r, 0, TAU)
    }
    ctx.shadowColor = dark ? 'rgba(255, 224, 152, .82)' : 'rgba(218, 174, 88, .74)'
    ctx.shadowBlur = 8
    ctx.fillStyle = dark ? 'rgba(255, 244, 214, 1)' : 'rgba(224, 180, 96, 1)'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'

    // High-jewelry optical lens starbursts on top bronze anchors (skipped on compact heading strips)
    if (!heading) {
      const sparkColor = dark ? 'rgba(255, 248, 226, .96)' : 'rgba(255, 232, 142, .96)'
      let sparks = 0
      for (let i = 0; i < awakenedGold.length && sparks < 6; i += 1) {
        const p = awakenedGold[i]!
        if (p.activity < 0.28) continue
        drawStarSpark(ctx, p.x, p.y, 7 + p.activity * 7.5, sparkColor, 0.22 + (i % 3) * 0.24)
        sparks += 1
      }
    }
  }

  drawRipples(ctx, runtime, 'celestial')
  ctx.globalAlpha = 1
}

/**
 * V2: 洛水浮光 · Luo River Liquid Silk Caustics (宋代汝窑天青 × 香槟鎏金 × 月白流光)
 * Smooth quadratic-spline multi-veil silk ribbons, organic elliptical water-caustic sheen,
 * radial micro-bokeh water droplets & poetic dual-wave ripples.
 */
function drawLuoshui(ctx: CanvasRenderingContext2D, runtime: LightFieldRuntime) {
  const { dark, variant, smoothX, smoothY, radius, presence, trail, motes, timeMs } = runtime
  const heading = variant === 'heading'
  const isImage = variant === 'image'

  // Exquisite Moonlit Pearl × Brushed Champagne Gold × Warm Silver-Sand palette
  const pearl: readonly [number, number, number] = dark ? [255, 251, 242] : [255, 252, 245]
  const champagne: readonly [number, number, number] = dark ? [232, 204, 154] : [198, 156, 82]
  const bronzeRose: readonly [number, number, number] = dark ? [188, 152, 102] : [164, 124, 66]
  const ruCeladon: readonly [number, number, number] = dark ? [220, 204, 176] : [186, 162, 124]

  // Derive smooth glide heading from recent trail so water caustics flow naturally with cursor direction
  let glideAngle = timeMs * 0.00028
  if (trail.length >= 2) {
    const tail = trail[Math.max(0, trail.length - 4)]!
    const head = trail[trail.length - 1]!
    const gdx = head.x - tail.x
    const gdy = head.y - tail.y
    if (Math.hypot(gdx, gdy) > 2) glideAngle = Math.atan2(gdy, gdx)
  }

  // 1. Soft optical water-mirror pool + organic elliptical caustics around pointer
  if (presence > 0.02) {
    const poolR = Math.min(radius * (heading ? 0.96 : 1.44), 310)
    const breathe = 1 + Math.sin(timeMs * 0.0024) * 0.045

    if (isImage) {
      // Quiet smoked warm-slate backing so pearl, champagne & Ru-celadon glow cleanly over sunlit stone
      const backing = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, poolR * breathe)
      backing.addColorStop(0, `rgba(20, 24, 23, ${((dark ? 0.36 : 0.30) * presence).toFixed(3)})`)
      backing.addColorStop(0.55, `rgba(24, 28, 27, ${((dark ? 0.15 : 0.12) * presence).toFixed(3)})`)
      backing.addColorStop(1, 'rgba(20, 24, 23, 0)')
      ctx.beginPath()
      ctx.arc(smoothX, smoothY, poolR * breathe, 0, TAU)
      ctx.fillStyle = backing
      ctx.fill()
    }

    // Dual-layer silk water luminance (pearl moonlight center -> champagne -> misty Ru-celadon outer rim)
    const pool = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, poolR * 0.76 * breathe)
    pool.addColorStop(0, `rgba(${pearl[0]}, ${pearl[1]}, ${pearl[2]}, ${((dark ? 0.28 : 0.32) * presence).toFixed(3)})`)
    pool.addColorStop(0.28, `rgba(${champagne[0]}, ${champagne[1]}, ${champagne[2]}, ${((dark ? 0.24 : 0.24) * presence).toFixed(3)})`)
    pool.addColorStop(0.62, `rgba(${ruCeladon[0]}, ${ruCeladon[1]}, ${ruCeladon[2]}, ${((dark ? 0.14 : 0.14) * presence).toFixed(3)})`)
    pool.addColorStop(1, `rgba(${ruCeladon[0]}, ${ruCeladon[1]}, ${ruCeladon[2]}, 0)`)
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, poolR * 0.76 * breathe, 0, TAU)
    ctx.fillStyle = pool
    ctx.fill()

    // Harmonious gossamer silk-water caustic contours around cursor:
    // organically undulating, doubly-tapered calligraphic arcs that fade to hairlines at both tips.
    const slowPhase = timeMs * 0.00052
    const counterPhase = -timeMs * 0.00038
    const tilt = glideAngle * 0.28
    const visScale = presence * (heading ? 0.72 : 1)

    // Inner whisper-soft champagne silk crescent + pearl counter-crescent
    drawFeatheredSilkArc(
      ctx, smoothX, smoothY,
      36 * breathe, 27 * breathe, tilt,
      slowPhase, Math.PI * 1.05,
      0.045, 3, timeMs * 0.0014,
      1.35, champagne, (dark ? 0.62 : 0.68) * visScale,
    )
    drawFeatheredSilkArc(
      ctx, smoothX, smoothY,
      32 * breathe, 24 * breathe, tilt + 0.18,
      slowPhase + Math.PI * 0.92, Math.PI * 0.78,
      0.035, 2, -timeMs * 0.0012,
      0.85, pearl, (dark ? 0.56 : 0.60) * visScale,
    )

    // Mid Song Ru-celadon flowing water-vein wave (gently undulating lotus-ripple geometry)
    drawFeatheredSilkArc(
      ctx, smoothX, smoothY,
      62 * breathe, 46 * breathe, tilt - 0.14,
      counterPhase + 0.6, Math.PI * 1.18,
      0.06, 3, timeMs * 0.0011 + 1.2,
      1.15, ruCeladon, (dark ? 0.48 : 0.56) * visScale,
    )
    drawFeatheredSilkArc(
      ctx, smoothX, smoothY,
      58 * breathe, 43 * breathe, tilt - 0.14,
      counterPhase + Math.PI * 1.12, Math.PI * 0.72,
      0.05, 4, -timeMs * 0.001 + 2.4,
      0.85, champagne, (dark ? 0.36 : 0.42) * visScale,
    )

    // Outer gossamer mist-silk shimmer arc (whisper-faint atmospheric boundary)
    drawFeatheredSilkArc(
      ctx, smoothX, smoothY,
      92 * breathe, 68 * breathe, tilt + 0.08,
      slowPhase * 0.65 + 2.1, Math.PI * 0.92,
      0.055, 2, timeMs * 0.0009,
      0.8, pearl, (dark ? 0.28 : 0.32) * visScale,
    )
  }

  // 2. Smooth quadratic-spline gossamer multi-veil silk ribbons along pointer trajectory
  if (trail.length >= 3) {
    const count = trail.length
    const normalsX = new Float32Array(count)
    const normalsY = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const prev = trail[Math.max(0, i - 1)]!
      const next = trail[Math.min(count - 1, i + 1)]!
      const dx = next.x - prev.x
      const dy = next.y - prev.y
      const len = Math.max(Math.hypot(dx, dy), 1)
      normalsX[i] = -dy / len
      normalsY[i] = dx / len
    }

    const silkLayers = [
      // Layer 1: Broad gossamer warm amber-champagne silk mist wash
      { amp: 2.2, freq: 0.26, phase: 0, width: 14.5, color: bronzeRose, alpha: dark ? 0.20 : 0.19, blur: 20 },
      // Layer 2: Slender champagne rose-gold flowing silk filament
      { amp: 9.5, freq: 0.32, phase: 0.2, width: 1.95, color: champagne, alpha: dark ? 0.84 : 0.84, blur: 7 },
      // Layer 3: Powdery Song Ru-celadon counter-silk gossamer thread
      { amp: -10.5, freq: 0.30, phase: Math.PI * 0.86, width: 1.45, color: ruCeladon, alpha: dark ? 0.68 : 0.72, blur: 6 },
      // Layer 4: Whisper-fine pearl moonlight crest highlight
      { amp: 4.8, freq: 0.36, phase: 0.48, width: 0.85, color: pearl, alpha: dark ? 0.82 : 0.78, blur: 4 },
    ] as const

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let l = 0; l < silkLayers.length; l += 1) {
      const layer = silkLayers[l]!
      const [r, g, b] = layer.color
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, .48)`
      ctx.shadowBlur = layer.blur

      // Compute displaced points for this silk strand
      const sx = new Float32Array(count)
      const sy = new Float32Array(count)
      for (let i = 0; i < count; i += 1) {
        const node = trail[i]!
        const frac = i / Math.max(count - 1, 1)
        const envelope = Math.sin(frac * Math.PI) // graceful zero-pinch taper at both ends
        const wave = layer.amp * Math.sin(timeMs * 0.0055 + i * layer.freq + layer.phase) * (0.25 + envelope * 0.75)
        sx[i] = node.x + normalsX[i]! * wave
        sy[i] = node.y + normalsY[i]! * wave
      }

      // Draw smooth quadratic midpoint spline segments with organic width & opacity taper
      for (let i = 1; i < count - 1; i += 1) {
        const node = trail[i]!
        const life = 1 - node.age / node.maxAge
        if (life <= 0.02) continue
        const frac = i / Math.max(count - 1, 1)
        const taper = Math.pow(Math.sin(frac * Math.PI), 0.65)
        const p0x = (sx[i - 1]! + sx[i]!) * 0.5
        const p0y = (sy[i - 1]! + sy[i]!) * 0.5
        const p1x = sx[i]!
        const p1y = sy[i]!
        const p2x = (sx[i]! + sx[i + 1]!) * 0.5
        const p2y = (sy[i]! + sy[i + 1]!) * 0.5
        const speedBoost = 0.72 + Math.min(node.speed / 1200, 1) * 0.58
        const alpha = life * (0.22 + frac * 0.78) * layer.alpha * (heading ? 0.74 : 1)

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${clamp01(alpha).toFixed(3)})`
        ctx.lineWidth = Math.max(0.55, layer.width * life * (0.35 + taper * 0.75) * speedBoost)
        ctx.beginPath()
        ctx.moveTo(p0x, p0y)
        ctx.quadraticCurveTo(p1x, p1y, p2x, p2y)
        ctx.stroke()
      }
    }
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }

  // 3. Delicate radial-bokeh water-light droplets & fine pearlescent glints (zero chunky circles!)
  if (presence > 0.02 || runtime.ripples.length > 0) {
    for (let i = 0; i < motes.length; i += 1) {
      const m = motes[i]!
      const d = Math.hypot(m.x - smoothX, m.y - smoothY)
      const near = clamp01(1 - d / (radius * 1.42))
      const twinkle = 0.62 + 0.38 * Math.sin(timeMs * 0.0052 + m.phase * 2.4)
      const a = (m.alpha * 0.12 + near * 0.64 + m.energy * 0.52) * twinkle * Math.max(presence, m.energy) * (heading ? 0.72 : 1)
      if (a < 0.045) continue

      const glowR = m.size * (0.95 + near * 0.85 + m.energy * 0.45)
      const [cr, cg, cb] = m.gold ? champagne : ruCeladon
      const bokeh = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, glowR * 1.65)
      bokeh.addColorStop(0, `rgba(${pearl[0]}, ${pearl[1]}, ${pearl[2]}, ${clamp01(a * 0.95).toFixed(3)})`)
      bokeh.addColorStop(0.38, `rgba(${cr}, ${cg}, ${cb}, ${clamp01(a * 0.68).toFixed(3)})`)
      bokeh.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`)
      ctx.fillStyle = bokeh
      ctx.beginPath()
      ctx.arc(m.x, m.y, glowR * 1.65, 0, TAU)
      ctx.fill()

      // Delicate optical lens-flare water glint on peak highlights (rotated uniquely per mote)
      if (m.gold && near > 0.50 && twinkle > 0.84) {
        drawStarSpark(
          ctx,
          m.x,
          m.y,
          6.5 + glowR * 2.4,
          `rgba(${pearl[0]}, ${pearl[1]}, ${pearl[2]}, ${(a * 0.88).toFixed(3)})`,
          0.22 + (m.phase % 0.55),
        )
      }
    }
  }

  drawRipples(ctx, runtime, 'luoshui')
}

/**
 * V3: 展柜聚光 · Curatorial Gallery Spotlight & Volumetric Beam
 * True museum flashlight: soft atmospheric dim outside beam + bright volumetric spotlight
 * illuminating engraved Heluo compass filigree & sparkling Tyndall gold dust inside.
 */
function drawSpotlight(ctx: CanvasRenderingContext2D, runtime: LightFieldRuntime) {
  const { dark, variant, width, height, smoothX, smoothY, radius, presence, motes, timeMs } = runtime
  const heading = variant === 'heading'
  const isImage = variant === 'image'
  const beamR = Math.min(Math.max(radius * (heading ? 1.15 : 1.72), 250), 390)

  if (presence <= 0.015 && runtime.ripples.length === 0) return

  // 1. Atmospheric cinema gallery dimming OUTSIDE the spotlight cone (hero image mode)
  if (presence > 0.02 && isImage) {
    const outerR = Math.max(width, height) * 0.92
    const theater = ctx.createRadialGradient(smoothX, smoothY, beamR * 0.24, smoothX, smoothY, outerR)
    theater.addColorStop(0, 'rgba(10, 10, 9, 0)')
    theater.addColorStop(0.22, `rgba(12, 12, 11, ${((dark ? 0.16 : 0.10) * presence).toFixed(3)})`)
    theater.addColorStop(0.46, `rgba(12, 11, 10, ${((dark ? 0.56 : 0.36) * presence).toFixed(3)})`)
    theater.addColorStop(1, `rgba(10, 10, 9, ${((dark ? 0.70 : 0.46) * presence).toFixed(3)})`)
    ctx.fillStyle = theater
    ctx.fillRect(0, 0, width, height)
  }

  if (presence > 0.02) {
    // 2. Warm volumetric track-spotlight glow inside cone
    const beam = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, beamR)
    beam.addColorStop(0, `rgba(255, 244, 212, ${((dark ? 0.26 : 0.32) * presence).toFixed(3)})`)
    beam.addColorStop(0.32, `rgba(238, 198, 116, ${((dark ? 0.14 : 0.16) * presence).toFixed(3)})`)
    beam.addColorStop(0.7, `rgba(126, 188, 166, ${(0.045 * presence).toFixed(3)})`)
    beam.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, beamR, 0, TAU)
    ctx.fillStyle = beam
    ctx.fill()

    // 3. Engraved Heluo architectural grid & rotating brass astrolabe revealed strictly inside beam
    ctx.save()
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, beamR * 0.92, 0, TAU)
    ctx.clip()

    const step = 52
    const startX = Math.floor((smoothX - beamR) / step) * step
    const endX = Math.ceil((smoothX + beamR) / step) * step
    const startY = Math.floor((smoothY - beamR) / step) * step
    const endY = Math.ceil((smoothY + beamR) / step) * step

    const gridGrad = ctx.createRadialGradient(smoothX, smoothY, 10, smoothX, smoothY, beamR * 0.88)
    gridGrad.addColorStop(0, `rgba(255, 224, 148, ${((dark ? 0.54 : 0.56) * presence).toFixed(3)})`)
    gridGrad.addColorStop(0.55, `rgba(222, 180, 96, ${((dark ? 0.24 : 0.26) * presence).toFixed(3)})`)
    gridGrad.addColorStop(1, 'rgba(222, 180, 96, 0)')

    ctx.strokeStyle = gridGrad
    ctx.lineWidth = 0.95
    ctx.beginPath()
    for (let x = startX; x <= endX; x += step) {
      if (x < 0 || x > width) continue
      ctx.moveTo(x, Math.max(0, startY))
      ctx.lineTo(x, Math.min(height, endY))
    }
    for (let y = startY; y <= endY; y += step) {
      if (y < 0 || y > height) continue
      ctx.moveTo(Math.max(0, startX), y)
      ctx.lineTo(Math.min(width, endX), y)
    }
    ctx.stroke()

    // Crisp museum registration crosshairs at grid intersections
    ctx.fillStyle = gridGrad
    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        const d = Math.hypot(x - smoothX, y - smoothY)
        if (d > beamR * 0.78) continue
        ctx.fillRect(x - 5, y - 0.75, 10, 1.5)
        ctx.fillRect(x - 0.75, y - 5, 1.5, 10)
      }
    }

    // Precision museum brass aperture & rotating degree compass rings
    const rot = timeMs * 0.00028
    const ringAlpha = (dark ? 0.62 : 0.58) * presence
    ctx.strokeStyle = `rgba(252, 220, 142, ${ringAlpha.toFixed(3)})`
    ctx.lineWidth = 1.25
    ctx.setLineDash([5, 9])
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, beamR * 0.38, rot, rot + TAU)
    ctx.stroke()
    ctx.setLineDash([])

    // Outer faint measuring ring
    ctx.strokeStyle = `rgba(240, 204, 128, ${(ringAlpha * 0.45).toFixed(3)})`
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, beamR * 0.62, -rot * 0.6, -rot * 0.6 + Math.PI * 0.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, beamR * 0.62, -rot * 0.6 + Math.PI, -rot * 0.6 + Math.PI * 1.8)
    ctx.stroke()

    // Inner lens bracket arcs
    ctx.strokeStyle = `rgba(255, 236, 178, ${(ringAlpha * 0.92).toFixed(3)})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, beamR * 0.17, -rot * 1.4, -rot * 1.4 + Math.PI * 0.52)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, beamR * 0.17, -rot * 1.4 + Math.PI, -rot * 1.4 + Math.PI * 1.52)
    ctx.stroke()

    ctx.restore()

    // 4. Sparkling Tyndall golden dust motes floating inside the spotlight beam
    for (let i = 0; i < motes.length; i += 1) {
      const m = motes[i]!
      const dist = Math.hypot(m.x - smoothX, m.y - smoothY)
      if (dist > beamR * 0.9) continue
      const cone = 1 - dist / (beamR * 0.9)
      const twinkle = 0.58 + 0.42 * Math.sin(timeMs * 0.0055 + m.phase * 2)
      const alpha = cone * twinkle * presence * (dark ? 0.98 : 0.92)
      if (alpha < 0.04) continue
      const r = m.size * (0.7 + cone * 0.72)
      ctx.fillStyle = m.gold
        ? `rgba(255, 242, 202, ${clamp01(alpha).toFixed(3)})`
        : `rgba(242, 224, 188, ${clamp01(alpha * 0.82).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(m.x, m.y, r, 0, TAU)
      ctx.fill()
      if (m.gold && cone > 0.62 && twinkle > 0.85) {
        drawStarSpark(ctx, m.x, m.y, r * 2.8, `rgba(255, 248, 224, ${(alpha * 0.85).toFixed(3)})`)
      }
    }
  }

  drawRipples(ctx, runtime, 'spotlight')
}

/**
 * V4: 流金箔尘 · Perlin/Curl Silk Flow-Field & Kintsugi Gold Dust
 * Lush faceted gold-leaf flakes & jade sand parted by a fluid vortex wake + molten Kintsugi trail.
 */
function drawKintsugi(ctx: CanvasRenderingContext2D, runtime: LightFieldRuntime) {
  const { dark, variant, smoothX, smoothY, radius, presence, trail, motes, timeMs } = runtime
  const heading = variant === 'heading'
  const isImage = variant === 'image'

  // 1. Warm smoked lacquer aura behind cursor so molten gold trail gleams over bright surfaces
  if (presence > 0.02) {
    const auraR = Math.min(radius * 1.32, 290)
    if (isImage) {
      const contrast = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, auraR)
      contrast.addColorStop(0, `rgba(22, 16, 10, ${((dark ? 0.36 : 0.28) * presence).toFixed(3)})`)
      contrast.addColorStop(0.55, `rgba(26, 20, 14, ${((dark ? 0.16 : 0.11) * presence).toFixed(3)})`)
      contrast.addColorStop(1, 'rgba(22, 16, 10, 0)')
      ctx.beginPath()
      ctx.arc(smoothX, smoothY, auraR, 0, TAU)
      ctx.fillStyle = contrast
      ctx.fill()
    }

    const aura = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, auraR * 0.72)
    aura.addColorStop(0, `rgba(255, 218, 126, ${((dark ? 0.34 : 0.28) * presence).toFixed(3)})`)
    aura.addColorStop(0.45, `rgba(218, 160, 56, ${((dark ? 0.14 : 0.12) * presence).toFixed(3)})`)
    aura.addColorStop(1, 'rgba(218, 160, 56, 0)')
    ctx.beginPath()
    ctx.arc(smoothX, smoothY, auraR * 0.72, 0, TAU)
    ctx.fillStyle = aura
    ctx.fill()
  }

  // 2. Molten Kintsugi gold-lacquer dual-layer silk brushstroke trail
  if (trail.length >= 2) {
    ctx.lineCap = 'round'
    // Outer warm molten-gold glow pass
    ctx.shadowColor = 'rgba(232, 170, 42, .68)'
    ctx.shadowBlur = 12
    for (let i = 1; i < trail.length; i += 1) {
      const prev = trail[i - 1]!
      const curr = trail[i]!
      const life = 1 - curr.age / curr.maxAge
      if (life <= 0.02) continue
      const frac = i / trail.length
      const alpha = life * frac * (dark ? 0.65 : 0.58) * (heading ? 0.72 : 1)
      ctx.strokeStyle = `rgba(236, 178, 52, ${alpha.toFixed(3)})`
      ctx.lineWidth = 4.6 * life * (0.45 + frac * 0.85)
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(curr.x, curr.y)
      ctx.stroke()
    }
    // Inner razor-bright champagne gold filament core
    ctx.shadowBlur = 4
    ctx.shadowColor = 'rgba(255, 240, 190, .75)'
    for (let i = 1; i < trail.length; i += 1) {
      const prev = trail[i - 1]!
      const curr = trail[i]!
      const life = 1 - curr.age / curr.maxAge
      if (life <= 0.04) continue
      const frac = i / trail.length
      const alpha = life * frac * 0.92 * (heading ? 0.75 : 1)
      ctx.strokeStyle = `rgba(255, 242, 194, ${alpha.toFixed(3)})`
      ctx.lineWidth = 1.65 * life * (0.4 + frac * 0.85)
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(curr.x, curr.y)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }

  // 3. Faceted gold-leaf diamond slivers & celadon mineral dust drifting in curl-noise flow
  ctx.globalAlpha = heading ? 0.72 : 1
  for (let i = 0; i < motes.length; i += 1) {
    const m = motes[i]!
    const twinkle = 0.68 + 0.32 * Math.sin(timeMs * 0.005 + m.phase * 3)
    const energyBoost = m.energy
    const baseVis = dark ? 0.42 : 0.36
    const alpha = clamp01((m.alpha * baseVis + energyBoost * 0.88) * twinkle)
    if (alpha < 0.04) continue

    const size = m.size * (0.9 + energyBoost * 1.15)
    ctx.save()
    ctx.translate(m.x, m.y)
    ctx.rotate(m.angle)

    if (m.gold) {
      // Subtle warm umber rim under gold leaf so flakes gleam even over bright marble
      if (energyBoost > 0.25) {
        ctx.shadowColor = dark ? 'rgba(255, 214, 118, .72)' : 'rgba(138, 92, 16, .48)'
        ctx.shadowBlur = 6
      }
      ctx.fillStyle = dark
        ? `rgba(255, 224, 142, ${alpha.toFixed(3)})`
        : `rgba(226, 168, 42, ${alpha.toFixed(3)})`
      ctx.beginPath()
      ctx.moveTo(0, -size * 1.6)
      ctx.lineTo(size * 0.92, 0)
      ctx.lineTo(0, size * 1.6)
      ctx.lineTo(-size * 0.92, 0)
      ctx.closePath()
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      if (energyBoost > 0.38) {
        drawStarSpark(
          ctx,
          0,
          0,
          size * 2.8,
          `rgba(255, 248, 220, ${clamp01(energyBoost * 0.94).toFixed(3)})`,
        )
      }
    } else {
      ctx.fillStyle = dark
        ? `rgba(236, 216, 180, ${(alpha * 0.86).toFixed(3)})`
        : `rgba(204, 168, 106, ${(alpha * 0.84).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.9, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  drawRipples(ctx, runtime, 'kintsugi')
  ctx.globalAlpha = 1
}

function drawRipples(ctx: CanvasRenderingContext2D, runtime: LightFieldRuntime, preset: LightPresetId) {
  const { dark, ripples } = runtime
  for (let i = 0; i < ripples.length; i += 1) {
    const rip = ripples[i]!
    const progress = clamp01(rip.age / rip.maxAge)
    const eased = 1 - Math.pow(1 - progress, 3)
    const r = 12 + rip.maxRadius * eased
    const alpha = Math.pow(1 - progress, 1.45) * (dark ? 0.70 : 0.64)
    if (alpha < 0.02) continue

    if (preset === 'luoshui') {
      // Feathered organic silk-water ripple waves (broken doubly-tapered arcs, never harsh full rings)
      const champagneCol: readonly [number, number, number] = dark ? [236, 208, 158] : [198, 154, 78]
      const celadonCol: readonly [number, number, number] = dark ? [220, 202, 172] : [184, 158, 118]
      const pearlCol: readonly [number, number, number] = [255, 251, 242]
      const drift = progress * 0.9

      drawFeatheredSilkArc(
        ctx, rip.x, rip.y,
        r * 1.12, r * 0.88, 0.14,
        drift, Math.PI * 1.15,
        0.032, 3, drift * 2,
        1.55 * (1 - progress * 0.45), champagneCol, alpha * 0.92,
      )
      drawFeatheredSilkArc(
        ctx, rip.x, rip.y,
        r * 1.12, r * 0.88, 0.14,
        drift + Math.PI * 1.08, Math.PI * 0.82,
        0.028, 3, drift * 2 + 1.4,
        1.15 * (1 - progress * 0.45), pearlCol, alpha * 0.62,
      )

      const r2 = Math.max(8, r * 0.72)
      drawFeatheredSilkArc(
        ctx, rip.x, rip.y,
        r2 * 1.12, r2 * 0.88, -0.1,
        -drift * 0.8 + 0.5, Math.PI * 1.25,
        0.04, 2, drift * 1.5,
        1.05, celadonCol, alpha * 0.64,
      )
      continue
    }

    ctx.shadowColor = 'rgba(238, 204, 136, .48)'
    ctx.shadowBlur = 8
    ctx.strokeStyle = dark
      ? `rgba(248, 224, 172, ${alpha.toFixed(3)})`
      : `rgba(212, 168, 86, ${alpha.toFixed(3)})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(rip.x, rip.y, r, 0, TAU)
    ctx.stroke()

    if (preset === 'celestial' || preset === 'kintsugi') {
      const r2 = Math.max(8, r * 0.72)
      const alpha2 = alpha * 0.62
      ctx.strokeStyle = `rgba(255, 246, 224, ${alpha2.toFixed(3)})`
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.arc(rip.x, rip.y, r2, 0, TAU)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }
}

export function renderLightField(ctx: CanvasRenderingContext2D, runtime: LightFieldRuntime) {
  ctx.clearRect(0, 0, runtime.width, runtime.height)
  if (runtime.preset === 'luoshui') {
    drawLuoshui(ctx, runtime)
  } else if (runtime.preset === 'spotlight') {
    drawSpotlight(ctx, runtime)
  } else if (runtime.preset === 'kintsugi') {
    drawKintsugi(ctx, runtime)
  } else {
    drawCelestial(ctx, runtime)
  }
}
