import { randomBytes, randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { qualityEnvironment } from './environment'

interface Account { username: string; password: string; nickname: string; email: string }
interface Slot { id: number; visitDate: string; startTime: string; endTime: string; remainingPeople: number }
interface Appointment { id: number; appointmentNo: string; status: string }
interface Order { id: number; orderNo: string; status: string; payableAmount: number; items: { quantity: number }[] }
interface Product { id: number; name: string; price: string; availableStock: number }
interface PageResult<T> { items: T[]; total: number; totalPages: number }
const unique = () => randomUUID().replaceAll('-', '').slice(0, 14)
let cleanupActions: (() => Promise<unknown>)[] = []

async function api<T>(request: APIRequestContext, path: string, method = 'GET', data?: unknown, token?: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await request.fetch(`/api/v1${path}`, {
    method, data, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  })
  // Report only the route and status. Authentication bodies are never logged.
  expect(response.ok(), `${method} ${path} returned ${response.status()}`).toBeTruthy()
  return (await response.json()).data as T
}

async function account(request: APIRequestContext): Promise<Account> {
  const id = unique()
  const value = { username: `qa_${id}`, password: randomBytes(24).toString('base64url'), nickname: `验收${id}`, email: `qa-${id}@example.test` }
  await api(request, '/auth/register', 'POST', value)
  return value
}

async function tokenFor(request: APIRequestContext, credentials: { username: string; password: string }): Promise<string> {
  return (await api<{ accessToken: string }>(request, '/auth/login', 'POST', credentials)).accessToken
}

async function fillLogin(page: Page, credentials: { username: string; password: string }, returnTo: string) {
  await page.getByLabel('用户名', { exact: true }).fill(credentials.username)
  await page.locator('input[autocomplete="current-password"]').fill(credentials.password)
  await page.locator('.auth-panel form').getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${returnTo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
}

async function login(page: Page, credentials: { username: string; password: string }, returnTo: string) {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  await fillLogin(page, credentials, returnTo)
}

async function bookableSlot(request: APIRequestContext, adminToken: string): Promise<Slot> {
  const slots = await api<Slot[]>(request, '/appointment-slots')
  const tomorrow = new Date(Date.now() + 86400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  const existing = slots.find(slot => slot.visitDate >= tomorrow && slot.remainingPeople >= 2)
  if (existing) return existing
  const created = await api<Slot>(request, '/admin/appointment-slots', 'POST', {
    visitDate: tomorrow, startTime: '09:20:00', endTime: '10:20:00', capacity: 100, status: 'OPEN',
  }, adminToken)
  return { ...created, remainingPeople: 100 }
}

async function productFixture(request: APIRequestContext, adminToken: string): Promise<Product> {
  const id = unique()
  const product = await api<Product>(request, '/admin/products', 'POST', {
    sku: `QA-${id}`, name: `验收文创${id}`, slug: `qa-product-${id}`, summary: '隔离业务验收商品',
    description: '此商品只存在于隔离测试数据库。', price: '19.50', stockQuantity: 100,
    coverImageUrl: '/media/products/river-map-notebook.webp',
  }, adminToken)
  await api(request, `/admin/products/${product.id}/on-shelf`, 'POST', undefined, adminToken)
  cleanupActions.push(() => api(request, `/admin/products/${product.id}/off-shelf`, 'POST', undefined, adminToken))
  return product
}

function withdrawAfterTest(request: APIRequestContext, articleId: number, adminToken: string) {
  cleanupActions.push(async () => {
    const article = await api<{ status: string }>(request, `/admin/articles/${articleId}`, 'GET', undefined, adminToken)
    if (article.status === 'PUBLISHED') await api(request, `/admin/articles/${articleId}/withdraw`, 'POST', undefined, adminToken)
  })
}

test.beforeEach(async ({ page }) => {
  cleanupActions = []
  await page.addInitScript(() => {
    localStorage.setItem('heluo.locale', 'zh-CN')
    localStorage.setItem('heluo.theme', 'light')
  })
})

test.afterEach(async () => {
  const failures: string[] = []
  for (const cleanup of cleanupActions.reverse()) {
    try { await cleanup() } catch (error) { failures.push(error instanceof Error ? error.message : 'Fixture withdrawal failed') }
  }
  expect(failures, 'Temporary public fixtures must be withdrawn without deleting business records').toEqual([])
})

test('后台手动开放时段后游客可在公开日历选中', async ({ page, request, browser }) => {
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const day = new Date(Date.now() + 2 * 86400_000)
  if (day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Shanghai' }) === 'Mon') day.setTime(day.getTime() + 86400_000)
  const visitDate = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  const existing: Slot[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const result = await api<PageResult<Slot>>(request, `/admin/appointment-slots?page=${pageNumber}&size=50`, 'GET', undefined, adminToken)
    existing.push(...result.items.filter(slot => slot.visitDate === visitDate))
    if (pageNumber >= result.totalPages) break
  }
  const minute = Array.from({ length: 59 }, (_, i) => String(i).padStart(2, '0')).find(m => existing.every(slot => !slot.startTime.startsWith(`16:${m}`)))
  if (!minute) throw new Error('No free test start time')
  const values = { visitDate, startTime: `16:${minute}`, endTime: '16:59', capacity: 3 }
  await login(page, qualityEnvironment.admin, '/admin/operations')
  await page.getByRole('tab', { name: '预约时段' }).click()
  await page.getByTestId('admin-ops-open-create-drawer').click()
  await page.getByLabel('参观日期').fill(visitDate)
  await page.getByLabel('开始时间').fill(values.startTime)
  await page.getByLabel('结束时间').fill(values.endTime)
  await page.getByLabel('可预约人数').fill('3')
  const created = page.waitForResponse(r => r.url().endsWith('/api/v1/admin/appointment-slots') && r.request().method() === 'POST')
  await page.getByRole('button', { name: '创建时段', exact: true }).click()
  const response = await created
  expect(response.ok()).toBeTruthy()
  const slot = (await response.json()).data as Slot
  cleanupActions.push(() => api(request, `/admin/appointment-slots/${slot.id}`, 'PATCH', { ...values, status: 'CLOSED' }, adminToken))
  expect(await api<Slot[]>(request, `/appointment-slots?from=${visitDate}&to=${visitDate}`)).toContainEqual(expect.objectContaining({ id: slot.id, remainingPeople: 3 }))
  const visitor = await browser.newPage({ baseURL: qualityEnvironment.baseURL, locale: 'zh-CN', viewport: { width: 390, height: 844 } })
  try {
    await visitor.goto('/appointment')
    await visitor.getByTestId('calendar-month-select').selectOption(visitDate.slice(0, 7))
    await visitor.getByTitle(`选择日期: ${visitDate}`, { exact: true }).click()
    const choice = visitor.getByRole('button', { name: new RegExp(`^${values.startTime}.*${values.endTime}`) })
    await choice.click()
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
  } finally { await visitor.close() }
})

test('预约登录续填、管理员确认、个人中心状态一致', async ({ page, request, browser }) => {
  const visitor = await account(request)
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const slot = await bookableSlot(request, adminToken)
  await page.goto('/appointment')
  await page.getByTitle(`选择日期: ${slot.visitDate}`, { exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`^${slot.startTime.slice(0, 5)}.*${slot.endTime.slice(0, 5)}`) }).click()
  await page.getByLabel('联系人姓名', { exact: true }).fill(visitor.nickname)
  await page.getByLabel('联系人手机号', { exact: true }).fill('13800000000')
  await page.getByLabel('联系人邮箱', { exact: true }).fill(visitor.email)
  await page.getByRole('button', { name: '确认预约', exact: true }).click()
  await expect(page).toHaveURL(/\/login\?returnTo=/)
  await fillLogin(page, visitor, '/appointment')
  await expect(page.getByLabel('联系人姓名', { exact: true })).toHaveValue(visitor.nickname)
  await expect(page.getByLabel('联系人手机号', { exact: true })).toHaveValue('13800000000')
  await expect(page.getByLabel('联系人邮箱', { exact: true })).toHaveValue(visitor.email)
  const submitted = page.waitForResponse(response => response.url().endsWith('/api/v1/appointments') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '确认预约', exact: true }).click()
  const appointment = (await (await submitted).json()).data as Appointment
  await expect(page.getByText(/预约已提交/).first()).toBeVisible()
  await page.getByRole('link', { name: /查看我的预约/ }).first().click()
  await page.locator('.profile-records').scrollIntoViewIfNeeded()
  await expect(page.locator('.profile-record-card').filter({ hasText: appointment.appointmentNo })).toContainText('待处理')

  const adminContext = await browser.newContext({ baseURL: qualityEnvironment.baseURL, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
  try {
    const adminPage = await adminContext.newPage()
    await login(adminPage, qualityEnvironment.admin, '/admin/operations')
    await adminPage.getByRole('tab', { name: '预约', exact: true }).click()
    const row = adminPage.locator('.admin-list article').filter({ hasText: visitor.nickname })
    await row.getByRole('button', { name: '确认', exact: true }).click()
    await expect(row).toContainText('已确认')
  } finally { await adminContext.close() }
  await page.getByRole('button', { name: '刷新预约记录' }).click()
  await expect(page.locator('.profile-record-card').filter({ hasText: appointment.appointmentNo })).toContainText('已确认')
})

test('移动预约提交时余量已用尽，保留填写内容并可改约其他时段', async ({ page, request }) => {
  const visitor = await account(request)
  const otherVisitor = await account(request)
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const visitorToken = await tokenFor(request, visitor)
  const otherToken = await tokenFor(request, otherVisitor)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1, 10)
  if (date.getUTCDay() === 1) date.setUTCDate(11)
  const visitDate = date.toISOString().slice(0, 10)
  async function createSlot(startTime: string, endTime: string) {
    const values = { visitDate, startTime, endTime, capacity: 2, status: 'OPEN' }
    const slot = await api<Slot>(request, '/admin/appointment-slots', 'POST', values, adminToken)
    cleanupActions.push(() => api(request, `/admin/appointment-slots/${slot.id}`, 'PATCH',
      { ...values, status: 'CLOSED' }, adminToken))
    return slot
  }
  const first = await createSlot('11:47:00', '11:57:00')
  const alternative = await createSlot('12:07:00', '12:17:00')
  const available = () => api<Slot[]>(request, `/appointment-slots?from=${visitDate}&to=${visitDate}`)

  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, visitor, '/appointment')
  await page.getByTestId('calendar-month-select').selectOption(visitDate.slice(0, 7))
  const day = page.getByTitle(`选择日期: ${visitDate}`, { exact: true })
  await day.click()
  const firstTime = page.getByRole('button', { name: /^11:47.*11:57/ })
  await firstTime.click()
  const trigger = page.getByRole('button', { name: '填写预约信息', exact: true })
  await trigger.click()
  const sheet = page.getByRole('dialog')
  const confirm = sheet.getByRole('button', { name: '确认预约', exact: true })
  const partySize = sheet.getByRole('spinbutton', { name: '同行人数', exact: true })
  await partySize.fill('2')
  await sheet.getByLabel('联系人手机号', { exact: true }).fill('13800000000')

  const competingBooking = await api<Appointment>(request, '/appointments', 'POST', {
    slotId: first.id, visitorCount: 2, contactName: otherVisitor.nickname,
    contactPhone: '13800000001', contactEmail: otherVisitor.email,
  }, otherToken, { 'Idempotency-Key': randomUUID() })
  expect(competingBooking.status).toBe('PENDING')
  expect((await available()).filter(slot => [first.id, alternative.id].includes(slot.id)))
    .toEqual([expect.objectContaining({ id: alternative.id, remainingPeople: 2 })])

  const submitted = () => page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/appointments' && response.request().method() === 'POST')
  const rejected = submitted()
  await confirm.click()
  expect((await rejected).status()).toBe(409)
  await expect(sheet.locator('[data-submit-error]')).toContainText('名额')
  await expect(confirm).toBeDisabled()
  await expect(partySize).toHaveValue('2')
  await expect(sheet.getByLabel('联系人手机号', { exact: true })).toHaveValue('13800000000')
  expect((await api<PageResult<Appointment>>(request, '/appointments/me', 'GET', undefined, visitorToken)).total).toBe(0)

  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await day.click()
  await expect(firstTime).toHaveCount(0)
  await page.getByRole('button', { name: /^12:07.*12:17/ }).click()
  await trigger.click()
  await expect(partySize).toHaveValue('2')
  await expect(sheet.getByLabel('联系人手机号', { exact: true })).toHaveValue('13800000000')
  const retried = submitted()
  await confirm.click()
  const response = await retried
  expect(response.ok()).toBe(true)
  const created = (await response.json()).data as Appointment
  const records = await api<PageResult<Appointment>>(request, '/appointments/me', 'GET', undefined, visitorToken)
  expect(records.total).toBe(1)
  expect(records.items[0]?.id).toBe(created.id)
  expect((await available()).some(slot => slot.id === alternative.id)).toBe(false)
})

test('预约落库但响应丢失时锁定原摘要，重试只恢复同一条预约', async ({ page, request }) => {
  const visitor = await account(request)
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const slot = await bookableSlot(request, adminToken)
  await login(page, visitor, '/appointment')
  await page.getByTitle(`选择日期: ${slot.visitDate}`, { exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`^${slot.startTime.slice(0, 5)}.*${slot.endTime.slice(0, 5)}`) }).click()
  await page.getByRole('spinbutton', { name: '同行人数', exact: true }).fill('2')
  await page.getByLabel('联系人姓名', { exact: true }).fill(visitor.nickname)
  await page.getByLabel('联系人手机号', { exact: true }).fill('13800000000')
  await page.getByLabel('联系人邮箱', { exact: true }).fill(visitor.email)

  let firstPayload: Record<string, unknown> | undefined
  let creationKey = ''
  let created: Appointment | undefined
  await page.route('**/api/v1/appointments', async route => {
    firstPayload = route.request().postDataJSON() as Record<string, unknown>
    creationKey = route.request().headers()['idempotency-key'] ?? ''
    const response = await route.fetch()
    expect(response.ok()).toBeTruthy()
    created = (await response.json()).data as Appointment
    await route.abort('connectionreset')
  }, { times: 1 })
  await page.getByRole('button', { name: '确认预约', exact: true }).click()
  await expect(page.getByText(/暂未确认预约结果/)).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: '同行人数', exact: true })).toBeDisabled()
  await expect(page.getByRole('spinbutton', { name: '同行人数', exact: true })).toHaveValue('2')
  await expect(page.getByLabel('联系人姓名', { exact: true })).toBeDisabled()
  await expect(page.getByTitle(`选择日期: ${slot.visitDate}`, { exact: true })).toBeDisabled()
  await page.route('**/api/v1/appointment-slots', route => route.fulfill({
    status: 200, json: { code: 'OK', message: 'success', data: [], requestId: 'quality-empty-slots' },
  }))
  await page.getByRole('link', { name: '探索馆藏', exact: true }).first().click()
  await page.getByRole('link', { name: '预约参观', exact: true }).first().click()
  await expect(page.locator('[data-recover-booking]')).toBeVisible()
  const retry = page.waitForRequest(request => request.url().endsWith('/api/v1/appointments') && request.method() === 'POST')
  await page.getByRole('button', { name: '核对预约结果', exact: true }).click()
  const replay = await retry
  expect(replay.headers()['idempotency-key']).toBe(creationKey)
  expect(replay.postDataJSON()).toEqual(firstPayload)
  await expect(page.getByText(/预约已提交/).first()).toBeVisible()
  const token = await tokenFor(request, visitor)
  const records = await api<PageResult<Appointment & { visitorCount: number; slotId: number; contactName: string }>>(request, '/appointments/me?page=1&size=20', 'GET', undefined, token)
  expect(records.total).toBe(1)
  expect(records.items[0]).toMatchObject({ id: created!.id, slotId: slot.id, visitorCount: 2, contactName: visitor.nickname })
  await page.getByRole('link', { name: /查看我的预约/ }).first().click()
  await page.locator('.profile-records').scrollIntoViewIfNeeded()
  const record = page.locator('.profile-record-card').filter({ hasText: created!.appointmentNo })
  await expect(record).toContainText('2 人')
  await expect(record).toContainText(visitor.nickname)
})

