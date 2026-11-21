import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://127.0.0.1:5197'
const browser = await chromium.launch({ executablePath: process.env.LUOSHENG_CHROME || undefined })
try {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: true, reducedMotion: 'reduce' })
      const modelRequests = []
      page.on('request', request => {
        if (new URL(request.url()).pathname.endsWith('.glb')) modelRequests.push(request.url())
      })
      await page.addInitScript(theme => localStorage.setItem('heluo.theme', theme), theme)
      await page.goto(new URL('/exhibits/heluo-bronze-ding-3d', base).href)
      const poster = page.locator('.three-fallback--activation > img')
      await poster.waitFor({ timeout: 10000 })
      assert(await page.locator('.viewer-poster-start').isVisible())
      const state = await poster.evaluate(async img => {
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        return {
          width: canvas.width, height: canvas.height,
          cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3],
          centerAlpha: ctx.getImageData(490, 590, 1, 1).data[3],
          fit: getComputedStyle(img).objectFit,
        }
      })
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      assert.deepEqual(state, { width: 980, height: 1180, cornerAlpha: 0, centerAlpha: 255, fit: 'contain' })
      assert.deepEqual(modelRequests, [])
      if (process.env.DING_POSTER_CAPTURE) {
        await page.screenshot({ path: `${process.env.DING_POSTER_CAPTURE}/ding-poster-${theme}-${width}.png` })
      }
      await page.close()
      console.log(`${width}px ${theme}: poster decoded, transparent, contained; no GLB request`)
    }
  }
} finally {
  await browser.close()
}
