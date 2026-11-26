import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({
  viewport: { width: 320, height: 529 },
  isMobile: true,
  hasTouch: true,
  launchOptions: { args: ['--enable-unsafe-swiftshader'] },
})

async function hitBox(locator: Locator, scroll = false, min = 44) {
  if (scroll) await locator.scrollIntoViewIfNeeded()
  await expect.poll(() => locator.evaluate((element, minimum) => {
    const { top, left, bottom, right, width, height } = element.getBoundingClientRect()
    const hits = [[(left + right) / 2, (top + bottom) / 2], [left + 8, top + 8],
      [right - 8, top + 8], [left + 8, bottom - 8], [right - 8, bottom - 8]]
    return width >= minimum - .1 && height >= minimum - .1
      && hits.every(([x, y]) => element.contains(document.elementFromPoint(x!, y!)))
  }, min), { message: `Visible touch target at least ${min}px: ${locator}` }).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heluo.locale', 'zh-CN')
    localStorage.setItem('heluo.theme', 'light')
  })
})

test('首页路由代码延迟时，提前请求主视觉且页脚不会先出现在第一屏', async ({ page }) => {
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  let intercepted = false
  let requestedHero = false
  page.on('request', request => {
    if (request.url().endsWith('/home-hero-light-v4-portrait.webp')) requestedHero = true
  })
  await page.route(/\/HomeView(?:-[^/]+)?\.(?:js|vue)(?:\?.*)?$/, async route => {
    intercepted = true
    await gate
    await route.continue()
  })
  try {
    await page.goto('/', { waitUntil: 'commit' })
    await expect.poll(() => intercepted).toBe(true)
    await expect.poll(() => requestedHero).toBe(true)
    const footer = page.locator('.site-footer')
    await expect(footer).toBeAttached()
    expect(await footer.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(529)
  } finally {
    release()
  }
  await expect(page.locator('.corridor-home')).toBeVisible()
})

test('手机冷启动不预热其他页面，点击底栏仍能进入商城', async ({ page }) => {
  let requestedShop = false
  page.on('request', request => {
    if (/\/ShopView(?:-[^/]+)?\.(?:js|vue)(?:\?.*)?$/.test(request.url())) requestedShop = true
  })
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('.corridor-home')).toBeVisible()
  await page.clock.runFor(2_500)
  expect(requestedShop).toBe(false)
  await page.locator('.mobile-tab-bar a[href="/shop"]').tap()
  await expect(page).toHaveURL(/\/shop$/)
  expect(requestedShop).toBe(true)
})

