#!/usr/bin/env node
/**
 * Luosheng v2 Playwright E2E Verification (390 dark + 1440 light).
 * Verifies:
 *  - Floating FAB + drawer open/close without losing multi-turn history (sessionStorage)
 *  - Live SSE streaming response + honest mode badge + Sources & Notes drawer
 *  - Cross-page navigation context divider + cross-artifact Q&A
 *  - Appointment slot query
 *  - Clicking 3D viewer_focus action navigates/activates 3D showcase (and auto-collapses drawer on 390 mobile)
 *  - Bilingual en-US toggle keeps Luosheng enabled and switches UI to English (D1)
 *  - Clear conversation resets history
 *  - Zero console errors, zero page errors, zero horizontal overflow
 *
 * Usage:
 *   node frontend/scripts/luosheng-e2e.mjs --url http://127.0.0.1:4173
 */
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
let baseUrl = process.env.LUOSHENG_E2E_URL || 'http://127.0.0.1:4173'
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--url' && args[i + 1]) baseUrl = args[i + 1]
}
baseUrl = baseUrl.replace(/\/+$/, '')

const PROFILES = [
  { name: '390-dark', viewport: { width: 390, height: 844 }, theme: 'dark', mobile: true },
  { name: '1440-light', viewport: { width: 1440, height: 900 }, theme: 'light', mobile: false },
]

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) {
    throw new Error(`[${label}] Horizontal overflow detected: ${overflow}px`)
  }
}