test('正常模拟支付后订单可查，重复支付不重复扣库存', async ({ page, request }) => {
  const visitor = await account(request)
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const product = await productFixture(request, adminToken)
  const inventory = async () => {
    const products = await api<PageResult<{ id: number; stockQuantity: number; lockedStock: number }>>(request, '/admin/products?page=1&size=100', 'GET', undefined, adminToken)
    const item = products.items.find(item => item.id === product.id)
    expect(item, 'The newly created fixture must be present in the admin inventory').toBeDefined()
    return item!
  }
  const before = await inventory()
  await login(page, visitor, '/shop')
  await page.locator('.product-grid article').filter({ hasText: product.name }).getByRole('button', { name: '加入购物车', exact: true }).click()
  const cart = page.getByRole('complementary', { name: '购物袋' })
  await cart.getByLabel(/订单通知邮箱/).fill(visitor.email)
  const paymentResponse = page.waitForResponse(response => response.url().includes('/mock-payment') && response.request().method() === 'POST')
  await cart.getByRole('button', { name: '确认并模拟支付' }).click()
  const response = await paymentResponse
  expect(response.ok()).toBeTruthy()
  const paid = (await response.json()).data as Order
  expect(paid.status).toBe('PAID')
  expect(Number(paid.payableAmount)).toBe(19.5)
  expect(paid.items).toHaveLength(1)
  expect(paid.items[0]!.quantity).toBe(1)
  await expect(cart.getByRole('heading', { name: '订单已完成' })).toBeVisible()
  const expectedStock = { stockQuantity: before.stockQuantity - 1, lockedStock: before.lockedStock }
  expect(await inventory()).toMatchObject(expectedStock)
  const visitorToken = await tokenFor(request, visitor)
  const replay = await api<Order>(request, `/orders/${paid.id}/mock-payment`, 'POST', undefined, visitorToken, {
    'Idempotency-Key': response.request().headers()['idempotency-key']!,
  })
  expect(replay.id).toBe(paid.id)
  expect(await inventory()).toMatchObject(expectedStock)
  expect(await api<unknown[]>(request, '/cart', 'GET', undefined, visitorToken)).toHaveLength(0)
  const records = await api<PageResult<Order>>(request, '/orders?page=1&size=20', 'GET', undefined, visitorToken)
  expect(records.total).toBe(1)
  await page.getByRole('link', { name: visitor.nickname, exact: true }).click()
  const record = page.locator('.profile-record-card').filter({ hasText: paid.orderNo })
  await record.scrollIntoViewIfNeeded()
  await expect(record).toContainText('已支付')
  await expect(record).toContainText(product.name)
  await page.reload()
  await expect(record).toContainText('已支付')
})