test('站内地址在刷新、分享和历史往返后保留页面与查询上下文', async ({ page, browser }) => {
  const historyLength = () => page.evaluate(() => window.history.length)
  const searchField = (target: Page) => target.getByRole('searchbox', { name: '搜索文物或文章' })
  const bronzeResult = (target: Page) => target.locator('.search-result-card[href="/artifacts/heluo-bronze-ding"]')
  const calendar = (target: Page) => target.locator('.appointment-dates')
  const username = (target: Page) => target.locator('input[autocomplete="username"]')
  const password = (target: Page) => target.locator('input[autocomplete="current-password"]')
  const addButton = (target: Page) => target.locator('.product-grid').getByRole('button', { name: '加入购物车', exact: true })
    .and(target.locator(':enabled')).first()

  await page.goto('/')
  await expect(page.locator('#home-title')).toBeVisible()
  let expectedHistory = await historyLength()
  const checkHistory = async (entries: number) => {
    expectedHistory += entries
    expect(await historyLength()).toBe(expectedHistory)
  }
  const checkAddress = async (ready: (target: Page) => Promise<void>) => {
    await ready(page)
    const address = page.url()
    expect((await page.reload())?.status()).toBe(200)
    await ready(page)
    await expect(page).toHaveURL(address)
    await checkHistory(0)

    const clean = await browser.newPage({
      locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 320, height: 529 },
      isMobile: true, hasTouch: true, reducedMotion: 'reduce',
    })
    try {
      expect((await clean.goto(address))?.status()).toBe(200)
      await ready(clean)
      await expect(clean).toHaveURL(address)
    } finally {
      await clean.close()
    }
    return address
  }

  await page.locator('.mobile-tab-bar a[href="/explore"]').tap()
  await expect(searchField(page)).toBeVisible()
  await checkHistory(1)
  const category = page.locator('.gallery-themes__links a[href^="/explore?category="]').first()
  await expect(category).toBeVisible()
  const categoryHref = await category.getAttribute('href')
  expect(categoryHref).toMatch(/^\/explore\?category=.+#collection-title$/)
  const categoryAddress = new URL(categoryHref!, page.url()).href
  await category.tap()
  await expect(page).toHaveURL(categoryAddress)
  await checkHistory(1)
  await checkAddress(async target => {
    await expect(target.locator('#collection-title')).toBeVisible()
    await expect(target.locator('.gallery-object').first()).toBeVisible()
    await expect(target).toHaveURL(categoryAddress)
  })

  await searchField(page).fill('青铜')
  await searchField(page).press('Enter')
  await expect(bronzeResult(page)).toBeVisible()
  expect(new URL(page.url()).searchParams.get('q')).toBe('青铜')
  await checkHistory(1)
  await checkAddress(async target => {
    await expect(searchField(target)).toHaveValue('青铜')
    await expect(bronzeResult(target)).toBeVisible()
  })

  const artifactTitle = await bronzeResult(page).locator('h3').innerText()
  await bronzeResult(page).tap()
  await expect(page).toHaveURL(/\/artifacts\/heluo-bronze-ding$/)
  await checkHistory(1)
  await checkAddress(async target => {
    await expect(target.locator('.detail-page h1')).toHaveText(artifactTitle)
  })

  await page.locator('.mobile-tab-bar a[href="/appointment"]').tap()
  await expect(page).toHaveURL(/\/appointment$/)
  await checkHistory(1)
  const appointmentAddress = await checkAddress(async target => {
    await expect(calendar(target)).toBeVisible()
  })

  await page.locator('.mobile-tab-bar a[href="/shop"]').tap()
  await expect(addButton(page)).toBeVisible()
  await checkHistory(1)
  const shopAddress = page.url()
  await addButton(page).tap()
  await expect(password(page)).toBeVisible()
  await checkHistory(1)
  const login = new URL(page.url())
  expect(login.pathname).toBe('/login')
  const id = login.searchParams.get('productId')
  expect(id).toMatch(/^\d+$/)
  expect(login.searchParams.get('intent')).toBe('add-to-cart')
  expect(login.searchParams.get('returnTo')).toBe('/shop?intent=add-to-cart&productId=' + id)

  await username(page).fill('local_test_user')
  await password(page).fill('dummy-form-value!')
  await expect(page).toHaveURL(login.href)
  const loginAddress = await checkAddress(async target => {
    await expect(password(target)).toBeVisible()
    await expect(target).toHaveURL(login.href)
  })

  for (const [action, address, ready] of [
    ['goBack', shopAddress, addButton(page)],
    ['goBack', appointmentAddress, calendar(page)],
    ['goForward', shopAddress, addButton(page)],
    ['goForward', loginAddress, password(page)],
  ] as const) {
    await page[action]()
    await expect(page).toHaveURL(address)
    await expect(ready).toBeVisible()
    await checkHistory(0)
  }
})

test('移动首页滚动后顶部栏收缩，进入馆藏再返回仍匹配滚动位置', async ({ page }) => {
  await page.goto('/')
  const header = page.locator('.site-header')
  const scrolled = /\bis-scrolled\b/
  await expect(header).not.toHaveClass(scrolled)

  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
  await expect(header).toHaveClass(scrolled)
  await page.locator('.mobile-tab-bar a[href="/explore"]').tap()
  await expect(page).toHaveURL(/\/explore$/)
  await expect(header).not.toHaveClass(scrolled)

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300)
  await expect(header).toHaveClass(scrolled)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(header).not.toHaveClass(scrolled)
})

test('移动首页并行预载关键代码和样式，不重复下载或影响深链接', async ({ page }) => {
  const paths: string[] = []
  page.on('request', request => paths.push(new URL(request.url()).pathname))
  const homeScript = /\/HomeView-[^/]+\.js$/
  const homeStyle = /\/HomeView-[^/]+\.css$/
  const touchUnused = /\/(?:PointerCursor|PointerDotField|HeluoPattern)-[^/]+\.(?:js|css)$/
  const hero = /\/home-hero-(?:light|dark)-v4-portrait\.webp$/
  await page.goto('/login')
  await expect(page.locator('.auth-mode-tabs')).toBeVisible()
  expect(paths.filter(path => homeScript.test(path) || homeStyle.test(path) || hero.test(path))).toEqual([])

  paths.length = 0
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-motion-tier', 'static')
  await expect(page.locator('#home-title')).toBeVisible()
  await expect(page.locator('link[rel="modulepreload"][href*="/HomeView-"]')).toHaveCount(1)
  await expect(page.locator('link[rel="preload"][as="style"][href*="/HomeView-"]')).toHaveCount(1)
  for (const pattern of [homeScript, homeStyle, hero]) expect(paths.filter(path => pattern.test(path))).toHaveLength(1)
  expect(paths.filter(path => touchUnused.test(path))).toEqual([])
})

