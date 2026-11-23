#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

const args = process.argv.slice(2)
let baseURL = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:4189'
let outDir = resolve(process.cwd(), '../artifacts/acoustic-upgrade-2026-11-23')
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--url' && args[i + 1]) baseURL = args[i + 1]
  if (args[i] === '--out' && args[i + 1]) outDir = resolve(args[i + 1])
}
baseURL = baseURL.replace(/\/+$/, '')
await mkdir(outDir, { recursive: true })

const report = {
  checkedAt: new Date().toISOString(),
  baseURL,
  outDir,
  passed: false,
  metrics: {},
  checks: [],
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
}

function record(name, detail = {}) {
  report.checks.push({ name, ...detail })
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(overflow <= 1, `[${label}] Horizontal overflow detected: ${overflow}px`)
}

async function assertNoRectOverlap(page, selectorA, selectorB, label) {
  const result = await page.evaluate(([selA, selB]) => {
    const a = document.querySelector(selA)
    const b = document.querySelector(selB)
    if (!a || !b) return { present: false }
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    const styleA = getComputedStyle(a)
    const styleB = getComputedStyle(b)
    if (styleA.display === 'none' || styleB.display === 'none' || ra.height === 0 || rb.height === 0) {
      return { present: false }
    }
    const overlapX = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left))
    const overlapY = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top))
    return {
      present: true,
      overlaps: overlapX > 1 && overlapY > 1,
      overlapX,
      overlapY,
      ra: { top: ra.top, bottom: ra.bottom, left: ra.left, right: ra.right },
      rb: { top: rb.top, bottom: rb.bottom, left: rb.left, right: rb.right },
    }
  }, [selectorA, selectorB])
  if (result.present) {
    assert.equal(result.overlaps, false, `[${label}] Overlap between ${selectorA} and ${selectorB}: ${JSON.stringify(result)}`)
  }
}

async function snap(page, filename) {
  const filePath = resolve(outDir, filename)
  await page.screenshot({ path: filePath })
  report.screenshots.push(filePath)
}

function installCanvasProbe() {
  const stats = {
    rulerDraws: 0,
    rulerDrawMs: [],
  }
  const originalClearRect = CanvasRenderingContext2D.prototype.clearRect
  const originalFillRect = CanvasRenderingContext2D.prototype.fillRect
  let inRulerDraw = false
  let drawStart = 0

  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (this.canvas?.classList?.contains('acoustic-ruler__canvas')) {
      inRulerDraw = true
      drawStart = performance.now()
    }
    return Reflect.apply(originalClearRect, this, args)
  }

  // Record completion on next microtask after ruler's synchronous draw loop finishes
  CanvasRenderingContext2D.prototype.fillRect = function (...args) {
    const res = Reflect.apply(originalFillRect, this, args)
    if (inRulerDraw && this.canvas?.classList?.contains('acoustic-ruler__canvas')) {
      inRulerDraw = false
      const start = drawStart
      queueMicrotask(() => {
        const dt = performance.now() - start
        stats.rulerDraws += 1
        stats.rulerDrawMs.push(dt)
        if (stats.rulerDrawMs.length > 240) stats.rulerDrawMs.shift()
      })
    }
    return res
  }

  window.__acousticProbe = {
    reset() {
      stats.rulerDraws = 0
      stats.rulerDrawMs.length = 0
    },
    read() {
      const list = stats.rulerDrawMs
      const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0
      const max = list.length ? Math.max(...list) : 0
      return { draws: stats.rulerDraws, sampleCount: list.length, avgMs: Number(avg.toFixed(4)), maxMs: Number(max.toFixed(4)) }
    },
  }
}

async function openContext(browser, { width, height, theme, locale = 'zh-CN' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    locale,
  })
  await context.addInitScript(installCanvasProbe)
  await context.addInitScript(({ theme, locale }) => {
    window.localStorage.setItem('heluo.theme', theme)
    window.localStorage.setItem('heluo-theme', theme)
    window.localStorage.setItem('heluo.locale', locale)
  }, { theme, locale })

  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push({ url: page.url(), text: msg.text() })
  })
  page.on('pageerror', (err) => {
    report.pageErrors.push({ url: page.url(), message: String(err) })
  })
  return { context, page }
}

const browser = await chromium.launch({
  headless: true,
  ...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }
    : {}),
})