test.describe('移动购物袋', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('访客登录后只续加一次，触屏拖动关闭与重开不丢商品', async ({ page, request }) => {
    const visitor = await account(request)
    const adminToken = await tokenFor(request, qualityEnvironment.admin)
    const product = await productFixture(request, adminToken)
    const visitorToken = await tokenFor(request, visitor)
    const cartItems = () => api<{ productId: number; quantity: number }[]>(request, '/cart', 'GET', undefined, visitorToken)
    const expectedBag = [{ productId: product.id, quantity: 1 }]
    let additions = 0
    page.on('request', req => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/v1/cart/items') additions++
    })

    await page.goto('/')
    await page.locator('.mobile-tab-bar a[href="/shop"]').tap()
    await page.locator('.product-grid article').filter({ hasText: product.name })
      .getByRole('button', { name: '加入购物车', exact: true }).tap()
    await expect(page).toHaveURL(/\/login\?/)
    const target = new URL(page.url()).searchParams.get('returnTo')
    expect(target).toBe(`/shop?intent=add-to-cart&productId=${product.id}`)
    expect(await cartItems()).toEqual([])
    expect(additions).toBe(0)

    await fillLogin(page, visitor, '/shop')
    const bagTrigger = page.getByRole('button', { name: /打开购物袋/ })
    await expect(bagTrigger).toHaveAccessibleName(/1 件/)
    expect(await cartItems()).toMatchObject(expectedBag)
    expect(additions).toBe(1)

    const bag = page.getByRole('dialog', { name: /购物袋/ })
    const quantity = bag.getByRole('group', { name: `${product.name} 数量` }).locator('[aria-live="polite"]')
    await bagTrigger.tap()
    await expect(quantity).toHaveText('1')
    await expect(bag.locator('.bottom-sheet')).toHaveAttribute('data-snap-point', 'medium')

    const session = await page.context().newCDPSession(page)
    async function swipeHandle(name: string, distance: number) {
      const handle = bag.getByRole('button', { name, exact: true })
      await handle.tap({ trial: true })
      const box = (await handle.boundingBox())!
      const x = Math.round(box.x + box.width / 2)
      const y = Math.round(box.y + box.height / 2)
      expect(y + distance).toBeGreaterThan(0)
      expect(y + distance).toBeLessThan(page.viewportSize()!.height)
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      try {
        for (let step = 1; step <= 10; step++) {
          const nextY = Math.round(y + distance * step / 10)
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: nextY }] })
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
        }
      } finally {
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      }
    }
    try {
      await swipeHandle('展开面板', -125)
      await expect(bag.locator('.bottom-sheet')).toHaveAttribute('data-snap-point', 'full')
      await expect(quantity).toHaveText('1')
      await swipeHandle('收起面板', 180)
      await expect(bag).toHaveCount(0)
    } finally {
      await session.detach()
    }

    await bagTrigger.tap()
    await expect(quantity).toHaveText('1')
    await bag.getByRole('button', { name: '关闭面板', exact: true }).tap()
    await expect(bag).toHaveCount(0)
    await page.reload()
    await expect(page).toHaveURL(/\/shop$/)
    await expect(bagTrigger).toHaveAccessibleName(/1 件/)
    expect(await cartItems()).toMatchObject(expectedBag)
    expect(additions).toBe(1)
  })
})

