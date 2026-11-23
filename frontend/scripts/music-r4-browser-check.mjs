import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.MUSIC_R4_BASE_URL || 'http://127.0.0.1:4198'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname), 'This check is for the local candidate/Docker only.')
const output = fileURLToPath(new URL('../../artifacts/music-r4-integration-2026-11-23/' + new URL(baseURL).port + '-' + Date.now() + '/', import.meta.url))
await mkdir(output, { recursive: true })
const prefix = '/media/audio/music-r4/'
const report = {
  checkedAt: new Date().toISOString(),
  baseURL,
  passed: false,
  checks: [],
  snapshots: [],
  errors: [],
  writes: [],
  requests: [],
  limitations: [
    'Real local backend reads and native AAC (.m4a) playback; no backend writes, subjective listening, or physical-device verification.',
    'Headless Chromium keeps tabs visible: hidden/resume uses an injected visibilitychange lifecycle.',
  ],
}

function installAudioObserver({ theme, locale }) {
  localStorage.setItem('heluo.theme', theme)
  localStorage.setItem('heluo-theme', theme)
  localStorage.setItem('heluo.locale', locale)
  const media = []
  const mediaIds = new WeakMap()
  const nodes = []
  const nodeIds = new WeakMap()
  const edges = new Map()
  const sourceMedia = new Map()
  const events = []
  const log = (event, detail = {}) => {
    events.push({ event, at: performance.now(), ...detail })
    if (events.length > 1500) events.shift()
  }
  const rememberMedia = (element) => {
    if (!(element instanceof HTMLAudioElement)) return null
    if (!mediaIds.has(element)) {
      const id = media.length + 1
      mediaIds.set(element, id)
      media.push(element)
      for (const event of ['play', 'playing', 'pause', 'ended', 'emptied', 'error']) {
        element.addEventListener(event, () => log(event, { id, src: element.currentSrc || element.src, currentTime: element.currentTime }))
      }
    }
    return mediaIds.get(element)
  }
  const rememberNode = (node) => {
    if (!nodeIds.has(node)) {
      const id = nodes.length + 1
      nodeIds.set(node, id)
      nodes.push(node)
    }
    return nodeIds.get(node)
  }
  const originalCreate = document.createElement
  document.createElement = function (...args) {
    const element = Reflect.apply(originalCreate, this, args)
    rememberMedia(element)
    return element
  }
  const NativeAudio = window.Audio
  window.Audio = new Proxy(NativeAudio, {
    construct(target, args) {
      const element = Reflect.construct(target, args)
      rememberMedia(element)
      return element
    },
  })
  const originalPlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    const id = rememberMedia(this)
    log('play-call', { id, src: this.currentSrc || this.src })
    const promise = Reflect.apply(originalPlay, this, args)
    promise?.then(() => log('play-resolved', { id }), (error) => log('play-rejected', { id, error: error.name }))
    return promise
  }
  const originalConnect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (...args) {
    const result = Reflect.apply(originalConnect, this, args)
    if (args[0] instanceof AudioNode) {
      const source = rememberNode(this)
      const destination = rememberNode(args[0])
      if (!edges.has(source)) edges.set(source, new Set())
      edges.get(source).add(destination)
    }
    return result
  }
  const originalDisconnect = AudioNode.prototype.disconnect
  AudioNode.prototype.disconnect = function (...args) {
    const result = Reflect.apply(originalDisconnect, this, args)
    const id = nodeIds.get(this)
    if (args[0] instanceof AudioNode) edges.get(id)?.delete(nodeIds.get(args[0]))
    else edges.delete(id)
    return result
  }
  const originalSource = AudioContext.prototype.createMediaElementSource
  AudioContext.prototype.createMediaElementSource = function (element) {
    const node = Reflect.apply(originalSource, this, [element])
    sourceMedia.set(rememberNode(node), rememberMedia(element))
    return node
  }
  const pathsFrom = (id, gains = [], seen = new Set()) => {
    if (seen.has(id)) return []
    const node = nodes[id - 1]
    const nextSeen = new Set(seen).add(id)
    const nextGains = node instanceof GainNode ? [...gains, node.gain.value] : gains
    if (node instanceof AudioDestinationNode) {
      return [{ gains: nextGains, gain: nextGains.reduce((total, value) => total * value, 1), contextState: node.context.state }]
    }
    return [...(edges.get(id) || [])].flatMap((next) => pathsFrom(next, nextGains, nextSeen))
  }
  window.__musicR4Audit = {
    snapshot() {
      const session = navigator.mediaSession
      return {
        visibility: document.visibilityState,
        mediaSession: session ? {
          playbackState: session.playbackState,
          title: session.metadata?.title ?? null,
          album: session.metadata?.album ?? null,
        } : null,
        preferences: Object.fromEntries(['enabled', 'sfx', 'music', 'volume-tier'].map((name) => [name, localStorage.getItem('museum-audio-' + name)])),
        media: media.map((element, index) => {
          const id = index + 1
          const paths = [...sourceMedia].filter(([, mediaId]) => mediaId === id).flatMap(([nodeId]) => pathsFrom(nodeId))
          return {
            id,
            src: element.currentSrc || element.src,
            currentTime: element.currentTime,
            duration: Number.isFinite(element.duration) ? element.duration : null,
            paused: element.paused,
            ended: element.ended,
            loop: element.loop,
            readyState: element.readyState,
            error: element.error?.code || null,
            paths,
            audible: !element.paused && !element.muted && element.volume > 0 && paths.some((path) => path.contextState === 'running' && path.gain > 0.0001),
          }
        }),
        events: [...events],
      }
    },
    visibility(state) {
      if (state === 'hidden') {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      } else {
        delete document.hidden
        delete document.visibilityState
      }
      document.dispatchEvent(new Event('visibilitychange'))
    },
    seekNearEnd(id) {
      const element = media[id - 1]
      if (!element || !Number.isFinite(element.duration)) throw new Error('The requested native audio is not ready to seek.')
      element.currentTime = element.duration - 2
    },
  }
}

