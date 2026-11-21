import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://127.0.0.1:5197'
const browser = await chromium.launch({ executablePath: process.env.LUOSHENG_CHROME || undefined })
try {
  for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    await context.addInitScript(value => localStorage.setItem('heluo.theme', value), theme)
    const page = await context.newPage()
    const errors = []
    const requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (/\/guide\/|\.glb(?:\?|$)/.test(request.url())) requests.push(request.url())
    })
    const artifact = '/artifacts/heluo-bronze-ding'
    const guide = page.getByRole('region', { name: '洛笙' })
    const button = name => guide.getByRole('button', { name, exact: true })
    const input = guide.getByRole('textbox', { name: '模拟问答 · 非实时 AI' })
    const result = guide.locator('form [role=status]')
    await page.goto(base + artifact)
    await button('带我看看').click()
    assert.equal(await input.count(), 0)
    await page.goto(base + artifact + '?guide-turn-test=1')
    await button('问洛笙').click()
    await input.waitFor()
    assert.equal(await input.evaluate(el => el.closest('form').scrollWidth <= el.closest('form').clientWidth), true)
    await page.clock.install()
    const ask = async () => {
      await input.fill('另一只呢？')
      await button('发送').click()
      assert.match(await result.innerText(), /等待模拟回答/)
    }
    const answer = async pattern => {
      await ask()
      await page.clock.fastForward(900)
      assert.match(await result.innerText(), pattern)
    }
    await answer(/你指的是鼎耳，还是鼎足/)
    await button('鼎耳').click()
    await answer(/口沿对侧[\s\S]*俯视图/)
    await ask()
    await button('三足').click()
    await page.clock.fastForward(900)
    assert.equal(await result.innerText(), '')
    await answer(/一足被挡住了[\s\S]*背视图/)
    await ask()
    await guide.getByRole('link', { name: '去 3D 看三足' }).click()
    await page.waitForURL('**/exhibits/heluo-bronze-ding-3d')
    await page.getByRole('button', { name: '进入互动 3D' }).waitFor()
    await page.clock.fastForward(900)
    assert.equal(await input.count(), 0)
    assert.equal(await guide.getByText('建议查看：背视图').count(), 0)
    await page.goBack()
    await page.waitForURL('**/artifacts/heluo-bronze-ding?guide-turn-test=1')
    await button('问洛笙').click()
    assert.equal(await result.innerText(), '')
    assert.deepEqual(errors, [])
    assert.deepEqual(requests, [])
    console.log(`Luosheng turn preview passed: ${width}px ${theme}`)
    await context.close()
  }
} finally {
  await browser.close()
}
