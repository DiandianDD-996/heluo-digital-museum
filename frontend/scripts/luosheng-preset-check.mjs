import { chromium, expect } from '@playwright/test'
import { createServer, preview } from 'vite'
import lexicon from '../src/assets/guide/lexicon.zh-CN.json' with { type: 'json' }
import ui from '../src/assets/guide/ui.zh-CN.json' with { type: 'json' }

async function bufferGuideReply(page) {
  await page.evaluate(() => {
    const originalFetch = window.fetch
    const release = Promise.withResolvers()
    const buffered = Promise.withResolvers()
    const aborted = Promise.withResolvers()
    const delivered = Promise.withResolvers()
    window.guideTestDelay = { release: release.resolve, buffered: buffered.promise, aborted: aborted.promise, delivered: delivered.promise }
    window.fetch = async (input, init) => {
      if (!String(input).endsWith('/api/v1/guide/turns')) return originalFetch(input, init)
      window.fetch = originalFetch
      init?.signal?.addEventListener('abort', () => aborted.resolve(true), { once: true })
      try {
        const reply = await originalFetch(input, init)
        const payload = await reply.text()
        buffered.resolve(JSON.parse(payload))
        await release.promise
        const response = new Response(payload, { status: reply.status, headers: reply.headers })
        delivered.resolve(true)
        return response
      } catch (error) {
        buffered.reject(error)
        throw error
      }
    }
  })
}

