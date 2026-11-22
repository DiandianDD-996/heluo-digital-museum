import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const deployment = process.env.LUOSHENG_PRODUCTION_ORIGIN
const distDirectory = process.env.LUOSHENG_PRODUCTION_DIST
const rollback = process.env.LUOSHENG_CHECK_FRONTEND_ROLLBACK === '1'
const upstream = process.env.MUSEUM_DEV_API_URL ?? ''
assert(!rollback || (!deployment && distDirectory && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(upstream)
  && Number(new URL(upstream).port) <= 65535), 'Rollback check requires a local build and loopback backend')
assert(!deployment || distDirectory, 'Set LUOSHENG_PRODUCTION_DIST to the files served by the deployment')
const dist = distDirectory ? resolve(distDirectory) : fileURLToPath(new URL('../dist/', import.meta.url))
const files = await readdir(dist, { recursive: true, withFileTypes: true })
const entries = files.filter(entry => entry.isFile())
assert(entries.some(entry => entry.name === 'index.html'), 'Build the production frontend first')
const previewMarkers = ['luosheng-preview', '讲解预览', '内容待审核', '带我看看', '去 3D 看', '沿着鼎腹纹样看', '侧视图能辨两足，背视图能辨三足', '这件鼎是在洛阳出土的吗？', '可以先看这处细节图。']
previewMarkers.push('guide-turn-test', '模拟问答 · 非实时 AI', '__guide-test', '合成资料 · 非实时 AI')
previewMarkers.push('guide-audio-test', '试听测试音频', 'luosheng-browser-test.wav')
previewMarkers.push('问时段', '青铜鼎数字模型 {view}', '回到青铜鼎 · {point}')
previewMarkers.push('当前公开时段的空位不足 {people} 人', '按馆内检索别名，把「{requested}」换成「{matched}」')
previewMarkers.push('ding-zh-CN-0.3.0-draft', 'ding-zh-CN-0.3.0-release-candidate',
  'ding-zh-CN-0.5.0-review-candidate', 'ding-zh-CN-0.5.0-signoff-candidate',
  'ding-period-zh-CN-draft', 'ding-size-zh-CN-draft',
  'LS-DING-EARS', 'LS-DING-FEET', 'LS-DING-MOTIF', 'LS-DING-SOURCE', 'LS-DING-PERIOD', 'LS-DING-SIZE')
for (const entry of entries) {
  assert.doesNotMatch(entry.name, /^luosheng-ding-(top|side|back|relief)([.-]|$)/i)
  assert.notEqual(entry.name, 'luosheng-browser-test.wav')
  assert.notEqual(entry.name, 'ding-period-zh-CN-draft.json')
  assert.notEqual(entry.name, 'ding-size-zh-CN-draft.json')
  assert.doesNotMatch(entry.name, /^ding-zh-CN-[\d.]+-(draft|review-candidate|release-candidate|signoff-candidate)([.-]|$)/i)
  if (!/\.(js|css|html|map|json)$/i.test(entry.name)) continue
  const file = resolve(entry.parentPath, entry.name)
  const source = await readFile(file, 'utf8')
  for (const marker of previewMarkers) {
    assert(!source.includes(marker), `Preview marker "${marker}" in ${entry.name}`)
  }
  if (deployment) {
    const pathname = relative(dist, file).split(sep).map(encodeURIComponent).join('/')
    const served = await fetch(new URL(pathname, deployment), { signal: AbortSignal.timeout(8000) })
    assert(served.ok, `Deployment did not serve ${pathname}`)
    assert.equal(await served.text(), source, `Unexpected deployment content for ${pathname}`)
  }
}
console.log('Production bundle: no draft copy, guide component marker, or named guide plates')

const server = deployment ? null : await preview({ root, build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0 } })
try {
  const address = server?.httpServer.address()
  assert(deployment || (address && typeof address === 'object'))
  const base = deployment ? new URL(deployment).origin : `http://127.0.0.1:${address.port}`
  if (rollback) {
    const home = await fetch(base, { signal: AbortSignal.timeout(5000) })
    assert.equal(home.status, 200)
    assert.equal(await home.text(), await readFile(resolve(dist, 'index.html'), 'utf8'))
  }
  const browser = await chromium.launch({ executablePath: process.env.LUOSHENG_CHROME || undefined })
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(8000)
    const errors = []
    const guideRequests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (/^\/api\/v1\/(?:__guide-test|guide)\//.test(new URL(request.url()).pathname)) {
        guideRequests.push(request.url())
      }
    })
    const assertGuideHidden = async () => {
      assert.equal(await page.getByRole('region', { name: '洛笙' }).count(), 0)
      assert.equal(await page.locator('.luosheng-site, .luosheng-preview').count(), 0)
    }
    const home = await page.goto(`${base}/`)
    assert.equal(home?.status(), 200)
    const explore = page.locator('a[href="/explore"]').first()
    await explore.waitFor({ state: 'attached' })
    await assertGuideHidden()
    await page.goto(`${base}/explore?q=${encodeURIComponent('河洛青铜鼎')}`)
    await page.locator('a[href="/artifacts/heluo-bronze-ding"]').first().tap()
    await page.waitForURL('**/artifacts/heluo-bronze-ding')
    const entry = page.locator('.related-exhibit[href="/exhibits/heluo-bronze-ding-3d"]')
    await entry.waitFor()
    await assertGuideHidden()
    await entry.tap()
    await page.waitForURL('**/exhibits/heluo-bronze-ding-3d')
    await page.getByRole('button', { name: '进入互动 3D' }).waitFor()
    await assertGuideHidden()
    await page.goBack()
    await page.waitForURL('**/artifacts/heluo-bronze-ding')
    await entry.waitFor()
    await assertGuideHidden()
    await page.goto(`${page.url()}?guide-turn-test=http&guide-audio-test=1`)
    await entry.waitFor()
    await assertGuideHidden()
    const [slots] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/appointment-slots'),
      page.locator('.detail-cta a[href="/appointment"]').tap(),
    ])
    assert.equal(slots.status(), 200)
    const availableSlots = (await slots.json()).data
    assert(Array.isArray(availableSlots) && availableSlots.length > 0, 'Expected public booking slots')
    await page.waitForURL('**/appointment')
    await page.getByRole('heading', { name: '预约参观' }).waitFor()
    await assertGuideHidden()
    assert.equal(await page.getByRole('button', { name: '问时段', exact: true }).count(), 0)
    assert.equal(await page.locator('.appointment-guide-actions').count(), 0)
    assert.deepEqual(guideRequests, [])
    assert.deepEqual(errors, [])
    const preset = await context.request.get(`${base}/api/v1/guide/exhibits/heluo-bronze-ding-3d`)
    if (rollback) {
      assert.equal(preset.status(), 200)
      const { data } = await preset.json()
      assert.equal(data?.available, true)
      assert.equal(data.entries.length, 8)
      console.log('Frontend-only rollback: all eight cards still available at the backend')
    } else {
      const turn = await context.request.post(`${base}/api/v1/guide/turns`, { data: {} })
      assert.equal(preset.status(), 404, 'Closed preset route must not answer direct HTTP requests')
      assert.equal(turn.status(), 404, 'Closed turn route must not accept direct HTTP requests')
      console.log('Production HTTP: preset and turn routes both returned 404')
    }
    console.log('Production browser: home, search, exhibit poster, returned artifact and booking slots passed without guide UI or requests')
  } finally {
    await browser.close()
  }
} finally {
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
}