try {
  // ── 1. Desktop 1440x900 Light + Dark ─────────────────────────────────────
  {
    const { context, page } = await openContext(browser, { width: 1440, height: 900, theme: 'light' })
    try {
      await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' })
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
      await expect(page.locator('.acoustic-ruler--hero')).toBeVisible()
      await assertNoOverflow(page, '1440-light-home')
      await assertNoRectOverlap(page, '.home-cover__foot', '.home-cover__ruler', '1440-light-home-foot-ruler')
      await assertNoRectOverlap(page, '.home-foot-link', '[data-testid="acoustic-ruler-trigger"]', '1440-light-footlink-trigger')
      await assertNoRectOverlap(page, '[data-testid="acoustic-ruler-trigger"]', '[data-testid="luosheng-fab"]', '1440-light-trigger-luosheng')

      // Idle zero-rAF verification
      await page.waitForTimeout(300)
      await page.evaluate(() => window.__acousticProbe.reset())
      await page.waitForTimeout(500)
      const idleMetrics = await page.evaluate(() => ({
        state: document.querySelector('.acoustic-ruler--hero')?.getAttribute('data-ruler-state'),
        rafActive: document.querySelector('.acoustic-ruler--hero')?.getAttribute('data-raf-active'),
        probe: window.__acousticProbe.read(),
      }))
      assert.equal(idleMetrics.state, 'idle')
      assert.equal(idleMetrics.rafActive, 'false')
      assert.equal(idleMetrics.probe.draws, 0, `Expected 0 idle rAF draws, got ${idleMetrics.probe.draws}`)
      record('home-1440-light-idle-zero-raf', idleMetrics)
      await snap(page, 'home-1440-light-idle.png')

      // Enable audio via AcousticRuler trigger & sample 60+ active frames
      await page.locator('[data-testid="acoustic-ruler-trigger"]').click()
      await expect(page.locator('.acoustic-ruler--hero')).toHaveAttribute('data-ruler-state', 'active', { timeout: 8000 })
      await expect(page.locator('.acoustic-ruler--hero')).toHaveAttribute('data-raf-active', 'true')
      await page.evaluate(() => window.__acousticProbe.reset())
      await page.waitForTimeout(1200)
      const activeMetrics = await page.evaluate(() => window.__acousticProbe.read())
      assert.ok(activeMetrics.draws >= 40, `Expected >= 40 active frames in 1.2s, got ${activeMetrics.draws}`)
      assert.ok(activeMetrics.avgMs <= 2.5, `Expected AcousticRuler draw mean <= 2.5ms, got ${activeMetrics.avgMs}ms`)
      report.metrics.desktopHeroDrawAvgMs = activeMetrics.avgMs
      report.metrics.desktopHeroDrawMaxMs = activeMetrics.maxMs
      record('home-1440-light-active-perf', activeMetrics)
      await snap(page, 'home-1440-light-active.png')

      // Scroll offscreen -> rAF stops
      await page.evaluate(() => window.scrollTo(0, 1200))
      await page.waitForTimeout(250)
      await expect(page.locator('.acoustic-ruler--hero')).toHaveAttribute('data-raf-active', 'false')
      await page.evaluate(() => window.__acousticProbe.reset())
      await page.waitForTimeout(450)
      const offscreenMetrics = await page.evaluate(() => window.__acousticProbe.read())
      assert.equal(offscreenMetrics.draws, 0, 'Expected 0 rAF draws when scrolled offscreen')
      record('home-1440-offscreen-zero-raf', offscreenMetrics)
      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(page.locator('.acoustic-ruler--hero')).toHaveAttribute('data-raf-active', 'true')

      // AudioControl curation panel: track placard, manual track lock across navigation, CC0 notes
      await page.locator('.audio-toggle').click()
      await expect(page.locator('.audio-panel')).toBeVisible()
      await expect(page.locator('[data-testid="audio-track-placard"]')).toContainText('入馆·河洛晨光')
      await page.locator('.audio-panel__notes summary').click()
      await expect(page.locator('.audio-panel__notes')).toContainText('VSCO 2 CE')
      await page.waitForTimeout(260)
      await snap(page, 'audiocontrol-1440-light.png')

      await page.locator('.audio-panel__track-btn', { hasText: '观器·温金' }).click()
      await expect(page.locator('[data-testid="audio-track-placard"]')).toContainText('观器·温金')
      await page.keyboard.press('Escape')
      await page.locator('a[href="/shop"]').first().click()
      await page.waitForURL('**/shop')
      await page.locator('.audio-toggle').click()
      await expect(page.locator('[data-testid="audio-track-placard"]')).toContainText('观器·温金')
      await page.locator('.audio-panel__track-btn', { hasText: '随展厅自动' }).click()
      await expect(page.locator('[data-testid="audio-track-placard"]')).toContainText('入馆·河洛晨光')
      await page.keyboard.press('Escape')
      record('audiocontrol-curation-and-manual-lock', { passed: true })

      // Switch to Dark Theme on Home & inspect AcousticRuler
      await page.locator('a[href="/"]').first().click()
      await page.waitForURL(`${baseURL}/`)
      await page.locator('.theme-toggle').nth(1).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(page.locator('.acoustic-ruler--hero')).toHaveAttribute('data-palette', 'hero-dark')
      await page.waitForTimeout(400)
      await snap(page, 'home-1440-dark-active.png')
      record('home-1440-dark-active', { passed: true })
    } finally {
      await context.close()
    }
  }

  // ── 2. Desktop 1440x900 3D Darkroom (Invite + Solid + Pointcloud) ────────
  {
    const { context, page } = await openContext(browser, { width: 1440, height: 900, theme: 'dark' })
    try {
      await page.goto(`${baseURL}/exhibits/heluo-bronze-ding-3d`, { waitUntil: 'networkidle' })
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
      await assertNoOverflow(page, '1440-dark-exhibit')

      // Darkroom first-visit light invitation
      await expect(page.locator('[data-testid="darkroom-audio-invite"]')).toBeVisible()
      await expect(page.locator('[data-testid="darkroom-audio-invite"]')).toContainText('观器·温金')
      await assertNoRectOverlap(page, '.darkroom-topbar', '[data-testid="darkroom-audio-invite"]', '1440-invite-topbar')

      await page.locator('[data-testid="darkroom-invite-enable"]').click()
      await expect(page.locator('[data-testid="darkroom-audio-invite"]')).toHaveCount(0)
      await expect(page.locator('.acoustic-ruler--darkroom')).toHaveAttribute('data-palette', 'darkroom-bronze')
      await expect(page.locator('.acoustic-ruler--darkroom')).toHaveAttribute('data-ruler-state', 'active', { timeout: 8000 })

      // Wait for 3D viewer ready
      await expect(page.locator('.exhibit-viewer-wrap')).toHaveAttribute('data-viewer-state', 'ready', { timeout: 25000 })
      await assertNoRectOverlap(page, '.exhibit-dock', '.exhibit-scene__ruler', '1440-exhibit-dock-ruler')
      await page.waitForTimeout(400)
      await snap(page, 'exhibit-1440-darkroom-solid.png')

      // Switch to Point Cloud
      await page.locator('.dock-mode-switch button').last().click()
      await expect(page.locator('.exhibit-scene')).toHaveAttribute('data-display-mode', 'points', { timeout: 60000 })
      await expect(page.locator('.acoustic-ruler--darkroom')).toHaveAttribute('data-palette', 'darkroom-pointcloud')
      await page.waitForTimeout(600)
      await snap(page, 'exhibit-1440-darkroom-pointcloud.png')
      record('exhibit-1440-darkroom-solid-and-pointcloud', { passed: true })
    } finally {
      await context.close()
    }
  }

  // ── 3. Mobile 390x844 (Dark Home + AudioControl + Light 3D Exhibit) ──────
  {
    const { context, page } = await openContext(browser, { width: 390, height: 844, theme: 'dark' })
    try {
      await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' })
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
      await assertNoOverflow(page, '390-dark-home')
      await assertNoRectOverlap(page, '.home-cover__foot', '.home-cover__ruler', '390-home-foot-ruler')
      await snap(page, 'home-390-dark.png')

      // Open AudioControl panel on 390px mobile
      await page.locator('.audio-toggle').click()
      await expect(page.locator('.audio-panel')).toBeVisible()
      await page.waitForTimeout(260)
      const panelBounds = await page.locator('.audio-panel').evaluate((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right, width: window.innerWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
      })
      assert.ok(panelBounds.left >= 15 && panelBounds.right <= panelBounds.width - 15, JSON.stringify(panelBounds))
      assert.ok(panelBounds.overflow <= 1)
      await snap(page, 'audiocontrol-390-dark.png')
      await page.keyboard.press('Escape')

      // Switch to light theme & visit 3D exhibit on 390x844
      await page.evaluate(() => {
        window.localStorage.setItem('heluo.theme', 'light')
        window.localStorage.setItem('heluo-theme', 'light')
        document.documentElement.dataset.theme = 'light'
      })
      await page.goto(`${baseURL}/exhibits/heluo-bronze-ding-3d`, { waitUntil: 'networkidle' })
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
      await assertNoOverflow(page, '390-light-exhibit')
      await assertNoRectOverlap(page, '.exhibit-dock', '.exhibit-scene__ruler', '390-exhibit-dock-ruler')
      await assertNoRectOverlap(page, '.exhibit-scene__ruler', '.mobile-tab-bar', '390-exhibit-ruler-tabbar')
      await snap(page, 'exhibit-390-light.png')
      record('mobile-390-dark-and-light', { panelBounds })
    } finally {
      await context.close()
    }
  }

  // ── 4. Mobile 390x844 Darkroom Invite Dismiss Persistence ────────────────
  {
    const { context, page } = await openContext(browser, { width: 390, height: 844, theme: 'light' })
    try {
      await page.goto(`${baseURL}/exhibits/heluo-bronze-ding-3d`, { waitUntil: 'networkidle' })
      await expect(page.locator('[data-testid="darkroom-audio-invite"]')).toBeVisible()
      await assertNoRectOverlap(page, '.darkroom-topbar', '[data-testid="darkroom-audio-invite"]', '390-invite-topbar')
      await page.locator('[data-testid="darkroom-invite-dismiss"]').click()
      await expect(page.locator('[data-testid="darkroom-audio-invite"]')).toHaveCount(0)
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.locator('[data-testid="darkroom-audio-invite"]')).toHaveCount(0)
      record('darkroom-invite-dismiss-persistence', { passed: true })
    } finally {
      await context.close()
    }
  }

  assert.deepEqual(report.consoleErrors, [], `Console errors: ${JSON.stringify(report.consoleErrors)}`)
  assert.deepEqual(report.pageErrors, [], `Page errors: ${JSON.stringify(report.pageErrors)}`)
  report.passed = true
} finally {
  await browser.close()
  await writeFile(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