test('浏览器从粗指针切换到精细指针时，不刷新也能加载桌面光标', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL, viewport: { width: 1280, height: 800 }, hasTouch: true, reducedMotion: 'no-preference',
  })
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 12 })
      Object.defineProperty(navigator, 'deviceMemory', { value: 8 })
      Object.defineProperty(navigator, 'connection', { value: { effectiveType: '4g', saveData: false } })
    })
    const page = await context.newPage()
    const root = page.locator('html')
    await page.goto('/explore')
    await expect(root).toHaveAttribute('data-motion-tier', 'static')
    await expect(page.locator('.pointer-cursor')).toHaveCount(0)
    const loaded = page.waitForResponse(/\/PointerCursor-[^/]+\.js$/)
    const session = await context.newCDPSession(page)
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    expect((await loaded).ok()).toBe(true)
    await expect(root).toHaveAttribute('data-motion-tier', 'full')
    await expect(root).toHaveClass(/\bpointer-motion-enabled\b/)
    await page.mouse.move(200, 120)
    await expect(page.locator('.pointer-cursor')).toHaveClass(/\bis-visible\b/)
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await expect(root).toHaveAttribute('data-motion-tier', 'static')
    await expect(root).not.toHaveClass(/\bpointer-motion-enabled\b/)
  } finally {
    await context.close()
  }
})

test('桌面完整动效按需加载纹样，播完移除且同一会话不重播', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL, viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, reducedMotion: 'no-preference',
  })
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 12 })
      Object.defineProperty(navigator, 'deviceMemory', { value: 8 })
      Object.defineProperty(navigator, 'connection', { value: { effectiveType: '4g', saveData: false } })
    })
    const page = await context.newPage()
    await page.goto('/explore')
    await expect(page.locator('html')).toHaveAttribute('data-motion-tier', 'full')
    const pattern = page.locator('.heluo-pattern')
    await expect(pattern).toHaveCount(0)
    const downloaded = page.waitForResponse(/\/HeluoPattern-[^/]+\.js$/)
    await page.locator('.brand').click()
    expect((await downloaded).ok()).toBe(true)
    await expect(pattern.locator('.pattern-center')).toBeAttached()
    await expect(pattern).toHaveCount(0)
    await expect(page.locator('#home-title')).toBeVisible()
    await page.locator('.home-primary').click()
    await expect(page).toHaveURL(/\/explore$/)
    await page.locator('.brand').click()
    await expect(page.locator('#home-title')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('heluo.home-intro-seen'))).toBe('true')
    await page.clock.install()
    await page.clock.runFor(1_000)
    await expect(pattern).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('英文品牌和章节在窄屏不交叠、不裁切', async ({ page }) => {
  await page.goto('/')
  await page.locator('.locale-toggle').tap()
  const header = page.locator('.site-header')
  const folios = page.locator('.home-chapter-folio')
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 805 })
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await header.locator('.theme-toggle[aria-pressed]').tap()
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(header.getByRole('link', { name: 'Heluo Digital Museum' })).toBeVisible()
      expect(await header.evaluate(el => el.querySelector('.brand')!.getBoundingClientRect().right
        <= el.querySelector('.site-utilities')!.getBoundingClientRect().left)).toBe(true)
      const brand = header.locator('.brand-copy b:visible')
      expect(await brand.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await expect(folios).toHaveCount(2)
      expect(await folios.evaluateAll(els => els.every(el => {
        const bounds = el.getBoundingClientRect()
        return Array.from(el.querySelectorAll('span')).every(label => {
          const range = document.createRange()
          range.selectNodeContents(label)
          return Array.from(range.getClientRects()).every(rect =>
            rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1)
        })
      }))).toBe(true)
    }
  }
})

test('模拟 200% 根字号时，英文品牌、底栏和章节仍完整可读和可点', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('heluo.locale', 'en-US'))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.locator('#home-title')).toBeVisible()
  await page.addStyleTag({ content: 'html { font-size: 32px !important; }' })
  const header = page.locator('.site-header')
  const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' })
  const collection = mobileNav.getByRole('link', { name: 'Art Collection', exact: true })
  const chapterLabels = page.locator('.home-chapter-folio span, .home-cover__masthead-no, .home-cover__masthead-meta span:visible')
  for (const width of [320, 375, 390, 430, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 351 : 805 })
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await header.locator('.theme-toggle[aria-pressed]').tap()
      }
      await expect(page.locator('html')).toHaveCSS('font-size', '32px')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(header.getByRole('link', { name: 'Heluo Digital Museum' })).toBeVisible()
      expect(await header.locator('.brand-copy b:visible').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      const labels = header.locator('.brand-copy b:visible, .locale-toggle')
        .or(mobileNav.locator('a > span:visible')).or(chapterLabels)
      await expect.poll(() => labels.evaluateAll(els => els.flatMap(el => {
        const bounds = (el.closest('.home-chapter-folio, .home-cover__masthead, .mobile-tab-bar a') ?? el).getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(el)
        return Array.from(range.getClientRects()).some(rect => rect.left < bounds.left - 1
          || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)
          ? [el.textContent?.trim()] : []
      }))).toEqual([])
      await hitBox(header.locator('.locale-toggle'))
      for (const link of await mobileNav.getByRole('link').all()) await hitBox(link)
    }
  }
  await page.setViewportSize({ width: 320, height: 529 })
  await expect(collection.locator('span:visible')).toHaveText('Art')
  const guide = page.getByTestId('luosheng-fab')
  if (process.env.HELUO_REQUIRE_GUIDE) await hitBox(guide)
  await collection.tap()
  await expect(page).toHaveURL(/\/explore$/)
  await mobileNav.getByRole('link', { name: 'Visit Booking' }).tap()
  await expect(page).toHaveURL(/\/appointment$/)
})