const browser = await chromium.launch({
  headless: true,
  ...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }
    : {}),
})
const snapshot = (page) => page.evaluate(() => window.__musicR4Audit.snapshot())
const playing = (state) => state.media.filter((item) => item.audible && item.src.includes(prefix))
const fileFor = (id) => `${prefix}${id}-r4.m4a`
const check = (label, detail = {}) => report.checks.push({ label, ...detail })

async function newPage({ width = 1440, theme = 'light', locale = 'zh-CN' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce', locale })
  await context.addInitScript(installAudioObserver, { theme, locale })
  await context.route('**/api/**', async (route) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      report.writes.push({ url: route.request().url(), method: route.request().method() })
      return route.abort()
    }
    return route.continue()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (error) => report.errors.push({ url: page.url(), message: error.message }))
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith(prefix)) report.requests.push({ url: request.url(), at: Date.now() })
  })
  return { page, context }
}

async function expectTrack(page, id) {
  await page.waitForFunction(
    (file) => window.__musicR4Audit.snapshot().media.some((item) => item.audible && item.src.endsWith(file) && item.currentTime > 0.05),
    fileFor(id),
  )
  await expect.poll(async () => playing(await snapshot(page)).length, { timeout: 8000 }).toBe(1)
  const state = await snapshot(page)
  const current = playing(state)[0]
  assert.ok(current.src.endsWith(fileFor(id)))
  return current
}

async function expectSilent(page) {
  await expect.poll(async () => playing(await snapshot(page)).length, { timeout: 8000 }).toBe(0)
}

async function checkLoop(page, track, label) {
  const before = await expectTrack(page, track)
  assert.equal(before.loop, true)
  await page.evaluate((id) => window.__musicR4Audit.seekNearEnd(id), before.id)
  await page.waitForFunction((id) => {
    const current = window.__musicR4Audit.snapshot().media.find((item) => item.id === id)
    return current?.audible && current.currentTime > 0.05 && current.currentTime < 2 && !current.error
  }, before.id, { timeout: 10000 })
  const after = await expectTrack(page, track)
  assert.equal(after.id, before.id)
  check(`${label}: native ${track} (.m4a) loop wraps from 2s before end`)
}