test('购物车改量锁定结算，丢失支付响应后恢复唯一已支付订单', async ({ page, request }) => {
  const visitor = await account(request)
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const product = await productFixture(request, adminToken)
  await login(page, visitor, '/shop')
  const productCard = page.locator('.product-grid article').filter({ hasText: product.name })
  await productCard.getByRole('button', { name: '加入购物车', exact: true }).click()
  const cart = page.getByRole('complementary', { name: '购物袋' })
  const quantity = cart.getByRole('group', { name: `${product.name} 数量` })
  await expect(quantity.locator('[aria-live="polite"]')).toHaveText('1')

  let releaseMutation!: () => void
  const mutationGate = new Promise<void>(resolve => { releaseMutation = resolve })
  let mutationStarted!: () => void
  const started = new Promise<void>(resolve => { mutationStarted = resolve })
  await page.route('**/api/v1/cart/items/*', async route => {
    if (route.request().method() !== 'PATCH') { await route.continue(); return }
    mutationStarted()
    await mutationGate
    await route.continue()
  })
  await quantity.getByRole('button', { name: '增加数量' }).click()
  await started
  try {
    await expect(cart.getByRole('button', { name: '确认并模拟支付' })).toBeDisabled()
    await expect(quantity.getByRole('button', { name: '增加数量' })).toBeDisabled()
  } finally { releaseMutation() }
  await expect(quantity.locator('[aria-live="polite"]')).toHaveText('2')
  await expect(cart.locator('.cart-order-total dd')).toHaveText('¥ 39.00')
  await cart.getByLabel(/订单通知邮箱/).fill(visitor.email)

  let paymentKey = ''
  let paidOrder: Order | undefined
  await page.route('**/api/v1/orders/*/mock-payment', async route => {
    paymentKey = route.request().headers()['idempotency-key'] ?? ''
    const response = await route.fetch()
    expect(response.ok()).toBeTruthy()
    paidOrder = (await response.json()).data as Order
    // The server commits the payment, then the browser loses only its response.
    await route.abort('connectionreset')
  }, { times: 1 })
  await cart.getByRole('button', { name: '确认并模拟支付' }).click()
  await expect(cart.getByRole('heading', { name: '订单已完成' })).toBeVisible()
  expect(paidOrder?.status).toBe('PAID')
  expect(paidOrder?.items[0]?.quantity).toBe(2)
  const visitorToken = await tokenFor(request, visitor)
  const replay = await api<Order>(request, `/orders/${paidOrder!.id}/mock-payment`, 'POST', undefined, visitorToken, { 'Idempotency-Key': paymentKey })
  expect(replay.id).toBe(paidOrder!.id)
  expect(replay.status).toBe('PAID')
  const records = await api<PageResult<Order>>(request, '/orders?page=1&size=20', 'GET', undefined, visitorToken)
  expect(records.total).toBe(1)
  await page.getByRole('link', { name: visitor.nickname, exact: true }).click()
  await page.locator('.profile-records').scrollIntoViewIfNeeded()
  const order = page.locator('.profile-record-card').filter({ hasText: paidOrder!.orderNo })
  await expect(order).toContainText('已支付')
  await expect(order).toContainText(`${product.name} × 2`)
})