test('移动首页不下载被底栏遮挡的声景画布，滚动后可正常操作', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (/\/AcousticRuler[^/]*\.js$/.test(path)) requests.push(path)
  })
  await page.goto('/')
  await expect(page.locator('#home-title')).toBeVisible()
  await hitBox(page.locator('.site-header .audio-toggle'))
  const rulerSlot = page.locator('.home-cover__ruler')
  const rulerButton = rulerSlot.locator('.acoustic-ruler__trigger')
  await expect(rulerButton).toHaveCount(0)
  expect(requests).toEqual([])

  await rulerSlot.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await hitBox(rulerButton)
  expect(requests.length).toBeGreaterThan(0)
})

test('声景设置按披露模式打开，关闭后不引用尚未挂载的分组', async ({ page }) => {
  await page.goto('/')
  const trigger = page.locator('.site-header .audio-toggle')
  const panel = page.locator('#audio-control-panel')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
  expect(await trigger.getAttribute('aria-haspopup')).toBeNull()
  await expect(panel).toHaveCount(0)

  await trigger.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(trigger).toHaveAttribute('aria-controls', 'audio-control-panel')
  await expect(panel).toHaveRole('group')
  await expect(panel.locator('.audio-panel__switch')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
})

test('预约空态可重试、失败可恢复、可跳至下月并进入时段', async ({ page }) => {
  let calls = 0
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  const [year, month] = now.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month!, 3))
  if (date.getUTCDay() === 1) date.setUTCDate(4)
  const visitDate = date.toISOString().slice(0, 10)
  await page.route('**/api/v1/appointment-slots', route => {
    calls++
    return route.fulfill({
      status: calls === 2 ? 503 : 200,
      json: { data: calls >= 3 ? [{ id: 12345, visitDate, startTime: '09:00:00',
        endTime: '10:30:00', remainingPeople: 10 }] : [] },
    })
  })
  await page.goto('/appointment')
  await expect(page.getByText('目前没有可预约的时段，请稍后再查。')).toBeVisible()
  await page.getByRole('button', { name: '重新加载' }).tap()
  await expect(page.getByRole('alert')).toContainText('开放时段暂时无法读取')
  await page.getByRole('button', { name: '重新加载' }).tap()
  await page.getByRole('button', { name: /查看最近可约日期/ }).tap()
  const day = page.locator(`[data-visit-date="${visitDate}"]`)
  await expect(day).toBeFocused()
  await hitBox(day, true)
  await day.tap()
  await expect(page.getByRole('button', { name: /09:00.*10:30/ })).toBeEnabled()
  await expect(page.locator('.appointment-day.is-monday-closed').first()).toBeDisabled()
})

test('洛笙短视口可展开灵感、输入与关闭，不发送消息', async ({ page }) => {
  await page.goto('/')
  const fab = page.locator('.luosheng-fab')
  if (!process.env.HELUO_REQUIRE_GUIDE) {
    await fab.waitFor({ timeout: 4500 }).catch(() => {})
    test.skip(!(await fab.count()), 'Enable the optional guide for this case')
  }
  await fab.tap()
  const input = page.getByTestId('luosheng-input')
  const ideas = page.getByTestId('luosheng-ideas-toggle')
  for (const [width, height] of [[390, 421], [375, 461], [320, 529]] as const) {
    await page.setViewportSize({ width, height })
    await ideas.tap()
    await expect(page.getByTestId('luosheng-ideas-drawer')).toBeVisible()
    await input.fill('只测试输入，不发送')
    await hitBox(input, false, 48)
    await hitBox(page.getByTestId('luosheng-send'), false, 48)
    await hitBox(page.getByTestId('luosheng-close'))
    await ideas.tap()
  }
  await page.getByTestId('luosheng-close').tap()
  await expect(page.getByTestId('luosheng-drawer')).toBeHidden()
})