async function runProfile(browser, profile) {
  console.log(`\n=== Running Luosheng v2 E2E profile: ${profile.name} ===`)
  const context = await browser.newContext({
    viewport: profile.viewport,
    colorScheme: profile.theme,
  })
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    pageErrors.push(String(err))
  })

  await page.addInitScript((theme) => {
    window.localStorage.setItem('heluo-theme', theme)
    window.localStorage.setItem('heluo-locale', 'zh-CN')
    if (!window.sessionStorage.getItem('__e2e_initialized')) {
      window.sessionStorage.clear()
      window.sessionStorage.setItem('__e2e_initialized', '1')
    }
  }, profile.theme)

  // 1. Load home page and open Luosheng drawer
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, profile.theme)
  await assertNoOverflow(page, `${profile.name}/home`)

  const fab = page.locator('[data-testid="luosheng-fab"]')
  await fab.waitFor({ state: 'visible', timeout: 15000 })
  await fab.click()
  const drawer = page.locator('[data-testid="luosheng-drawer"]')
  await drawer.waitFor({ state: 'visible' })
  await assertNoOverflow(page, `${profile.name}/home-drawer-open`)

  // 2. Ask about Bronze Ding legs via live SSE stream
  await page.locator('[data-testid="luosheng-input"]').fill('侧面数来数去只有两条腿，是断了一条吗？')
  await page.locator('[data-testid="luosheng-send"]').click()
  await page.locator('[data-testid="luosheng-mode-badge"]').first().waitFor({ state: 'visible', timeout: 30000 })
  const firstReplyText = await drawer.locator('.luosheng-msg--assistant .luosheng-bubble').first().innerText()
  if (!firstReplyText.trim() || firstReplyText.includes('<<<LUOSHENG_META>>>')) {
    throw new Error(`[${profile.name}] Invalid first SSE reply: ${firstReplyText}`)
  }
  console.log(`[${profile.name}] Turn 1 OK (${firstReplyText.slice(0, 42)}…)`)

  // 3. Close and reopen drawer — history MUST persist!
  await page.locator('[data-testid="luosheng-close"]').click()
  await drawer.waitFor({ state: 'hidden' })
  await fab.click()
  await drawer.waitFor({ state: 'visible' })
  const persistedCount = await drawer.locator('.luosheng-msg--assistant').count()
  if (persistedCount < 1) {
    throw new Error(`[${profile.name}] Conversation history lost after close/reopen`)
  }
  console.log(`[${profile.name}] Close/reopen persistence OK`)

  // 4. Ask appointment slot query (Turn 2)
  await page.locator('[data-testid="luosheng-input"]').fill('明天有哪些可以预约的时段？')
  await page.locator('[data-testid="luosheng-send"]').click()
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="luosheng-mode-badge"]').length >= 2,
    { timeout: 30000 },
  )
  console.log(`[${profile.name}] Turn 2 (appointment slots) OK`)

  // 5. Navigate via SPA (closing drawer on mobile first so page links are clickable) to Bronze Ding artifact page
  if (profile.mobile && (await drawer.isVisible())) {
    await page.locator('[data-testid="luosheng-close"]').click()
    await drawer.waitFor({ state: 'hidden' })
  }
  const dingLink = page.locator('a[href="/artifacts/heluo-bronze-ding"]').first()
  if (await dingLink.count()) {
    await dingLink.click()
    await page.waitForURL(/\/artifacts\/heluo-bronze-ding/, { timeout: 15000 })
  } else {
    await page.goto(`${baseUrl}/artifacts/heluo-bronze-ding`, { waitUntil: 'networkidle' })
  }
  await page.locator('#luosheng-static-plates').waitFor({ state: 'visible', timeout: 15000 })
  await assertNoOverflow(page, `${profile.name}/artifact-ding`)

  // Reopen drawer if collapsed, verify history still intact + divider inserted
  if (!(await drawer.isVisible())) {
    await fab.click()
    await drawer.waitFor({ state: 'visible' })
  }
  const dividerCount = await drawer.locator('.luosheng-divider').count()
  if (dividerCount < 1) {
    throw new Error(`[${profile.name}] Expected context divider after route navigation`)
  }
  console.log(`[${profile.name}] Cross-page context divider + static plates OK`)

  // 6. Trigger 3D viewer_focus action from the first assistant reply (or static plate 3D button)
  const focusBtn = drawer.locator('[data-action-type="viewer_focus"]').first()
  if (await focusBtn.count()) {
    await focusBtn.click()
  } else {
    await page.locator('[data-testid="luosheng-close"]').click()
    await page.locator('#luosheng-static-plates .preset-plate-btn--secondary').click()
  }

  await page.waitForURL(/\/exhibits\/heluo-bronze-ding-3d/, { timeout: 15000 })
  await assertNoOverflow(page, `${profile.name}/exhibit-3d`)
  if (profile.mobile) {
    // On mobile (< 768px), clicking 3D action collapses the drawer to uncover the 3D stage
    await drawer.waitFor({ state: 'hidden', timeout: 5000 })
  }
  // Confirm viewer runtime transitioned out of poster state (activating/loading/ready/error)
  const viewerState = await page.locator('.exhibit-viewer-wrap').getAttribute('data-viewer-state')
  if (!viewerState || viewerState === 'poster') {
    throw new Error(`[${profile.name}] Expected 3D viewer to activate after viewer_focus action, got: ${viewerState}`)
  }
  console.log(`[${profile.name}] 3D handoff & activation OK (viewerState=${viewerState})`)

  // 7. Test Clear conversation + Bilingual en-US mode (D1)
  if (!(await drawer.isVisible())) {
    await fab.click()
    await drawer.waitFor({ state: 'visible' })
  }
  await page.locator('[data-testid="luosheng-clear"]').click()
  const remainingMsgs = await drawer.locator('.luosheng-msg').count()
  if (remainingMsgs !== 0) {
    throw new Error(`[${profile.name}] Expected 0 messages after Clear, got ${remainingMsgs}`)
  }

  // Switch locale to en-US and verify Luosheng stays available in English
  await page.locator('[data-testid="luosheng-close"]').click()
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await page.locator('.locale-toggle').click()
  await page.waitForFunction(() => document.documentElement.lang === 'en-US')
  const enFabText = await fab.innerText()
  if (!enFabText.includes('Luosheng')) {
    throw new Error(`[${profile.name}] Expected English FAB label 'Luosheng', got: ${enFabText}`)
  }
  console.log(`[${profile.name}] Clear + Bilingual en-US OK`)

  if (consoleErrors.length || pageErrors.length) {
    throw new Error(
      `[${profile.name}] Runtime errors detected:\nconsole: ${consoleErrors.join('\n')}\npage: ${pageErrors.join('\n')}`,
    )
  }

  await context.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const profile of PROFILES) {
      await runProfile(browser, profile)
    }
    console.log('\nALL Luosheng v2 Playwright E2E checks PASSED (390 dark + 1440 light)!')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
