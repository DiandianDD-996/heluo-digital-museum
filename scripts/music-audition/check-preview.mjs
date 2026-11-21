import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const output = new URL('../../artifacts/music-audition-2026-09-27/', import.meta.url)
const diagnostic = process.argv.includes('--diagnostic')
const revision = process.argv.includes('--r3') ? 'r3' : process.argv.includes('--r2') ? 'r2' : 'r1'
const revisionIds = revision === 'r3' ? ['r3', 'r2', 'r1'] : revision === 'r2' ? ['r2', 'r1'] : ['r1']
const editions = await Promise.all(revisionIds.map(async id => ({
  id,
  report: JSON.parse(await readFile(new URL(id === 'r1' ? 'render-report.json' : 'render-report-' + id + '.json', output), 'utf8')),
})))
const report = editions[0].report
const browser = await chromium.launch({ headless: true })
const results = []
const errors = []
const origin = process.env.MUSIC_PREVIEW_URL || 'http://127.0.0.1:4197/'
const pageUrl = new URL(origin)
pageUrl.searchParams.set('revision', revision)
const format = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
const trackAt = (id, edition = revision) => editions.find(item => item.id === edition).report.tracks.find(track => track.id === id)

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } })
  page.on('pageerror', error => errors.push(error.message))
  const waitForAudio = async (track, mode, playing) => page.waitForFunction(({ file, playing }) => {
    const audio = document.querySelector('audio')
    return audio.readyState >= 1 && audio.currentSrc.endsWith(file)
      && (playing === undefined || audio.paused === !playing)
  }, { file: track[mode].file, playing })
  const response = await page.goto(pageUrl.href, { waitUntil: 'load' })
  assert.equal(response.status(), 200)
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 1)
  assert.equal(await page.locator('audio').count(), 1)
  assert.equal(await page.locator('audio').evaluate(audio => audio.paused), true)
  assert.equal(await page.locator('input[name="revision"]:checked').inputValue(), revision)
  if (revision !== 'r1') assert.equal(await page.locator('.track[aria-pressed="true"]').getAttribute('data-id'), 'bronze')
  for (const id of revisionIds) assert.equal(await page.locator('input[name="revision"][value="' + id + '"]').count(), 1)
  results.push('HTTP 200; URL revision and initial scene match; one player; initial load remains paused')

  for (const edition of editions) {
    await page.locator('input[name="revision"][value="' + edition.id + '"]').check()
    for (const track of edition.report.tracks) {
      await page.locator('.track[data-id="' + track.id + '"]').click()
      assert.equal(await page.locator('#title').textContent(), track.title)
      assert.equal(await page.locator('#description').textContent(), track.description)
      assert.equal(await page.locator('.section').count(), track.sections.length)
      for (let index = 0; index < track.sections.length; index++) {
        const section = track.sections[index]
        assert.equal(Number(await page.locator('.section').nth(index).getAttribute('data-start')), section.start)
        assert.equal(Number(await page.locator('.section').nth(index).getAttribute('data-end')), section.end)
        assert.ok(section.start >= 0 && section.end <= track.scene.durationSeconds)
      }
      for (const mode of ['scene', 'audition']) {
        await page.locator('input[name="mode"][value="' + mode + '"]').check()
        const resourceInfo = track[mode]
        await waitForAudio(track, mode, false)
        const state = await page.locator('audio').evaluate(audio => ({
          duration: audio.duration, paused: audio.paused, error: audio.error?.message,
        }))
        assert.ok(Math.abs(state.duration - resourceInfo.durationSeconds) < 0.002)
        assert.equal(state.paused, true)
        assert.equal(state.error, undefined)
        assert.equal(await page.locator('#duration').textContent(), format(state.duration))
        const resource = await page.request.get(new URL(resourceInfo.file, origin).href)
        const body = await resource.body()
        assert.equal(resource.status(), 200)
        assert.equal(body.length, resourceInfo.bytes)
        assert.equal(await page.locator('#download').getAttribute('href'), resourceInfo.file)
        results.push(edition.id + '/' + track.id + '/' + mode + ': WAV decoded, ' + resourceInfo.durationSeconds + 's and duration label, sections, HTTP bytes and download match')
        if (revision === 'r3' && edition.id === 'r3' && track.id === 'bronze' && mode === 'scene') {
          const url = new URL(resourceInfo.file, origin).href
          const first = await page.request.get(url, { headers: { Range: 'bytes=0-63' } })
          assert.equal(first.status(), 206)
          assert.equal(first.headers()['accept-ranges'], 'bytes')
          assert.equal(first.headers()['content-range'], 'bytes 0-63/' + body.length)
          assert.deepEqual(await first.body(), body.subarray(0, 64))
          results.push('HTTP range bytes=0-63: 206, correct range header and exact source bytes')

          const suffix = await page.request.get(url, { headers: { Range: 'bytes=-32' } })
          assert.equal(suffix.status(), 206)
          assert.equal(suffix.headers()['content-range'], 'bytes ' + (body.length - 32) + '-' + (body.length - 1) + '/' + body.length)
          assert.deepEqual(await suffix.body(), body.subarray(-32))
          results.push('HTTP suffix bytes=-32: 206 and exact final source bytes')

          const invalid = await page.request.get(url, { headers: { Range: 'bytes=' + body.length + '-' } })
          assert.equal(invalid.status(), 416)
          assert.equal(invalid.headers()['content-range'], 'bytes */' + body.length)
          results.push('HTTP range beyond file: 416 with correct unsatisfied Content-Range')

          const head = await page.request.head(url)
          assert.equal(head.status(), 200)
          assert.equal(Number(head.headers()['content-length']), body.length)
          assert.equal((await head.body()).length, 0)
          results.push('HTTP HEAD: full content length and no response body')
        }
      }
    }
  }

  await page.locator('input[name="revision"][value="' + revision + '"]').check()
  await page.locator('.track[data-id="reading"]').click()
  await waitForAudio(trackAt('reading'), 'audition', false)
  await page.locator('.section').nth(1).click()
  await page.waitForFunction(() => !document.querySelector('audio').paused)
  const position = await page.locator('audio').evaluate(audio => audio.currentTime)
  assert.ok(Math.abs(position - trackAt('reading').sections[1].start) < 2)
  await page.locator('input[name="mode"][value="scene"]').check()
  await waitForAudio(trackAt('reading'), 'scene', true)
  const after = await page.locator('audio').evaluate(audio => audio.currentTime)
  assert.ok(Math.abs(after - position) < 2)
  results.push('Phrase seek starts playback; volume-mode change preserves position and resumes')

  if (revision !== 'r1') {
    await page.locator('audio').evaluate(audio => { audio.currentTime = 12 })
    const before = await page.locator('audio').evaluate(audio => audio.currentTime)
    await page.locator('input[name="revision"][value="r1"]').check()
    await waitForAudio(trackAt('reading', 'r1'), 'scene', true)
    assert.ok(Math.abs(await page.locator('audio').evaluate(audio => audio.currentTime) - before) < 2)
    await page.evaluate(current => {
      for (const value of [current, 'r1', current]) document.querySelector('input[name="revision"][value="' + value + '"]').click()
    }, revision)
    await waitForAudio(trackAt('reading'), 'scene', true)
    assert.ok(Math.abs(await page.locator('audio').evaluate(audio => audio.currentTime) - before) < 2)
    assert.equal(await page.locator('audio').count(), 1)
    results.push('Old/new version comparison and rapid switches retain the same second and playback in one player')
  }

  if (revision === 'r3') {
    assert.equal(new Set(report.tracks.map(track => track.scene.durationSeconds)).size, 3)
    assert.ok(report.tracks.every(track => track.scene.durationSeconds >= 90 && track.scene.durationSeconds <= 120))
    await page.locator('.track[data-id="bronze"]').click()
    await waitForAudio(trackAt('bronze'), 'scene', false)
    await page.locator('audio').evaluate(async audio => { audio.currentTime = 80; await audio.play() })
    await page.locator('input[name="revision"][value="r2"]').check()
    await waitForAudio(trackAt('bronze', 'r2'), 'scene', true)
    assert.ok(await page.locator('audio').evaluate(audio => audio.currentTime < 2))
    assert.match(await page.locator('#status').textContent(), /所选版本较短，从开头继续/)
    assert.match(await page.locator('#revision-note').textContent(), /同一秒数不代表同一乐句/)
    results.push('80s playing R3 → 56s R2 resumes from the start with an explicit duration/structure notice')

    await page.locator('input[name="revision"][value="r3"]').check()
    await waitForAudio(trackAt('bronze'), 'scene', true)
    await page.locator('audio').evaluate(audio => { audio.pause(); audio.currentTime = 80 })
    await page.locator('input[name="revision"][value="r1"]').check()
    await waitForAudio(trackAt('bronze', 'r1'), 'scene', false)
    assert.equal(await page.locator('audio').evaluate(audio => audio.currentTime), 0)
    assert.match(await page.locator('#status').textContent(), /所选版本较短，已回到开头/)
    results.push('80s paused R3 → 56s R1 returns to the start and remains paused')

    await page.locator('input[name="revision"][value="r3"]').check()
    await waitForAudio(trackAt('bronze'), 'scene', false)
    await page.locator('audio').evaluate(audio => { audio.currentTime = 80 })
    await page.evaluate(() => {
      for (const value of ['r2', 'r1', 'r3']) document.querySelector('input[name="revision"][value="' + value + '"]').click()
    })
    await waitForAudio(trackAt('bronze'), 'scene', false)
    assert.ok(Math.abs(await page.locator('audio').evaluate(audio => audio.currentTime) - 80) < 0.1)
    assert.equal(await page.locator('audio').count(), 1)
    results.push('Rapid paused R3 → R2 → R1 → R3 keeps the intended 80s position without starting playback')

    await page.locator('input[name="mode"][value="audition"]').check()
    await waitForAudio(trackAt('bronze'), 'audition', false)
    assert.ok(Math.abs(await page.locator('audio').evaluate(audio => audio.currentTime) - 80) < 0.1)
    await page.locator('input[name="mode"][value="scene"]').check()
    await waitForAudio(trackAt('bronze'), 'scene', false)
    results.push('Loudness comparison also preserves 80s position while paused')
  }

  await page.locator('.track[data-id="reading"]').click()
  await waitForAudio(trackAt('reading'), 'scene', false)
  await page.locator('.section').nth(1).click()
  await page.waitForFunction(() => !document.querySelector('audio').paused)
  await page.locator('.track[data-id="bronze"]').click()
  await waitForAudio(trackAt('bronze'), 'scene', false)
  assert.equal(await page.locator('audio').evaluate(audio => audio.currentTime), 0)
  results.push('Scene change stops prior playback and waits for explicit play')

  await page.locator('.track[data-id="reading"]').focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.track[data-id="reading"]').getAttribute('aria-pressed'), 'true')
  await waitForAudio(trackAt('reading'), 'scene', false)
  results.push('Track selection works from keyboard and remains paused')

  if (revision === 'r3') {
    await page.locator('input[name="revision"][value="r3"]').focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.locator('input[name="revision"]:checked').inputValue(), 'r2')
    await waitForAudio(trackAt('reading', 'r2'), 'scene', false)
    await page.locator('input[name="revision"][value="r3"]').focus()
    await page.keyboard.press('Space')
    await waitForAudio(trackAt('reading'), 'scene', false)
    results.push('Version radios work with arrow/space keys without starting playback')
  }

  await page.locator('.track[data-id="bronze"]').click()
  await waitForAudio(trackAt('bronze'), 'scene', false)
  for (const viewport of [{ width: 1440, height: 1050 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await page.locator('.section').evaluateAll(buttons => buttons.every(button => {
      const rect = button.getBoundingClientRect()
      return rect.left >= 0 && rect.right <= innerWidth
    })), true)
    if (!diagnostic) await page.screenshot({ path: fileURLToPath(new URL('preview-' + revision + '-' + viewport.width + '.png', output)), fullPage: true })
    results.push(viewport.width + 'px: no document or section overflow' + (diagnostic ? '' : '; screenshot saved'))
  }
  assert.deepEqual(errors, [])
  if (!diagnostic) await writeFile(new URL('preview-check-' + revision + '.json', output), JSON.stringify({
    checkedAt: new Date().toISOString(), revision, origin: pageUrl.href, browser: await browser.version(),
    results, errors, limit: 'Headless browser checks only; no subjective or physical-device listening.',
  }, null, 2) + '\n')
  console.log(JSON.stringify({ passed: results.length, errors, diagnostic }))
} finally {
  await browser.close()
}