test('洛笙中文组合键不提交或关闭，多行草稿在短屏与横屏保持可编辑', async ({ page }) => {
  let requests = 0
  await page.route('**/api/v1/guide/chat**', route => {
    requests++
    return route.abort()
  })
  await page.setViewportSize({ width: 390, height: 421 })
  await page.goto('/')
  const fab = page.getByTestId('luosheng-fab')
  if (!process.env.HELUO_REQUIRE_GUIDE) {
    await fab.waitFor({ timeout: 4500 }).catch(() => {})
    test.skip(!(await fab.count()), 'Enable the optional guide for this case')
  }
  await fab.tap()
  const input = page.getByTestId('luosheng-input')
  const drawer = page.getByTestId('luosheng-drawer')
  await input.fill('先问青铜鼎')
  await input.press('Shift+Enter')
  await input.pressSequentially('再问参观')
  const draft = '先问青铜鼎\n再问参观'
  await expect(input).toHaveValue(draft)
  for (const key of ['Enter', 'Escape']) {
    await input.dispatchEvent('keydown', { key, isComposing: true, bubbles: true, cancelable: true })
    await expect(fab, `组合状态的 ${key} 不应关闭抽屉`).toBeHidden()
    await expect(input).toBeFocused()
    await expect(input).toHaveValue(draft)
  }
  expect(requests).toBe(0)
  for (const [width, height] of [[844, 351], [390, 421], [390, 805]] as const) {
    await page.setViewportSize({ width, height })
    await expect(input).toHaveValue(draft)
    await hitBox(input, false, 48)
    await hitBox(page.getByTestId('luosheng-send'), false, 48)
    await hitBox(page.getByTestId('luosheng-close'))
  }
  await input.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(fab).toBeFocused()
  expect(requests).toBe(0)
})

test('溯源资料接口失败时，键盘仍能阅读抽屉正文、循环焦点并关闭回焦', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('heluo.locale', 'en-US'))
  await page.route(/\/api\/v1\/products\/[^/?]+$/, route => route.abort())
  await page.goto('/shop')
  const trigger = page.getByTestId('open-provenance-btn').first()
  await trigger.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByTestId('product-provenance-drawer')
  const close = drawer.getByTestId('provenance-close')
  const body = drawer.locator('.provenance-drawer__body')
  await expect(close).toBeFocused()
  await expect(drawer.locator('.provenance-loading')).toHaveCount(0)
  await expect(drawer.getByRole('link', { name: /source object archive/i })).toHaveCount(0)
  await expect(body.getByRole('heading', { name: 'Curatorial Design Notes' })).toBeVisible()

  const focusInside = () => drawer.evaluate(element => element.contains(document.activeElement))
  await page.locator('.mobile-cart-trigger').evaluate(element => (element as HTMLElement).focus())
  expect(await focusInside()).toBe(true)
  await page.keyboard.press('Tab')
  await expect(body).toBeFocused()
  await page.keyboard.press('End')
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press(key)
      expect(await focusInside()).toBe(true)
    }
  }
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('购物袋锁定背景焦点和滚动，双向 Tab 循环并从 Escape 回焦', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.mobile-tab-bar a[href="/shop"]').tap()
  const trigger = page.getByRole('button', { name: /打开购物袋/ })
  const bag = page.getByRole('dialog', { name: /购物袋/ })
  const activeInBag = () => bag.evaluate(element => element.contains(document.activeElement))
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(bag).toBeVisible()
  await expect.poll(activeInBag).toBe(true)

  await trigger.evaluate(element => element.focus())
  expect(await activeInBag(), 'Opening a modal must prevent focus even outside the Tab sequence').toBe(true)
  const close = bag.getByRole('button', { name: '关闭面板', exact: true })
  const handle = bag.getByRole('button', { name: '展开面板', exact: true })
  const signIn = bag.getByRole('link', { name: '前往登录' })
  await expect(close).toBeFocused()
  for (const [key, order] of [['Tab', [signIn, handle, close]], ['Shift+Tab', [handle, signIn, close]]] as const) {
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const control of order) {
        await page.keyboard.press(key)
        await expect(control).toBeFocused()
      }
    }
  }

  const scroll = () => page.evaluate(() => window.scrollY)
  const before = await scroll()
  await page.mouse.move(25, 100)
  await page.mouse.wheel(0, 520)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await scroll()).toBe(before)
  await page.keyboard.press('Escape')
  await expect(bag).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await page.mouse.wheel(0, 520)
  await expect.poll(scroll).toBeGreaterThan(before)
})

