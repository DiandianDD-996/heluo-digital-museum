import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'

const target = process.env.LUOSHENG_HTTP_TEST_BACKEND
const capture = process.env.LUOSHENG_REVIEW_CAPTURE
const manual = process.argv.includes('--manual-preview')
const benchmark = process.env.LUOSHENG_BENCHMARK === '1'
const unified = process.env.LUOSHENG_UNIFIED_CHECK === '1'
const voice = JSON.parse(await readFile(new URL('../../docs/plans/luosheng-copy/voice.zh-CN.json', import.meta.url), 'utf8'))
const sourceHint = voice.actionTemplates.source
const missingFindSpot = voice.insufficient.template.replace('{missing}', voice.insufficient.missing.FIND_SPOT)
if (unified) process.env.VITE_GUIDE_UNIFIED_PREVIEW = process.env.LUOSHENG_PREVIEW_MODE === 'model' ? 'model' : 'http'
if (manual && unified && process.env.LUOSHENG_PREVIEW_MODE !== 'model') {
  process.env.VITE_GUIDE_REVIEWED_PREVIEW = 'true'
}
assert.match(target ?? '', /^http:\/\/127\.0\.0\.1:\d+$/)
const manualPort = manual ? Number(process.env.LUOSHENG_MANUAL_PORT ?? 5173) : 0
if (manual) assert.ok(Number.isInteger(manualPort) && manualPort >= 1024 && manualPort <= 65535)

function silentWav() {
  const sampleRate = 8000
  const size = sampleRate * 2 * 15
  const wav = Buffer.alloc(44 + size)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(size, 40)
  return wav
}

async function captureFollowUpReview(browser, base) {
  if (!capture) return
  for (const [width, theme] of [[390, 'dark'], [1440, 'light']]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    try {
      await page.addInitScript(value => localStorage.setItem('heluo.theme', value), theme)
      await page.goto(`${base}/artifacts/heluo-bronze-ding?guide-turn-test=http`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const panel = page.getByRole('region', { name: '洛笙' })
      await panel.getByRole('button', { name: '带我看看', exact: true }).click()
      const question = panel.getByRole('textbox', { name: '问洛笙' })
      await expect(question).toHaveAccessibleDescription('合成资料 · 非实时 AI')
      const source = panel.getByRole('link', { name: '测试出处', exact: true })
      for (const [state, lookpoint] of [['clarify', null], ['ear', '鼎耳'], ['feet', '三足']]) {
        if (lookpoint) await panel.getByRole('button', { name: lookpoint, exact: true }).click()
        await question.fill('那另外一只在哪呢？')
        await question.press('Enter')
        if (lookpoint) {
          await expect(source).toHaveAttribute('href', `https://museum.example.test/${state.toUpperCase()}`)
          await expect(panel.getByRole('button', { name: `看${lookpoint}图版`, exact: true })).toBeVisible()
        } else {
          await expect(panel.getByText('你想看鼎耳、鼎足，还是器身上的纹样？')).toBeVisible()
          await expect(source).toHaveCount(0)
        }
        const plate = panel.locator('img:visible').first()
        await plate.scrollIntoViewIfNeeded()
        await expect.poll(() => plate.evaluate(el => el.naturalWidth)).toBeGreaterThan(0)
        await panel.screenshot({
          path: join(capture, `luosheng-review-${theme}-${state}.png`),
          animations: 'disabled',
          style: '.site-header, .mobile-tab-bar, .skip-link { visibility: hidden !important; }',
        })
      }
    } finally {
      await page.close()
    }
  }
}

async function checkSessionLimit(browser, base) {
  const prefix = '/api/v1/__guide-test'
  for (const [width, theme] of [[390, 'dark'], [1440, 'light']]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    try {
      await page.addInitScript(theme => localStorage.setItem('heluo.theme', theme), theme)
      let posts = 0
      await page.route(`**${prefix}/context`, route => route.continue({ headers: {
        ...route.request().headers(), 'x-guide-test-scenario': 'session-limit',
      } }))
      page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith(prefix + '/')) posts++
      })
      await page.goto(`${base}/artifacts/heluo-bronze-ding?guide-turn-test=http`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const guide = page.getByRole('region', { name: '洛笙' })
      const button = name => guide.getByRole('button', { name, exact: true })
      const input = guide.getByRole('textbox', { name: '问洛笙' })
      const source = guide.getByRole('link', { name: '测试出处' })
      await button('带我看看').click()
      await button('三足').click()
      await button('背视').press('Enter')
      await expect(guide.getByText('背视：可见三足')).toBeVisible()
      for (let turn = 1; turn <= 7; turn++) {
        await input.fill('另一只呢？')
        const [response] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === prefix + '/turns'),
          input.press('Enter'),
        ])
        const { data } = await response.json()
        assert.equal(data.kind, turn <= 6 ? 'EVIDENCE' : 'SESSION_RATE_LIMITED')
        if (turn <= 6) {
          await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
          await expect(button('看三足图版')).toBeVisible()
        }
      }
      await expect(guide.getByRole('status').filter({ hasText: '问得有点快' })).toBeVisible()
      await expect(source).toHaveCount(0)
      await expect(button('看三足图版')).toHaveCount(0)
      await expect(button('还是没看清。')).toHaveCount(0)
      await expect(guide.getByRole('img', { name: '数字模型背面，三只鼎足均可见' })).toBeVisible()
      await button('读三足讲解').press('Enter')
      await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeFocused()
      assert.equal(posts, 14)
      console.log(`Luosheng session limit and reading fallback passed: ${width}px ${theme}`)
    } finally {
      await page.close()
    }
  }
}

