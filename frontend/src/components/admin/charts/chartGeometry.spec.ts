import { describe, expect, it } from 'vitest'
import {
  buildAreaPath,
  buildMonotoneSplinePath,
  buildMovingAverage,
  buildRosePetalPath,
  calcDeltaPercent,
  formatCompactNumber,
  formatCurrency,
  isWeekendDate,
  niceTicks,
  pickTickIndices,
} from './chartGeometry'

describe('chartGeometry utilities', () => {
  it('generates clean non-NaN ticks for zero and positive ranges without inflating headroom', () => {
    expect(niceTicks(0, 5)).toEqual([0, 10, 20, 30, 40])
    const ticks = niceTicks(420, 5)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(420)
    expect(ticks.every(Number.isFinite)).toBe(true)

    const peakTicks = niceTicks(620 * 1.12, 5)
    expect(peakTicks).toEqual([0, 200, 400, 600, 800])
  })

  it('builds safe monotone spline and area paths for empty, single and multi-point series', () => {
    expect(buildMonotoneSplinePath([])).toBe('')
    expect(buildAreaPath([], 200)).toBe('')
    expect(buildMonotoneSplinePath([{ x: 10, y: 20 }])).toBe('M 10.00 20.00')
    expect(buildAreaPath([{ x: 10, y: 20 }], 200)).toBe('M 10.00 200.00 L 10.00 20.00 Z')

    const multi = buildMonotoneSplinePath([
      { x: 0, y: 100 },
      { x: 50, y: 20 },
      { x: 100, y: 80 },
      { x: 150, y: 10 },
    ])
    expect(multi).toContain('M 0.00 100.00 C ')
    expect(multi).not.toContain('NaN')

    const area = buildAreaPath([
      { x: 0, y: 100 },
      { x: 50, y: 20 },
      { x: 100, y: 80 },
    ], 150)
    expect(area.endsWith('L 100.00 150.00 L 0.00 150.00 Z')).toBe(true)
  })

  it('computes deltas, compact numbers, currencies, tick indices and weekend flags accurately', () => {
    expect(calcDeltaPercent(120, 100)).toEqual({ text: '+20.0%', direction: 'up' })
    expect(calcDeltaPercent(80, 100)).toEqual({ text: '-20.0%', direction: 'down' })
    expect(calcDeltaPercent(0, 0)).toEqual({ text: '持平', direction: 'flat' })
    expect(calcDeltaPercent(15, 0)).toEqual({ text: '新增', direction: 'up' })

    expect(formatCompactNumber(12500)).toBe('1.3w')
    expect(formatCurrency('129.5')).toBe('¥ 129.50')
    expect(pickTickIndices(30, 6)).toEqual([0, 6, 12, 17, 23, 29])
    expect(pickTickIndices(5, 7)).toEqual([0, 1, 2, 3, 4])

    // 2026-11-28 is Saturday, 2026-11-29 is Sunday, 2026-11-30 is Monday
    expect(isWeekendDate('2026-11-28')).toBe(true)
    expect(isWeekendDate('2026-11-29')).toBe(true)
    expect(isWeekendDate('2026-11-30')).toBe(false)
    expect(isWeekendDate('invalid')).toBe(false)
  })

  it('builds polar rose petals and trailing moving averages safely', () => {
    expect(buildRosePetalPath(120, 120, 40, 40, 0, 90)).toBe('')
    expect(buildRosePetalPath(120, 120, 30, 80, 90, 90)).toBe('')
    const petal = buildRosePetalPath(120, 120, 34, 96, 4, 86)
    expect(petal).toMatch(/^M \d+\.\d{2} \d+\.\d{2} A 96\.00 96\.00 0 0 1 .* A 34\.00 34\.00 0 0 0 .* Z$/)
    expect(petal).not.toContain('NaN')

    expect(buildMovingAverage([])).toEqual([])
    expect(buildMovingAverage([10, 20, 30, 60], 3)).toEqual([10, 15, 20, 36.666666666666664])
  })
})