test('暗房焦点双向循环、背景不可聚焦，Escape 与触摸关闭回焦', async ({ page }) => {
  await page.goto('/artifacts/heluo-bronze-ding')
  const trigger = page.getByTestId('artifact-fullscreen-btn')
  await trigger.tap()
  const dialog = page.getByRole('dialog')
  const close = page.getByTestId('artifact-lightbox-close')
  await expect(close).toBeFocused()
  const brand = page.locator('.site-header .brand')
  await brand.evaluate(element => (element as HTMLElement).focus())
  await expect(close).toBeFocused()
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden')
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press(key)
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
    }
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.tap()
  await dialog.getByRole('button', { name: '2.8×' }).tap()
  await close.tap()
  await expect(trigger).toBeFocused()
})

test('从馆藏开暗房后浏览器返回到馆藏，前进只恢复详情，不添加暗房历史', async ({ page }) => {
  const collection = '/explore'
  const artifact = '/artifacts/heluo-bronze-ding'
  await page.goto('/')
  await page.locator(`.mobile-tab-bar a[href="${collection}"]`).tap()
  const card = page.locator(`.gallery-object[href="${artifact}"]`)
  await card.tap()
  await expect(page).toHaveURL(new RegExp(`${artifact}$`))
  const entryCount = await page.evaluate(() => history.length)
  const trigger = page.getByTestId('artifact-fullscreen-btn')
  const dialog = page.getByTestId('artifact-loupe-lightbox')
  const main = page.locator('#main-content')

  await trigger.tap()
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => history.length)).toBe(entryCount)

  await page.goBack()
  await expect(page).toHaveURL(/\/explore$/)
  await expect(card).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(main).toBeFocused()
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).overflowY)).not.toBe('hidden')
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/explore$/)
  await expect(card).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`${artifact}$`))
  await expect(trigger).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(main).toBeFocused()
  expect(await page.evaluate(() => history.length)).toBe(entryCount)
})

test('暗房锁住背景滚轮与触摸滚动，关闭后保留位置并恢复滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/artifacts/heluo-bronze-ding')
  const trigger = page.getByTestId('artifact-fullscreen-btn')
  const close = page.getByTestId('artifact-lightbox-close')
  const dialog = page.getByTestId('artifact-loupe-lightbox')
  const header = page.locator('.site-header')
  await expect(trigger).toBeVisible()
  await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'instant' }))
  await expect(header).toHaveClass(/\bis-scrolled\b/)
  // Flush the collapsed header's layout before measuring the scroll position.
  await expect.poll(() => header.evaluate(el => el.getBoundingClientRect().height)).toBe(58)
  await page.evaluate(() => window.scrollTo({ top: 170, behavior: 'instant' }))
  await expect(trigger).toBeInViewport({ ratio: 1 })
  const y = await page.evaluate(() => scrollY)
  expect(y).toBeGreaterThan(100)
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(y + 300)
  await trigger.tap()
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => scrollY), 'Opening does not move the background').toBe(y)
  await page.mouse.move(160, 240)
  await page.mouse.wheel(0, 230)

  // The top bar allows native touch panning, unlike the draggable image.
  // Start there so the check exercises the document lock, not touch-action: none.
  const session = await page.context().newCDPSession(page)
  try {
    const bar = await dialog.locator('.loupe-lightbox__bar').boundingBox()
    expect(bar).not.toBeNull()
    const nextFrame = () => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    const swipe = async (y: number) => {
      const x = 24
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (const dy of [20, 40, 60, 80]) {
        await nextFrame()
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] })
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await nextFrame()
    }
    await swipe(Math.round(bar!.y + bar!.height - 10))
    expect(await page.evaluate(() => scrollY), 'Wheel and touch do not scroll the background').toBe(y)
    await expect(close).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => scrollY), 'Closing preserves the background position').toBe(y)
    await swipe(430)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y + 30)
    const afterSwipe = await page.evaluate(() => scrollY)
    await page.mouse.move(160, 240)
    await page.mouse.wheel(0, 230)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(afterSwipe + 100)
  } finally {
    await session.detach()
  }
})

