import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

// 8088 = standard Docker. 14173 = local opt-in preview, archive-only API.
const route = '/exhibits/heluo-bronze-ding-3d'
const out = new URL('../../artifacts/readme-highlights/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', args: ['--enable-unsafe-swiftshader'] })
try {
  for (const kind of ['tour', 'guide']) {
    if (process.argv[2] && kind !== process.argv[2]) continue
    const origin = 'http://127.0.0.1:' + (kind === 'tour' ? '8088' : '14173')
    const p = await browser.newPage({ viewport: {width: 1680, height: 1050}, locale: 'zh-CN', reducedMotion: 'reduce' })
    const errors = []
    p.on('pageerror', e => errors.push(e.message))
    await p.addInitScript(() => {
      localStorage.setItem('heluo.theme', 'dark')
      localStorage.setItem('heluo.locale', 'zh-CN')
    })
    assert.equal((await p.goto(origin + route)).status(), 200)
    await p.locator('.exhibit-viewer-wrap').waitFor()
    const poster = p.locator('.viewer-poster-start')
    if (await poster.isVisible()) await poster.click()
    await p.locator('[data-viewer-state="ready"] canvas').first().waitFor({timeout: 60000})
    await p.locator('.dock-mode-switch button').nth(1).click()
    const points = p.locator('[data-display-mode="points"] [data-point-cloud-state="ready"]')
    await points.waitFor()
    const shot = async (file, detail) => {
      await p.mouse.move(0, 0)
      await p.evaluate(() => document.fonts.ready)
      await p.waitForTimeout(700)
      assert(await points.isVisible())
      assert.equal(await p.locator('html').getAttribute('lang'), 'zh-CN')
      assert.deepEqual(errors, [])
      const buffer = await p.screenshot({path: fileURLToPath(new URL(file + '.png', out))})
      const sha256 = createHash('sha256').update(buffer).digest('hex')
      const bundle = await p.locator('script[src*="/assets/index-"]').getAttribute('src')
      const meta = {file, url: p.url(), bundle, detail, sha256, capturedAt: new Date().toISOString()}
      await writeFile(new URL(file + '.json', out), JSON.stringify(meta))
      console.log(file, detail, sha256.slice(0, 12))
    }
    if (kind === 'tour') {
      await p.getByTestId('start-micro-tour').click()
      await p.getByTestId('micro-tour-play').click()
      const bar = p.getByTestId('micro-tour-bar')
      assert.equal(await bar.getAttribute('data-tour-state'), 'paused')
      const steps = [['ear', '立耳对称轮廓'], ['motif', '器腹兽面纹带'], ['feet', '三足承重柱体']]
      for (const [i, [key, title]] of steps.entries()) {
        if (i) await p.getByTestId('micro-tour-next').click()
        assert.equal(await bar.locator('strong').innerText(), title)
        assert.equal(await bar.locator('.micro-tour-bar__step').innerText(), '0' + (i+1) + ' / 03')
        await shot('pointcloud-tour-' + key, title)
      }
    } else {
      await p.getByTestId('luosheng-fab').click()
      await p.getByTestId('luosheng-expand').click()
      await p.getByTestId('luosheng-input').fill('青铜鼎的立耳可以用来提举吗？带我看看鼎耳。')
      await p.getByTestId('luosheng-send').click()
      const reply = p.locator('article[data-role="assistant"]').last()
      const badge = reply.locator('.luosheng-mode-badge.is-archive')
      await badge.waitFor({timeout: 30000})
      const focus = reply.locator('[data-action-type="viewer_focus"]')
      await focus.waitFor()
      await badge.scrollIntoViewIfNeeded()
      await shot('luosheng-ding-answer', await badge.innerText())
      await reply.locator('details summary').click()
      const source = reply.locator('.luosheng-citation-list li').first()
      await source.waitFor()
      await source.scrollIntoViewIfNeeded()
      await shot('luosheng-ding-sources', await source.locator('.luosheng-citation-id').innerText())
      await reply.locator('details summary').click()
      await p.getByTestId('luosheng-close').click()
      await p.getByTestId('start-micro-tour').click()
      await p.getByTestId('micro-tour-play').click()
      await p.getByTestId('luosheng-fab').click()
      await badge.scrollIntoViewIfNeeded()
      assert.equal(await p.getByTestId('micro-tour-bar').locator('strong').innerText(), '立耳对称轮廓')
      assert.equal(await p.getByTestId('micro-tour-bar').getAttribute('data-tour-state'), 'paused')
      await shot('ding-tour-with-luosheng', '01 / 03 · ' + await badge.innerText())
    }
    await p.close()
  }
} finally {await browser.close()}
