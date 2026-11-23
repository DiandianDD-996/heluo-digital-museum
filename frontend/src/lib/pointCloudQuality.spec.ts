import { describe, expect, it } from 'vitest'
import { POINT_COUNTS, createPointCloudPerformanceMonitor, downgradePointCloudQuality, selectPointCloudPalette, selectPointCloudPointSize, selectPointCloudQuality } from './pointCloudQuality'

describe('point cloud quality', () => {
  it('selects the requested desktop and mobile quality tiers', () => {
    expect(selectPointCloudQuality({ width: 1440, coarsePointer: false, cores: 8, memoryGiB: 16 })).toBe('high')
    expect(selectPointCloudQuality({ width: 1024, coarsePointer: false, cores: 4 })).toBe('medium')
    expect(selectPointCloudQuality({ width: 390, coarsePointer: true, cores: 8 })).toBe('mobile')
  })

  it('uses the planned point budgets and one-way fallback path', () => {
    expect(POINT_COUNTS.high).toBe(120_000)
    expect(POINT_COUNTS.medium).toBe(60_000)
    expect(POINT_COUNTS.mobile).toBe(18_000)
    expect(downgradePointCloudQuality('high')).toBe('medium')
    expect(downgradePointCloudQuality('medium')).toBe('fallback')
  })

  it('ignores loading, transitions and short slow bursts', () => {
    const monitor = createPointCloudPerformanceMonitor()
    for (let time = 0; time < 10000; time += 100) expect(monitor.record(time, false, 'high')).toBeUndefined()
    for (let time = 10000; time < 13000; time += 100) expect(monitor.record(time, true, 'high')?.quality).toBeUndefined()
    monitor.reset()
    for (let time = 14000; time < 22000; time += 16) expect(monitor.record(time, true, 'high')?.quality).toBeUndefined()
  })

  it('requires sustained slow frames and can downgrade again after cooldown', () => {
    const monitor = createPointCloudPerformanceMonitor()
    let quality: 'high' | 'medium' | 'mobile' | 'fallback' = 'high'
    const changes: Array<{ time: number; quality: string }> = []
    for (let time = 0; time <= 22000; time += 100) {
      const result = monitor.record(time, true, quality)
      if (result?.quality) { quality = result.quality; changes.push({ time, quality }) }
    }
    expect(changes.map((change) => change.quality)).toEqual(['medium', 'fallback'])
    expect(changes[0]!.time).toBeGreaterThanOrEqual(6000)
    expect(changes[1]!.time - changes[0]!.time).toBeGreaterThanOrEqual(10000)
  })

  it('keeps light-theme points rich ink-jade and warm gold for the sunlit exhibition hall', () => {
    const desktop = selectPointCloudPalette('high', 'light')
    expect(selectPointCloudPalette('medium', 'light')).toEqual(desktop)
    const mobile = selectPointCloudPalette('mobile', 'light')
    expect(mobile.opacity).toBeLessThan(desktop.opacity)
    expect(desktop.copper[0]).toBeGreaterThan(desktop.jade[0])
    expect(selectPointCloudPalette('fallback', 'light')).toEqual(mobile)
  })

  it('switches both desktop and mobile point clouds to luminous emerald-and-gold in dark mode', () => {
    const desktopLight = selectPointCloudPalette('high', 'light')
    const desktopDark = selectPointCloudPalette('high', 'dark')
    const mobileLight = selectPointCloudPalette('mobile', 'light')
    const mobileDark = selectPointCloudPalette('mobile', 'dark')

    expect(desktopDark.jade[1]).toBeGreaterThan(0.6)
    expect(desktopDark.copper[0]).toBeGreaterThan(0.9)
    expect(desktopDark.jade[1]).toBeGreaterThan(desktopLight.jade[1])
    expect(mobileDark.jade[1]).toBeGreaterThan(mobileLight.jade[1])
    expect(selectPointCloudPalette('fallback', 'dark')).toEqual(mobileDark)
    expect(selectPointCloudPointSize('high', 'dark')).toBeGreaterThan(selectPointCloudPointSize('high', 'light'))
    expect(selectPointCloudPointSize('mobile', 'dark')).toBeGreaterThan(selectPointCloudPointSize('mobile', 'light'))
  })
})