async function checkNarration(browser, base) {
  for (const [width, theme] of [[390, 'dark'], [1440, 'light']]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    try {
      await page.addInitScript(theme => {
        localStorage.setItem('heluo.theme', theme)
        const play = HTMLMediaElement.prototype.play
        window.guideMedia = []
        HTMLMediaElement.prototype.play = function () {
          if (this.src.endsWith('/media/guide/luosheng-browser-test.wav')) window.guideMedia.push(this)
          return play.call(this)
        }
      }, theme)
      let loads = 0
      let guidePosts = 0
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().includes('/api/v1/__guide-test/')) guidePosts++
      })
      let fail = false
      const body = silentWav()
      await page.route('**/media/guide/luosheng-browser-test.wav', async route => {
        loads++
        if (fail) await route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' } })
        else await route.fulfill({ body, contentType: 'audio/wav', headers: { 'cache-control': 'no-store' } })
      })
      await page.goto(`${base}/artifacts/heluo-bronze-ding?guide-turn-test=http&guide-audio-test=1`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const guide = page.getByRole('region', { name: '洛笙' })
      const button = name => guide.getByRole('button', { name, exact: true })
      const media = () => page.evaluate(() => window.guideMedia.map(a => ({ paused: a.paused, time: a.currentTime, source: a.hasAttribute('src') })))
      const last = async () => (await media()).at(-1)
      const playing = async () => await expect.poll(async () => {
        const audio = await last()
        return Boolean(audio && !audio.paused && audio.time > 0.05)
      }).toBe(true)
      const released = async () => await expect.poll(last).toMatchObject({ paused: true, source: false })
      await expect(button('试听测试音频')).toHaveCount(0)
      await button('带我看看').click()
      assert.equal(loads, 0)
      assert.deepEqual(await media(), [])
      await button('试听测试音频').press('Enter')
      await playing()
      await button('暂停试听').press('Enter')
      const paused = await last()
      assert.equal(paused.paused, true)
      await button('继续试听').press('Enter')
      await expect.poll(async () => (await last()).time).toBeGreaterThan(paused.time)
      assert.equal(await page.evaluate(() => window.guideMedia[0] === window.guideMedia[1]), true)
      await button('三足').click()
      await released()
      await expect(button('试听测试音频')).toBeVisible()
      await button('试听测试音频').click()
      await playing()
      const input = guide.getByRole('textbox', { name: '问洛笙' })
      await input.fill('三足从哪里看？')
      await input.press('Enter')
      await released()
      await expect(guide.getByRole('link', { name: '测试出处' })).toHaveAttribute('href', 'https://museum.example.test/FEET')
      await button('试听测试音频').click()
      await playing()
      const requestsBefore = guidePosts
      const loadsBefore = loads
      const playsBefore = (await media()).length
      await input.fill('刚才，我没听清楚。')
      await input.press('Enter')
      await released()
      await expect(guide.locator('form').getByRole('status')).toContainText('「三足」这段讲解：从侧面只数到了两只？')
      await expect(guide.getByRole('link', { name: '测试出处' })).toHaveCount(0)
      await expect(button('看三足图版')).toHaveCount(0)
      await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
      assert.equal(guidePosts, requestsBefore)
      assert.equal(loads, loadsBefore)
      assert.equal((await media()).length, playsBefore)
      await button('试听测试音频').click()
      await playing()
      await input.fill('够了，我自己看。')
      await input.press('Enter')
      await released()
      await expect(button('问洛笙')).toBeFocused()
      await button('问洛笙').press('Enter')
      fail = true
      await button('试听测试音频').click()
      await expect(guide.getByText('音频暂不可用，仍可阅读讲解。')).toBeVisible()
      await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
      await released()
      fail = false
      await button('试听测试音频').click()
      await playing()
      await guide.getByRole('link', { name: '去 3D 看三足' }).click()
      await page.waitForURL('**/exhibits/heluo-bronze-ding-3d?guide-turn-test=http')
      await released()
      await expect(button('试听测试音频')).toHaveCount(0)
      console.log(`Luosheng browser narration passed: ${width}px ${theme}`)
    } finally {
      await page.close()
    }
  }
}

const server = await createServer({
  server: { host: '127.0.0.1', port: manualPort, strictPort: manual, proxy: { '/api': target } },
})
try {
  await server.listen()
  const { port } = server.httpServer.address()
  if (unified && !manual) {
    const { checkUnifiedGuide } = await import('./luosheng-unified-check.mjs')
    await checkUnifiedGuide(`http://127.0.0.1:${port}`)
  } else if (manual) {
    const mode = process.env.LUOSHENG_PREVIEW_MODE === 'model' ? 'model' : 'http'
    const base = `http://127.0.0.1:${port}`
    const url = unified ? `${base}/` : `${base}/artifacts/heluo-bronze-ding?guide-turn-test=${mode}#luosheng-preview`
    console.log(`LUOSHENG_MANUAL_URL=${url}`)
    if (process.env.LUOSHENG_PREVIEW_SMOKE === '1') {
      assert.equal(mode, 'model')
      const transport = process.env.LUOSHENG_PREVIEW_TRANSPORT
      assert.ok(transport === 'provider' || transport === 'loopback')
      if (unified) {
        const { checkUnifiedGuide } = await import('./luosheng-unified-check.mjs')
        await checkUnifiedGuide(base)
      } else {
        await checkModelPreview(url, transport)
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000))
    }
  } else {
    await checkBrowser(port)
  }
} finally {
  await server.close()
}

