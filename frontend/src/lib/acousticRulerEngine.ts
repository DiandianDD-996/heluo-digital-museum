/**
 * AcousticRuler Engine —「十二律吕 · 青铜游标刻度」
 *
 * Pure TypeScript acoustic analysis, Hooke spring-damper physics,
 * and zero-shadowBlur Canvas2D renderer combining:
 *   - 12-pitch architectural meridian calibration (十二律吕)
 *   - Continuous guqin-silk harmonic envelope ribbon
 *   - Crisp vernier needles with star-needle apexes
 *   - Subtle Luo-River mirrored reflection below the datum rail
 */

export type AcousticRulerPaletteKey =
  | 'hero-light'
  | 'hero-dark'
  | 'darkroom-bronze'
  | 'darkroom-pointcloud'

export interface LogBand {
  index: number
  startBin: number
  endBin: number
  startHz: number
  endHz: number
  bassCompensation: number
  windowWeight: number
}

export interface RulerBar {
  value: number
  velocity: number
  peakHold: number
  pulse: number
}

export interface RulerRipple {
  centerRatio: number
  ageMs: number
  maxAgeMs: number
  strength: number
}

export interface AcousticRulerDrawState {
  width: number
  height: number
  palette: AcousticRulerPaletteKey
  active: boolean
  bars: readonly RulerBar[]
  hoverRatio?: number | null
  pointCloudMix?: number
}

interface PaletteStops {
  lineBase: string
  tickRest: string
  tickMajorRest: string
  barBottom: string
  barTop: string
  pillarTop: string
  ribbonStroke: string
  ribbonFillTop: string
  ribbonFillBottom: string
  reflection: string
  starTip: string
}

