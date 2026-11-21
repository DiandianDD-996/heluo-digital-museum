import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const base = args.find(arg => !arg.startsWith('--')) ?? 'http://127.0.0.1:5197'
const throttled = args.includes('--throttled')
const browser = await chromium.launch({
  executablePath: process.env.LUOSHENG_CHROME || undefined,
  args: ['--enable-unsafe-swiftshader'],
})

try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
    })
    let releaseModel, releasePlate
    const modelGate = new Promise(resolve => { releaseModel = resolve })
    const plateGate = new Promise(resolve => { releasePlate = resolve })
    try {
      await context.addInitScript(theme => localStorage.setItem('heluo.theme', theme), theme)
      const page = await context.newPage()
      if (throttled) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 180,
          downloadThroughput: 375_000,
          uploadThroughput: 93_750,
          connectionType: 'cellular4g',
        })
        page.setDefaultTimeout(60_000)
        page.setDefaultNavigationTimeout(60_000)
      }
      const errors = []
      const modelRequests = []
      let sidePlateRequested = false
      page.on('pageerror', error => errors.push(error.message))
      const modelPattern = /\/media\/models\/heluo-bronze-ding-v5\.5(?:-mobile)?\.glb(?:\?|$)/
      await page.route(modelPattern, async route => {
        modelRequests.push(route.request().url())
        const fail = await modelGate
        if (fail) await route.abort()
        else await route.continue()
      })
      const platePattern = /\/luosheng-ding-side\.webp(?:\?|$)/
      await page.route(platePattern, async route => {
        if (route.request().resourceType() !== 'image') return route.fallback()
        sidePlateRequested = true
        await plateGate
        await route.continue()
      })
      const startedAt = performance.now()
      await page.goto(new URL('/explore?q=' + encodeURIComponent('河洛青铜鼎'), base).href, { waitUntil: 'domcontentloaded' })
      await page.locator('a[href="/artifacts/heluo-bronze-ding"]').first().tap()
      const guide = page.getByRole('region', { name: '洛笙' })
      const button = name => guide.getByRole('button', { name, exact: true })
      await button('带我看看').tap()
      await guide.getByRole('link', { name: '去 3D 看鼎耳', exact: true }).tap()
      await page.waitForURL('**/exhibits/heluo-bronze-ding-3d')
      await guide.getByRole('heading', { name: '找一找鼎耳' }).waitFor()
      const viewer = page.locator('.exhibit-viewer-wrap')
      assert.equal(await viewer.getAttribute('data-viewer-state'), 'poster')
      assert(await guide.getByText('3D 尚未启动。可以先看这处细节图。', { exact: true }).isVisible())
      assert.deepEqual(modelRequests, [])
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      await viewer.locator('.viewer-poster-start').tap()
      await page.locator('.exhibit-viewer-wrap[data-viewer-state="loading-model"]').waitFor()
      await button('三足').tap()
      const plate = guide.locator('img[src*="luosheng-ding-side.webp"]')
      await plate.scrollIntoViewIfNeeded()
      assert.equal(await plate.evaluate(img => img.naturalWidth), 0)
      await guide.getByText('只看见两足，是不是少了一足？', { exact: true }).tap()
      assert(await guide.getByText(/用背视图对照/).isVisible())
      await guide.getByText('查看依据', { exact: true }).tap()
      assert(await guide.getByText(/侧视图能辨两足，背视图能辨三足/).isVisible())
      assert.equal(await viewer.getAttribute('data-viewer-state'), 'loading-model')
      assert(await guide.getByText('3D 正在准备。可以先看这处细节图。', { exact: true }).isVisible())
      assert(sidePlateRequested, 'side plate request should still be waiting at the gate')
      assert(modelRequests.length > 0, 'model request should still be waiting at the gate')
      assert.equal(await button('从背面数鼎足').count(), 0)
      assert.equal(await page.locator('.view-switcher button:not(:disabled)').count(), 0)

      releasePlate()
      await plate.evaluate(img => img.decode())
      releaseModel(theme === 'dark')
      if (theme === 'light') {
        await button('从背面数鼎足').waitFor({ timeout: 45000 })
        assert.equal(await viewer.getAttribute('data-viewer-state'), 'ready')
        assert.equal(await guide.getByText(/3D 正在准备/).count(), 0)
        const back = page.locator('.view-switcher [data-view="back"]')
        assert.equal(await back.getAttribute('aria-pressed'), 'false')
        const canvas = viewer.locator('canvas')
        const frontFrame = await canvas.screenshot()
        await button('从背面数鼎足').tap()
        assert.equal(await back.getAttribute('aria-pressed'), 'true')
        const backFrame = await canvas.screenshot()
        assert(!frontFrame.equals(backFrame), 'explicit view change should change canvas pixels')
      } else {
        await page.locator('.exhibit-viewer-wrap[data-viewer-state="error"]').waitFor()
        assert(await guide.getByText('3D 暂不可用。可以先看这处细节图。', { exact: true }).isVisible())
        assert.equal(await button('从背面数鼎足').count(), 0)
        assert(await guide.getByText(/用背视图对照/).isVisible())
      }
      await guide.getByRole('link', { name: '回到藏品展签' }).tap()
      await page.waitForURL('**/artifacts/heluo-bronze-ding#luosheng-preview')
      await button('问洛笙').waitFor()
      assert.equal(await guide.getAttribute('data-mode'), 'quiet')
      await button('问洛笙').tap()
      await guide.getByRole('heading', { name: '数一数鼎足' }).waitFor()
      assert.deepEqual(errors, [])
      console.log(`390px ${theme}: ${throttled ? '180 ms, 3/0.75 Mbps, cache off; ' : ''}delayed model and side plate; ${theme === 'light' ? 'recovery and explicit back view' : 'failure and comparison fallback'}; quiet return passed in ${((performance.now() - startedAt) / 1000).toFixed(1)} s`)
    } finally {
      releasePlate()
      releaseModel(true)
      await context.close()
    }
  }
} finally {
  await browser.close()
}