async function checkModelPreview(url, transport) {
  const browser = await chromium.launch({ executablePath: process.env.LUOSHENG_CHROME || undefined })
  try {
    for (const [width, theme] of [[390, 'dark'], [1440, 'light']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      try {
        await page.addInitScript(theme => localStorage.setItem('heluo.theme', theme), theme)
        const home = new URL('/?guide-turn-test=model', url).href
        await page.goto(home)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        const siteGuide = page.getByRole('complementary', { name: '洛笙全站导览' })
        const launch = siteGuide.getByRole('button', { name: '洛笙导览', exact: true })
        await launch.click()
        await expect(siteGuide.getByRole('heading')).toBeFocused()
        const siteQuestion = siteGuide.getByRole('textbox')
        await siteQuestion.fill('怎么预约参观？')
        await siteQuestion.press('Enter')
        await expect(page).toHaveURL(home)
        await siteGuide.getByRole('link', { name: '预约参观', exact: true }).click()
        await expect(page).toHaveURL(/\/appointment$/)
        await launch.click()
        await expect(siteGuide.getByRole('status')).toContainText('选日期和可用时段')
        await page.keyboard.press('Escape')
        await expect(launch).toBeFocused()
        await page.goto(home)
        await launch.click()
        const panel = siteGuide.locator('.site-guide-panel')
        const panelBounds = await panel.boundingBox()
        assert.ok(panelBounds && panelBounds.x >= 0 && panelBounds.x + panelBounds.width <= width)
        const opposite = theme === 'dark' ? 'light' : 'dark'
        await page.getByRole('button', { name: theme === 'dark' ? '切换到浅色模式' : '切换到深色模式' }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', opposite)
        await expect(panel).toHaveCSS('background-color', opposite === 'dark' ? 'rgb(36, 35, 33)' : 'rgb(250, 248, 242)')
        await page.getByRole('button', { name: opposite === 'dark' ? '切换到浅色模式' : '切换到深色模式' }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await siteGuide.getByRole('button', { name: '带我逛馆' }).click()
        for (const [station, label, path] of [
          [1, '探索馆藏', '/explore'],
          [2, '数字展厅', '/exhibits'],
          [3, '河洛青铜鼎', '/artifacts/heluo-bronze-ding'],
        ]) {
          await siteGuide.getByRole('link', { name: new RegExp(`(?:第一站|下一站)：${label}`) }).click()
          await expect(page).toHaveURL(current => current.pathname === path)
          await siteGuide.getByRole('button', { name: '继续导览' }).click()
          await expect(siteGuide.getByRole('status').first()).toContainText(`已到达第 ${station} / 3 站`)
        }
        await expect(page).toHaveURL(url)
        await page.keyboard.press('Escape')
        const guide = page.getByRole('region', { name: '洛笙', exact: true })
        await guide.getByRole('button', { name: '带我看看', exact: true }).click()
        const input = guide.getByRole('textbox', { name: '问洛笙', exact: true })
        await expect(input).toHaveCSS('background-color', theme === 'dark' ? 'rgb(42, 44, 41)' : 'rgb(252, 250, 245)')
        await expect(guide.locator('.guide-dialogue')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(25, 30, 29)' : 'rgb(238, 242, 235)')
        let turnRequests = 0
        page.on('request', request => {
          if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/__guide-test/turns') {
            turnRequests++
          }
        })
        async function ask(question) {
          await input.fill(question)
          await input.press('Enter')
        }
        await ask('介绍一下自己')
        await expect(guide.getByText('你好，我是洛笙，河洛数字博物馆的 AI 向导。', { exact: false })).toBeVisible()
        await ask('你好，洛笙，你能做什么？')
        await expect(guide.getByText('我们可以先找鼎口两侧的鼎耳', { exact: false })).toBeVisible()
        assert.equal(turnRequests, 0)
        await ask('你是什么模型？')
        await expect(guide.getByRole('status')).toContainText(
          transport === 'loopback' ? '当前展品问答配置的模型是 stub' : '当前展品问答配置的模型是',
        )
        await expect(guide.getByText('AI 实时回答')).toHaveCount(0)
        const review = guide.getByText('回看问答（2）', { exact: true })
        await review.click()
        await expect(guide.locator('.guide-review dd').first()).toContainText('你好，我是洛笙')
        await review.click()
        await ask('另一只呢？')
        await expect(guide.getByText('你想看鼎耳、鼎足，还是器身上的纹样？')).toBeVisible()
        const evidence = guide.getByRole('group', { name: '回答依据' })
        const generated = guide.getByText('AI 实时回答', { exact: true })
        const answer = guide.locator('.guide-dialogue [role="status"] > p').first()
        for (const [stop, question, stubText, observation] of [
          ['鼎耳', '换个角度会更好辨认吗？', '协议测试：承接鼎耳', /俯视|从上/],
          ['三足', '另一只呢？', '协议测试：承接三足', /挡住|遮挡|背面|背视/],
        ]) {
          await guide.getByRole('button', { name: stop, exact: true }).click()
          await expect(guide.locator('.guide-review')).toHaveCount(0)
          await expect(guide.getByText(`当前看点 · ${stop}`, { exact: true })).toBeVisible()
          const started = performance.now()
          await ask(question)
          await expect(generated).toBeVisible({ timeout: 16_000 })
          await expect(evidence.getByRole('button', { name: `${stop}图版` })).toBeVisible()
          if (transport === 'provider') {
            await expect(answer).toContainText(observation)
            console.log(`Luosheng provider reply ${width}px ${theme} ${stop} ${Math.round(performance.now() - started)}ms: ${JSON.stringify(await answer.innerText())}`)
          } else {
            await expect(answer).toHaveText(stubText)
          }
        }
        await ask('依据是什么？')
        await expect(evidence.getByRole('button', { name: '三足图版' })).toBeVisible()
        await expect(guide.getByText('AI 实时回答')).toHaveCount(0)
        await ask('是谁铸造它的？')
        await expect(guide.getByText('我手边的展品资料还回答不了这个问题。', { exact: false }))
          .toBeVisible({ timeout: 16_000 })
        await expect(evidence).toHaveCount(0)
        const referenceQuestion = theme === 'dark' ? '介绍一下这件鼎' : '材质和尺寸是什么？'
        await ask(referenceQuestion)
        await expect(generated).toBeVisible({ timeout: 16_000 })
        await expect(answer).toContainText(theme === 'dark' ? /数字模型|数字展品/ : /24[.．]5/)
        await expect(guide.getByText('克利夫兰馆藏记录 · 1962.281', { exact: false })).toBeVisible()
        await expect(guide.getByRole('link', { name: '克利夫兰馆藏记录' })).toHaveCount(0)
        const horizontalOverflow = await guide.locator('.guide-dialogue').evaluate(element => element.scrollWidth > element.clientWidth + 1)
        assert.equal(horizontalOverflow, false)
        console.log(`Luosheng model preview passed (${transport} transport): ${width}px ${theme}`)
      } catch (error) {
        console.error(error)
        throw error
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
}

async function checkBrowser(port) {
  const browser = await chromium.launch({
    executablePath: process.env.LUOSHENG_CHROME || undefined,
    args: ['--enable-unsafe-swiftshader'],
  })
  try {
    if (benchmark) {
      for (const [width, theme, network] of [
        [390, 'dark', 'loopback'], [1440, 'light', 'loopback'],
        [390, 'dark', 'api-delay-180ms'], [1440, 'light', 'api-delay-180ms'],
        [390, 'dark', 'cellular-3mbps'], [1440, 'light', 'cellular-3mbps'],
      ]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
        try {
          await page.addInitScript(value => localStorage.setItem('heluo.theme', value), theme)
          await page.goto(`http://127.0.0.1:${port}/artifacts/heluo-bronze-ding?guide-turn-test=http`)
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
          const panel = page.getByRole('region', { name: '洛笙' })
          const button = name => panel.getByRole('button', { name, exact: true })
          const field = panel.getByRole('textbox', { name: '问洛笙' })
          const source = panel.getByRole('link', { name: '测试出处', exact: true })
          await button('带我看看').click()
          if (network === 'cellular-3mbps') {
            const cdp = await page.context().newCDPSession(page)
            await cdp.send('Network.enable')
            await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
            await cdp.send('Network.emulateNetworkConditions', {
              offline: false, latency: 180, downloadThroughput: 375_000,
              uploadThroughput: 93_750, connectionType: 'cellular4g',
            })
          }
          if (network === 'api-delay-180ms') {
            await page.route(/\/api\/v1\/__guide-test\/(?:context|turns)$/, async route => {
              await new Promise(resolve => setTimeout(resolve, 180))
              await route.continue()
            })
          }
          const durations = []
          for (let i = 0; i <= 15; i++) {
            const [label, id, body] = i % 2
              ? ['鼎耳', 'EAR', 'Synthetic ear observation']
              : ['三足', 'FEET', 'Synthetic foot observation']
            await button(label).click()
            await expect(source).toHaveCount(0)
            await field.fill('那另外一只在哪呢？')
            const started = performance.now()
            await field.press('Enter')
            await expect(panel.getByText(body, { exact: true })).toBeVisible()
            await expect(source).toHaveAttribute('href', `https://museum.example.test/${id}`)
            await expect(source).toBeVisible()
            if (i > 0) durations.push(performance.now() - started)
          }
          durations.sort((a, b) => a - b)
          const percentile = rank => Math.round(durations[Math.ceil(rank * durations.length) - 1])
          console.log('LUOSHENG_BENCHMARK ' + JSON.stringify({
            width, theme, network, samples: durations.length, p50Ms: percentile(0.5),
            p95Ms: percentile(0.95), maxMs: percentile(1),
          }))
        } finally {
          await page.close()
        }
      }
    }
    for (const theme of ['light', 'dark']) {
      const platePage = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' })
      try {
        await platePage.addInitScript(value => localStorage.setItem('heluo.theme', value), theme)
        const modelRequests = []
        platePage.on('request', request => {
          if (/\.glb(?:[?#]|$)/i.test(request.url())) modelRequests.push(request.url())
        })
        const url = `http://127.0.0.1:${port}/artifacts/heluo-bronze-ding?guide-turn-test=http`
        await platePage.goto(url)
        await expect(platePage.locator('html')).toHaveAttribute('data-theme', theme)
        const panel = platePage.getByRole('region', { name: '洛笙' })
        const turns = []
        platePage.on('request', request => {
          if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/turns')) {
            turns.push(request.postDataJSON().question)
          }
        })
        await expect(panel.getByRole('textbox', { name: '问洛笙' })).toHaveCount(0)
        await panel.getByRole('button', { name: '带我看看' }).click()
        const question = panel.getByRole('textbox', { name: '问洛笙' })
        await expect(question).toHaveAccessibleDescription('合成资料 · 非实时 AI')
        assert.deepEqual(turns, [])
        const suggestions = panel.getByRole('group', { name: '推荐问题' })
        await suggestions.getByRole('button', { name: '三足从哪里看？' }).click()
        const action = panel.getByRole('button', { name: '看三足图版' })
        const followUp = panel.getByRole('button', { name: '还是没看清。', exact: true })
        await expect(action).toBeVisible()
        await expect(followUp).toBeVisible()
        assert.deepEqual(turns, ['三足从哪里看？'])
        await followUp.press('Enter')
        await expect(action).toBeVisible()
        await expect(question).toBeFocused()
        await expect(panel.getByRole('link', { name: '测试出处' })).toHaveAttribute('href', 'https://museum.example.test/FEET')
        await expect(panel.getByRole('heading', { name: '找一找鼎耳' })).toBeVisible()
        const [actionRect, panelRect] = await Promise.all([action.boundingBox(), panel.boundingBox()])
        assert(actionRect && panelRect && actionRect.height >= 44
          && actionRect.x >= panelRect.x && actionRect.x + actionRect.width <= panelRect.x + panelRect.width)
        await action.press('Enter')
        await expect(panel.getByRole('heading', { name: '数一数鼎足' })).toBeFocused()
        await expect(panel.getByText('侧视：可见两足')).toBeVisible()
        const side = panel.getByRole('img', { name: '数字模型侧面，只有两只鼎足清晰可见' })
        await side.scrollIntoViewIfNeeded()
        await expect.poll(() => side.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
        const rearView = panel.getByRole('button', { name: '背视', exact: true })
        await rearView.press('Enter')
        await expect(rearView).toHaveAttribute('aria-pressed', 'true')
        await expect(panel.getByText('背视：可见三足')).toBeVisible()
        const rear = panel.getByRole('img', { name: '数字模型背面，三只鼎足均可见' })
        await rear.scrollIntoViewIfNeeded()
        await expect.poll(() => rear.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
        await expect(panel.getByRole('link', { name: '测试出处' })).toHaveAttribute('href', 'https://museum.example.test/FEET')
        await suggestions.getByRole('button', { name: '这些纹样象征什么？' }).press('Enter')
        await expect(panel.getByText(/无法判断纹样的寓意/)).toBeVisible()
        await expect(panel.getByRole('link', { name: '测试出处' })).toHaveAttribute('href', 'https://museum.example.test/MOTIF')
        await expect(panel.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
        await question.fill('我还是看不太清楚。')
        const tabs = platePage.locator('.mobile-tab-bar')
        await expect(tabs).toBeVisible()
        await question.evaluate(input => {
          const navTop = document.querySelector('.mobile-tab-bar').getBoundingClientRect().top
          window.scrollBy({ top: input.getBoundingClientRect().bottom - navTop + 20, behavior: 'instant' })
        })
        const inputBottomBefore = (await question.boundingBox()).y + (await question.boundingBox()).height
        const tabsTop = (await tabs.boundingBox()).y
        assert(inputBottomBefore >= tabsTop - 40 && inputBottomBefore < tabsTop)
        await question.press('Enter')
        await expect(panel.getByRole('link', { name: '测试出处' })).toHaveAttribute('href', 'https://museum.example.test/MOTIF')
        await expect(question).toBeFocused()
        const reply = await panel.locator('form [role="status"]').boundingBox()
        assert(reply && reply.y >= 0 && reply.y + reply.height <= (await tabs.boundingBox()).y)
        await expect(panel.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
        await panel.getByRole('button', { name: '看纹样图版' }).press('Enter')
        await expect(panel.getByRole('heading', { name: '沿着鼎腹纹样看' })).toBeFocused()
        const motif = panel.getByRole('img', { name: /数字模型鼎腹局部/ })
        await motif.scrollIntoViewIfNeeded()
        await expect.poll(() => motif.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
        await question.fill('你怎么知道的？')
        await question.press('Enter')
        await expect(panel.getByText(sourceHint, { exact: true })).toBeVisible()
        await expect(panel.getByRole('link', { name: '测试出处' })).toHaveAttribute('href', 'https://museum.example.test/MOTIF')
        await expect(panel.getByRole('button', { name: '看纹样图版' })).toHaveCount(0)
        await expect(panel.getByRole('heading', { name: '沿着鼎腹纹样看' })).toBeVisible()
        assert.equal(platePage.url(), url)
        assert.deepEqual(modelRequests, [])
        assert.deepEqual(turns, ['三足从哪里看？', '还是没看清。', '这些纹样象征什么？', '我还是看不太清楚。', '你怎么知道的？'])
        if (capture) {
          const exchange = panel.locator('form')
          await exchange.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
          await exchange.screenshot({ path: join(capture, `luosheng-follow-up-exchange-${theme}.png`), animations: 'disabled' })
        }
      } finally {
        await platePage.close()
      }
    }
    await checkNarration(browser, `http://127.0.0.1:${port}`)
    await checkSessionLimit(browser, `http://127.0.0.1:${port}`)
    await captureFollowUpReview(browser, `http://127.0.0.1:${port}`)
    for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
      const pointsPage = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
      const timings = {}
      try {
        await pointsPage.addInitScript(value => localStorage.setItem('heluo.theme', value), theme)
        // Record viewer state changes without polling or modifying the renderer.
        await pointsPage.addInitScript(() => {
          const transitions = window.pointCloudTestTransitions = []
          new MutationObserver(records => {
            for (const record of records) {
              if (transitions.length >= 30 || !record.target.closest('.exhibit-viewer-wrap')) continue
              transitions.push({
                ms: Math.round(performance.now()),
                at: Date.now(),
                attribute: record.attributeName,
                from: record.oldValue,
                to: record.target.getAttribute(record.attributeName),
              })
            }
          }).observe(document, { subtree: true, attributes: true, attributeOldValue: true,
            attributeFilter: ['data-quality', 'data-viewer-state', 'data-point-cloud-state', 'data-render-state'] })
        })
        if (width === 390) await pointsPage.route(/\.glb(?:[?#]|$)/i, route => route.abort())
        let posts = 0
        pointsPage.on('request', request => {
          if (request.method() === 'POST' && request.url().includes('/api/v1/__guide-test/')) posts++
        })
        await pointsPage.goto(`http://127.0.0.1:${port}/exhibits/heluo-bronze-ding-3d?guide-turn-test=http`)
        await expect(pointsPage.locator('html')).toHaveAttribute('data-theme', theme)
        const guide = pointsPage.getByRole('region', { name: '洛笙' })
        await guide.getByRole('button', { name: '带我看看' }).click()
        const input = guide.getByRole('textbox', { name: '问洛笙' })
        const action = guide.getByRole('button', { name: '以点云观察' })
        const viewer = pointsPage.locator('.exhibit-viewer-wrap')
        const start = viewer.locator('.viewer-poster-start')
        if (await start.isVisible()) await start.click()
        await expect(viewer).toHaveAttribute('data-viewer-state', width === 390 ? 'error' : 'ready', { timeout: 30_000 })
        timings.viewer = Date.now()
        const canvas = viewer.locator('canvas')
        const host = viewer.locator('[data-point-cloud-state]')
        let solid
        if (width === 1440) {
          timings.screenshotStart = Date.now()
          solid = await canvas.screenshot()
          timings.screenshotEnd = Date.now()
          // A visitor reads the guide below the viewer. Pause offscreen rendering
          // before asking, instead of taking a baseline screenshot mid-interaction.
          await pointsPage.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
          await expect(host).toHaveAttribute('data-render-state', 'paused-offscreen')
        }
        await input.fill('我想看点云。')
        await input.press('Enter')
        await expect(guide.getByText(/不是文物表面的真实颗粒/)).toBeVisible()
        if (width === 390) {
          await expect(action).toHaveCount(0)
          await expect(guide.getByText('当前不能切换点云，仍可查看图版和文字讲解。')).toBeVisible()
          await expect(guide.getByRole('heading', { name: '找一找鼎耳' })).toBeVisible()
        } else {
          const modes = pointsPage.getByRole('group', { name: '展品显示模式' })
          await expect(modes).toHaveAttribute('data-mode', 'solid')
          await expect(host).toHaveAttribute('data-point-cloud-state', 'idle')
          const [buttonRect, guideRect] = await Promise.all([action.boundingBox(), guide.boundingBox()])
          assert(buttonRect && guideRect && buttonRect.x >= guideRect.x
            && buttonRect.x + buttonRect.width <= guideRect.x + guideRect.width)
          timings.focusStart = Date.now()
          await action.evaluate(button => button.focus({ preventScroll: true }))
          await expect(action).toBeFocused()
          timings.confirm = Date.now()
          await pointsPage.keyboard.press('Enter')
          await expect(host).toHaveAttribute('data-point-cloud-state', /loading|ready/)
          await expect(host).toHaveAttribute('data-render-state', 'paused-offscreen')
          try {
            await expect(host).toHaveAttribute('data-point-cloud-state', 'ready', { timeout: 40_000 })
          } catch (error) {
            console.error('Point cloud progress:', await host.evaluate(element => ({ ...element.dataset })))
            throw error
          }
          await expect(modes).toHaveAttribute('data-mode', 'points', { timeout: 30_000 })
          await expect(guide.getByText('点云已开启。')).toBeVisible()
          await canvas.scrollIntoViewIfNeeded()
          await expect(host).toHaveAttribute('data-render-state', 'running')
          assert.notDeepEqual(await canvas.screenshot(), solid)
        }
        assert.equal(posts, 0)
        console.log(`Luosheng point cloud confirmation passed: ${width}px ${theme}`)
      } catch (error) {
        const viewerTransitions = await pointsPage.evaluate(() => window.pointCloudTestTransitions).catch(() => null)
        console.error(`Point cloud viewer transitions (${width}px ${theme}): ${JSON.stringify(viewerTransitions)}`)
        console.error(`Point cloud test timings (${width}px ${theme}): ${JSON.stringify(timings)}`)
        throw error
      } finally {
        await pointsPage.close()
      }
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' })
    page.setDefaultTimeout(5000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const path = '/artifacts/heluo-bronze-ding?guide-turn-test=http'
    const guide = page.getByRole('region', { name: '洛笙' })
    const button = name => guide.getByRole('button', { name, exact: true })
    const input = guide.getByRole('textbox', { name: '问洛笙' })
    const source = guide.getByRole('link', { name: '测试出处' })
    await page.goto(`http://127.0.0.1:${port}${path}`)
    await button('带我看看').click()
    const spokenFollowUp = '那另外一只在哪呢？'
    await input.fill(spokenFollowUp)
    const send = () => button('发送').click()
    await send()
    await expect(guide.getByText('你想看鼎耳、鼎足，还是器身上的纹样？')).toBeVisible()
    await expect(button('看鼎耳图版')).toHaveCount(0)
    await expect(button('还是没看清。')).toHaveCount(0)
    await button('鼎耳').click()
    await input.fill('鼎耳在哪里？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/EAR')
    await input.fill(spokenFollowUp)
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/EAR')
    await input.fill('三足从哪里看？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await input.fill(spokenFollowUp)
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await expect(button('鼎耳')).toHaveAttribute('aria-pressed', 'true')
    const reselectRequests = []
    const trackReselect = request => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/__guide-test/')) reselectRequests.push(request.url())
    }
    page.on('request', trackReselect)
    try {
      await button('鼎耳').press('Enter')
      await expect(source).toHaveCount(0)
      await expect(button('看三足图版')).toHaveCount(0)
      assert.deepEqual(reselectRequests, [])
    } finally {
      page.off('request', trackReselect)
    }
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/EAR')
    await button('结束讲解').click()
    await button('问洛笙').click()
    await input.fill('另一只呢？')
    await send()
    await expect(guide.getByText('你想看鼎耳、鼎足，还是器身上的纹样？')).toBeVisible()
    await button('鼎耳').click()
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/EAR')
    await button('三足').click()
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await input.fill('联调：鼎耳生成器不可用')
    await send()
    await expect(guide.getByText('模拟问答暂不可用，仍可阅读当前看点的讲解。')).toBeVisible()
    await expect(source).toHaveCount(0)
    await expect(guide.getByRole('link', { name: '去 3D 看三足' })).toBeVisible()
    const turnsPath = '/api/v1/__guide-test/turns'
    const serverTimeoutQuestion = '联调：鼎耳生成超时'
    let serverTimeoutRequests = 0
    const countTimeoutTurns = request => {
      if (new URL(request.url()).pathname === turnsPath) serverTimeoutRequests++
    }
    await input.fill('另一只呢？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    page.on('request', countTimeoutTurns)
    try {
      await input.fill(serverTimeoutQuestion)
      const [timedOut] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === turnsPath
          && response.request().postDataJSON()?.question === serverTimeoutQuestion, { timeout: 10_000 }),
        send(),
      ])
      assert.equal((await timedOut.json()).data.kind, 'GENERATION_TIMEOUT')
      await expect(guide.getByText('这次模拟问答超时了，仍可阅读当前看点的讲解。')).toBeVisible()
      await expect(source).toHaveCount(0)
      await expect(button('看三足图版')).toHaveCount(0)
      await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
      await input.fill('另一只呢？')
      await send()
      await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
      assert.equal(serverTimeoutRequests, 2)
    } finally {
      page.off('request', countTimeoutTurns)
    }
    await input.fill('材质检测做过吗？')
    await send()
    await expect(guide.getByText('测试资料不足，暂时无法回答。')).toBeVisible()
    await expect(button('看三足图版')).toHaveCount(0)
    await input.fill('另一只呢？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await input.fill('你确定它是什么时候做的？')
    await send()
    await expect(guide.getByText('现有测试资料的说法不一致，暂时不能确认。')).toBeVisible()
    await expect(source).toHaveCount(0)
    await expect(guide.getByRole('button', { name: /^看.*图版$/ })).toHaveCount(0)
    await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
    await input.fill('另一只呢？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await input.fill('三足的这件鼎是在洛阳出土的吗？')
    await send()
    await expect(guide.getByText(`${missingFindSpot} ${sourceHint}`, { exact: true })).toBeVisible()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/SOURCE')
    await expect(button('看三足图版')).toHaveCount(0)
    for (const question of ['这是实物拍的照片吗？', '这就是原器真实颜色吧？']) {
      await input.fill(question)
      await send()
      await expect(guide.getByText('Synthetic reference record', { exact: true })).toBeVisible()
      await expect(source).toHaveAttribute('href', 'https://museum.example.test/SOURCE')
      await expect(button('看三足图版')).toHaveCount(0)
      await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
    }
    await input.fill('你怎么知道的？')
    await send()
    await expect(guide.getByText(sourceHint, { exact: true })).toBeVisible()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/SOURCE')
    await expect(button('看三足图版')).toHaveCount(0)
    await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
    await input.fill('另一只呢？')

    const slowRoute = '**/api/v1/__guide-test/turns'
    let slowRequests = 0
    const countSlowTurn = request => {
      if (new URL(request.url()).pathname === turnsPath) slowRequests++
    }
    await page.evaluate(path => {
      const fetch = window.fetch
      const release = Promise.withResolvers()
      window.releaseSlowGuideReply = release.resolve
      window.fetch = async (resource, init) => {
        if (new URL(resource, location.href).pathname !== path) return fetch(resource, init)
        window.fetch = fetch
        const response = await fetch(resource, init)
        return new Promise((resolve, reject) => {
          const signal = init.signal
          signal.throwIfAborted()
          const onAbort = () => reject(signal.reason)
          signal.addEventListener('abort', onAbort, { once: true })
          release.promise.then(() => {
            signal.removeEventListener('abort', onAbort)
            resolve(response)
          })
        })
      }
    }, turnsPath)
    page.on('request', countSlowTurn)
    try {
      await send()
      await expect(guide.getByText('正在查找相关资料…')).toBeVisible()
      await expect(guide.getByText('模拟问答暂不可用，仍可阅读当前看点的讲解。')).toBeVisible({ timeout: 12_000 })
      await expect(source).toHaveCount(0)
      await expect(button('看三足图版')).toHaveCount(0)
      await expect(guide.getByRole('link', { name: '去 3D 看三足' })).toBeVisible()
      assert.equal(slowRequests, 1)
    } finally {
      page.off('request', countSlowTurn)
      await page.evaluate(() => window.releaseSlowGuideReply())
    }
    await expect(guide.getByText('模拟问答暂不可用，仍可阅读当前看点的讲解。')).toBeVisible()
    await expect(source).toHaveCount(0)
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')

    async function verifyLateResponse(change) {
      const pattern = '**/api/v1/__guide-test/turns'
      let release
      let fetched
      let failed
      let finished
      const hold = new Promise(resolve => { release = resolve })
      const ready = new Promise(resolve => { fetched = resolve })
      const settled = new Promise(resolve => { finished = resolve })
      const handler = async route => {
        try {
          const response = await route.fetch()
          fetched(await response.json())
          await hold
          await route.fulfill({ response }).catch(() => {}) // the page may have already aborted
        } catch (error) {
          failed = error
          fetched(null)
        } finally {
          finished()
        }
      }
      try {
        await page.route(pattern, handler)
        await send()
        assert.equal((await ready)?.data?.text, 'Synthetic foot observation')
        await change()
      } finally {
        release()
        await settled
        await page.unroute(pattern, handler)
      }
      assert.equal(failed, undefined)
      await expect(source).toHaveCount(0)
      await expect(guide.getByText('Synthetic foot observation')).toHaveCount(0)
    }

    let turnRequests = 0
    page.on('request', request => {
      if (request.url().includes('/api/v1/__guide-test/')) turnRequests++
    })
    await verifyLateResponse(async () => {
      const beforeStop = turnRequests
      await input.fill('够了，我自己看。')
      await input.press('Enter')
      await expect(button('问洛笙')).toBeFocused()
      await expect(button('带我看看')).toHaveCount(0)
      await expect(input).toHaveCount(0)
      assert.equal(turnRequests, beforeStop)
    })
    await button('问洛笙').click()
    await expect(source).toHaveCount(0)
    await expect(input).toHaveValue('')
    await input.fill('怎么结束讲解？')
    await send()
    await expect(guide.getByText('测试资料不足，暂时无法回答。')).toBeVisible()
    await button('三足').click()
    await input.fill('另一只呢？')

    await verifyLateResponse(() => button('鼎耳').click())
    await button('三足').click()
    await verifyLateResponse(async () => {
      await guide.getByRole('link', { name: '去 3D 看三足' }).click()
      await page.waitForURL('**/exhibits/heluo-bronze-ding-3d?guide-turn-test=http')
    })
    await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(source).toHaveCount(0)
    await input.fill('另一只呢？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await button('纹样').click()
    const beforeReturn = turnRequests
    await guide.getByRole('link', { name: '回到藏品展签' }).click()
    await page.waitForURL('**' + path + '#luosheng-preview')
    await expect(button('问洛笙')).toBeFocused()
    await expect(input).toHaveCount(0)
    assert.equal(turnRequests, beforeReturn)
    await button('问洛笙').press('Enter')
    await expect(guide.getByRole('heading', { name: '沿着鼎腹纹样看' })).toBeVisible()
    await input.fill('还是没看清。')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/MOTIF')
    await page.reload()
    await button('问洛笙').click()
    await expect(guide.getByRole('heading', { name: '找一找鼎耳' })).toBeVisible()
    await input.fill('另一只呢？')
    await send()
    await expect(guide.getByText('你想看鼎耳、鼎足，还是器身上的纹样？')).toBeVisible()
    await expect(source).toHaveCount(0)
    await input.fill('鼎耳和三足分别怎么观察？')
    await send()
    await expect(guide.getByText('Synthetic ear observation Synthetic foot observation', { exact: true })).toBeVisible()
    const pairedSources = guide.getByRole('link', { name: /^测试出处 [12]$/ })
    await expect(pairedSources).toHaveCount(2)
    const links = await pairedSources.evaluateAll(items => items.map(item => item.href))
    assert.deepEqual([...links].sort(), ['https://museum.example.test/EAR', 'https://museum.example.test/FEET'])
    await expect(guide.getByRole('button', { name: /^看.*图版$/ })).toHaveCount(0)
    await input.fill('你怎么知道的？')
    await send()
    await expect(guide.getByText(sourceHint, { exact: true })).toBeVisible()
    assert.deepEqual(await pairedSources.evaluateAll(items => items.map(item => item.href)), links)
    await input.fill('材质检测做过吗？')
    await send()
    await expect(guide.getByText('测试资料不足，暂时无法回答。')).toBeVisible()
    await expect(pairedSources).toHaveCount(0)
    await input.fill('你怎么知道的？')
    await send()
    await expect(guide.getByText('测试资料不足，暂时无法回答。')).toBeVisible()
    await expect(pairedSources).toHaveCount(0)
    await expect(source).toHaveCount(0)
    const quotaTurns = []
    await page.route(slowRoute, route => {
      const request = route.request()
      quotaTurns.push(request.postDataJSON().question)
      return route.continue({ headers: { ...request.headers(), 'x-guide-test-scenario': 'single-attempt' } })
    })
    await button('三足').click()
    await input.fill('三足从哪里看？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await expect(button('看三足图版')).toBeVisible()
    const quotaQuestion = '还是没看清。'
    await input.fill(quotaQuestion)
    const [quotaResponse] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === turnsPath
        && response.request().postDataJSON()?.question === quotaQuestion),
      send(),
    ])
    assert.equal((await quotaResponse.json()).data.kind, 'GENERATION_LIMIT_REACHED')
    await expect(guide.getByText('今天的模拟问答次数已用完，仍可阅读当前看点的讲解。')).toBeVisible()
    await expect(source).toHaveCount(0)
    await expect(button('看三足图版')).toHaveCount(0)
    await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
    await expect(guide.getByRole('link', { name: '去 3D 看三足' })).toBeVisible()
    const beforeReading = turnRequests
    await button('读三足讲解').press('Enter')
    await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeFocused()
    assert.equal(turnRequests, beforeReading)
    const provenanceQuestion = '这是实物拍的照片吗？'
    await input.fill(provenanceQuestion)
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/SOURCE')
    assert.deepEqual(quotaTurns, ['三足从哪里看？', quotaQuestion, provenanceQuestion])
    await page.unroute(slowRoute)

    await input.fill('三足从哪里看？')
    await send()
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    await expect(button('看三足图版')).toBeVisible()
    await button('背视').press('Enter')
    await expect(guide.getByText('背视：可见三足')).toBeVisible()
    const beforeDisabled = turnRequests
    const disabled = route => route.continue({ headers: {
      ...route.request().headers(), 'x-guide-test-scenario': 'questioning-disabled',
    } })
    await page.route(slowRoute, disabled)
    try {
      await input.fill('还是没看清。')
      const [disabledResponse] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === turnsPath),
        send(),
      ])
      assert.equal((await disabledResponse.json()).data.kind, 'QUESTIONING_DISABLED')
      await expect(guide.getByRole('status').filter({ hasText: '自由问答已暂停' })).toContainText('图版和展签讲解仍可查看')
      await expect(button('还是没看清。')).toHaveCount(0)
      await expect(source).toHaveCount(0)
      await expect(button('看三足图版')).toHaveCount(0)
      await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeVisible()
      await expect(guide.getByRole('img', { name: '数字模型背面，三只鼎足均可见' })).toBeVisible()
      await button('读三足讲解').press('Enter')
      await expect(guide.getByRole('heading', { name: '数一数鼎足' })).toBeFocused()
      const preset = guide.getByText('只看见两足，是不是少了一足？', { exact: true })
      await preset.click()
      await expect(guide.getByText('不是这么数的。', { exact: false })).toBeVisible()
      // One explicit submission posts context and then the question.
      assert.equal(turnRequests, beforeDisabled + 2)
    } finally {
      await page.unroute(slowRoute, disabled)
    }
    await input.fill('还是没看清。')
    await input.press('Enter')
    await expect(source).toHaveAttribute('href', 'https://museum.example.test/FEET')
    assert.equal(turnRequests, beforeDisabled + 4)
    assert.deepEqual(errors, [])
    console.log('Luosheng browser HTTP: context, citations, switch and leave passed')
  } finally {
    await browser.close()
  }
}
