import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://127.0.0.1:5197'
const browser = await chromium.launch({
  ...(process.env.LUOSHENG_CHROME ? { executablePath: process.env.LUOSHENG_CHROME } : {}),
  args: ['--enable-unsafe-swiftshader'],
})

try {
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [768, 'light'], [768, 'dark'], [390, 'light'], [390, 'dark'], [320, 'light'], [320, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    await context.addInitScript((appearance) => localStorage.setItem('heluo.theme', appearance), theme)
    const page = await context.newPage()
    const errors = []
    const prohibited = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (/\.(glb|gltf)(\?|$)|\/guide\//.test(request.url())) prohibited.push(request.url())
    })
    await page.goto(`${base}/explore?q=${encodeURIComponent('河洛青铜鼎')}`)
    await page.locator('a[href="/artifacts/heluo-bronze-ding"]:visible').first().click()
    const guide = page.getByRole('region', { name: '洛笙', exact: true })
    const button = name => guide.getByRole('button', { name, exact: true })
    await button('带我看看').waitFor()
    const panelId = await button('带我看看').getAttribute('aria-controls')
    assert(panelId)
    const panel = guide.locator(`[id="${panelId}"]`)
    assert.equal(await panel.count(), 1)
    assert.equal(await panel.isVisible(), false)
    assert.equal(await button('带我看看').getAttribute('aria-expanded'), 'false')
    assert.doesNotMatch(await guide.ariaSnapshot(), /找一找鼎耳|查看依据/)
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    if (process.env.LUOSHENG_CAPTURE && width === 1440) {
      await guide.screenshot({ path: `${process.env.LUOSHENG_CAPTURE}/luosheng-invite-${theme}.png` })
    }
    if (width === 320) {
      await button('我先自己逛').click()
      assert.equal(await button('问洛笙').evaluate(el => el === document.activeElement), true)
      await page.reload()
      await button('问洛笙').waitFor()
      assert.equal(await button('带我看看').count(), 0)
      await button('问洛笙').click()
    } else {
      await button('带我看看').focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      assert.equal(await button('带我看看').evaluate(el => el === document.activeElement), true)
      assert.equal(await button('带我看看').evaluate(el => getComputedStyle(el).outlineStyle), 'solid')
      await page.keyboard.press('Enter')
    }
    await guide.getByRole('heading', { name: '找一找鼎耳' }).waitFor()
    assert.equal(await guide.getByRole('heading', { name: '洛笙', exact: true }).evaluate(el => el === document.activeElement), true)
    await button('左侧鼎耳').focus()
    await button('左侧鼎耳').press('Enter')
    assert.equal(await button('左侧鼎耳').getAttribute('aria-pressed'), 'true')
    assert(await guide.getByText(/看口沿左侧凸起的一段/).isVisible())
    await button('右侧鼎耳').click()
    assert.equal(await button('左侧鼎耳').getAttribute('aria-pressed'), 'false')
    assert(await guide.getByText(/看口沿对侧伸出的这一段/).isVisible())
    assert.equal(await guide.locator('.guide-etch-light').evaluate(el => getComputedStyle(el).animationName), 'none')
    assert.equal(await panel.isVisible(), true)
    await guide.getByRole('link', { name: '去 3D 看鼎耳', exact: true }).waitFor()
    await button('纹样').click()
    await button('找找纹样的转折').click()
    assert(await guide.getByText(/沿着鼎腹中段较宽的凸线看/).isVisible())
    await button('收起纹样提示').click()
    await guide.getByRole('link', { name: '去 3D 看纹样', exact: true }).waitFor()
    await button('鼎耳').click()
    const image = guide.getByRole('img')
    await image.scrollIntoViewIfNeeded()
    await image.evaluate(img => img.decode())
    const evidence = guide.locator('details').filter({ has: page.locator('summary').filter({ hasText: '查看依据' }) })
    await evidence.locator('summary').click()
    assert.equal(await evidence.getByText(/俯视图的口沿左右各可见一耳/).isVisible(), true)
    await button('三足').click()
    assert.equal(await button('三足').evaluate(el => el === document.activeElement), true)
    assert.equal(await panel.locator('[aria-live="polite"]').count(), 2)
    assert.equal(await button('三足').getAttribute('aria-pressed'), 'true')
    assert.equal(await button('鼎耳').getAttribute('aria-pressed'), 'false')
    await button('背视').click()
    assert(await guide.getByText('背视：可见三足', { exact: true }).isVisible())
    assert.match(await guide.getByRole('img').getAttribute('src'), /luosheng-ding-back\.webp/)
    await button('侧视').click()
    assert(await guide.getByText('侧视：可见两足', { exact: true }).isVisible())
    await guide.getByRole('heading', { name: '数一数鼎足' }).waitFor()
    assert.equal(await evidence.getByText(/侧视图能辨两足，背视图能辨三足/).isVisible(), true)
    assert.equal(await evidence.getByText(/俯视图的口沿左右各可见一耳/).count(), 0)
    const plates = await guide.getByRole('img').all()
    assert.equal(plates.length, 1)
    for (const plate of plates) {
      await plate.scrollIntoViewIfNeeded()
      await plate.evaluate(img => img.decode())
      const asset = await plate.evaluate(img => ({ url: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight }))
      assert.match(asset.url, /luosheng-ding-side\.webp/)
      assert.equal(asset.width, 480)
      assert.equal(asset.height, 480)
    }
    const geometry = await guide.evaluate(el => ({
      clipped: el.scrollWidth > el.clientWidth + 1,
      controls: [...el.querySelectorAll('button, .guide-primary, summary')].map(node => ({
        height: node.getBoundingClientRect().height,
        clipped: node.scrollWidth > node.clientWidth + 1,
      })),
    }))
    assert.equal(geometry.clipped, false)
    assert(geometry.controls.every(control => control.height >= 44 && !control.clipped))
    const styles = await guide.locator('.guide-actions .guide-primary').evaluate(el => {
      const css = getComputedStyle(el)
      const canvas = document.createElement('canvas').getContext('2d')
      const luminance = color => {
        canvas.clearRect(0, 0, 1, 1)
        canvas.fillStyle = color
        canvas.fillRect(0, 0, 1, 1)
        const rgb = canvas.getImageData(0, 0, 1, 1).data
        return [0.2126, 0.7152, 0.0722].reduce((total, weight, index) => {
          const channel = rgb[index] / 255
          return total + weight * (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
        }, 0)
      }
      const [dark, light] = [luminance(css.color), luminance(css.backgroundColor)].sort((a, b) => a - b)
      return (light + .05) / (dark + .05)
    })
    assert(styles >= 4.5, `Primary button contrast: ${styles.toFixed(2)}:1`)
    if (process.env.LUOSHENG_CAPTURE && [1440, 390].includes(width)) {
      await guide.screenshot({ path: `${process.env.LUOSHENG_CAPTURE}/luosheng-${theme}-${width}.png` })
    }
    await page.keyboard.press('Escape')
    assert.equal(await panel.count(), 1)
    assert.equal(await panel.isVisible(), false)
    assert.equal(await button('问洛笙').getAttribute('aria-controls'), panelId)
    assert.equal(await button('问洛笙').getAttribute('aria-expanded'), 'false')
    assert.equal(await button('问洛笙').evaluate(el => el === document.activeElement), true)
    assert.doesNotMatch(await guide.ariaSnapshot(), /数一数鼎足|查看依据/)
    await page.keyboard.press('Space')
    await guide.getByRole('link', { name: '去 3D 看三足', exact: true }).click()
    await page.waitForURL('**/exhibits/heluo-bronze-ding-3d')
    await guide.getByRole('heading', { name: '数一数鼎足' }).waitFor()
    assert.equal(await button('从背面数鼎足').count(), 0)
    await guide.getByText('只看见两足，是不是少了一足？', { exact: true }).click()
    assert.equal(await guide.getByText(/用背视图对照/).isVisible(), true)
    assert.equal(await page.locator('.exhibit-viewer-wrap').getAttribute('data-viewer-state'), 'poster')
    const findSpot = guide.locator('details').filter({ has: page.locator('summary').filter({ hasText: '这件鼎是在洛阳出土的吗？' }) })
    await findSpot.locator('summary').focus()
    await page.keyboard.press('Enter')
    assert.equal(await findSpot.getByText(/目前不能确定/).isVisible(), true)
    assert.equal(await findSpot.getByText(/没有填写出土地/).isVisible(), true)
    assert.equal(await findSpot.getByRole('link', { name: /1962.281/ }).getAttribute('href'), 'https://www.clevelandart.org/art/1962.281')
    assert.equal(await button('三足').getAttribute('aria-pressed'), 'true')
    assert.equal(await page.locator('.exhibit-viewer-wrap').getAttribute('data-viewer-state'), 'poster')
    await guide.getByText('查看依据', { exact: true }).click()
    assert.equal(await evidence.getByText(/侧视图能辨两足，背视图能辨三足/).isVisible(), true)
    assert.equal(await evidence.getByRole('link', { name: /1962.281/ }).getAttribute('href'), 'https://www.clevelandart.org/art/1962.281')
    const bounds = await guide.boundingBox()
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
    assert.deepEqual(prohibited, [])
    const viewer = page.locator('.exhibit-viewer-wrap')
    if (width === 1440 && theme === 'light') {
      await viewer.locator('.viewer-poster-start').click()
      await button('从背面数鼎足').waitFor({ timeout: 45_000 })
      const canvas = viewer.locator('canvas')
      const back = page.locator('[data-view="back"]')
      assert.equal(await back.getAttribute('aria-pressed'), 'false')
      await button('从背面数鼎足').click()
      assert.equal(await back.getAttribute('aria-pressed'), 'true')
      const backFrame = await canvas.screenshot({ path: process.env.LUOSHENG_CAPTURE && `${process.env.LUOSHENG_CAPTURE}/pilot-model-back.png` })
      await button('鼎耳').click()
      assert.equal(await back.getAttribute('aria-pressed'), 'true')
      await button('从上面看').waitFor({ timeout: 45_000 })
      const top = page.locator('[data-view="top"]')
      assert.equal(await top.getAttribute('aria-pressed'), 'false')
      await button('从上面看').click()
      assert.equal(await top.getAttribute('aria-pressed'), 'true')
      const topFrame = await canvas.screenshot({ path: process.env.LUOSHENG_CAPTURE && `${process.env.LUOSHENG_CAPTURE}/pilot-model-top.png` })
      assert.equal(backFrame.equals(topFrame), false)
      await button('纹样').click()
      await guide.getByRole('img', { name: /凸出的宽线/ }).evaluate(img => img.decode())
      assert.equal(await top.getAttribute('aria-pressed'), 'true')
      await button('回到正面找纹样').click()
      assert.equal(await page.locator('[data-view="front"]').getAttribute('aria-pressed'), 'true')
    } else if (width === 390 && theme === 'dark') {
      await page.route(/\.glb(\?|$)/, route => route.abort())
      await viewer.locator('.viewer-poster-start').click()
      await page.locator('.exhibit-viewer-wrap[data-viewer-state="error"]').waitFor()
      assert.equal(await button('从背面数鼎足').count(), 0)
      assert.equal(await guide.getByRole('img').count(), 1)
      await page.route(/luosheng-ding-relief\.webp/, route =>
        route.request().resourceType() === 'image' ? route.abort() : route.fallback())
      await button('纹样').click()
      await guide.getByRole('status').getByText(/图版暂不可用/).waitFor()
      assert(await guide.getByText('3D 暂不可用。仍可按文字说明找这一处。', { exact: true }).isVisible())
      await guide.getByText('这些纹样象征什么？', { exact: true }).click()
      assert.equal(await guide.getByText(/不能从图案形状直接猜出来/).isVisible(), true)
      assert.equal(await evidence.getByText(/数字模型局部图能辨凸起宽线的转折/).isVisible(), true)
    }
    const returnLink = guide.getByRole('link', { name: '回到藏品展签' })
    const assertReturnToArtifact = async () => {
      await page.waitForURL('**/artifacts/heluo-bronze-ding#luosheng-preview')
      const passive = button('问洛笙')
      await passive.waitFor()
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === '问洛笙')
      const position = await passive.boundingBox()
      assert(position && position.y >= 0 && position.y + position.height <= 900)
      assert.equal(await button('带我看看').count(), 0)
      assert.equal(await returnLink.count(), 0)
      assert.equal(await guide.getAttribute('data-mode'), 'quiet')
      assert.equal(await guide.getByRole('heading', { name: '沿着鼎腹纹样看' }).count(), 0)
      assert.equal(await page.evaluate(() => history.state?.luoshengPreviewReturn), null)
      const requestCount = prohibited.length
      await passive.click()
      await guide.getByRole('heading', { name: '沿着鼎腹纹样看' }).waitFor()
      await evidence.locator('summary').click()
      assert.equal(await evidence.getByText(/数字模型局部图能辨凸起宽线的转折/).isVisible(), true)
      assert.equal(prohibited.length, requestCount)
      await page.reload()
      await passive.waitFor()
      assert.equal(await guide.getAttribute('data-mode'), 'quiet')
      await passive.click()
      await guide.getByRole('heading', { name: '找一找鼎耳' }).waitFor()
    }
    if (width === 1440 && theme === 'light') {
      await returnLink.focus()
      await page.keyboard.press('Enter')
      await assertReturnToArtifact()
    } else {
      await button('结束讲解').focus()
      await page.keyboard.press('Escape')
      assert.equal(await button('问洛笙').evaluate(el => el === document.activeElement), true)
      if (width === 390 && theme === 'dark') {
        await returnLink.click()
        await assertReturnToArtifact()
      }
    }
    assert.equal(prohibited.some(url => /\/guide\//.test(url)), false)
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`${width}px ${theme}: pass; primary contrast ${styles.toFixed(2)}:1`)
  }
  for (const storageDenied of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    })
    if (storageDenied) {
      await context.addInitScript(() => {
        Object.defineProperty(window, 'sessionStorage', {
          get() { throw new DOMException('Storage unavailable', 'SecurityError') },
        })
      })
    }
    try {
      const page = await context.newPage()
      const unexpectedRequests = []
      page.on('request', request => {
        if (/\.(glb|gltf)(\?|$)|\/guide\//.test(request.url())) unexpectedRequests.push(request.url())
      })
      await page.goto(`${base}/explore?q=${encodeURIComponent('河洛青铜鼎')}`)
      await page.locator('a[href="/artifacts/heluo-bronze-ding"]:visible').first().tap()
      const guide = page.getByRole('region', { name: '洛笙', exact: true })
      const accept = guide.getByRole('button', { name: '带我看看', exact: true })
      const passive = guide.getByRole('button', { name: '问洛笙', exact: true })
      const invite = page.locator('.luosheng-preview[data-mode="invite"]')
      if (!storageDenied) {
        await invite.waitFor()
        assert.equal(await accept.evaluate(el => el === document.activeElement), false)
        assert.deepEqual(unexpectedRequests, [])
        await guide.getByRole('button', { name: '我先自己逛' }).tap()
      }
      await passive.waitFor()
      await page.locator('.related-exhibit[href="/exhibits/heluo-bronze-ding-3d"]').tap()
      await page.waitForURL('**/exhibits/heluo-bronze-ding-3d')
      await passive.waitFor()
      assert.equal(await accept.count(), 0)
      assert.equal(await page.locator('.exhibit-viewer-wrap').getAttribute('data-viewer-state'), 'poster')
      await page.goBack()
      await page.waitForURL('**/artifacts/heluo-bronze-ding')
      await passive.waitFor()
      await passive.tap()
      await guide.getByRole('heading', { name: '找一找鼎耳' }).waitFor()
      await guide.getByRole('button', { name: '纹样', exact: true }).tap()
      await guide.getByRole('link', { name: /^去 3D 看/ }).tap()
      await guide.getByRole('heading', { name: '沿着鼎腹纹样看' }).waitFor()
      await page.reload()
      await passive.waitFor()
      assert.equal(await accept.count(), 0)
      assert.deepEqual(unexpectedRequests, [])
      console.log(`Touch visit, storage ${storageDenied ? 'denied' : 'available'}: pass`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
