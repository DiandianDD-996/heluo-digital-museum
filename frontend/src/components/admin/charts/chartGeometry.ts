export interface ChartPoint {
  x: number
  y: number
}

const NICE_STEP_CANDIDATES = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const

/**
 * Generates clean, human-readable axis tick values starting from 0.
 * Uses fine step multipliers so curves stay tall and legible without over-inflating headroom.
 */
export function niceTicks(maxValue: number, tickCount = 5): number[] {
  const safeCount = Math.max(2, tickCount)
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0
  if (safeMax === 0) {
    return Array.from({ length: safeCount }, (_, i) => i * 10)
  }

  const rawStep = safeMax / (safeCount - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  const niceUnit = NICE_STEP_CANDIDATES.find(candidate => candidate >= residual - 1e-9) ?? 10

  const step = niceUnit * magnitude
  const ticks: number[] = []
  for (let i = 0; i < safeCount; i++) {
    ticks.push(Math.round(step * i * 1000) / 1000)
  }
  if (ticks[ticks.length - 1]! < safeMax) {
    ticks[ticks.length - 1] = Math.round(Math.ceil(safeMax / step) * step * 1000) / 1000
  }
  return ticks
}

/**
 * Fritsch-Carlson monotone cubic spline interpolation for smooth trend curves
 * that never overshoot below baselines or create artificial loops.
 */
export function buildMonotoneSplinePath(points: ChartPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]!
    return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }
  if (points.length === 2) {
    const [a, b] = points
    return `M ${a!.x.toFixed(2)} ${a!.y.toFixed(2)} L ${b!.x.toFixed(2)} ${b!.y.toFixed(2)}`
  }

  const n = points.length
  const dx: number[] = []
  const dy: number[] = []
  const slopes: number[] = []

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!
    const p1 = points[i + 1]!
    const deltaX = p1.x - p0.x
    const deltaY = p1.y - p0.y
    dx.push(deltaX)
    dy.push(deltaY)
    slopes.push(deltaX === 0 ? 0 : deltaY / deltaX)
  }

  const tangents = new Array<number>(n).fill(0)
  tangents[0] = slopes[0]!
  tangents[n - 1] = slopes[n - 2]!

  for (let i = 1; i < n - 1; i++) {
    const sPrev = slopes[i - 1]!
    const sNext = slopes[i]!
    if (sPrev === 0 || sNext === 0 || sPrev * sNext <= 0) {
      tangents[i] = 0
    } else {
      const w1 = 2 * dx[i]! + dx[i - 1]!
      const w2 = dx[i]! + 2 * dx[i - 1]!
      tangents[i] = (w1 + w2) / (w1 / sPrev + w2 / sNext)
    }
  }

  let d = `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!
    const p1 = points[i + 1]!
    const stepX = dx[i]! / 3
    const cp1x = p0.x + stepX
    const cp1y = p0.y + stepX * tangents[i]!
    const cp2x = p1.x - stepX
    const cp2y = p1.y - stepX * tangents[i + 1]!
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
  }
  return d
}

/**
 * Builds a closed SVG path for gradient area fills beneath a monotone spline.
 */
export function buildAreaPath(points: ChartPoint[], baselineY: number): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]!
    return `M ${p.x.toFixed(2)} ${baselineY.toFixed(2)} L ${p.x.toFixed(2)} ${p.y.toFixed(2)} Z`
  }
  const spline = buildMonotoneSplinePath(points)
  const first = points[0]!
  const last = points[points.length - 1]!
  return `${spline} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`
}

/**
 * Selects evenly spaced tick indices along a series without duplicating endpoints.
 */
export function pickTickIndices(length: number, maxTicks = 6): number[] {
  if (length <= 0) return []
  if (length <= maxTicks) return Array.from({ length }, (_, i) => i)
  const indices: number[] = []
  const step = (length - 1) / (maxTicks - 1)
  for (let i = 0; i < maxTicks; i++) {
    const idx = Math.round(i * step)
    if (!indices.includes(idx)) indices.push(idx)
  }
  if (indices[indices.length - 1] !== length - 1) {
    indices[indices.length - 1] = length - 1
  }
  return indices
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 10_000) {
    return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}w`
  }
  return Math.round(value).toLocaleString('zh-CN')
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(num)) return '¥ 0.00'
  return `¥ ${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface DeltaBadge {
  text: string
  direction: 'up' | 'down' | 'flat'
}

export function calcDeltaPercent(current: number, previous: number): DeltaBadge {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { text: '0.0%', direction: 'flat' }
  }
  if (previous <= 0) {
    if (current <= 0) return { text: '持平', direction: 'flat' }
    return { text: '新增', direction: 'up' }
  }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.05) return { text: '0.0%', direction: 'flat' }
  const sign = pct > 0 ? '+' : ''
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    direction: pct > 0 ? 'up' : 'down',
  }
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate
  return isoDate.slice(5)
}

export function formatWeekdayZh(isoDate: string): string {
  if (!isoDate) return ''
  const parsed = new Date(`${isoDate}T12:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return labels[parsed.getDay()] ?? ''
}

export function isWeekendDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  const parsed = new Date(`${isoDate}T12:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return false
  const day = parsed.getDay()
  return day === 0 || day === 6
}

/**
 * Builds a closed SVG annular sector ("petal") path in polar coordinates,
 * starting at 12 o'clock (-90deg) and sweeping clockwise.
 */
export function buildRosePetalPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  if (
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    !Number.isFinite(innerR) ||
    !Number.isFinite(outerR) ||
    !Number.isFinite(startDeg) ||
    !Number.isFinite(endDeg) ||
    outerR <= 0 ||
    outerR <= innerR ||
    endDeg <= startDeg
  ) {
    return ''
  }

  const safeInner = Math.max(0, innerR)
  const sweepDeg = Math.min(359.9, endDeg - startDeg)
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180
  const sRad = toRad(startDeg)
  const eRad = toRad(startDeg + sweepDeg)
  const largeArc = sweepDeg > 180 ? 1 : 0

  const ox1 = cx + outerR * Math.cos(sRad)
  const oy1 = cy + outerR * Math.sin(sRad)
  const ox2 = cx + outerR * Math.cos(eRad)
  const oy2 = cy + outerR * Math.sin(eRad)

  if (safeInner <= 0.5) {
    return [
      `M ${cx.toFixed(2)} ${cy.toFixed(2)}`,
      `L ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
      `A ${outerR.toFixed(2)} ${outerR.toFixed(2)} 0 ${largeArc} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
      'Z',
    ].join(' ')
  }

  const ix2 = cx + safeInner * Math.cos(eRad)
  const iy2 = cy + safeInner * Math.sin(eRad)
  const ix1 = cx + safeInner * Math.cos(sRad)
  const iy1 = cy + safeInner * Math.sin(sRad)

  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${outerR.toFixed(2)} ${outerR.toFixed(2)} 0 ${largeArc} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    `A ${safeInner.toFixed(2)} ${safeInner.toFixed(2)} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    'Z',
  ].join(' ')
}

/**
 * Computes a trailing moving average sequence of the same length as `values`.
 */
export function buildMovingAverage(values: number[], windowSize = 3): number[] {
  if (!values.length) return []
  const w = Math.max(1, Math.floor(windowSize))
  return values.map((_, idx) => {
    const start = Math.max(0, idx - w + 1)
    let sum = 0
    let count = 0
    for (let j = start; j <= idx; j++) {
      const val = values[j]
      sum += typeof val === 'number' && Number.isFinite(val) ? val : 0
      count++
    }
    return count > 0 ? sum / count : 0
  })
}