async function openPanel(page) {
  if ((await page.locator('.audio-toggle').getAttribute('aria-expanded')) !== 'true') await page.locator('.audio-toggle').click()
  await expect(page.locator('.audio-panel')).toBeVisible()
}

async function navigate(page, path) {
  const link = page.locator(`a[href="${path}"]`).filter({ visible: true }).first()
  if (await link.count()) {
    await link.click()
  } else {
    await page.evaluate((target) => {
      window.history.pushState({}, '', target)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  }
  await page.waitForURL((url) => url.pathname === path)
  if (path === '/exhibits/heluo-bronze-ding-3d') {
    await expect(page.locator('.exhibit-viewer-wrap')).toBeVisible()
  } else {
    await expect(page.locator('#main-content h1').first()).toBeVisible()
  }
}

async function checkPanel(page, label) {
  await openPanel(page)
  const bounds = await page.locator('.audio-panel').evaluate((panel) => {
    const rect = panel.getBoundingClientRect()
    return {
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      inputsInPanel: [...panel.querySelectorAll('button,input')].every((control) => {
        const box = control.getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth
      }),
    }
  })
  assert.ok(bounds.left >= 15 && bounds.right <= bounds.viewport - 15, JSON.stringify(bounds))
  assert.equal(bounds.inputsInPanel, true)
  assert.equal(bounds.overflow, false)
  assert.equal(await page.locator('.audio-panel__track-btn').count(), 5)
  await page.screenshot({ path: `${output}/${label}-control.png` })
  await page.locator('.audio-panel__tier').last().focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.audio-panel')).toHaveCount(0)
  await expect(page.locator('.audio-toggle')).toBeFocused()
  check(`${label}: 5-pill panel fits viewport; Escape restores focus`, bounds)
}

async function journey(width, theme) {
  const label = `${width}-${theme}-zh-CN`
  const { page, context } = await newPage({ width, theme })
  try {
    const beforeRequests = report.requests.length
    const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    assert.equal(response.status(), 200)
    await expect(page.locator('.audio-toggle')).toBeVisible()
    await page.waitForTimeout(350)
    assert.equal(report.requests.length, beforeRequests)
    assert.equal(playing(await snapshot(page)).length, 0)
    check(`${label}: first visit stays silent and does not request any R4 audio`)

    await page.locator('.audio-toggle').click()
    await expectTrack(page, 'home')
    const homeState = await snapshot(page)
    if (homeState.mediaSession) {
      assert.equal(homeState.mediaSession.album, '展馆原声 R4')
      assert.equal(homeState.mediaSession.title, '《入馆·河洛晨光》')
    }
    check(`${label}: single gesture enables home-r4.m4a and syncs MediaSession`)

    await checkLoop(page, 'home', label)
    await checkPanel(page, label)

    // Volume tiers & independent music/sfx toggles
    await openPanel(page)
    for (const [index, gain, tier] of [[1, 0.45, 'quiet'], [3, 1.45, 'rich'], [0, 0, 'silent'], [2, 1, 'normal']]) {
      await page.locator('.audio-panel__tier').nth(index).click()
      await page.waitForFunction(({ gain, tier }) => {
        const state = window.__musicR4Audit.snapshot()
        const media = state.media.find((item) => !item.paused && item.src.includes('/media/audio/music-r4/'))
        return state.preferences['volume-tier'] === tier && media?.paths.some((path) => Math.abs(path.gains.at(-1) - gain) < 0.015)
      }, { gain, tier })
    }
    check(`${label}: volume tiers update master gain accurately`)

    // Manual 4-track switching including jade, then reset to Auto
    await page.locator('.audio-panel__track-btn', { hasText: '温润·玉石' }).click()
    await expectTrack(page, 'jade')
    await page.locator('.audio-panel__track-btn', { hasText: '随展厅自动' }).click()
    await expectTrack(page, 'home')
    await page.keyboard.press('Escape')
    check(`${label}: manual switch to jade-r4.m4a and auto reset work`)

    // Cross-route transitions across all 4 tracks
    const home = await expectTrack(page, 'home')
    await navigate(page, '/explore')
    const collection = await expectTrack(page, 'home')
    assert.equal(collection.id, home.id)
    assert.ok(collection.currentTime >= home.currentTime)

    await navigate(page, '/artifacts/water-bird-bronze')
    const water = await expectTrack(page, 'reading')
    await navigate(page, '/appointment')
    const booking = await expectTrack(page, 'reading')
    assert.equal(booking.id, water.id)
    assert.ok(booking.currentTime >= water.currentTime)

    await navigate(page, '/artifacts/river-map-jade-bi')
    await expectTrack(page, 'jade')
    await checkLoop(page, 'jade', label)

    await navigate(page, '/exhibits')
    const gallery = await expectTrack(page, 'bronze')
    await navigate(page, '/exhibits/heluo-bronze-ding-3d')
    const exhibit = await expectTrack(page, 'bronze')
    assert.equal(exhibit.id, gallery.id)
    assert.ok(exhibit.currentTime >= gallery.currentTime)
    check(`${label}: 4-track routing (home/reading/jade/bronze) and same-track position retention verified`)

    // Visibility pause + resume
    await navigate(page, '/')
    await expectTrack(page, 'home')
    await page.evaluate(() => window.__musicR4Audit.visibility('hidden'))
    await expectSilent(page)
    const retained = (await snapshot(page)).media.find((item) => item.src.endsWith(fileFor('home')) && item.paths.length > 0)
    assert.ok(retained?.paused)
    await page.evaluate(() => window.__musicR4Audit.visibility('visible'))
    await expectSilent(page)
    await page.keyboard.press('Tab')
    const restored = await expectTrack(page, 'home')
    assert.equal(restored.id, retained.id)
    assert.ok(restored.currentTime >= retained.currentTime)
    check(`${label}: hidden/visible lifecycle pauses and resumes at retained position`)
    report.snapshots.push({ label, state: await snapshot(page) })
  } finally {
    await context.close()
  }
}

async function failureDuringNavigation() {
  const { page, context } = await newPage()
  let release
  let observed = false
  const gate = new Promise((resolve) => { release = resolve })
  await page.route(`**${fileFor('reading')}`, async (route) => {
    observed = true
    await gate
    await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Intentional R4 loading failure test.' }).catch(() => {})
  })
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    await page.locator('.audio-toggle').click()
    await expectTrack(page, 'home')
    await page.keyboard.press('Escape')
    await navigate(page, '/explore')
    await navigate(page, '/artifacts/water-bird-bronze')
    await expect.poll(() => observed).toBe(true)
    await openPanel(page)
    await page.locator('.audio-panel__switch').click()
    await expectSilent(page)
    release()
    await navigate(page, '/')
    await page.waitForTimeout(1600)
    assert.equal((await snapshot(page)).preferences.enabled, 'false')
    assert.equal(playing(await snapshot(page)).length, 0)
    await page.locator('.audio-toggle').click()
    await expectTrack(page, 'home')
    check('Delayed reading-r4 failure after mute cannot revive stale audio; deliberate enable recovers')
  } finally {
    release()
    await context.close()
  }
}

try {
  for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) await journey(width, theme)
  for (const [width, theme] of [[1440, 'dark'], [390, 'light']]) {
    const { page, context } = await newPage({ width, theme, locale: 'en-US' })
    try {
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Enable sound', exact: true }).click()
      await expectTrack(page, 'home')
      const state = await snapshot(page)
      if (state.mediaSession) {
        assert.equal(state.mediaSession.album, 'Museum Soundscape R4')
      }
      await checkPanel(page, `${width}-${theme}-en-US`)
    } finally {
      await context.close()
    }
  }
  await failureDuringNavigation()
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.writes, [])
  report.passed = true
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }
  throw error
} finally {
  await browser.close()
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, pageErrors: report.errors.length, blockedWrites: report.writes.length, output }))
}
