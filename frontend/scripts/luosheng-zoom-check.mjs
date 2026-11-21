import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://127.0.0.1:5197'
const context = await chromium.launchPersistentContext('', {
  channel: 'chrome',
  headless: true,
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
})

try {
  const settings = context.pages()[0]
  await settings.goto('chrome://settings/appearance')
  await settings.locator('#zoomLevel').selectOption('2')
  assert.equal(await settings.locator('#zoomLevel').inputValue(), '2')
  for (const theme of ['light', 'dark']) {
    const page = await context.newPage()
    try {
      await page.addInitScript(({ appearance, origin }) => {
        if (location.origin !== origin) return
        localStorage.setItem('heluo.theme', appearance)
        localStorage.setItem('heluo.locale', 'zh-CN')
      }, { appearance: theme, origin: new URL(base).origin })
      await page.goto(`${base}/explore?q=${encodeURIComponent('河洛青铜鼎')}`)
      await page.locator('a[href="/artifacts/heluo-bronze-ding"]').first().click()
      const guide = page.getByRole('region', { name: '洛笙' })
      const button = name => guide.getByRole('button', { name, exact: true })
      const open = button('带我看看')
      await open.waitFor()
      assert.deepEqual(await page.evaluate(() => ({
        width: innerWidth, dpr: devicePixelRatio, zoom: getComputedStyle(document.documentElement).zoom,
        theme: document.documentElement.dataset.theme,
      })), { width: 720, dpr: 2, zoom: '1', theme })
      const checkControl = async control => {
        await control.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
        await control.click({ trial: true })
        const metrics = await control.evaluate(element => {
          const { left, right, top, width, height } = element.getBoundingClientRect()
          const center = document.elementFromPoint(left + width / 2, top + height / 2)
          return { inBounds: left >= 0 && right <= innerWidth, reachable: element.contains(center), fits: element.scrollWidth <= element.clientWidth + 1,
            obstruction: element.contains(center) ? null : center?.outerHTML.slice(0, 200) ?? { top, height, viewport: innerHeight } }
        })
        assert.deepEqual(metrics, { inBounds: true, reachable: true, fits: true, obstruction: null }, await control.innerText())
      }
      await checkControl(open)
      await open.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      assert(await open.evaluate(element => element === document.activeElement))
      await page.keyboard.press('Enter')
      await guide.getByRole('heading', { name: '找一找鼎耳' }).waitFor()
      for (const name of ['鼎耳', '三足', '纹样']) {
        const stop = button(name)
        await checkControl(stop)
        await stop.press('Space')
        assert.equal(await stop.getAttribute('aria-pressed'), 'true')
        const images = await guide.getByRole('img').all()
        assert.equal(images.length, name === '三足' ? 2 : 1)
        for (const image of images) {
          await image.scrollIntoViewIfNeeded()
          await image.evaluate(element => element.decode())
          if (name === '纹样') {
            const size = await image.evaluate(element => [element.naturalWidth, element.naturalHeight])
            assert.deepEqual(size, [1100, 620])
          }
        }
      }
      const evidence = guide.locator('summary').filter({ hasText: '查看依据' })
      await checkControl(evidence)
      await evidence.press('Enter')
      await guide.getByRole('link', { name: /1962.281/ }).waitFor()
      await checkControl(guide.getByRole('link', { name: /^去 3D 看/ }))
      const close = button('结束讲解')
      await checkControl(close)
      await close.press('Escape')
      assert(await button('问洛笙').evaluate(element => element === document.activeElement))
      await checkControl(button('问洛笙'))
      console.log(`${theme}: native Chrome 200%, keyboard, plates, evidence, and exit passed`)
    } finally {
      await page.close()
    }
  }
} finally {
  await context.close()
}