test('3D 在手机短屏与横屏初始可用，扩展工具可退出', async ({ page }) => {
  for (const [width, height] of [[320, 529], [375, 628], [844, 351]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/exhibits/heluo-bronze-ding-3d')
    await hitBox(page.locator('.viewer-poster-start'))
    await hitBox(page.locator('.viewer-poster-info'))
    await page.locator('.viewer-poster-start').tap()
    await expect(page.locator('[data-viewer-state="ready"]')).toBeVisible({ timeout: 25_000 })
    await hitBox(page.locator('.mobile-exhibit-info-trigger'))
    await hitBox(page.locator('.viewer-tools button:last-child'))
    await hitBox(page.locator('.dock-mode-switch button').first())
    const tools = page.getByTestId('compact-exhibit-tools')
    if (await tools.isVisible()) {
      await hitBox(tools)
      await tools.tap()
      await expect(tools).toHaveAttribute('aria-expanded', 'true')
      await hitBox(page.locator('.view-switcher button').first())
      await hitBox(page.getByTestId('spatial-guide-toggle'))
      await hitBox(page.getByTestId('start-micro-tour'))
      await page.keyboard.press('Escape')
      await expect(tools).toHaveAttribute('aria-expanded', 'false')
    }
  }
})

for (const [width, height, locale, message, retryLabel] of [
  [320, 529, 'zh-CN', /不支持 WebGL/, '重试加载'],
  [844, 351, 'en-US', /does not support WebGL/, 'Try again'],
] as const) {
  test(`没有 WebGL 时 ${width}×${height} 仍可查看展品资料和重试`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(() => {
      Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: undefined })
    })
    await page.goto('/exhibits/heluo-bronze-ding-3d')
    if (locale === 'en-US') await page.locator('.locale-toggle').tap()
    await page.locator('.viewer-poster-start').tap()
    const fallback = page.locator('[data-viewer-state="error"] .three-fallback[role="alert"]')
    await expect(fallback).toContainText(message)
    await expect.poll(() => fallback.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    const retry = fallback.getByRole('button', { name: retryLabel })
    await hitBox(retry)
    await retry.tap()
    await expect(fallback).toContainText(message)
    const info = page.locator('.mobile-exhibit-info-trigger')
    await hitBox(info)
    await info.tap()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('.mobile-exhibit-facts dd').first()).toBeVisible()
    await expect(dialog.locator('a[href^="/artifacts/"]')).toBeVisible()
  })
}

for (const [width, height, locale, message, retryLabel] of [
  [320, 529, 'zh-CN', /3D 显示连接已中断/, '重试加载'],
  [844, 351, 'en-US', /3D display connection was interrupted/, 'Try again'],
] as const) {
  test(`青铜鼎运行中失去 WebGL 后 ${width}×${height} 可读资料并重新加载`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/exhibits/heluo-bronze-ding-3d')
    if (locale === 'en-US') await page.locator('.locale-toggle').tap()
    await page.locator('.viewer-poster-start').tap()
    const viewer = page.locator('.exhibit-viewer-wrap')
    await expect(viewer).toHaveAttribute('data-viewer-state', 'ready', { timeout: 25_000 })
    await viewer.locator('canvas[aria-hidden="true"]').evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('webgl2')
      const extension = ctx?.getExtension('WEBGL_lose_context')
      if (!extension) throw new Error('The running WebGL2 canvas cannot simulate context loss')
      extension.loseContext()
    })
    const fallback = viewer.locator('.three-fallback[role="alert"]')
    await expect(fallback).toContainText(message)
    await expect(viewer.locator('canvas[aria-hidden="true"]')).toHaveCount(0)
    await expect.poll(() => fallback.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    const info = page.locator('.mobile-exhibit-info-trigger')
    await hitBox(info)
    await info.tap()
    const details = page.getByRole('dialog')
    await expect(details.locator('.mobile-exhibit-facts dd').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(details).toBeHidden()
    const retry = fallback.getByRole('button', { name: retryLabel })
    await hitBox(retry)
    await retry.tap()
    await expect(viewer).toHaveAttribute('data-viewer-state', 'ready', { timeout: 25_000 })
    await expect(viewer.locator('canvas[aria-hidden="true"]')).toBeVisible()
  })
}