const PALETTES: Record<AcousticRulerPaletteKey, PaletteStops> = {
  'hero-light': {
    lineBase: 'rgba(116, 78, 38, 0.28)',
    tickRest: 'rgba(116, 78, 38, 0.36)',
    tickMajorRest: 'rgba(104, 62, 24, 0.68)',
    barBottom: 'rgba(132, 82, 36, 0.56)',
    barTop: 'rgba(166, 108, 42, 0.96)',
    pillarTop: 'rgba(118, 68, 22, 0.98)',
    ribbonStroke: 'rgba(156, 104, 42, 0.52)',
    ribbonFillTop: 'rgba(176, 124, 54, 0.14)',
    ribbonFillBottom: 'rgba(176, 124, 54, 0.01)',
    reflection: 'rgba(136, 88, 42, 0.24)',
    starTip: 'rgba(255, 244, 214, 0.96)',
  },
  'hero-dark': {
    lineBase: 'rgba(226, 200, 148, 0.26)',
    tickRest: 'rgba(222, 196, 146, 0.34)',
    tickMajorRest: 'rgba(240, 216, 168, 0.68)',
    barBottom: 'rgba(192, 154, 92, 0.48)',
    barTop: 'rgba(244, 222, 174, 0.96)',
    pillarTop: 'rgba(255, 240, 206, 0.98)',
    ribbonStroke: 'rgba(240, 214, 162, 0.50)',
    ribbonFillTop: 'rgba(232, 202, 142, 0.14)',
    ribbonFillBottom: 'rgba(232, 202, 142, 0.01)',
    reflection: 'rgba(222, 194, 140, 0.24)',
    starTip: 'rgba(255, 252, 240, 0.98)',
  },
  'darkroom-bronze': {
    lineBase: 'rgba(226, 198, 144, 0.28)',
    tickRest: 'rgba(222, 194, 140, 0.36)',
    tickMajorRest: 'rgba(242, 216, 166, 0.72)',
    barBottom: 'rgba(186, 146, 84, 0.48)',
    barTop: 'rgba(242, 218, 168, 0.96)',
    pillarTop: 'rgba(255, 242, 208, 0.98)',
    ribbonStroke: 'rgba(242, 216, 162, 0.54)',
    ribbonFillTop: 'rgba(232, 198, 134, 0.16)',
    ribbonFillBottom: 'rgba(232, 198, 134, 0.01)',
    reflection: 'rgba(222, 190, 132, 0.26)',
    starTip: 'rgba(255, 250, 236, 0.98)',
  },
  'darkroom-pointcloud': {
    lineBase: 'rgba(202, 224, 234, 0.28)',
    tickRest: 'rgba(198, 220, 230, 0.36)',
    tickMajorRest: 'rgba(226, 242, 248, 0.72)',
    barBottom: 'rgba(146, 182, 198, 0.46)',
    barTop: 'rgba(224, 242, 248, 0.96)',
    pillarTop: 'rgba(246, 253, 255, 0.98)',
    ribbonStroke: 'rgba(216, 238, 246, 0.56)',
    ribbonFillTop: 'rgba(196, 226, 238, 0.16)',
    ribbonFillBottom: 'rgba(196, 226, 238, 0.01)',
    reflection: 'rgba(188, 216, 228, 0.24)',
    starTip: 'rgba(248, 254, 255, 0.98)',
  },
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

export function buildLogBandTable(options: {
  sampleRate?: number
  fftSize?: number
  barCount: number
  minHz?: number
  maxHz?: number
}): LogBand[] {
  const sampleRate = Math.max(8000, options.sampleRate ?? 44100)
  const fftSize = Math.max(256, options.fftSize ?? 2048)
  const barCount = Math.max(4, Math.floor(options.barCount))
  const minHz = Math.max(20, options.minHz ?? 60)
  const maxHz = Math.min(sampleRate * 0.48, Math.max(minHz + 100, options.maxHz ?? 4500))
  const binCount = Math.floor(fftSize / 2)
  const hzPerBin = sampleRate / fftSize
  const ratio = maxHz / minHz

  const bands: LogBand[] = []
  for (let i = 0; i < barCount; i += 1) {
    const startHz = minHz * Math.pow(ratio, i / barCount)
    const endHz = minHz * Math.pow(ratio, (i + 1) / barCount)
    const rawStart = Math.max(1, Math.floor(startHz / hzPerBin))
    const rawEnd = Math.min(binCount - 1, Math.max(rawStart, Math.floor(endHz / hzPerBin)))
    const u = (i + 0.5) / barCount
    const bassCompensation = 0.74 + 0.26 * (i / Math.max(barCount - 1, 1))
    const windowWeight = 0.34 + 0.66 * Math.pow(Math.sin(Math.PI * u), 0.68)

    bands.push({
      index: i,
      startBin: Math.min(binCount - 1, rawStart),
      endBin: rawEnd,
      startHz,
      endHz,
      bassCompensation,
      windowWeight,
    })
  }
  return bands
}

export function sampleBandEnergies(
  spectrum: Uint8Array,
  bands: readonly LogBand[],
  out?: Float32Array,
): Float32Array {
  const target = out && out.length === bands.length ? out : new Float32Array(bands.length)
  if (spectrum.length === 0) {
    target.fill(0)
    return target
  }

  for (let i = 0; i < bands.length; i += 1) {
    const band = bands[i]!
    const start = Math.min(spectrum.length - 1, band.startBin)
    const end = Math.min(spectrum.length - 1, Math.max(start, band.endBin))
    let sumSq = 0
    let count = 0
    for (let bin = start; bin <= end; bin += 1) {
      const normalized = (spectrum[bin] ?? 0) / 255
      sumSq += normalized * normalized
      count += 1
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0
    target[i] = rms * band.bassCompensation
  }
  return target
}

export function normalizeChamberSpectrum(
  energies: ArrayLike<number>,
  rollingPeak: number,
  dtSeconds: number,
  bands: readonly LogBand[],
  out?: Float32Array,
): { values: Float32Array; rollingPeak: number } {
  const len = Math.min(energies.length, bands.length)
  const values = out && out.length === len ? out : new Float32Array(len)
  const safeDt = Math.max(0.001, Math.min(0.1, Number.isFinite(dtSeconds) ? dtSeconds : 0.016))

  let framePeak = 0
  for (let i = 0; i < len; i += 1) {
    const v = energies[i] ?? 0
    if (v > framePeak) framePeak = v
  }

  const prevPeak = Number.isFinite(rollingPeak) ? Math.max(0.12, rollingPeak) : 0.12
  const tau = framePeak > prevPeak ? 0.25 : 4.5
  const alpha = 1 - Math.exp(-safeDt / tau)
  const nextPeak = Math.max(0.12, prevPeak + (framePeak - prevPeak) * alpha)

  for (let i = 0; i < len; i += 1) {
    const prev = energies[Math.max(0, i - 1)] ?? 0
    const curr = energies[i] ?? 0
    const next = energies[Math.min(len - 1, i + 1)] ?? 0
    const smoothed = prev * 0.16 + curr * 0.68 + next * 0.16
    const norm = clamp01(smoothed / nextPeak)
    values[i] = Math.pow(norm, 0.58) * bands[i]!.windowWeight
  }
  return { values, rollingPeak: nextPeak }
}

export function createRulerBars(barCount: number): RulerBar[] {
  return Array.from({ length: Math.max(1, barCount) }, () => ({
    value: 0,
    velocity: 0,
    peakHold: 0,
    pulse: 0,
  }))
}

export function triggerRulerRipple(
  ripples: RulerRipple[],
  centerRatio: number,
  strength = 0.85,
): void {
  if (ripples.length >= 6) ripples.shift()
  ripples.push({
    centerRatio: clamp01(centerRatio),
    ageMs: 0,
    maxAgeMs: 700,
    strength: clamp01(strength),
  })
}

export function stepRulerBars(
  bars: RulerBar[],
  targets: ArrayLike<number> | null,
  ripples: RulerRipple[],
  dtMs: number,
): void {
  const safeDtMs = Math.max(1, Math.min(48, Number.isFinite(dtMs) ? dtMs : 16.67))
  const dtScale = safeDtMs / 16.667
  const dtSec = safeDtMs * 0.001

  for (let ri = ripples.length - 1; ri >= 0; ri -= 1) {
    const ripple = ripples[ri]!
    ripple.ageMs += safeDtMs
    if (ripple.ageMs >= ripple.maxAgeMs) {
      ripples.splice(ri, 1)
    }
  }

  const count = bars.length
  for (let i = 0; i < count; i += 1) {
    const bar = bars[i]!
    const u = (i + 0.5) / count

    let pulseSum = 0
    for (let ri = 0; ri < ripples.length; ri += 1) {
      const r = ripples[ri]!
      const p = r.ageMs / r.maxAgeMs
      const waveRadius = p * 0.62
      const dist = Math.abs(Math.abs(u - r.centerRatio) - waveRadius)
      if (dist < 0.1) {
        const bell = Math.cos((dist / 0.1) * Math.PI * 0.5)
        const fade = (1 - p) * (1 - p) * Math.min(1, p * 7)
        pulseSum += bell * bell * fade * r.strength
      }
    }
    bar.pulse = clamp01(pulseSum)

    const rawTarget = targets ? (targets[i] ?? 0) : 0
    const target = clamp01(rawTarget)
    const rising = target > bar.value
    const stiffness = rising ? 0.24 : 0.08
    const damping = rising ? 0.72 : 0.86

    const force = (target - bar.value) * stiffness
    bar.velocity = (bar.velocity + force * dtScale) * Math.pow(damping, dtScale)
    const nextVal = bar.value + bar.velocity * dtScale
    if (nextVal <= 0) {
      bar.value = 0
      bar.velocity = 0
    } else {
      bar.value = clamp01(nextVal)
    }

    if (target === 0 && bar.value < 0.0012 && Math.abs(bar.velocity) < 0.0012) {
      bar.value = 0
      bar.velocity = 0
    }

    bar.peakHold = Math.max(bar.value, Math.max(0, bar.peakHold - 0.8 * dtSec))
    if (bar.peakHold < 0.0012 && bar.value === 0) bar.peakHold = 0
  }
}

export function isRulerSettled(
  bars: readonly RulerBar[],
  ripples: readonly RulerRipple[],
): boolean {
  if (ripples.length > 0) return false
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]!
    if (bar.value >= 0.002 || Math.abs(bar.velocity) >= 0.002 || bar.peakHold >= 0.002 || bar.pulse >= 0.002) {
      return false
    }
  }
  return true
}