async function checkCandidate(page, base) {
  const journey = new Map()
  page.on('response', response => {
    if (new URL(response.url()).pathname !== '/api/v1/guide/journey' || response.status() !== 204) return
    const kind = response.request().postDataJSON().kind
    journey.set(kind, (journey.get(kind) ?? 0) + 1)
  })
  await page.goto(base)
  const panel = page.getByRole('complementary', { name: '洛笙全站导览' })
  const trigger = panel.getByRole('button', { name: '洛笙导览', exact: true })
  const input = panel.getByRole('textbox', { name: '问洛笙' })
  const answer = panel.getByRole('status', { name: '洛笙的回答' })
  const suggestions = panel.getByRole('group', { name: '建议问题' })
  const ask = async (question) => {
    await input.fill(question)
    await input.press('Enter')
  }
  const replyTimings = []
  async function timeReply(category, question, ready) {
    await input.fill(question)
    await input.evaluate(element => {
      performance.clearMarks('guide-qa-submit')
      element.form.addEventListener('submit', () => performance.mark('guide-qa-submit'), { once: true, capture: true })
    })
    await input.press('Enter')
    await ready()
    const durationMs = await page.evaluate(() => {
      const start = performance.getEntriesByName('guide-qa-submit', 'mark')[0]
      return start ? performance.now() - start.startTime : null
    })
    expect(durationMs).not.toBeNull()
    expect(durationMs).toBeGreaterThanOrEqual(0)
    replyTimings.push({ category, durationMs: Math.round(durationMs) })
  }
  await trigger.click()
  await expect(panel.getByText('AI 向导 · 请勿输入个人信息')).toBeVisible()
  await expect(panel.getByText('模型预览 · 请勿输入个人信息')).toHaveCount(0)
  const close = panel.getByRole('button', { name: '关闭洛笙导览' })
  await input.fill('看看展品')
  for (const control of [input, close, panel.getByRole('button', { name: '发送' }), panel.getByRole('button', { name: '我先自己逛' })]) {
    await expect(control).toBeInViewport()
    const size = await control.boundingBox()
    expect(size?.width).toBeGreaterThanOrEqual(44)
    expect(size?.height).toBeGreaterThanOrEqual(44)
  }
  await input.evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    element.value = '不想预约只想看青铜鼎'
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
  })
  await expect(panel.getByRole('button', { name: '发送' })).toBeDisabled()
  await input.press('Escape')
  await expect(input).toBeFocused()
  await input.evaluate(element => element.form.requestSubmit())
  await expect(panel.getByRole('status')).toContainText('想找什么展品')
  await input.evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: element.value }))
  })
  await expect(input).toHaveValue('不想预约只想看青铜鼎')
  await input.press('Enter')
  await expect(panel.getByRole('button', { name: '带我找鼎耳' })).toBeVisible()
  await expect(panel.getByRole('link', { name: '预约参观' })).toHaveCount(0)
  await ask('不想看青铜鼎')
  await expect(panel.getByRole('status')).toContainText('你想看哪类藏品')
  await expect(panel.getByRole('button', { name: '带我找鼎耳' })).toHaveCount(0)
  let earlySlotReads = 0
  const countEarlySlots = request => {
    if (new URL(request.url()).pathname === '/api/v1/appointment-slots') earlySlotReads++
  }
  page.on('request', countEarlySlots)
  await ask('先看青铜鼎再看看明天三个人还有没有票')
  await expect(page).toHaveURL(base + '/')
  const figureModule = /\/LuoshengApprovedFigure(?:-[^/?]+)?\.(?:js|vue)(?:\?|$)/
  let requestedFigure = false
  const releaseFigure = Promise.withResolvers()
  const holdFigure = async route => {
    requestedFigure = true
    await releaseFigure.promise
    await route.continue()
  }
  const heading = page.getByRole('heading', { name: '鼎耳图版' })
  const earImage = page.locator('.approved-figure img')
  await page.route(figureModule, holdFigure, { times: 1 })
  try {
    await panel.getByRole('button', { name: '带我找鼎耳' }).click()
    await expect(heading).toBeVisible()
    await expect.poll(() => requestedFigure).toBe(true)
    await expect(page.locator('.approved-figure figcaption')).toHaveCount(0)
    await expect(heading).not.toBeFocused()
    expect(journey.get('plate-arrived') ?? 0).toBe(0)
  } finally {
    releaseFigure.resolve()
  }
  await expect(heading).toBeFocused()
  await expect(page.locator('.approved-figure figcaption')).toContainText('Approved observation')
  await expect.poll(() => earImage.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  await earImage.evaluate(img => { img.src = 'data:image/webp;base64,AA==' })
  await expect(page.getByText('图版暂不可用，可继续阅读图注。')).toBeVisible()
  await expect(page.locator('.approved-figure figcaption')).toContainText('鼎耳 · 俯视')
  await page.getByRole('button', { name: '接着问' }).click()
  await expect(input).toBeFocused()
  const pending = panel.getByRole('button', { name: /查 \d{4}-\d{2}-\d{2} 的时段/ })
  await expect(pending).toBeVisible()
  await ask('别预约了')
  await expect(pending).toHaveCount(0)
  expect(earlySlotReads).toBe(0)
  page.off('request', countEarlySlots)
  const turn = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/guide/turns' && response.ok())
  await ask('这个看点的依据是什么？')
  const result = await (await turn).json()
  expect(result.data.citations[0]?.reference.cardId).toBe('LS-DING-EARS')
  await panel.getByText('查看本轮依据').click()
  await expect(panel.getByRole('link', { name: 'LS-DING-EARS · 修订 1' })).toBeVisible()
  await timeReply('reviewed-answer', '它是什么年代的？', async () => {
    await expect(panel.getByRole('status')).toContainText('Synthetic period for the reference object')
    await expect(panel.getByText('查看本轮依据')).toBeVisible()
    await expect(panel.locator('details a', { hasText: 'LS-DING-PERIOD · 修订 1' })).toHaveCount(1)
  })
  await panel.getByText('查看本轮依据').click()
  await expect(panel.getByRole('link', { name: 'LS-DING-PERIOD · 修订 1' })).toBeVisible()
  await ask('在哪里出土？')
  await expect(answer).toContainText('缺的是：出土地记录。')
  await panel.getByText('查看本轮依据').click()
  await expect(panel.getByRole('link', { name: 'LS-DING-SOURCE · 修订 2' })).toBeVisible()
  await expect(panel.getByText(/LS-DING-PERIOD/)).toHaveCount(0)
  await expect(heading).toBeVisible()
  const slotQuery = url => url.pathname === '/api/v1/appointment-slots'
    && url.searchParams.has('dateFrom') && url.searchParams.has('dateTo')
  const requestedDates = []
  const shanghaiDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const tomorrow = new Date(Date.parse(shanghaiDay) + 86_400_000).toISOString().slice(0, 10)
  const dayAfter = new Date(Date.parse(shanghaiDay) + 2 * 86_400_000).toISOString().slice(0, 10)
  const oneSeat = { visitDate: tomorrow, startTime: '10:00:00', endTime: '11:00:00', remainingPeople: 1 }
  const threeSeats = { visitDate: tomorrow, startTime: '14:00:00', endTime: '15:00:00', remainingPeople: 3 }
  let reply
  const interceptSlots = async route => {
    const date = new URL(route.request().url()).searchParams
    requestedDates.push([date.get('dateFrom'), date.get('dateTo')])
    await route.fulfill(reply)
  }
  await page.route(slotQuery, interceptSlots)
  try {
    for (const [slots, expected] of [
      [[oneSeat, threeSeats], '14:00–15:00 可选，查询时余 3 个名额'],
      [[oneSeat], '当前公开时段的空位不足 3 人'],
      [[], '当前没有公开可约时段'],
      [null, '的公开时段暂时查不到'],
    ]) {
      reply = slots ? { json: { data: slots } } : { status: 503 }
      const ready = async () => {
        await expect(panel.getByRole('status')).toContainText(tomorrow)
        await expect(panel.getByRole('status')).toContainText(expected)
      }
      if (slots?.length === 2) {
        await timeReply('slots-fixture', '明天还有三个人的名额吗？', async () => {
          await ready()
          await expect(panel.getByRole('link', { name: '看这天的时段' })).toBeVisible()
        })
      } else {
        await ask('明天还有三个人的名额吗？')
        await ready()
      }
      await expect(panel.getByRole('status')).not.toContainText('10:00')
    }
    reply = { json: { data: [oneSeat, threeSeats] } }
    await ask('明天我们十一位，有没有可约的时段？')
    await expect(panel.getByRole('status')).toContainText('当前公开时段的空位不足 11 人')
    await expect(panel.getByRole('status')).not.toContainText('14:00')
    await ask('明天三到五人，还有预约时段吗？')
    await expect(panel.getByRole('status')).toContainText('请确认参观人数')
    await expect(panel.getByRole('link', { name: '看这天的时段' })).toHaveCount(0)
    await ask('明天或者后天三个人有时段吗？')
    await expect(panel.getByRole('status')).toContainText('请给一个日期')
    await expect(panel.getByRole('link', { name: '看这天的时段' })).toHaveCount(0)
    reply = { json: { data: [oneSeat] } }
    await ask('那就明天吧')
    await expect(panel.getByRole('status')).toContainText('当前公开时段的空位不足 3 人')
    await expect(panel.getByRole('status')).not.toContainText('10:00')
    reply = { json: { data: [oneSeat, threeSeats] } }
    const [, month, day] = tomorrow.split('-')
    await ask(`${Number(month)} 月 ${Number(day)} 日还有三人名额吗？`)
    await expect(panel.getByRole('status')).toContainText(tomorrow)
    await expect(panel.getByRole('status')).toContainText('14:00–15:00 可选')
    await ask('2099-12-01 还有参观名额吗？')
    await expect(panel.getByRole('status')).toContainText('2099-12-01 不在当前 14 天的公开预约范围内')
    await expect(panel.getByRole('link', { name: '看这天的时段' })).toHaveCount(0)
    expect(requestedDates).toEqual(Array.from({ length: 7 }, () => [tomorrow, tomorrow]))
  } finally {
    await page.unroute(slotQuery, interceptSlots)
  }
  await ask('明天还有三个人的名额吗？')
  const [slotRefresh] = await Promise.all([
    page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/appointment-slots' && !url.search && response.ok()
    }),
    panel.getByRole('link', { name: '看这天的时段' }).click(),
  ])
  expect(Array.isArray((await slotRefresh.json()).data)).toBe(true)
  await expect(page).toHaveURL(/\/appointment\?date=\d{4}-\d{2}-\d{2}$/)
  await expect(page.locator('.appointment-selected-date')).toHaveText(tomorrow)
  await expect(page.locator('.appointment-time[aria-pressed="true"]')).toHaveCount(0)
  const askSlots = page.getByRole('button', { name: '问时段', exact: true })
  const appointmentActions = page.locator('.appointment-guide-actions')
  await expect(askSlots).toBeVisible()
  await expect(appointmentActions.getByRole('button', { name: '回到青铜鼎 · 鼎耳' })).toBeVisible()
  const slotEntrySize = await askSlots.boundingBox()
  expect(slotEntrySize?.height).toBeGreaterThanOrEqual(44)
  expect(slotEntrySize?.width).toBeGreaterThanOrEqual(44)
  await askSlots.focus()
  await askSlots.press('Enter')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('')
  await expect(panel.getByRole('status')).toContainText('想查哪天的公开时段')
  await expect(panel.getByRole('button', { name: '回到青铜鼎 · 鼎耳' })).toBeVisible()
  await input.press('Escape')
  await expect(askSlots).toBeFocused()
  if (page.viewportSize()?.width === 1440) {
    const allSlots = url => url.pathname === '/api/v1/appointment-slots' && !url.search
    const failRefresh = route => route.fulfill({ status: 503 })
    await page.route(allSlots, failRefresh, { times: 1 })
    await askSlots.click()
    await ask('后天还有三个人的名额吗？')
    await panel.getByRole('link', { name: '看这天的时段' }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('date') === dayAfter)
    await expect(askSlots).toBeFocused()
    await expect(page.locator('.appointment-empty[role="alert"]')).toBeVisible()
    await expect(page.locator('.appointment-time')).toHaveCount(0)
    const retry = page.waitForResponse(response => allSlots(new URL(response.url())) && response.ok())
    await page.locator('.appointment-empty').getByRole('button').click()
    await retry
    await expect(page.locator('.appointment-selected-date')).toHaveText(dayAfter)
    await expect(page.locator('.appointment-time[aria-pressed="true"]')).toHaveCount(0)
  }
  await askSlots.click()
  await ask('接着看玉器')
  await expect(panel.getByRole('link', { name: /玉璧/ })).toBeVisible()
  await expect(page).toHaveURL(/\/appointment\?date=\d{4}-\d{2}-\d{2}$/)
  await ask('回到刚才那只耳朵')
  await expect(panel.getByRole('status')).toContainText('回到青铜鼎 · 鼎耳，接着看刚才的图版。')
  await expect(page).toHaveURL(/\/appointment\?date=\d{4}-\d{2}-\d{2}$/)
  await panel.getByRole('button', { name: '回到青铜鼎 · 鼎耳' }).click()
  await expect(heading).toBeFocused()
  await page.getByRole('link', { name: '去 3D 看鼎耳' }).click()
  await expect(page).toHaveURL(/\/exhibits\/heluo-bronze-ding-3d$/)
  await expect(heading).toBeFocused()
  await page.getByRole('link', { name: '回到藏品展签' }).click()
  await expect(heading).toBeFocused()
  await page.getByRole('button', { name: '三足', exact: true }).click()
  const feetHeading = page.getByRole('heading', { name: '三足图版' })
  const caption = page.locator('.approved-figure figcaption')
  await expect(caption).toContainText('侧视')
  async function visitSlotsAndReturn() {
    await page.getByRole('button', { name: '接着问' }).click()
    if (process.env.LUOSHENG_CHECK_SEEDED_SLOTS === '1') {
      const response = page.waitForResponse(reply => slotQuery(new URL(reply.url())) && reply.ok())
      await timeReply('slots-seeded-api', '后天还有三个人的名额吗？', async () => {
        const slotReply = await response
        const date = new URL(slotReply.url()).searchParams
        expect([date.get('dateFrom'), date.get('dateTo')]).toEqual([dayAfter, dayAfter])
        const slots = (await slotReply.json()).data
        const firstMatch = slots.find(slot => slot.remainingPeople >= 3)
        expect(firstMatch?.visitDate).toBe(dayAfter)
        if (process.env.LUOSHENG_EXPECT_SLOT_FIXTURE_PAIR === '1') {
          expect(slots[0]?.remainingPeople).toBe(1)
          expect(firstMatch.startTime).toBe('09:30:00')
          expect(firstMatch.remainingPeople).toBe(6)
        }
        await expect(panel.getByRole('status')).toContainText(
          `${firstMatch.startTime.slice(0, 5)}–${firstMatch.endTime.slice(0, 5)} 可选，查询时余 ${firstMatch.remainingPeople} 个名额`,
        )
        await expect(panel.getByRole('link', { name: '看这天的时段' })).toBeVisible()
      })
    } else {
      await ask('明天还有三个人的名额吗？')
    }
    const refresh = page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/appointment-slots' && !url.search && response.ok()
    })
    await panel.getByRole('link', { name: '看这天的时段' }).click()
    await refresh
    await expect(page.locator('.appointment-selected-date')).toHaveText(
      process.env.LUOSHENG_CHECK_SEEDED_SLOTS === '1' ? dayAfter : tomorrow,
    )
    await expect(input).toBeHidden()
    const inlineReturn = appointmentActions.getByRole('button', { name: '回到青铜鼎 · 三足' })
    await expect(inlineReturn).toBeVisible()
    await inlineReturn.scrollIntoViewIfNeeded()
    await expect(inlineReturn).toBeInViewport()
    const returnSize = await inlineReturn.boundingBox()
    expect(returnSize?.height).toBeGreaterThanOrEqual(44)
    expect(returnSize?.width).toBeGreaterThanOrEqual(44)
    if (page.viewportSize()?.width !== 390) {
      await inlineReturn.focus()
      await inlineReturn.press('Enter')
    } else {
      await inlineReturn.click()
    }
    await expect(feetHeading).toBeFocused()
  }
  await page.getByRole('button', { name: '看背视图', exact: true }).click()
  await visitSlotsAndReturn()
  await expect(caption).toContainText('背视')
  await page.getByRole('button', { name: '看侧视图', exact: true }).click()
  await visitSlotsAndReturn()
  await expect(caption).toContainText('侧视')

  await bufferGuideReply(page)
  try {
    const resume = page.getByRole('button', { name: '接着问' })
    const isTurn = request => new URL(request.url()).pathname === '/api/v1/guide/turns'
    await resume.click()
    const [previousRequest] = await Promise.all([page.waitForRequest(isTurn), ask('这个看点的依据是什么？')])
    const previous = await page.evaluate(() => window.guideTestDelay.buffered)
    expect(previous.data.citations[0]?.reference.cardId).toBe('LS-DING-FEET')
    await input.press('Escape')
    await expect(resume).toBeFocused()
    await resume.click()
    await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
    const [resumedRequest] = await Promise.all([page.waitForRequest(isTurn), ask('这个看点的依据是什么？')])
    expect(resumedRequest.postDataJSON().lookpoint).toBe('feet')
    expect(resumedRequest.postDataJSON().contextVersion).toBeGreaterThan(previousRequest.postDataJSON().contextVersion)
    await expect(panel.getByText('查看本轮依据')).toBeVisible()
    await input.press('Escape')
    await page.getByRole('button', { name: '鼎耳', exact: true }).click()
    await resume.click()
    await ask('这个看点的依据是什么？')
    await panel.getByText('查看本轮依据').click()
    await expect(panel.getByRole('link', { name: 'LS-DING-EARS · 修订 1' })).toBeVisible()
  } finally {
    await page.evaluate(() => window.guideTestDelay.release())
  }
  await expect(panel.getByRole('link', { name: 'LS-DING-EARS · 修订 1' })).toBeVisible()
  await expect(panel.getByText(/LS-DING-FEET/)).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: '问洛笙', exact: true }).click()
  await ask('另一只呢')
  const clarify = panel.getByRole('group', { name: '请选择你想问的部位' })
  await expect(clarify.getByRole('button')).toHaveCount(3)
  await expect(answer).toHaveAttribute('aria-live', 'polite')
  await expect(input).toBeFocused()
  const repeat = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/guide/journey'
    && response.status() === 204 && response.request().postDataJSON()?.kind === 'clarification-repeated')
  await ask('另一只呢')
  const repeatRequest = (await repeat).request()
  expect(repeatRequest.postDataJSON()).toEqual({ kind: 'clarification-repeated' })
  expect(await repeatRequest.headerValue('cookie')).toBeNull()
  expect(await repeatRequest.headerValue('referer')).toBeNull()
  for (const key of ['Enter', 'Space']) {
    const clarificationRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/guide/turns'
      && request.postDataJSON().question === '三足')
    await clarify.getByRole('button', { name: '三足', exact: true }).press(key)
    await clarificationRequest
    await expect(answer).toContainText('Approved foot observation')
    await expect(clarify).toHaveCount(0)
    if (key === 'Enter') {
      await page.reload()
      await page.getByRole('button', { name: '问洛笙', exact: true }).click()
      await ask('另一只呢')
      await expect(clarify).toBeVisible()
    }
  }
  await ask('它多大、哪里出土？')
  await expect(answer).toContainText('Synthetic overall size')
  await expect(answer).toContainText('缺的是：出土地记录。')
  await expect(input).toBeFocused()
  await panel.getByText('查看本轮依据').click()
  await expect(panel.getByRole('link', { name: 'LS-DING-SIZE · 修订 1' })).toBeVisible()
  await expect(panel.getByRole('link', { name: 'LS-DING-SOURCE · 修订 2' })).toBeVisible()
  const reviewed = new Set(Object.values(lexicon.exhibits['heluo-bronze-ding-3d'].suggestedQuestions)
    .flat().map(item => item.q))
  const shownQuestions = async () => (await suggestions.getByRole('button').allTextContents())
    .map(label => label.trim()).filter(label => reviewed.has(label))
  const primary = await shownQuestions()
  expect(primary).toHaveLength(2)
  const more = suggestions.getByRole('button', { name: '更多', exact: true })
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.press('Enter')
  const all = await shownQuestions()
  expect(all.length).toBeGreaterThan(primary.length)
  const geometry = await suggestions.evaluate(group => {
    const bounds = group.getBoundingClientRect()
    const buttons = [...group.querySelectorAll('button')].map(button => button.getBoundingClientRect())
    return {
      viewportWidth: innerWidth,
      fits: group.scrollWidth <= group.clientWidth + 1
        && buttons.every(button => button.left >= bounds.left - 1 && button.right <= bounds.right + 1),
      rows: new Set(buttons.map(rect => Math.round(rect.top))).size,
    }
  })
  expect(geometry.fits, `suggestion layout: ${JSON.stringify(geometry)}`).toBe(true)
  if (geometry.viewportWidth <= 390) expect(geometry.rows).toBeGreaterThan(1)
  // At short heights the wrapped list may scroll vertically, but its last
  // action and the composer must still be reachable with the keyboard.
  const selfTour = suggestions.getByRole('button', { name: '我先自己逛', exact: true })
  await suggestions.getByRole('button', { name: '收起', exact: true }).focus()
  for (let i = 0; i < await suggestions.getByRole('button').count(); i++) {
    if (await selfTour.evaluate(button => button === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(selfTour).toBeFocused()
  await expect(selfTour).toBeInViewport({ ratio: 0.9 })
  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()
  await expect(input).toBeInViewport({ ratio: 0.9 })
  await expect(panel.getByRole('button', { name: '发送' })).toBeInViewport({ ratio: 0.9 })
  await suggestions.getByRole('button', { name: '收起', exact: true }).press('Enter')
  expect(await shownQuestions()).toEqual(primary)
  await expect.poll(() => [...journey.entries()].filter(([kind]) => !kind.startsWith('clarification-')).sort()).toEqual([
    ['plate-arrived', 1], ['plate-attempted', 1], ['return-arrived', 3], ['return-attempted', 3],
  ])

  for (const [path, response, message] of [
    ['/api/v1/guide/exhibits/heluo-bronze-ding-3d', { json: { data: { available: false, entries: [] } } }, '原看点暂时不可用'],
    ['/api/v1/artifacts/heluo-bronze-ding', { status: 404 }, '暂时无法打开原展品'],
  ]) {
    await page.reload()
    await page.getByRole('button', { name: '阅读洛笙讲解' }).click()
    await page.getByRole('button', { name: '鼎耳', exact: true }).click()
    await page.getByRole('button', { name: '接着问' }).click()
    await ask('明天还有三个人的名额吗？')
    await panel.getByRole('link', { name: '看这天的时段' }).click()
    await expect(page).toHaveURL(/\/appointment\?date=/)
    const matches = url => url.pathname === path
    const fulfill = route => route.fulfill(response)
    await page.route(matches, fulfill)
    try {
      await appointmentActions.getByRole('button', { name: '回到青铜鼎 · 鼎耳' }).click()
      await expect(panel.getByRole('status')).toContainText(message)
      await expect(panel.getByRole('link', { name: '探索公开馆藏' })).toBeVisible()
      await expect(panel.getByRole('heading')).toBeFocused()
      await expect(heading).toHaveCount(0)
      await expect(panel.getByRole('button', { name: '回到青铜鼎 · 鼎耳' })).toHaveCount(0)
      if (response.status === 404) {
        await panel.getByRole('link', { name: '探索公开馆藏' }).click()
        await expect(page).toHaveURL(/\/explore$/)
      }
    } finally {
      await page.unroute(matches, fulfill)
    }
  }
  await expect.poll(() => [...journey.entries()].filter(([kind]) => !kind.startsWith('clarification-')).sort()).toEqual([
    ['plate-arrived', 1], ['plate-attempted', 1], ['return-arrived', 3], ['return-attempted', 5],
  ])

  if (page.viewportSize()?.width === 1440) {
    await page.goto(base + '/appointment')
    await expect(askSlots).toBeVisible()
    await expect(appointmentActions.getByRole('button', { name: /^回到青铜鼎/ })).toHaveCount(0)
  }

  await page.goto(base + '/artifacts/heluo-bronze-ding')
  await page.getByRole('button', { name: '阅读洛笙讲解' }).click()
  await page.getByRole('button', { name: '鼎耳', exact: true }).click()
  const modelRequest = url => /\.glb$/i.test(url.pathname)
  let modelRequests = 0
  const failModel = route => {
    modelRequests += 1
    return route.abort()
  }
  await page.route(modelRequest, failModel)
  try {
    await page.getByRole('link', { name: '去 3D 看鼎耳' }).click()
    await expect(page).toHaveURL(/\/exhibits\/heluo-bronze-ding-3d$/)
    await expect(heading).toBeFocused()
    const startViewer = page.getByRole('button', { name: '进入互动 3D' })
    await expect(startViewer).toBeVisible()
    expect(modelRequests).toBe(0)
    await startViewer.click()
    await expect.poll(() => modelRequests).toBeGreaterThan(0)
    await expect(page.getByText(/3D 模型暂时无法加载/)).toBeVisible()
    await expect(page.locator('.approved-figure figcaption')).toContainText('鼎耳 · 俯视')
    await page.getByRole('button', { name: '接着问' }).click()
    await expect(input).toBeFocused()
    await ask('这个看点的依据是什么？')
    await panel.getByText('查看本轮依据').click()
    await expect(panel.getByRole('link', { name: 'LS-DING-EARS · 修订 1' })).toBeVisible()
    await input.press('Escape')
  } finally {
    await page.unroute(modelRequest, failModel)
  }

  await page.goto(base)
  const previousAttempts = journey.get('plate-attempted') ?? 0
  const previousArrivals = journey.get('plate-arrived') ?? 0
  const releaseUnavailableFigure = Promise.withResolvers()
  const unavailableFigureFinished = Promise.withResolvers()
  const requestsStayPending = page.viewportSize()?.width === 390
  let requestedUnavailableFigure = false
  const failFigure = async route => {
    requestedUnavailableFigure = true
    try {
      if (requestsStayPending) await releaseUnavailableFigure.promise
      await route.abort()
    } finally {
      unavailableFigureFinished.resolve()
    }
  }
  await page.route(figureModule, failFigure)
  try {
    await trigger.click()
    await ask('我只有五分钟，带我看一件')
    await panel.getByRole('button', { name: '带我找鼎耳' }).click()
    await expect.poll(() => requestedUnavailableFigure).toBe(true)
    const reading = page.getByRole('heading', { name: '鼎耳说明' })
    await expect(reading).toBeFocused({ timeout: 12000 })
    await expect(page.getByText('图版暂不可用，可继续阅读看点说明。')).toBeVisible()
    await expect(page.locator('[data-observation-text]')).toContainText('Approved observation')
    await expect.poll(() => journey.get('plate-attempted')).toBe(previousAttempts + 1)
    expect(journey.get('plate-arrived')).toBe(previousArrivals)
    const resume = page.getByRole('button', { name: '接着问' })
    await resume.click()
    await expect(input).toBeFocused()
    await ask('这个看点的依据是什么？')
    await panel.getByText('查看本轮依据').click()
    await expect(panel.getByRole('link', { name: 'LS-DING-EARS · 修订 1' })).toBeVisible()
    await input.press('Escape')
    await expect(resume).toBeFocused()
  } finally {
    releaseUnavailableFigure.resolve()
    if (requestedUnavailableFigure) await unavailableFigureFinished.promise
    await page.unroute(figureModule, failFigure)
  }

  await page.goto(base)
  await trigger.click()
  const birdQuery = url => url.pathname === '/api/v1/search' && url.searchParams.get('keyword') === '鸟'
  const birdSearch = page.waitForResponse(response => birdQuery(new URL(response.url())) && response.ok())
  const birdQuestion = '我想看看和鸟相关的藏品'
  const birdLink = panel.getByRole('link', { name: /水鸟青铜雕塑/ })
  await timeReply('public-search', birdQuestion, async () => {
    const { data } = await (await birdSearch).json()
    expect(data.items[0].slug).toBe('water-bird-bronze')
    await expect(panel.getByRole('status')).toContainText('公开标题提到了「鸟」')
    await expect(birdLink).toBeVisible()
  })
  const birdCover = panel.locator('img.site-guide-cover')
  await expect.poll(() => birdCover.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  const birdCoverPath = await birdCover.getAttribute('src')
  let failedSearches = 0
  const searchUnavailable = route => {
    failedSearches++
    return route.fulfill({ status: 503, json: { message: '测试：搜索暂不可用' } })
  }
  await page.route(birdQuery, searchUnavailable)
  try {
    await ask(birdQuestion)
    await expect(panel.getByRole('status')).toHaveText(/馆藏搜索暂时不可用/)
    await expect(birdLink).toHaveCount(0)
    await expect(page).toHaveURL(new URL('/', base).href)
    expect(failedSearches).toBe(1)
  } finally {
    await page.unroute(birdQuery, searchUnavailable)
  }
  const coverUrl = new URL(birdCoverPath, base).href
  const breakCover = route => route.abort('failed')
  await page.route(coverUrl, breakCover)
  try {
    const retried = page.waitForResponse(response => birdQuery(new URL(response.url())) && response.ok())
    const coverFailed = page.waitForEvent('requestfailed', { predicate: request => request.url() === coverUrl, timeout: 5000 })
    await panel.getByRole('button', { name: '重试搜索' }).click()
    await retried
    await coverFailed
    await expect(birdCover).toHaveCount(0)
    await expect(panel.getByRole('status')).toContainText('公开标题提到了「鸟」')
    await expect(input).toBeFocused()
    await expect(birdLink).toBeVisible()
  } finally {
    await page.unroute(coverUrl, breakCover)
  }
  await birdLink.click()
  await expect(page).toHaveURL(/\/artifacts\/water-bird-bronze$/)
  await expect(page.getByRole('heading', { name: /水鸟青铜雕塑.*概念展品/ })).toBeVisible()

  await page.goto(base)
  await trigger.click()
  await ask('我想找紫云龙纹方盒')
  await expect(panel.getByRole('status')).toContainText('没有找到「紫云龙纹方盒」的公开藏品')
  await expect(panel.getByRole('button', { name: '重试搜索' })).toHaveCount(0)
  const jadeSearch = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/v1/search' && ['玉器', '玉璧'].includes(url.searchParams.get('keyword')) && response.ok()
  })
  await timeReply('public-search', '不看鼎，我想找玉器', async () => {
    await jadeSearch
    await expect(panel.getByRole('status')).toContainText('玉璧')
    await expect(panel.getByRole('link', { name: /玉璧/ })).toBeVisible()
  })
  await panel.getByRole('link', { name: /玉璧/ }).click()
  await expect(page).toHaveURL(/\/artifacts\/river-map-jade-bi$/)
  await page.getByRole('button', { name: '问洛笙', exact: true }).click()
  await ask('它是什么？')
  await expect(panel.getByRole('status')).toContainText('概念展品')
  console.log(`Candidate guide UI timing ${JSON.stringify({
    width: page.viewportSize()?.width,
    theme: await page.locator('html').getAttribute('data-theme'),
    samples: replyTimings,
    realModelSamples: 0,
  })}`)
}

async function checkPublicDetour(page, base) {
  await page.goto(base)
  const panel = page.getByRole('complementary', { name: '洛笙全站导览' })
  const trigger = panel.getByRole('button', { name: '洛笙导览', exact: true })
  const input = panel.getByRole('textbox', { name: '问洛笙' })
  async function ask(question) {
    await expect(trigger.or(input)).toBeVisible()
    if (await trigger.isVisible()) await trigger.click()
    await input.fill(question)
    await input.press('Enter')
  }
  await ask('我只有五分钟，带我看一件')
  await panel.getByRole('button', { name: '带我找鼎耳' }).click()
  await expect(page.getByRole('heading', { name: '鼎耳图版' })).toBeFocused()
  const exhibit = page.getByRole('region', { name: '洛笙', exact: true })
  await exhibit.getByRole('button', { name: '三足', exact: true }).click()
  await exhibit.getByRole('button', { name: '看背视图', exact: true }).click()
  const caption = exhibit.locator('figcaption')
  await expect(caption).toContainText('背视')
  const nav = page.getByRole('navigation', { name: page.viewportSize()?.width === 390 ? '移动端主导航' : '主导航', exact: true })
  await nav.locator('a[href="/shop"]').click()
  await page.waitForURL('**/shop')
  await trigger.click()
  await expect(panel.getByRole('status')).toContainText('怎么浏览商品')
  await ask('回到刚才的三足')
  const resume = panel.getByRole('button', { name: '回到青铜鼎 · 三足' })
  await expect(resume).toBeVisible()
  await expect(page).toHaveURL(/\/shop$/)
  await resume.click()
  await expect(page.getByRole('heading', { name: '三足图版' })).toBeFocused()
  await expect(caption).toContainText('背视')

  await nav.locator('a[href="/explore"]').click()
  await page.waitForURL('**/explore')
  const article = page.locator('.gallery-story[href^="/articles/"]').first()
  const articleReply = page.waitForResponse(response => new URL(response.url()).pathname.startsWith('/api/v1/articles/') && response.ok())
  await article.click()
  const { data: published } = await (await articleReply).json()
  await expect(page.getByRole('heading', { name: published.title, exact: true })).toBeVisible()
  await ask('这篇讲什么？')
  await expect(panel.locator('.site-guide-title')).toContainText(published.title)
  await expect(panel.getByRole('status')).toContainText(published.summary)
  await ask('这里可以预约吗？')
  await expect(panel.getByRole('link', { name: '预约参观' })).toBeVisible()
  await ask('回到刚才的三足')
  await expect(resume).toBeVisible()
  await expect(page).toHaveURL(/\/articles\/[^/]+$/)
  await resume.click()
  await expect(page.getByRole('heading', { name: '三足图版' })).toBeFocused()
  await expect(caption).toContainText('背视')

  await nav.locator('a[href="/explore"]').click()
  await page.waitForURL('**/explore')
  await page.route('**/api/v1/articles/*', route => route.fulfill({ status: 404, json: { message: '测试：专题已撤回' } }), { times: 1 })
  await article.click()
  await expect(page.getByRole('heading', { name: '暂时无法打开这页内容' })).toBeVisible()
  await ask('这篇讲什么？')
  await expect(panel.getByRole('status')).toContainText('还没有读到这篇专题的公开资料')
  await expect(panel.locator('.site-guide-title')).not.toContainText(published.title)
  await ask('回到刚才的三足')
  await expect(panel.getByRole('status')).not.toContainText('正在查找相关资料')
  await expect(resume).toHaveCount(0)
}

async function checkNavigationDuringTurn(page, base, credentials) {
  const login = await page.request.post(base + '/api/v1/auth/login', {
    data: credentials,
    maxRedirects: 0,
  })
  expect(login.ok()).toBe(true)
  const { data: { accessToken } } = await login.json()
  await page.addInitScript(token => localStorage.setItem('heluo.access-token', token), accessToken)
  await page.goto(base + '/explore?q=' + encodeURIComponent('河洛青铜鼎'))
  const artifact = page.locator('a[href="/artifacts/heluo-bronze-ding"]').first()
  await artifact.click()
  const panel = page.getByRole('complementary', { name: '洛笙全站导览' })
  const input = panel.getByRole('textbox', { name: '问洛笙' })
  const profile = page.locator('header a[href="/profile"]').first()

  for (const destination of ['explore', 'profile', 'language']) {
    await page.getByRole('button', { name: '阅读洛笙讲解' }).click()
    await page.getByRole('button', { name: '三足', exact: true }).click()
    await page.getByRole('button', { name: '接着问' }).click()
    await bufferGuideReply(page)
    await input.fill('这个看点的依据是什么？')
    const [request] = await Promise.all([
      page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/guide/turns'),
      input.press('Enter'),
    ])
    const previous = await page.evaluate(() => window.guideTestDelay.buffered)
    expect(previous.data.citations[0]?.reference.cardId).toBe('LS-DING-FEET')
    expect(await request.headerValue('authorization')).toBeNull()
    expect(Object.keys(request.postDataJSON()).sort()).toEqual([
      'artifact', 'contextVersion', 'exhibit', 'locale', 'lookpoint', 'question', 'requestId', 'visitId',
    ])

    try {
      if (destination === 'explore') await page.goBack()
      else if (destination === 'profile') await profile.click()
      else await page.getByRole('button', { name: 'EN', exact: true }).click()
      if (destination === 'language') {
        await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
        await expect(page).toHaveURL(/\/artifacts\/heluo-bronze-ding$/)
      } else {
        await expect(page).toHaveURL(url => url.pathname === '/' + destination)
      }
      await expect.poll(() => page.evaluate(() => Promise.race([
        window.guideTestDelay.aborted, Promise.resolve(false),
      ]))).toBe(true)
      if (destination !== 'explore') await expect(panel).toHaveCount(0)
    } finally {
      await page.evaluate(() => {
        window.guideTestDelay.release()
        return window.guideTestDelay.delivered
      })
    }

    if (destination === 'explore') await artifact.click()
    else if (destination === 'profile') await page.goBack()
    else await page.getByRole('button', { name: '中文', exact: true }).click()
    await expect(page).toHaveURL(/\/artifacts\/heluo-bronze-ding$/)
    await page.getByRole('button', { name: '问洛笙', exact: true }).click()
    await expect(panel.getByText(/LS-DING-FEET/)).toHaveCount(0)
    await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
    await input.fill('另一只呢')
    const [next] = await Promise.all([
      page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/guide/turns'),
      input.press('Enter'),
    ])
    expect(next.postDataJSON().lookpoint).toBeNull()
    if (destination !== 'explore') expect(next.postDataJSON().visitId).not.toBe(request.postDataJSON().visitId)
    await expect(panel.getByRole('group', { name: '请选择你想问的部位' }).getByRole('button')).toHaveCount(3)
    await input.press('Escape')
  }
}

async function checkVisitEnd(page, base) {
  await page.goto(base)
  const panel = page.getByRole('complementary', { name: '洛笙全站导览' })
  const trigger = panel.getByRole('button', { name: '洛笙导览', exact: true })
  const input = panel.getByRole('textbox', { name: '问洛笙' })
  const send = async (question) => {
    await input.fill(question)
    const [request] = await Promise.all([
      page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/guide/turns'),
      input.press('Enter'),
    ])
    return request.postDataJSON()
  }

  await trigger.click()
  await input.fill('我只有五分钟，带我看一件')
  await input.press('Enter')
  await panel.getByRole('button', { name: '带我找鼎耳' }).click()
  const continueAsking = page.getByRole('button', { name: '接着问' })
  await continueAsking.click()
  const first = await send('另一只呢')
  await expect(panel.getByRole('button', { name: '看俯视图' })).toBeVisible()
  const caption = page.locator('.approved-figure figcaption')
  const correction = await send('我说的是脚')
  expect(correction.lookpoint).toBe('ear')
  await expect(panel.getByRole('button', { name: '看背视图' })).toBeVisible()
  const indirect = await send('另一只呢')
  expect(indirect.contextVersion).toBe(correction.contextVersion)
  await expect(panel.getByRole('button', { name: '看背视图' })).toBeVisible()
  await panel.getByText('查看本轮依据').click()
  await expect(panel.getByText('LS-DING-FEET · 修订 1')).toBeVisible()
  await expect(caption).toContainText('鼎耳 · 俯视')
  await input.press('Escape')
  await expect(continueAsking).toBeFocused()
  await page.getByRole('button', { name: '鼎耳', exact: true }).click()
  await continueAsking.press('Enter')
  await expect(input).toBeFocused()

  await bufferGuideReply(page)
  const beforeEnd = await send('另一只呢')
  try {
    expect(beforeEnd.visitId).toBe(first.visitId)
    expect(beforeEnd.lookpoint).toBe('ear')
    const buffered = await page.evaluate(() => window.guideTestDelay.buffered)
    expect(buffered.data.citations[0]?.reference.cardId).toBe('LS-DING-EARS')
    await panel.getByRole('button', { name: '我先自己逛' }).press('Enter')
    await expect(continueAsking).toBeFocused()
    await expect.poll(() => page.evaluate(() => Promise.race([
      window.guideTestDelay.aborted, Promise.resolve(false),
    ]))).toBe(true)
  } finally {
    await page.evaluate(() => {
      window.guideTestDelay.release()
      return window.guideTestDelay.delivered
    })
  }

  await trigger.click()
  await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
  const afterEnd = await send('另一只呢')
  expect(afterEnd.visitId).not.toBe(first.visitId)
  expect(afterEnd.lookpoint).toBeNull()
  await expect(panel.getByRole('group', { name: '请选择你想问的部位' }).getByRole('button')).toHaveCount(3)
  await input.press('Escape')
  await expect(trigger).toBeFocused()

  await page.getByRole('button', { name: '三足', exact: true }).click()
  await continueAsking.click()
  const feet = await send('另一只呢')
  expect(feet.lookpoint).toBe('feet')
  await expect(panel.getByRole('button', { name: '看背视图' })).toBeVisible()
  await panel.getByText('查看本轮依据').click()
  await expect(panel.getByText('LS-DING-FEET · 修订 1')).toBeVisible()
  await panel.getByRole('button', { name: '看背视图' }).click()
  await expect(caption).toContainText('三足 · 背视')
}

async function checkTurnFallback(page, base) {
  await page.goto(base + '/artifacts/heluo-bronze-ding')
  const panel = page.getByRole('complementary', { name: '洛笙全站导览' })
  const input = panel.getByRole('textbox', { name: '问洛笙' })
  const answer = panel.getByRole('status', { name: '洛笙的回答' })
  const resume = page.getByRole('button', { name: '接着问' })
  await page.getByRole('button', { name: '阅读洛笙讲解' }).click()
  await page.getByRole('button', { name: '三足', exact: true }).click()
  await page.getByRole('button', { name: '看背视图', exact: true }).click()
  const caption = page.locator('.approved-figure figcaption')
  const submit = async (question) => {
    await input.fill(question)
    await input.press('Enter')
  }
  await resume.click()
  await submit('这个看点的依据是什么？')
  await expect(panel.getByText('查看本轮依据')).toBeVisible()

  const turnsUrl = '**/api/v1/guide/turns'
  for (const [kind, message] of [
    ['GENERATION_TIMEOUT', ui.errors.timeout],
    ['GENERATION_LIMIT_REACHED', ui.errors.limit],
    ['GENERATION_BUSY', ui.errors.busy],
    ['GENERATION_UNAVAILABLE', ui.errors.generation],
    ['QUESTIONING_DISABLED', ui.errors.paused],
    ['network-failure', ui.site.unavailable],
    ['no-response', ui.errors.timeout],
  ]) {
    let requests = 0
    const release = Promise.withResolvers()
    const intercept = async route => {
      requests++
      if (kind === 'network-failure') return route.abort()
      if (kind === 'no-response') {
        await release.promise
        return route.abort().catch(() => {})
      }
      return route.fulfill({ json: { data: { kind, text: null, citations: [], plate: null, generated: false } } })
    }
    await page.route(turnsUrl, intercept)
    try {
      await submit('这个看点的依据是什么？')
      const progress = panel.getByText(ui.progress.checking, { exact: true })
      if (kind === 'no-response') await expect(progress).toBeVisible({ timeout: 4500 })
      await expect(answer).toContainText(message, { timeout: kind === 'no-response' ? 10_000 : 5_000 })
      await expect(progress).toHaveCount(0)
      await expect(panel.getByText('查看本轮依据')).toHaveCount(0)
      await expect(caption).toContainText('背视')
      const [reread] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/guide/exhibits/heluo-bronze-ding-3d' && response.ok()),
        panel.getByRole('button', { name: '读当前讲解' }).press('Enter'),
      ])
      expect((await reread.json()).data.available).toBe(true)
      await expect(page.getByRole('heading', { name: '三足图版' })).toBeFocused()
      await expect(caption).toContainText('背视')
      expect(requests).toBe(1)
      await resume.press('Enter')
      await expect(input).toBeFocused()
    } finally {
      release.resolve()
      await page.unroute(turnsUrl, intercept)
    }
  }
}

