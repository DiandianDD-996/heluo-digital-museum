import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { chromium, expect } from '@playwright/test'

const candidate = new URL('../../docs/plans/luosheng-eval/ding-zh-CN-0.5.0-signoff-candidate.2026-11-22.json', import.meta.url)
const uiCopy = new URL('../src/assets/guide/ui.zh-CN.json', import.meta.url)

export async function checkDatedDemo(base) {
  const capture = process.env.LUOSHENG_DATED_DEMO_CAPTURE
  if (capture) assert(isAbsolute(capture), 'Use an absolute screenshot directory')
  const approvalPath = process.env.LUOSHENG_TEST_APPROVAL_FILE
  assert(approvalPath && isAbsolute(approvalPath), 'Expected the isolated test approval file')
  const pausePath = process.env.LUOSHENG_TEST_PAUSE_FILE
  assert(pausePath && isAbsolute(pausePath), 'Expected the isolated test pause file')
  const bytes = await readFile(candidate)
  const approvedDigest = createHash('sha256').update(bytes).digest('hex')
  const { cards } = JSON.parse(bytes)
  const ui = JSON.parse(await readFile(uiCopy, 'utf8'))
  const byId = id => cards.find(card => card.id === id)
  const ear = byId('LS-DING-EARS')
  const feet = byId('LS-DING-FEET')
  const period = byId('LS-DING-PERIOD')
  const source = byId('LS-DING-SOURCE')
  const layouts = [[1440, 'light'], [390, 'dark']]
  if (process.env.LUOSHENG_DATED_DEMO_DIST) layouts.push([1440, 'dark'], [390, 'light'])
  const browser = await chromium.launch({ executablePath: process.env.LUOSHENG_CHROME || undefined })
  try {
    for (const [width, theme] of layouts) {
      const baselineLayout = (width === 1440 && theme === 'light') || (width === 390 && theme === 'dark')
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width === 390, reducedMotion: 'reduce' })
      try {
        page.setDefaultTimeout(7000)
        const appointmentRequests = []
        page.on('request', request => {
          if (/^\/api\/v1\/appointment(?:s|-slots)(?:\/|$)/.test(new URL(request.url()).pathname)) {
            appointmentRequests.push(request)
          }
        })
        await page.addInitScript(value => localStorage.setItem('heluo.theme', value), theme)
        assert.equal((await page.goto(base)).status(), 200)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await page.getByRole('button', { name: '洛笙导览', exact: true }).click()
        const panel = page.getByRole('complementary', { name: '洛笙全站导览' })
        const input = panel.getByRole('textbox', { name: '问洛笙' })
        const ask = async question => {
          await input.fill(question)
          await input.press('Enter')
        }
        await ask('我只有五分钟，带我看一件')
        await expect(panel.getByRole('button', { name: '带我找鼎耳' })).toBeVisible()
        await expect(panel.getByRole('status')).toContainText('带我找鼎耳')
        const [search] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/search'),
          ask('不想预约只想看青铜鼎'),
        ])
        assert.equal(search.status(), 200)
        const [ding] = (await search.json()).data.items
        assert.equal(ding.slug, 'heluo-bronze-ding')
        await expect(panel.getByRole('status')).toContainText(ding.title)
        await expect(panel.getByRole('status')).not.toContainText('带我找鼎耳')
        await expect(panel.getByRole('link', { name: '预约参观' })).toHaveCount(0)
        await expect(page).toHaveURL(base)
        assert.equal(appointmentRequests.length, 0)
        await panel.getByRole('button', { name: '带我找鼎耳' }).click()
        await expect(page.getByRole('heading', { name: '鼎耳图版' })).toBeVisible()
        await expect(page.getByRole('group', { name: '选择看点' })).toBeVisible()
        await expect(page.getByRole('img', { name: '青铜鼎数字模型 鼎耳 · 俯视', exact: true })).toBeVisible()
        await expect(page.locator('.approved-figure figcaption')).toContainText(ear.text)
        await expect.poll(() => page.locator('.approved-figure img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
        if (capture && baselineLayout && width === 1440) {
          await page.locator('.approved-figure').screenshot({ path: join(capture, 'luosheng-eight-cards-ding-ear.png'), animations: 'disabled' })
        }
        await page.getByRole('button', { name: '接着问' }).click()
        const checkTurn = async (question, card, text, kind) => {
          const [response] = await Promise.all([
            page.waitForResponse(result => result.request().method() === 'POST'
              && new URL(result.url()).pathname === '/api/v1/guide/turns'),
            ask(question),
          ])
          assert.equal(response.status(), 200)
          const { data } = await response.json()
          assert.equal(data.kind, kind)
          assert.equal(data.generated, false)
          assert.deepEqual(data.citations[0]?.reference, { cardId: card.id, revision: card.revision })
          if (kind !== 'FIND_SPOT_UNKNOWN') assert.equal(data.text, text)
          await expect(panel.getByRole('status')).toContainText(text)
          if (kind !== 'PLATE_OBSERVATION') {
            await panel.getByText('查看本轮依据').click()
            await expect(panel.getByRole('link', { name: `${card.id} · 修订 ${card.revision}` })).toBeVisible()
          }
          if (capture && baselineLayout && ((width === 1440 && kind === 'PERIOD') || (width === 390 && kind === 'FIND_SPOT_UNKNOWN'))) {
            const name = kind === 'PERIOD' ? 'luosheng-eight-cards-desktop-period.png' : 'luosheng-eight-cards-mobile-find-spot.png'
            await page.screenshot({ path: join(capture, name), animations: 'disabled' })
          }
        }
        await checkTurn('它是什么年代的？', period, period.text, 'PERIOD')
        await checkTurn('在哪里出土？', source, '缺的是：出土地记录。', 'FIND_SPOT_UNKNOWN')
        await expect(page.getByRole('heading', { name: '鼎耳图版' })).toBeVisible()
        await input.press('Escape')
        await expect(input).toBeHidden()
        const feetSelector = page.getByRole('group', { name: '选择看点' }).getByRole('button', { name: '三足', exact: true })
        await feetSelector.click()
        const figure = page.locator('.approved-figure')
        const feetHeading = page.getByRole('heading', { name: '三足图版' })
        await expect(feetSelector).toHaveAttribute('aria-pressed', 'true')
        await expect(feetHeading).toBeVisible()
        await expect(figure).toHaveAttribute('data-compare', 'false')
        await page.getByRole('button', { name: '接着问' }).click()
        await checkTurn('另一只在哪', feet, feet.text, 'PLATE_OBSERVATION')
        await expect(panel.getByRole('button', { name: '看背视图' })).toBeVisible()
        await expect(figure).toHaveAttribute('data-compare', 'false')
        await checkTurn('我说的是脚', feet, feet.text, 'PLATE_OBSERVATION')
        await expect(figure).toHaveAttribute('data-compare', 'false')
        if (capture && width === 390) {
          const name = baselineLayout ? 'luosheng-three-feet-mobile-followup.png' : 'luosheng-three-feet-mobile-light-followup.png'
          await page.screenshot({ path: join(capture, name), animations: 'disabled' })
        }
        await panel.getByRole('button', { name: '看背视图' }).click()
        await expect(feetHeading).toBeVisible()
        await expect(figure).toHaveAttribute('data-compare', 'true')
        await page.getByRole('button', { name: '接着问' }).click()
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
        const tomorrow = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10)
        const [slotLookup] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/appointment-slots'),
          ask('明天还有三个人的名额吗？'),
        ])
        assert.equal(slotLookup.status(), 200)
        const params = new URL(slotLookup.url()).searchParams
        assert.equal(params.get('dateFrom'), tomorrow)
        assert.equal(params.get('dateTo'), tomorrow)
        await expect(panel.getByRole('status')).toContainText(tomorrow)
        await expect(panel.getByRole('status')).toContainText('09:30–10:00 可选')
        await panel.getByRole('link', { name: '看这天的时段' }).click()
        await expect(page).toHaveURL(new URL(`/appointment?date=${tomorrow}`, base).href)
        await expect(page.locator('.appointment-selected-date')).toHaveText(tomorrow)
        await expect(page.getByRole('button', { name: /^09:30 – 10:00/ })).toBeEnabled()
        if (capture && baselineLayout && width === 1440) {
          await page.locator('.appointment-time-section').screenshot({ path: join(capture, 'luosheng-three-feet-appointment.png'), animations: 'disabled' })
        }
        await page.locator('.appointment-guide-actions').getByRole('button', { name: '回到青铜鼎 · 三足' }).click()
        await expect(feetHeading).toBeFocused()
        await expect(page.getByRole('img', { name: '青铜鼎数字模型 三足 · 背视', exact: true })).toBeVisible()
        await expect(page.locator('.approved-figure')).toHaveAttribute('data-compare', 'true')
        await expect(page.locator('.approved-figure figcaption')).toContainText(feet.text)
        if (capture && width === 1440) {
          await expect.poll(() => figure.locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
          const name = baselineLayout ? 'luosheng-three-feet-restored-back.png' : 'luosheng-three-feet-desktop-dark-restored-back.png'
          await figure.screenshot({ path: join(capture, name), animations: 'disabled' })
        }
        assert(appointmentRequests.every(request => request.method() === 'GET'
          && new URL(request.url()).pathname === '/api/v1/appointment-slots'), 'Demo must only read public slots')

        const reloadPreset = async () => {
          const [preset, navigation] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/guide/exhibits/heluo-bronze-ding-3d'),
            page.reload(),
          ])
          assert.equal(navigation.status(), 200)
          assert.equal(preset.status(), 200)
          return (await preset.json()).data
        }
        const presetRegion = page.getByRole('region', { name: '洛笙', exact: true })
        const approval = await readFile(approvalPath)
        assert.equal(approval.toString().trim(), approvedDigest)
        try {
          await writeFile(approvalPath, '0'.repeat(64))
          await page.getByRole('button', { name: '接着问' }).click()
          const [turnResponse] = await Promise.all([
            page.waitForResponse(response => response.request().method() === 'POST'
              && new URL(response.url()).pathname === '/api/v1/guide/turns'),
            ask('我说的是脚'),
          ])
          assert.equal(turnResponse.status(), 200)
          const { data: turn } = await turnResponse.json()
          assert.equal(turn.kind, 'INSUFFICIENT_EVIDENCE')
          assert.equal(turn.generated, false)
          assert.deepEqual(turn.citations, [])
          assert.equal(turn.text, null)
          await expect(panel.getByRole('status')).toContainText(ui.insufficient.title)
          await expect(panel.getByRole('status')).not.toContainText(feet.text)
          await expect(panel.getByRole('button', { name: '看背视图' })).toHaveCount(0)
          const rejected = await reloadPreset()
          assert.equal(rejected.available, false)
          assert.deepEqual(rejected.entries, [])
          await expect(page.getByRole('heading', { name: ding.title, exact: true })).toBeVisible()
          await expect(presetRegion).toHaveCount(0)
          await expect(page.getByText(feet.text, { exact: true })).toHaveCount(0)
        } finally {
          await writeFile(approvalPath, approval)
        }
        const restored = await reloadPreset()
        assert.equal(restored.available, true)
        assert.equal(restored.entries.find(entry => entry.cardId === feet.id)?.text, feet.text)
        await presetRegion.getByRole('button', { name: '阅读洛笙讲解' }).click()
        await expect(presetRegion.getByText(feet.text, { exact: true })).toBeVisible()
        if (width === 1440 && theme === 'light') {
          await feetSelector.click()
          await page.getByRole('button', { name: '接着问' }).click()
          await checkTurn('我说的是脚', feet, feet.text, 'PLATE_OBSERVATION')
          await writeFile(pausePath, 'paused', { flag: 'wx' })
          try {
            const isTurn = request => request.method() === 'POST'
              && new URL(request.url()).pathname === '/api/v1/guide/turns'
            const [paused] = await Promise.all([
              page.waitForResponse(response => isTurn(response.request())),
              ask('我说的是脚'),
            ])
            assert.equal(paused.status(), 200)
            const { data: turn } = await paused.json()
            assert.equal(turn.kind, 'QUESTIONING_DISABLED')
            assert.equal(turn.generated, false)
            assert.deepEqual(turn.citations, [])
            assert.equal(turn.text, null)
            assert.equal(turn.plate, null)
            await expect(panel.getByRole('status')).toContainText(ui.errors.paused)
            await expect(panel.getByRole('status')).not.toContainText(feet.text)
            await expect(panel.getByRole('button', { name: '看背视图' })).toHaveCount(0)
            await panel.getByRole('button', { name: ui.site.readPlate }).click()
            await expect(feetHeading).toBeVisible()
            await expect(figure.locator('figcaption')).toContainText(feet.text)
            await page.getByRole('button', { name: '接着问' }).click()
            const duringLookup = []
            const record = request => {
              if (isTurn(request) || /^\/api\/v1\/appointment(?:s|-slots)(?:\/|$)/.test(new URL(request.url()).pathname)) {
                duringLookup.push([request.method(), new URL(request.url()).pathname])
              }
            }
            page.on('request', record)
            try {
              const [slots] = await Promise.all([
                page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/appointment-slots'),
                ask('明天还有三个人的名额吗？'),
              ])
              assert.equal(slots.status(), 200)
              await expect(panel.getByRole('status')).toContainText(tomorrow)
              await expect(panel.getByRole('status')).toContainText('09:30–10:00 可选')
              assert.deepEqual(duringLookup, [['GET', '/api/v1/appointment-slots']])
            } finally {
              page.off('request', record)
            }
          } finally {
            await unlink(pausePath)
          }
          await checkTurn('我说的是脚', feet, feet.text, 'PLATE_OBSERVATION')
          console.log('Dated demo pause/resume passed: 1440px light; readable plate, GET-only slots, cited reply restored')

          // Hold an actual, successful response from the frozen pack at the
          // browser boundary. Do not substitute a JSON fixture for the reply.
          const heldReply = await page.evaluateHandle(() => {
            const original = window.fetch
            const hold = Promise.withResolvers()
            const state = { release: hold.resolve, parsed: false, restore: () => { window.fetch = original } }
            window.fetch = async (url, options) => {
              if (url !== '/api/v1/guide/turns' || options?.method !== 'POST') return original(url, options)
              window.fetch = original
              const response = await original(url, options)
              const read = response.json.bind(response)
              response.json = async () => {
                const data = await read()
                state.parsed = true
                await hold.promise
                return data
              }
              return response
            }
            return state
          })
          try {
            const [slow] = await Promise.all([
              page.waitForResponse(response => response.request().method() === 'POST'
                && new URL(response.url()).pathname === '/api/v1/guide/turns'),
              ask('我说的是脚'),
            ])
            assert.equal(slow.status(), 200)
            const { data } = await slow.json()
            assert.equal(data.kind, 'PLATE_OBSERVATION')
            assert.equal(data.generated, false)
            assert.equal(data.text, feet.text)
            assert.deepEqual(data.citations[0]?.reference, { cardId: feet.id, revision: feet.revision })
            await expect(panel.getByText(ui.progress.checking, { exact: true })).toBeVisible()
            await expect.poll(() => heldReply.evaluate(state => state.parsed)).toBe(true)
            await input.press('Escape')
            await expect(input).toBeHidden()
            await page.getByRole('group', { name: '选择看点' }).getByRole('button', { name: '鼎耳', exact: true }).click()
            await expect(page.getByRole('heading', { name: '鼎耳图版' })).toBeVisible()
            await page.getByRole('button', { name: '接着问' }).click()
            await expect(input).toBeVisible()
            await heldReply.evaluate(state => state.release())
            await expect(panel.getByRole('status')).not.toContainText(feet.text)
            await expect(panel.getByText(ui.progress.checking, { exact: true })).toBeHidden()
            await expect(panel.getByRole('button', { name: '看背视图' })).toHaveCount(0)
            await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
            await checkTurn('它是什么年代的？', period, period.text, 'PERIOD')
            await expect(page.getByRole('heading', { name: '鼎耳图版' })).toBeVisible()
            console.log('Dated demo late reply passed: held cited feet response never replaced the ear context')
          } finally {
            await heldReply.evaluate(state => { state.release(); state.restore() })
            await heldReply.dispose()
          }

          // Start a new visit to keep the per-visit turn limit independent of
          // the process-wide generation budget being exercised below.
          assert.equal((await reloadPreset()).available, true)
          await presetRegion.getByRole('button', { name: '阅读洛笙讲解' }).click()
          await page.getByRole('group', { name: '选择看点' }).getByRole('button', { name: '鼎耳', exact: true }).click()
          await page.getByRole('button', { name: '接着问' }).click()
          const unavailableQuestion = '这只鼎耳是用来做什么的？'
          for (const [kind, message] of [
            ['GENERATION_UNAVAILABLE', ui.errors.generation],
            ['GENERATION_LIMIT_REACHED', ui.errors.limit],
          ]) {
            // Seed a visible reference each time, then verify the actual API
            // strips it on failure and the UI does not carry it forward.
            await checkTurn('它是什么年代的？', period, period.text, 'PERIOD')
            const [failure] = await Promise.all([
              page.waitForResponse(response => response.request().method() === 'POST'
                && new URL(response.url()).pathname === '/api/v1/guide/turns'),
              ask(unavailableQuestion),
            ])
            assert.equal(failure.status(), 200)
            const { data } = await failure.json()
            assert.equal(data.kind, kind)
            assert.equal(data.generated, false)
            assert.equal(data.text, null)
            assert.equal(data.plate, null)
            assert.deepEqual(data.citations, [])
            await expect(panel.getByRole('status')).toContainText(message)
            await expect(panel.getByRole('status')).not.toContainText(period.text)
            await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
            await expect(panel.getByRole('link', { name: `${period.id} · 修订 ${period.revision}` })).toHaveCount(0)
          }
          const isPublicTurn = request => request.method() === 'POST'
            && new URL(request.url()).pathname === '/api/v1/guide/turns'
          const readCurrentEarPlate = async () => {
            let readingTurns = 0
            const countReadingTurn = request => { if (isPublicTurn(request)) readingTurns++ }
            page.on('request', countReadingTurn)
            try {
              await panel.getByRole('button', { name: ui.site.readPlate }).click()
              await expect(page.getByRole('heading', { name: '鼎耳图版' })).toBeFocused()
              await expect(figure.locator('figcaption')).toContainText(ear.text)
              await expect(input).toBeHidden()
              assert.equal(readingTurns, 0)
            } finally {
              page.off('request', countReadingTurn)
            }
          }
          await readCurrentEarPlate()
          console.log('Dated demo generation fallback passed: loopback failure and exhausted budget cleared citations; current plate remained readable')

          await page.getByRole('button', { name: '接着问' }).click()
          await checkTurn('它是什么年代的？', period, period.text, 'PERIOD')
          await expect.poll(() => figure.locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
          const context = page.context()
          await context.setOffline(true)
          try {
            const [failed] = await Promise.all([
              page.waitForEvent('requestfailed', { predicate: isPublicTurn }),
              ask('在哪里出土？'),
            ])
            assert.match(failed.failure()?.errorText ?? '', /ERR_INTERNET_DISCONNECTED/)
            await expect(panel.getByRole('status')).toContainText(ui.site.unavailable)
            await expect(panel.getByRole('status')).not.toContainText(period.text)
            await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
            await expect(panel.getByRole('button', { name: '看背视图' })).toHaveCount(0)
            await readCurrentEarPlate()
            await expect(figure.locator('img')).toBeVisible()
            assert(await figure.locator('img').evaluate(img => img.complete && img.naturalWidth > 0))
          } finally {
            await context.setOffline(false)
          }
          await page.getByRole('button', { name: '接着问' }).click()
          await checkTurn('它是什么年代的？', period, period.text, 'PERIOD')
          console.log('Dated demo browser offline passed: request failed, open plate remained readable and reconnect restored cited replies')

          // Simulate an unresponsive transport at the fetch boundary. Only the
          // application's actual AbortSignal can end the simulated request.
          const noResponse = await page.evaluateHandle(() => {
            const original = window.fetch
            const state = { attempts: 0, aborted: false, question: null, restore: () => { window.fetch = original } }
            window.fetch = (url, options) => {
              if (url !== '/api/v1/guide/turns' || options?.method !== 'POST') return original(url, options)
              state.attempts++
              state.question = JSON.parse(options.body).question
              return new Promise((_resolve, reject) => {
                const abort = () => {
                  state.aborted = true
                  reject(options.signal.reason)
                }
                if (options.signal.aborted) abort()
                else options.signal.addEventListener('abort', abort, { once: true })
              })
            }
            return state
          })
          try {
            await ask('在哪里出土？')
            await expect(panel.getByText(ui.progress.checking, { exact: true })).toBeVisible()
            await expect(panel.getByText(ui.progress.checking, { exact: true })).toBeHidden({ timeout: 10_000 })
            await expect(panel.getByRole('status')).toContainText(ui.errors.timeout)
            await expect(panel.getByRole('status')).not.toContainText(period.text)
            await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
            await readCurrentEarPlate()
            assert.deepEqual(await noResponse.evaluate(({ attempts, aborted, question }) => ({ attempts, aborted, question })),
              { attempts: 1, aborted: true, question: '在哪里出土？' })
          } finally {
            await noResponse.evaluate(state => state.restore())
            await noResponse.dispose()
          }
          console.log('Dated demo browser deadline passed: one stalled request, no old citations or retry, current plate readable')

          await page.getByRole('button', { name: '接着问' }).click()
          await writeFile(pausePath, 'paused', { flag: 'wx' })
          try {
            const [paused] = await Promise.all([
              page.waitForResponse(response => isPublicTurn(response.request())),
              ask('我说的是耳'),
            ])
            assert.equal((await paused.json()).data.kind, 'QUESTIONING_DISABLED')
            await expect(panel.getByRole('status')).toContainText(ui.errors.paused)
            await writeFile(approvalPath, '0'.repeat(64))
            const [revoked] = await Promise.all([
              page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/guide/exhibits/heluo-bronze-ding-3d'),
              panel.getByRole('button', { name: ui.site.readPlate }).click(),
            ])
            assert.equal(revoked.status(), 200)
            const { data: unavailable } = await revoked.json()
            assert.equal(unavailable.available, false)
            assert.deepEqual(unavailable.entries, [])
            await expect(figure).toHaveCount(0)
            await expect(presetRegion.getByText(ear.text, { exact: true })).toHaveCount(0)
            console.log('Dated demo open plate revocation passed: explicit unavailable preset cleared the old plate')
          } finally {
            try {
              await writeFile(approvalPath, approval)
            } finally {
              await unlink(pausePath)
            }
          }
        }
        console.log(`Dated demo smoke passed: ${width}px ${theme}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
}
