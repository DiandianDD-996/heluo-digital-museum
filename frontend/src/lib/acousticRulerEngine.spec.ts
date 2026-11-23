import { describe, expect, it, vi } from 'vitest'
import {
  buildLogBandTable,
  createRulerBars,
  drawAcousticRuler,
  isRulerSettled,
  normalizeChamberSpectrum,
  sampleBandEnergies,
  stepRulerBars,
  triggerRulerRipple,
  type RulerRipple,
} from './acousticRulerEngine'

describe('acousticRulerEngine', () => {
  it('builds strictly non-empty, monotonically increasing logarithmic bands in 60–4500 Hz', () => {
    const desktopBands = buildLogBandTable({ barCount: 48, sampleRate: 44100, fftSize: 2048 })
    expect(desktopBands).toHaveLength(48)
    for (let i = 0; i < desktopBands.length; i += 1) {
      const b = desktopBands[i]!
      expect(b.startBin).toBeGreaterThanOrEqual(1)
      expect(b.endBin).toBeGreaterThanOrEqual(b.startBin)
      expect(b.endHz).toBeGreaterThan(b.startHz)
      expect(b.windowWeight).toBeGreaterThan(0.25)
      if (i > 0) {
        expect(b.startHz).toBeGreaterThan(desktopBands[i - 1]!.startHz)
        expect(b.startBin).toBeGreaterThanOrEqual(desktopBands[i - 1]!.startBin)
      }
    }

    const mobileBands = buildLogBandTable({ barCount: 24 })
    expect(mobileBands).toHaveLength(24)
  })

  it('handles silent/zero spectrum and low-level R3 chamber input cleanly without NaN', () => {
    const bands = buildLogBandTable({ barCount: 24 })
    const zeroSpectrum = new Uint8Array(1024)
    const zeroEnergies = sampleBandEnergies(zeroSpectrum, bands)
    expect(Array.from(zeroEnergies).every(v => v === 0)).toBe(true)

    const normZero = normalizeChamberSpectrum(zeroEnergies, 0.18, 0.016, bands)
    expect(normZero.rollingPeak).toBeGreaterThanOrEqual(0.18)
    expect(Array.from(normZero.values).every(v => v === 0)).toBe(true)

    // Simulated gentle chamber music (~25% bin magnitude)
    const chamber = new Uint8Array(1024)
    for (let i = 3; i < 180; i += 1) {
      chamber[i] = Math.round(48 + 24 * Math.sin(i * 0.25))
    }
    const chamberEnergies = sampleBandEnergies(chamber, bands)
    const normChamber = normalizeChamberSpectrum(chamberEnergies, 0.18, 0.016, bands)
    expect(normChamber.values.some(v => v > 0.2)).toBe(true)
    expect(Array.from(normChamber.values).every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true)
  })

  it('responds swiftly on attack, settles smoothly to idle within 1.8s, and never diverges on large dt', () => {
    const bars = createRulerBars(24)
    const ripples: RulerRipple[] = []
    const targets = new Float32Array(24).fill(0.85)

    // Attack frames
    for (let i = 0; i < 6; i += 1) {
      stepRulerBars(bars, targets, ripples, 16.67)
    }
    expect(bars[12]!.value).toBeGreaterThan(0.55)
    expect(isRulerSettled(bars, ripples)).toBe(false)

    // Drop target to 0 (mute) and run <= 1.8s (108 frames)
    for (let i = 0; i < 108; i += 1) {
      stepRulerBars(bars, null, ripples, 16.67)
    }
    expect(isRulerSettled(bars, ripples)).toBe(true)
    expect(bars.every(b => b.value === 0 && b.velocity === 0)).toBe(true)

    // Large dt spike must stay clamped and finite
    stepRulerBars(bars, targets, ripples, 5000)
    expect(bars.every(b => Number.isFinite(b.value) && b.value >= 0 && b.value <= 1)).toBe(true)
  })

  it('propagates and expires 3D focus ripples within 700ms', () => {
    const bars = createRulerBars(24)
    const ripples: RulerRipple[] = []
    triggerRulerRipple(ripples, 0.34, 0.9)
    expect(ripples).toHaveLength(1)

    stepRulerBars(bars, null, ripples, 120)
    expect(bars.some(b => b.pulse > 0.05)).toBe(true)

    for (let i = 0; i < 45; i += 1) {
      stepRulerBars(bars, null, ripples, 16.67)
    }
    expect(ripples).toHaveLength(0)
    expect(isRulerSettled(bars, ripples)).toBe(true)
  })

  it('renders all 4 museum palettes with zero Canvas2D shadowBlur calls', () => {
    const bars = createRulerBars(12)
    bars[5]!.value = 0.65
    bars[5]!.peakHold = 0.78

    const fillRect = vi.fn()
    const clearRect = vi.fn()
    const ctx = {
      clearRect,
      fillRect,
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      globalAlpha: 1,
      shadowBlur: 0,
    } as unknown as CanvasRenderingContext2D

    for (const palette of ['hero-light', 'hero-dark', 'darkroom-bronze', 'darkroom-pointcloud'] as const) {
      fillRect.mockClear()
      drawAcousticRuler(ctx, { width: 480, height: 26, palette, active: true, bars, hoverRatio: 0.5 })
      expect(clearRect).toHaveBeenCalled()
      expect(fillRect.mock.calls.length).toBeGreaterThan(12)
      expect(ctx.shadowBlur).toBe(0)
    }
  })
})