for (const [width, height, locale, message] of [
  [320, 529, 'zh-CN', '图形显示暂时中断'],
  [320, 529, 'en-US', 'Graphics interrupted'],
  [844, 351, 'en-US', 'Graphics interrupted'],
] as const) test(`图纹石板失去 WebGL 后 ${width}×${height} ${locale} 提示不被挡住，恢复时重建光学台`, async ({ page }) => {
  await page.setViewportSize({ width, height })
  await page.goto('/exhibits/river-map-stone-raking')
  if (locale === 'en-US') await page.locator('.locale-toggle').tap()
  await page.locator('.viewer-poster-start').tap()
  const stage = page.getByTestId('raking-light-viewer')
  const canvas = stage.locator('canvas')
  await expect(canvas).toBeVisible()
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const ctx = element.getContext('webgl')
    const extension = ctx?.getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('The running optical canvas cannot simulate context loss')
    element.addEventListener('test-restore-webgl', () => extension.restoreContext(), { once: true })
    extension.loseContext()
  })
  const plate = stage.locator('.raking-fallback img')
  await expect(plate).toBeVisible({ timeout: 5_000 })
  const status = stage.getByRole('status')
  await expect(status).toContainText(message)
  await expect.poll(() => status.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const dock = element.closest('.exhibit-scene')?.querySelector('.exhibit-dock')?.getBoundingClientRect()
    const text = document.createRange()
    text.selectNodeContents(element)
    return !!dock && bounds.bottom <= dock.top
      && Array.from(text.getClientRects()).every(({ left, top, right, bottom }) =>
        [[left + 1, top + 1], [right - 1, top + 1], [left + 1, bottom - 1], [right - 1, bottom - 1]]
          .every(([x, y]) => element.contains(document.elementFromPoint(x!, y!))))
  }), { message: 'The status text stays above the dock and unobstructed' }).toBe(true)
  await expect.poll(() => plate.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(canvas).toBeHidden()
  const info = page.locator('.mobile-exhibit-info-trigger')
  await hitBox(info)
  await info.tap()
  await expect(page.getByRole('dialog').locator('.mobile-exhibit-facts dd').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.screenshot({ path: test.info().outputPath(`stone-graphics-interrupted-${locale}-${width}.png`) })
  await canvas.dispatchEvent('test-restore-webgl')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await expect(plate).toHaveCount(0)
  await expect(page.locator('.exhibit-viewer-wrap')).toHaveAttribute('data-viewer-state', 'ready')
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const ctx = element.getContext('webgl')
    const activeProgram = ctx?.getParameter(ctx.CURRENT_PROGRAM) as WebGLProgram | null | undefined
    return !!(ctx && !ctx.isContextLost() && activeProgram && ctx.isProgram(activeProgram))
  })).toBe(true)
  const loupe = stage.getByTestId('raking-loupe-toggle')
  await expect(loupe).toBeEnabled()
  if (width === 320) {
    await hitBox(stage.getByTestId('raking-compass'))
    await hitBox(loupe)
    if (process.env.HELUO_REQUIRE_GUIDE) await hitBox(page.locator('.luosheng-fab'))
    await expect.poll(() => loupe.evaluate(button => {
      const telemetry = button.closest('.raking-hud')?.querySelector('.raking-telemetry__row')
      if (!telemetry) return false
      const text = document.createRange()
      text.selectNodeContents(telemetry)
      return text.getBoundingClientRect().right <= button.getBoundingClientRect().left
    }), { message: 'Optical telemetry does not extend under the loupe' }).toBe(true)
  }
  await page.screenshot({ path: test.info().outputPath(`stone-graphics-restored-${locale}-${width}.png`) })
})

test('抽查声景、推镜、手账、检索、登录和购物袋操作热区', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 805 })
  await page.goto('/')
  await page.locator('.home-cover__ruler').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  for (const selector of ['.acoustic-ruler__trigger', '.home-closeup__zoom-pill', '.site-footer__journal-btn']) {
    const target = page.locator(selector).first()
    await target.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await hitBox(target)
  }
  await page.locator('.mobile-tab-bar a[href="/explore"]').tap()
  await hitBox(page.locator('.museum-search-field__control input'), true, 48)
  await hitBox(page.locator('.museum-search-field__submit'), true, 48)
  await hitBox(page.locator('.gallery-hot-terms button').first(), true)
  await page.goto('/login')
  await hitBox(page.locator('.auth-mode-tabs button').first(), true)
  await hitBox(page.locator('.password-toggle'), true)
  await page.goto('/shop')
  await page.locator('.mobile-cart-trigger').tap()
  await hitBox(page.locator('.bottom-sheet-handle'))
  await page.keyboard.press('Escape')
  await expect(page.locator('.bottom-sheet-handle')).toBeHidden()
})

for (const { width, height, locale } of [
  { width: 320, height: 529, locale: 'zh-CN' },
  { width: 844, height: 351, locale: 'en-US' },
]) {
  test(`馆藏纹样标签和预约助手热区可准确点按（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(lang => localStorage.setItem('heluo.locale', lang), locale)
    await page.goto('/shop')
    const motif = page.locator('.product-motif-chip').first()
    await expect(motif).toHaveAccessibleName(/查看溯源|Open provenance/)
    await motif.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await hitBox(motif)
    await motif.tap({ position: { x: 8, y: 8 } })
    const drawer = page.getByTestId('product-provenance-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveRole('dialog')
    await drawer.getByTestId('provenance-close').tap()
    await expect(drawer).toBeHidden()

    await page.goto('/appointment')
    const guide = page.getByRole('button', { name: '问洛笙查可约时段' })
      .or(page.getByRole('button', { name: 'Ask Luosheng about open slots' }))
    if (!process.env.HELUO_REQUIRE_GUIDE && !(await guide.count())) return
    await guide.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await hitBox(guide)
    await guide.tap({ position: { x: 8, y: 8 } })
    await expect(page.getByTestId('luosheng-drawer')).toBeVisible()
    await expect(page.getByTestId('luosheng-input')).toHaveValue(/最近三天|next 3 days/)
  })
}