export function drawAcousticRuler(
  ctx: CanvasRenderingContext2D,
  state: AcousticRulerDrawState,
): void {
  const { width, height, palette, bars, hoverRatio } = state
  ctx.clearRect(0, 0, width, height)
  if (width <= 0 || height <= 0 || bars.length === 0) return

  const colors = PALETTES[palette]
  const count = bars.length
  const pitchStep = Math.max(2, Math.round(count / 12))
  const datumY = Math.round(height * 0.72)
  const maxUp = Math.max(6, datumY - 3)
  const maxReflect = Math.max(2, height - datumY - 2)

  // 1) Tapered horizontal bronze datum rail
  const railGrad = ctx.createLinearGradient(0, 0, width, 0)
  railGrad.addColorStop(0, 'rgba(0,0,0,0)')
  railGrad.addColorStop(0.12, colors.lineBase)
  railGrad.addColorStop(0.88, colors.lineBase)
  railGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = railGrad
  ctx.fillRect(0, datumY, width, 1)

  const barGradient = ctx.createLinearGradient(0, datumY, 0, Math.max(1, datumY - maxUp))
  barGradient.addColorStop(0, colors.barBottom)
  barGradient.addColorStop(1, colors.barTop)

  const pillarGradient = ctx.createLinearGradient(0, datumY, 0, Math.max(1, datumY - maxUp))
  pillarGradient.addColorStop(0, colors.barBottom)
  pillarGradient.addColorStop(1, colors.pillarTop)

  // Precompute bar geometry for unified silk-ribbon + vertical needles
  const xs: number[] = new Array(count)
  const tops: number[] = new Array(count)
  const energies: number[] = new Array(count)
  const fades: number[] = new Array(count)
  const hovers: number[] = new Array(count)

  for (let i = 0; i < count; i += 1) {
    const bar = bars[i]!
    const u = (i + 0.5) / count
    const isPitchPillar = i % pitchStep === 0 || i === count - 1
    const edgeFade = 0.42 + 0.58 * Math.sin(Math.PI * u)

    let hoverBoost = 0
    if (hoverRatio !== null && hoverRatio !== undefined) {
      const dist = Math.abs(u - hoverRatio)
      if (dist < 0.12) {
        hoverBoost = (1 - dist / 0.12) * 0.28
      }
    }

    const energy = Math.max(bar.value, bar.pulse * 0.78)
    const archEnvelope = 0.46 + 0.54 * Math.sin(Math.PI * u)
    const restHeight = (isPitchPillar ? 7.5 : 3.5) * archEnvelope
    const h = Math.max(restHeight, energy * maxUp + hoverBoost * (maxUp * 0.42))

    xs[i] = u * width
    tops[i] = datumY - h
    energies[i] = energy
    fades[i] = edgeFade
    hovers[i] = hoverBoost
  }

  // 2) Continuous Guqin-Silk Harmonic Envelope Ribbon (when path APIs exist)
  if (typeof ctx.beginPath === 'function' && count >= 3) {
    const ribbonGrad = ctx.createLinearGradient(0, Math.max(1, datumY - maxUp), 0, datumY)
    ribbonGrad.addColorStop(0, colors.ribbonFillTop)
    ribbonGrad.addColorStop(1, colors.ribbonFillBottom)

    ctx.beginPath()
    ctx.moveTo(xs[0]!, datumY)
    ctx.lineTo(xs[0]!, tops[0]!)
    for (let i = 0; i < count - 1; i += 1) {
      const midX = (xs[i]! + xs[i + 1]!) * 0.5
      const midY = (tops[i]! + tops[i + 1]!) * 0.5
      ctx.quadraticCurveTo(xs[i]!, tops[i]!, midX, midY)
    }
    ctx.lineTo(xs[count - 1]!, tops[count - 1]!)
    ctx.lineTo(xs[count - 1]!, datumY)
    ctx.closePath()
    ctx.fillStyle = ribbonGrad
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(xs[0]!, tops[0]!)
    for (let i = 0; i < count - 1; i += 1) {
      const midX = (xs[i]! + xs[i + 1]!) * 0.5
      const midY = (tops[i]! + tops[i + 1]!) * 0.5
      ctx.quadraticCurveTo(xs[i]!, tops[i]!, midX, midY)
    }
    ctx.lineTo(xs[count - 1]!, tops[count - 1]!)
    ctx.strokeStyle = colors.ribbonStroke
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 3) Twelve-pitch pillars + fine vernier needles + Luo-River water reflections
  for (let i = 0; i < count; i += 1) {
    const bar = bars[i]!
    const isPitchPillar = i % pitchStep === 0
    const lineWidth = isPitchPillar ? 2 : 1.25
    const x = Math.round(xs[i]! - lineWidth * 0.5)
    const y = tops[i]!
    const h = datumY - y
    const energy = energies[i]!
    const edgeFade = fades[i]!
    const hoverBoost = hovers[i]!

    if (energy > 0.02 || hoverBoost > 0.02) {
      ctx.globalAlpha = Math.min(1, (0.58 + energy * 0.42 + hoverBoost * 0.35) * edgeFade)
      ctx.fillStyle = isPitchPillar ? pillarGradient : barGradient
      ctx.fillRect(x, y, lineWidth, h)

      // Star-needle luminous crown on active bars or 12-pitch pillars
      if (energy > 0.06 || isPitchPillar) {
        ctx.globalAlpha = Math.min(1, (0.45 + energy * 0.55) * edgeFade)
        ctx.fillStyle = colors.starTip
        ctx.fillRect(x, Math.max(0, y - 0.5), lineWidth, isPitchPillar ? 2 : 1.5)
      }

      // Mirrored Luo-River reflection below datum
      const reflectH = Math.min(maxReflect, Math.max(1.5, h * 0.28))
      ctx.globalAlpha = Math.min(0.45, (0.18 + energy * 0.28) * edgeFade)
      ctx.fillStyle = colors.reflection
      ctx.fillRect(x, datumY + 1, lineWidth, reflectH)
    } else {
      // Engraved resting 12-pitch bronze arch
      ctx.globalAlpha = edgeFade
      ctx.fillStyle = isPitchPillar ? colors.tickMajorRest : colors.tickRest
      ctx.fillRect(x, y, lineWidth, h)

      if (isPitchPillar) {
        ctx.globalAlpha = edgeFade * 0.85
        ctx.fillStyle = colors.starTip
        ctx.fillRect(x, Math.max(0, y - 0.5), lineWidth, 1.5)
      }

      const restReflect = isPitchPillar ? Math.min(maxReflect, 3) : Math.min(maxReflect, 1.5)
      ctx.globalAlpha = edgeFade * 0.45
      ctx.fillStyle = colors.reflection
      ctx.fillRect(x, datumY + 1, lineWidth, restReflect)
    }

    if (bar.peakHold > bar.value + 0.04) {
      const peakY = datumY - Math.max(4, bar.peakHold * maxUp) - 2
      ctx.globalAlpha = Math.min(0.9, bar.peakHold * edgeFade * 0.82)
      ctx.fillStyle = colors.starTip
      ctx.fillRect(x, Math.max(0, peakY), lineWidth, 1.5)
    }
  }
  ctx.globalAlpha = 1
}
