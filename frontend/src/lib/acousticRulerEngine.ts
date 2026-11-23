/**
 * AcousticRuler Engine —「十二律吕 · 青铜游标刻度」
 *
 * Pure TypeScript acoustic analysis, Hooke spring-damper physics,
 * and zero-shadowBlur Canvas2D renderer for museum-grade chamber
 * music visualization.
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
  starTip: string
}

const PALETTES: Record<AcousticRulerPaletteKey, PaletteStops> = {
  'hero-light': {
    lineBase: 'rgba(116, 82, 46, 0.16)',
    tickRest: 'rgba(116, 82, 46, 0.26)',
    tickMajorRest: 'rgba(116, 82, 46, 0.44)',
    barBottom: 'rgba(128, 86, 46, 0.36)',
    barTop: 'rgba(168, 122, 62, 0.90)',
    starTip: 'rgba(255, 248, 228, 0.92)',
  },
  'hero-dark': {
    lineBase: 'rgba(222, 198, 152, 0.16)',
    tickRest: 'rgba(222, 198, 152, 0.24)',
    tickMajorRest: 'rgba(222, 198, 152, 0.42)',
    barBottom: 'rgba(186, 152, 98, 0.36)',
    barTop: 'rgba(232, 210, 166, 0.92)',
    starTip: 'rgba(255, 250, 238, 0.95)',
  },
  'darkroom-bronze': {
    lineBase: 'rgba(218, 190, 140, 0.18)',
    tickRest: 'rgba(218, 190, 140, 0.26)',
    tickMajorRest: 'rgba(226, 200, 150, 0.46)',
    barBottom: 'rgba(176, 138, 82, 0.34)',
    barTop: 'rgba(232, 206, 156, 0.92)',
    starTip: 'rgba(255, 249, 234, 0.95)',
  },
  'darkroom-pointcloud': {
    lineBase: 'rgba(196, 216, 226, 0.18)',
    tickRest: 'rgba(196, 216, 226, 0.26)',
    tickMajorRest: 'rgba(214, 232, 240, 0.48)',
    barBottom: 'rgba(148, 178, 192, 0.34)',
    barTop: 'rgba(214, 232, 240, 0.92)',
    starTip: 'rgba(244, 252, 255, 0.96)',
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
    const bassCompensation = 0.72 + 0.28 * (i / Math.max(barCount - 1, 1))
    const windowWeight = 0.28 + 0.72 * Math.pow(Math.sin(Math.PI * u), 0.72)

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

  const prevPeak = Number.isFinite(rollingPeak) ? Math.max(0.18, rollingPeak) : 0.18
  const tau = framePeak > prevPeak ? 0.25 : 4.5
  const alpha = 1 - Math.exp(-safeDt / tau)
  const nextPeak = Math.max(0.18, prevPeak + (framePeak - prevPeak) * alpha)

  for (let i = 0; i < len; i += 1) {
    const norm = clamp01((energies[i] ?? 0) / nextPeak)
    values[i] = Math.pow(norm, 0.68) * bands[i]!.windowWeight
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
  const baselineY = height - 1
  const maxAmplitude = Math.max(4, height - 4)
  const count = bars.length
  const step = width / count
  const lineWidth = 1.5

  // 1px precision vernier baseline
  ctx.fillStyle = colors.lineBase
  ctx.fillRect(0, baselineY, width, 1)

  const barGradient = ctx.createLinearGradient(0, baselineY, 0, Math.max(1, baselineY - maxAmplitude))
  barGradient.addColorStop(0, colors.barBottom)
  barGradient.addColorStop(1, colors.barTop)

  for (let i = 0; i < count; i += 1) {
    const bar = bars[i]!
    const u = (i + 0.5) / count
    const x = Math.round(u * width - lineWidth * 0.5)
    const edgeFade = 0.35 + 0.65 * Math.sin(Math.PI * u)
    const isMajor = i % 4 === 0

    let hoverBoost = 0
    if (hoverRatio !== null && hoverRatio !== undefined) {
      const dist = Math.abs(u - hoverRatio)
      if (dist < 0.12) {
        hoverBoost = (1 - dist / 0.12) * 0.22
      }
    }

    const energy = Math.max(bar.value, bar.pulse * 0.72)
    const restHeight = isMajor ? 4 : 2.2
    const activeHeight = energy * maxAmplitude + hoverBoost * 6
    const h = Math.max(restHeight, activeHeight)
    const y = baselineY - h

    if (energy > 0.02 || hoverBoost > 0.02) {
      ctx.globalAlpha = Math.min(1, (0.48 + energy * 0.52 + hoverBoost * 0.35) * edgeFade)
      ctx.fillStyle = barGradient
      ctx.fillRect(x, y, lineWidth, h)

      if (energy > 0.08) {
        ctx.globalAlpha = Math.min(1, energy * edgeFade)
        ctx.fillStyle = colors.starTip
        ctx.fillRect(x, Math.max(0, y - 0.5), lineWidth, 1.5)
      }
    } else {
      ctx.globalAlpha = edgeFade
      ctx.fillStyle = isMajor ? colors.tickMajorRest : colors.tickRest
      ctx.fillRect(x, baselineY - restHeight, lineWidth, restHeight)
    }

    if (bar.peakHold > bar.value + 0.04) {
      const peakY = baselineY - Math.max(restHeight, bar.peakHold * maxAmplitude) - 2
      ctx.globalAlpha = Math.min(0.85, bar.peakHold * edgeFade * 0.75)
      ctx.fillStyle = colors.starTip
      ctx.fillRect(x, Math.max(0, peakY), lineWidth, 1)
    }
  }
  ctx.globalAlpha = 1
  void step
}