test('后台草稿保存、发布、公开检索及撤回形成闭环', async ({ page, request, browser }) => {
  const id = unique()
  const title = `质量验收文章${id}`
  const slug = `qa-article-${id}`
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  await login(page, qualityEnvironment.admin, '/admin')
  await page.getByRole('tab', { name: '文章', exact: true }).click()
  await page.getByTestId('admin-open-create-drawer').click()
  const form = page.locator('.admin-create form')
  await form.getByLabel('标题', { exact: true }).fill(title)
  await form.getByLabel('标题', { exact: true }).press('Tab')
  await expect(form.getByLabel(/^URL 标识/)).not.toHaveValue('')
  await form.getByLabel(/^URL 标识/).fill(slug)
  await expect(form.getByLabel(/^URL 标识/)).toHaveValue(slug)
  await form.getByLabel('摘要', { exact: true }).fill('隔离环境中的内容发布验收摘要。')
  await form.getByLabel('正文', { exact: true }).fill('第一节\n\n这是一篇验证草稿、公开展示与撤回状态一致性的临时文章。')
  const created = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/articles') && response.request().method() === 'POST')
  await form.getByRole('button', { name: '创建草稿', exact: true }).click()
  withdrawAfterTest(request, (await (await created).json()).data.id, adminToken)
  const row = page.locator('.admin-list article').filter({ hasText: title })
  await expect(row).toContainText('草稿')
  expect((await request.get(`/api/v1/articles/${slug}`)).status()).toBe(404)
  await row.getByRole('button', { name: '发布', exact: true }).click()
  await expect(row).toContainText('已发布')

  const publicContext = await browser.newContext({ baseURL: qualityEnvironment.baseURL, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
  try {
    const publicPage = await publicContext.newPage()
    await publicPage.goto(`/explore?q=${encodeURIComponent(title)}`)
    await publicPage.getByRole('link').filter({ hasText: title }).first().click()
    await expect(publicPage).toHaveURL(new RegExp(`/articles/${slug}$`))
    await expect(publicPage.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(publicPage).toHaveTitle(new RegExp(title))
    await row.getByRole('button', { name: '撤回', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(title)
    await dialog.getByRole('button', { name: '确认撤回', exact: true }).click()
    await expect(row).toContainText('已撤回')
    await publicPage.reload()
    await expect(publicPage.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
    await expect(publicPage.getByRole('link', { name: /探索馆藏|返回馆藏/ }).first()).toBeVisible()
    expect((await request.get(`/api/v1/articles/${slug}`)).status()).toBe(404)
  } finally { await publicContext.close() }
})

test('普通用户不能进入后台或读取、修改其他用户预约与订单', async ({ page, request }) => {
  const owner = await account(request)
  const outsider = await account(request)
  const ownerToken = await tokenFor(request, owner)
  const outsiderToken = await tokenFor(request, outsider)
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const slot = await bookableSlot(request, adminToken)
  const appointment = await api<Appointment>(request, '/appointments', 'POST', {
    slotId: slot.id, visitorCount: 1, contactName: owner.nickname, contactPhone: '13800000000', contactEmail: owner.email,
  }, ownerToken, { 'Idempotency-Key': randomUUID() })
  const product = await productFixture(request, adminToken)
  const cart = await api<{ id: number }[]>(request, '/cart/items', 'POST', { productId: product.id, quantity: 1 }, ownerToken)
  const order = await api<Order>(request, '/orders', 'POST', { cartItemIds: cart.map(item => item.id), notificationEmail: owner.email }, ownerToken, { 'Idempotency-Key': randomUUID() })
  const outsiderHeaders = { Authorization: `Bearer ${outsiderToken}`, 'Idempotency-Key': randomUUID() }
  for (const path of ['/admin/categories', '/admin/appointments', '/admin/orders']) {
    expect((await request.get(`/api/v1${path}`, { headers: outsiderHeaders })).status()).toBe(403)
  }
  for (const path of [`/appointments/${appointment.id}`, `/orders/${order.id}`]) {
    expect((await request.get(`/api/v1${path}`, { headers: outsiderHeaders })).status()).toBe(404)
    expect((await request.post(`/api/v1${path}/cancel`, { headers: outsiderHeaders, data: { reason: '越权请求' } })).status()).toBe(404)
  }
  expect((await request.post(`/api/v1/orders/${order.id}/mock-payment`, { headers: outsiderHeaders })).status()).toBe(404)
  await login(page, outsider, '/profile')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/profile')
  await page.locator('.profile-records').scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: '预约记录', exact: true })).toBeVisible()
  await expect(page.getByText('还没有订单记录。', { exact: false })).toBeVisible()
  await expect(page.locator('.profile-record-card')).toHaveCount(0)
  expect((await api<Appointment>(request, `/appointments/${appointment.id}`, 'GET', undefined, ownerToken)).status).toBe('PENDING')
  expect((await api<Order>(request, `/orders/${order.id}`, 'GET', undefined, ownerToken)).status).toBe('PENDING_PAYMENT')
})

test('21条预约、21条订单和25条搜索结果均可翻页并保留上下文', async ({ page, request }) => {
  test.setTimeout(180_000)
  const visitor = await account(request)
  const visitorToken = await tokenFor(request, visitor)
  const adminToken = await tokenFor(request, qualityEnvironment.admin)
  const slot = await bookableSlot(request, adminToken)
  const product = await productFixture(request, adminToken)
  const appointmentNumbers: string[] = []
  let firstOrder: Order | undefined
  for (let index = 0; index < 21; index++) {
    const appointment = await api<Appointment>(request, '/appointments', 'POST', {
      slotId: slot.id, visitorCount: 1, contactName: visitor.nickname, contactPhone: '13800000000', contactEmail: visitor.email,
    }, visitorToken, { 'Idempotency-Key': randomUUID() })
    appointmentNumbers.push(appointment.appointmentNo)
    await api(request, `/appointments/${appointment.id}/cancel`, 'POST', { reason: '隔离分页验收' }, visitorToken)
    const cart = await api<{ id: number }[]>(request, '/cart/items', 'POST', { productId: product.id, quantity: 1 }, visitorToken)
    const order = await api<Order>(request, '/orders', 'POST', { cartItemIds: cart.map(item => item.id), notificationEmail: visitor.email }, visitorToken, { 'Idempotency-Key': randomUUID() })
    firstOrder ??= order
    if (index > 0) await api(request, `/orders/${order.id}/cancel`, 'POST', undefined, visitorToken)
  }
  await login(page, visitor, '/profile')
  await page.locator('.profile-records').scrollIntoViewIfNeeded()
  const appointmentSection = page.getByRole('region', { name: '预约记录', exact: true })
  const orderSection = page.getByRole('region', { name: '订单记录', exact: true })
  await expect(appointmentSection).toContainText('共 21 条预约')
  await expect(appointmentSection.locator('article')).toHaveCount(20)
  const visibleAppointments = await appointmentSection.locator('.profile-record-kicker').allTextContents()
  await page.getByRole('button', { name: '下一页预约记录', exact: true }).click()
  await expect(appointmentSection.locator('article')).toHaveCount(1)
  visibleAppointments.push(...await appointmentSection.locator('.profile-record-kicker').allTextContents())
  expect(visibleAppointments.sort()).toEqual(appointmentNumbers.sort())
  await expect(orderSection).toContainText('共 21 条订单')
  await expect(orderSection.locator('article')).toHaveCount(20)
  await page.getByRole('button', { name: '下一页订单记录', exact: true }).click()
  await expect(orderSection.locator('article')).toHaveCount(1)
  await expect(orderSection).toContainText(firstOrder!.orderNo)
  await orderSection.getByRole('button', { name: '继续支付', exact: true }).click()
  await expect(orderSection.locator('article')).toContainText('已支付')
  await expect(orderSection.getByRole('navigation')).toContainText('2 / 2')
  await expect(appointmentSection.getByRole('navigation')).toContainText('2 / 2')

  const prefix = `分页验收${unique()}`
  const categories = await api<{ id: number }[]>(request, '/categories')
  for (let index = 0; index < 25; index++) {
    const article = await api<{ id: number }>(request, '/admin/articles', 'POST', {
      categoryId: categories[0]!.id, title: `${prefix}-${index + 1}`, slug: `qa-page-${unique()}`,
      summary: '真实数据库搜索分页验收。', content: '隔离测试内容，用于验证第25条搜索结果可访问。',
    }, adminToken)
    withdrawAfterTest(request, article.id, adminToken)
    await api(request, `/admin/articles/${article.id}/publish`, 'POST', undefined, adminToken)
  }
  await page.getByRole('link', { name: '探索馆藏', exact: true }).first().click()
  const search = page.getByRole('searchbox', { name: '搜索文物或文章' })
  await search.fill(prefix)
  await search.press('Enter')
  await expect(page).toHaveURL(new RegExp('q='))
  await expect(page.locator('#collection-search-results')).toContainText('25 项')
  await expect(page.locator('.search-result-card')).toHaveCount(24)
  const visibleTitles = await page.locator('.search-result-card h3').allTextContents()
  await page.getByRole('navigation', { name: '馆藏分页' }).getByRole('button', { name: '下一页' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.search-result-card')).toHaveCount(1)
  const lastResultTitle = await page.locator('.search-result-card h3').innerText()
  expect(new Set([...visibleTitles, lastResultTitle]).size).toBe(25)
  await page.locator('.search-result-card').click()
  await expect(page.getByRole('heading', { name: lastResultTitle, exact: true })).toBeVisible()
  await page.getByRole('link', { name: /返回.*馆藏/ }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.reload()
  await expect(search).toHaveValue(prefix)
  await expect(page.locator('.search-result-card')).toHaveCount(1)
})