async function checkGuideReflow(page, base) {
  await page.goto(base)
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  const panel = page.getByRole('complementary', { name: '洛笙全站导览' })
  const trigger = panel.getByRole('button', { name: '洛笙导览', exact: true })
  await trigger.click()
  const input = panel.getByRole('textbox', { name: '问洛笙' })
  await input.fill('我只有五分钟，带我看一件')
  await expect(input).toBeInViewport()
  await expect(panel.getByRole('button', { name: '发送' })).toBeInViewport()
  await expect(panel.getByRole('button', { name: '关闭洛笙导览' })).toBeInViewport()
  await input.press('Enter')
  await expect(panel.getByRole('button', { name: '带我找鼎耳' })).toBeVisible()
  await input.press('Escape')
  await expect(trigger).toBeFocused()
}

async function checkNativeZoom(base) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome', headless: true, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce',
  })
  try {
    const settings = context.pages()[0]
    await settings.goto('chrome://settings/appearance')
    await settings.locator('#zoomLevel').selectOption('2')
    await expect(settings.locator('#zoomLevel')).toHaveValue('2')
    for (const theme of ['light', 'dark']) {
      const page = await context.newPage()
      try {
        await page.addInitScript(({ theme, origin }) => {
          if (location.origin === origin) localStorage.setItem('heluo.theme', theme)
        }, { theme, origin: new URL(base).origin })
        await page.goto(base)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        expect(await page.evaluate(() => ({
          width: innerWidth, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom,
        }))).toEqual({ width: 720, dpr: 2, cssZoom: '1' })
        await checkCandidate(page, base)
        console.log(`Candidate guide passed native Chrome 200% ${theme}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await context.close()
  }
}

const deployment = process.env.LUOSHENG_CANDIDATE_ORIGIN
if (deployment && process.env.LUOSHENG_CHECK_PUBLIC_TURNS !== 'true') {
  throw new Error('Set LUOSHENG_CHECK_PUBLIC_TURNS=true to exercise a deployed candidate')
}
const credentials = deployment
  ? { username: process.env.LUOSHENG_QA_USERNAME, password: process.env.LUOSHENG_QA_PASSWORD }
  : { username: 'guide_preset_test', password: 'GuidePresetFixtureOnly123' }
if (deployment && (
  new URL(deployment).hostname !== '127.0.0.1' || !credentials.username || !credentials.password
)) {
  throw new Error('Use an isolated 127.0.0.1 candidate and set LUOSHENG_QA_USERNAME and LUOSHENG_QA_PASSWORD')
}
const builtCandidate = process.env.LUOSHENG_CHECK_PUBLIC_TURNS === 'true'
  && (deployment || process.env.LUOSHENG_CANDIDATE_DIST)
const server = deployment ? null : builtCandidate
  ? await preview({ build: { outDir: builtCandidate }, preview: { host: '127.0.0.1', port: 0 } })
  : await createServer({ server: { host: '127.0.0.1', port: 0 } })
try {
  if (!builtCandidate) await server.listen()
  const base = deployment ? new URL(deployment).origin : `http://127.0.0.1:${server.httpServer.address().port}`
  if (builtCandidate && process.env.LUOSHENG_CHECK_NATIVE_ZOOM === '1') await checkNativeZoom(base)
  const browser = await chromium.launch({ executablePath: process.env.LUOSHENG_CHROME || undefined })
  try {
    const layouts = builtCandidate && process.env.LUOSHENG_CHECK_SWAPPED_THEMES === '1'
      ? [[390, 'dark'], [1440, 'light'], [390, 'light'], [1440, 'dark']]
      : [[390, 'dark'], [1440, 'light']]
    for (const [width, theme] of layouts) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width === 390, reducedMotion: 'reduce' })
      try {
        await page.addInitScript(value => localStorage.setItem('heluo.theme', value), theme)
        if (process.env.LUOSHENG_CHECK_PUBLIC_TURNS === 'true') {
          await checkCandidate(page, base)
          console.log(`Candidate guide passed ${width}px ${theme}`)
          await checkPublicDetour(page, base)
          console.log(`Candidate guide restored the explicitly confirmed plate after shop and article navigation at ${width}px ${theme}`)
          continue
        }
        await page.goto(`${base}/explore?q=${encodeURIComponent('河洛青铜鼎')}`)
        await page.locator('a[href="/artifacts/heluo-bronze-ding"]').first().click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        const guide = page.getByRole('region', { name: '洛笙' })
        await expect(guide.getByText('Approved observation')).toHaveCount(0)
        await guide.getByRole('button', { name: '带我看看' }).click()
        await expect(guide.getByText('Approved observation')).toBeVisible()
        await expect(guide.getByText('Draft note')).toHaveCount(0)
        await expect(guide.getByRole('link', { name: '查看参考资料' }))
          .toHaveAttribute('href', 'https://museum.example.test/record')
        await expect(guide.getByRole('textbox')).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(guide.getByRole('button', { name: '阅读洛笙讲解' })).toBeFocused()
        await expect(guide.getByText('Approved observation')).toHaveCount(0)
        await page.locator('.related-exhibit[href="/exhibits/heluo-bronze-ding-3d"]').click()
        await page.waitForURL('**/exhibits/heluo-bronze-ding-3d')
        await expect(guide.getByRole('button', { name: '带我看看' })).toHaveCount(0)
        await guide.getByRole('button', { name: '阅读洛笙讲解' }).click()
        await expect(guide.getByText('Approved observation')).toBeVisible()
        await guide.getByRole('button', { name: '结束讲解' }).click()
        await page.route('**/api/v1/guide/exhibits/*', route => route.abort())
        await guide.getByRole('button', { name: '阅读洛笙讲解' }).click()
        await expect(guide.getByText('这段讲解暂时不可用，可以继续浏览展品。')).toBeVisible()
        await expect(guide.getByText('Approved observation')).toHaveCount(0)
      } finally {
        await page.close()
      }
    }
    if (builtCandidate) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      try {
        await checkNavigationDuringTurn(page, base, credentials)
        console.log('Candidate guide passed cancellation on browser back, signed-in profile navigation and locale change')
        await checkVisitEnd(page, base)
        console.log('Candidate guide preserved visit on Escape and reset visit on explicit exit')
        await checkTurnFallback(page, base)
        console.log('Candidate guide returned to the reviewed plate after turn failure without retry')
      } finally {
        await page.close()
      }
    }
    if (builtCandidate && process.env.LUOSHENG_CHECK_SWAPPED_THEMES === '1') {
      const page = await browser.newPage({ viewport: { width: 1440, height: 844 }, reducedMotion: 'reduce' })
      try {
        await checkGuideReflow(page, base)
        console.log('Candidate guide passed 2x CSS zoom reflow')
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
} finally {
  await server?.close()
}
