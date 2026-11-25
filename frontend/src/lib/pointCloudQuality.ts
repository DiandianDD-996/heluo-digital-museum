export type PointCloudQuality = 'high' | 'medium' | 'mobile' | 'fallback'
export type PointCloudTheme = 'light' | 'dark'

export interface PointCloudPalette {
  jade: readonly [number, number, number]
  copper: readonly [number, number, number]
  copperBase: number
  copperRange: number
  opacity: number
}

export const POINT_COUNTS: Record<Exclude<PointCloudQuality, 'fallback'>, number> = {
  high: 120_000,
  medium: 60_000,
  mobile: 18_000,
}

export interface PointCloudCapabilities {
  width: number
  coarsePointer: boolean
  cores?: number
  memoryGiB?: number
}

// Heluo Editorial 3.0 Cyber-Archaeology Metallurgy Palettes:
// Malachite bronze patina × 22K inlaid gold inscription × silver-white highlight cores.
const LIGHT_DESKTOP_POINT_CLOUD_PALETTE: PointCloudPalette = {
  jade: [.28, .56, .48],
  copper: [.96, .80, .47],
  copperBase: .48,
  copperRange: .34,
  opacity: 1,
}

const DARK_DESKTOP_POINT_CLOUD_PALETTE: PointCloudPalette = {
  jade: [.38, .72, .62],
  copper: [.98, .83, .50],
  copperBase: .44,
  copperRange: .36,
  opacity: .98,
}

const MOBILE_JADE_POINT_CLOUD_PALETTE: PointCloudPalette = {
  jade: [.26, .52, .44],
  copper: [.94, .78, .46],
  copperBase: .48,
  copperRange: .32,
  opacity: .94,
}

const MOBILE_DARK_POINT_CLOUD_PALETTE: PointCloudPalette = {
  jade: [.36, .68, .58],
  copper: [.96, .81, .49],
  copperBase: .42,
  copperRange: .32,
  opacity: .96,
}

export function selectPointCloudQuality(capabilities: PointCloudCapabilities): PointCloudQuality {
  if (capabilities.coarsePointer || capabilities.width < 768) return 'mobile'

  const hasStrongCpu = (capabilities.cores ?? 0) >= 8
  const hasEnoughMemory = capabilities.memoryGiB === undefined || capabilities.memoryGiB >= 8
  return capabilities.width >= 1280 && hasStrongCpu && hasEnoughMemory ? 'high' : 'medium'
}

export function downgradePointCloudQuality(quality: PointCloudQuality): PointCloudQuality {
  if (quality === 'high') return 'medium'
  if (quality === 'medium' || quality === 'mobile') return 'fallback'
  return 'fallback'
}

export function createPointCloudPerformanceMonitor() {
  let stableSince: number | undefined
  let windowStart: number | undefined
  let frames = 0
  let slowWindows = 0
  let cooldownUntil = 0
  const reset = () => {
    stableSince = undefined
    windowStart = undefined
    frames = 0
    slowWindows = 0
  }
  return {
    reset,
    // Call only after an actual renderer.render submission, never from bare RAF ticks.
    record(time: number, eligible: boolean, quality: PointCloudQuality): { fps: number; quality?: PointCloudQuality } | undefined {
      if (!eligible || time < cooldownUntil) { reset(); return }
      stableSince ??= time
      if (time - stableSince < 1000) return
      if (windowStart === undefined) { windowStart = time; return }
      frames += 1
      const duration = time - windowStart
      if (duration < 2500) return
      const fps = frames * 1000 / duration
      frames = 0
      windowStart = time
      slowWindows = fps < 35 ? slowWindows + 1 : 0
      if (slowWindows < 2 || quality === 'fallback') return { fps }
      cooldownUntil = time + 6000
      reset()
      return { fps, quality: downgradePointCloudQuality(quality) }
    },
  }
}

export function selectPointCloudPalette(quality: PointCloudQuality, theme: PointCloudTheme = 'light'): PointCloudPalette {
  if (quality !== 'mobile' && quality !== 'fallback') {
    return theme === 'dark' ? DARK_DESKTOP_POINT_CLOUD_PALETTE : LIGHT_DESKTOP_POINT_CLOUD_PALETTE
  }
  return theme === 'dark' ? MOBILE_DARK_POINT_CLOUD_PALETTE : MOBILE_JADE_POINT_CLOUD_PALETTE
}

export function selectPointCloudPointSize(quality: PointCloudQuality, theme: PointCloudTheme = 'light'): number {
  if (quality !== 'mobile' && quality !== 'fallback') return theme === 'dark' ? 1.34 : 1.26
  return theme === 'dark' ? 1.14 : 1.02
}

export function qualityLabel(quality: PointCloudQuality): string {
  return { high: '高画质', medium: '标准画质', mobile: '移动优化', fallback: '实体降级' }[quality]
}
