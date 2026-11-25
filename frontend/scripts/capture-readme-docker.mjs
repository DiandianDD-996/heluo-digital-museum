// Capture only the local Compose deployment. Stage PNGs outside the publication directory.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const origin = 'http://127.0.0.1:8088'
const out = new URL('../../artifacts/readme-docker/', import.meta.url)
await mkdir(out, { recursive: true })
const args = new Set(process.argv.slice(2))
const cases = []
function add(page, route, ready, theme, language, options = {}) {
  cases.push({ page, route, ready, theme, language, ...options })
}
for (const theme of ['light', 'dark']) {
  for (const lang of ['zh', 'en']) add('home', '/', 'main h1', theme, lang,
    { preview: theme === 'light' && lang === 'en' ? 'hero-light-preview' : null })
  for (const [page, route, ready] of [
    ['explore', '/explore', '.gallery-object'], ['shop', '/shop', '.product-card'],
    ['booking', '/appointment', '.appointment-time'], ['gallery', '/exhibits', '.exhibit-showcase'],
  ]) add(page, route, ready, theme, 'en', { preview: theme === 'light' && page + '-light-preview' })
  add('digital-exhibit', '/exhibits/heluo-bronze-ding-3d', '.viewer-poster-start', theme, 'en', { model: true })
  add('admin-content', '/admin', '.admin-list article', theme, 'zh', { admin: true })
}
add('artifact-detail', '/artifacts/heluo-bronze-ding', '.detail-header', 'light', 'en', { preview: 'artifact-detail-light-preview' })
add('digital-exhibit-pointcloud', '/exhibits/heluo-bronze-ding-3d', '.viewer-poster-start', 'dark', 'en', { model: true, points: true, file: 'digital-exhibit-pointcloud' })
for (const [page, tab] of [['admin-products', '商品'], ['admin-exhibits', '3D 展项']])
  add(page, '/admin/operations', '.admin-list article', 'dark', 'zh', { admin: true, tab })

const browser = await chromium.launch({ channel: 'msedge', args: ['--enable-unsafe-swiftshader'] })
try {
  const health = await fetch(origin + '/api/v1/health')
  assert.equal((await health.json()).data.status, 'UP')
  let token
  for (const c of cases) {
    const name = c.file || [c.page, c.theme, c.language].join('-')
    if (args.size && !args.has(name)) continue
    console.log('Opening', name)
    if (c.admin && !token) {
      const env = await readFile(new URL('../../deploy/.env', import.meta.url), 'utf8')
      const get = key => env.split(/\r?\n/).find(s => s.startsWith(key + '='))?.slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
      const res = await fetch(origin + '/api/v1/auth/login', { method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          username: get('MUSEUM_BOOTSTRAP_ADMIN_USERNAME'), password: get('MUSEUM_BOOTSTRAP_ADMIN_PASSWORD'),
        }) })
      assert.ok(res.ok, 'Local administrator login failed: ' + res.status)
      const { data } = await res.json()
      assert(data.user.roles.includes('ADMIN'))
      token = data.accessToken
    }
    const locale = c.language === 'zh' ? 'zh-CN' : 'en-US'
    const viewport = c.model || c.admin ? { width: 1680, height: 1050 } : { width: 1440, height: 900 }
    const p = await browser.newPage({ viewport, reducedMotion: 'reduce', locale })
    const errors = []
    p.on('pageerror', e => errors.push(e.message))
    await p.addInitScript(({ origin, locale, theme, token }) => {
      if (location.origin !== origin) return
      localStorage.setItem('heluo.locale', locale)
      localStorage.setItem('heluo.theme', theme)
      if (token) localStorage.setItem('heluo.access-token', token)
    }, { origin, locale, theme: c.theme, token: c.admin ? token : null })
    assert.equal((await p.goto(origin + c.route)).status(), 200)
    if (c.page === 'booking') {
      await p.locator('.appointment-dates').waitFor()
      const available = p.locator('.appointment-day.is-available:enabled').first()
      if (await available.count()) await available.click()
      else await p.getByRole('button', { name: /Go to the next available date/i }).click()
    }
    if (c.tab) {
      const t = p.getByRole('tab', { name: c.tab, exact: true })
      await t.click()
      assert.equal(await t.getAttribute('aria-selected'), 'true')
    }
    await p.locator(c.model ? '.exhibit-viewer-wrap' : c.ready).first().waitFor({ timeout: 25000 })
    if (c.model) {
      if (await p.locator(c.ready).isVisible()) await p.locator(c.ready).click()
      await p.locator('[data-viewer-state="ready"] canvas').first().waitFor({ timeout: 60000 })
      if (c.points) {
        await p.locator('.dock-mode-switch button').nth(1).click()
        await p.locator('[data-display-mode="points"] [data-point-cloud-state="ready"]').waitFor()
      }
    }
    await p.evaluate(async () => {
      await document.fonts.ready
      for (let y = 0; y < document.documentElement.scrollHeight; y += 650) {
        window.scrollTo({ top: y, behavior: 'instant' })
        await new Promise(resolve => setTimeout(resolve, 80))
      }
      await Promise.all([...document.images].filter(i => i.currentSrc || i.src).map(i => i.decode()))
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
    await p.mouse.move(0, 0)
    await p.waitForTimeout(c.model ? 1500 : 350)
    const state = await p.evaluate(() => ({
      lang: document.documentElement.lang, theme: document.documentElement.dataset.theme,
      path: location.pathname, width: document.documentElement.scrollWidth,
      bundle: [...document.scripts].map(s => s.src).find(s => s.includes('/assets/index-')),
    }))
    assert.deepEqual([state.path, state.lang, state.theme, state.width], [c.route, locale, c.theme, viewport.width])
    assert(state.bundle)
    assert.deepEqual(errors, [])
    const save = async (file, fullPage) => {
      const png = await p.screenshot({ fullPage, path: fileURLToPath(new URL(file + '.png', out)), timeout: 60000 })
      const dimensions = [png.readUInt32BE(16), png.readUInt32BE(20)]
      const sha256 = createHash('sha256').update(png).digest('hex')
      await writeFile(new URL(file + '.json', out), JSON.stringify({ file, ...state, dimensions, sha256, capturedAt: new Date().toISOString() }))
      console.log(file, dimensions.join('x'), sha256.slice(0, 12))
    }
    if (c.preview) await save(c.preview, false)
    await save(name, !c.model)
    await p.close()
  }
} finally { await browser.close() }
