#!/usr/bin/env node
/**
 * Luosheng v2 Disabled-State Isolation Verification (VITE_GUIDE_ENABLED=false).
 * Verifies at BOTH 390x844 dark and 1440x900 light across Home, Bronze Ding Artifact,
 * Bronze Ding 3D Exhibit, and Appointment routes:
 *  - ZERO Luosheng UI elements ([data-testid="luosheng-fab"], #luosheng-static-plates)
 *  - ZERO /api/v1/guide/ network requests
 *  - ZERO console errors, ZERO page errors, ZERO horizontal overflow
 *
 * Usage:
 *   node frontend/scripts/luosheng-isolation.mjs --url http://127.0.0.1:4174
 */
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
let baseUrl = process.env.LUOSHENG_ISOLATION_URL || 'http://127.0.0.1:4174'
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--url' && args[i + 1]) baseUrl = args[i + 1]
}
baseUrl = baseUrl.replace(/\/+$/, '')

const PROFILES = [
  { name: '390-dark', viewport: { width: 390, height: 844 }, theme: 'dark' },
  { name: '1440-light', viewport: { width: 1440, height: 900 }, theme: 'light' },
]

const ROUTES = ['/', '/artifacts/heluo-bronze-ding', '/exhibits/heluo-bronze-ding-3d', '/appointment']

async function runProfile(browser, profile) {
  console.log(`\n=== Running Luosheng v2 Isolation profile: ${profile.name} ===`)
  const context = await browser.newContext({
    viewport: profile.viewport,
    colorScheme: profile.theme,
  })
  const page = await context.newPage()
  const guideRequests = []
  const consoleErrors = []
  const pageErrors = []

  page.on('request', (req) => {
    if (req.url().includes('/api/v1/guide')) {
      guideRequests.push(`${req.method()} ${req.url()}`)
    }
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    pageErrors.push(String(err))
  })

  await page.addInitScript((theme) => {
    window.localStorage.setItem('heluo-theme', theme)
    window.localStorage.setItem('heluo-locale', 'zh-CN')
  }, profile.theme)

  for (const routePath of ROUTES) {
    await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'networkidle' })
    await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, profile.theme)

    const fabCount = await page.locator('[data-testid="luosheng-fab"]').count()
    const drawerCount = await page.locator('[data-testid="luosheng-drawer"]').count()
    const plateCount = await page.locator('#luosheng-static-plates').count()
    if (fabCount > 0 || drawerCount > 0 || plateCount > 0) {
      throw new Error(`[${profile.name}${routePath}] Unexpected guide UI found when disabled: fab=${fabCount}, drawer=${drawerCount}, plate=${plateCount}`)
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 1) {
      throw new Error(`[${profile.name}${routePath}] Horizontal overflow: ${overflow}px`)
    }
    console.log(`[${profile.name}] ${routePath} -> 0 guide UI, 0 overflow`)
  }

  if (guideRequests.length) {
    throw new Error(`[${profile.name}] Unexpected /api/v1/guide requests when disabled:\n${guideRequests.join('\n')}`)
  }
  if (consoleErrors.length || pageErrors.length) {
    throw new Error(`[${profile.name}] Runtime errors:\nconsole: ${consoleErrors.join('\n')}\npage: ${pageErrors.join('\n')}`)
  }

  await context.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const profile of PROFILES) {
      await runProfile(browser, profile)
    }
    console.log('\nALL Luosheng v2 Isolation checks PASSED (zero UI, zero /api/v1/guide requests)!')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
