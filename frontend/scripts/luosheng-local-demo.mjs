import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { createServer, preview } from 'vite'

const upstream = process.env.MUSEUM_DEV_API_URL ?? ''
if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(upstream) || Number(new URL(upstream).port) > 65535) {
  throw new Error('The local guide demo requires a dedicated loopback test backend')
}
const duration = process.env.LUOSHENG_LOCAL_DEMO_SECONDS ?? '900'
if (!/^[1-9]\d{0,2}$/.test(duration) || Number(duration) > 900) {
  throw new Error('LUOSHENG_LOCAL_DEMO_SECONDS must be an integer from 1 to 900')
}

const dated = process.env.LUOSHENG_LOCAL_DEMO_DATED === '1'
const smoke = process.env.LUOSHENG_LOCAL_DEMO_SMOKE === '1'
const dist = process.env.LUOSHENG_DATED_DEMO_DIST
const rollbackDist = process.env.LUOSHENG_DATED_DEMO_ROLLBACK_DIST
if (smoke && !dated) throw new Error('Local demo smoke requires the dated candidate')
if (dist && (!dated || !isAbsolute(dist))) {
  throw new Error('Built demo requires the dated candidate and an absolute output directory')
}
if (rollbackDist && (!dist || !smoke || !isAbsolute(rollbackDist))) {
  throw new Error('Rollback demo requires a built dated smoke run and an absolute rollback directory')
}
const bind = { host: '127.0.0.1', port: 0 }
const server = dist
  ? await preview({ build: { outDir: dist }, preview: { ...bind, proxy: { '/api': upstream } } })
  : await createServer({ server: { ...bind,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/docs/plans/**'] },
  } })
try {
  if (!dist) await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  if (dist) {
    const home = await fetch(base, { signal: AbortSignal.timeout(5000) })
    const builtIndex = await readFile(join(dist, 'index.html'), 'utf8')
    if (!home.ok || await home.text() !== builtIndex) throw new Error('Built demo did not serve the built index')
    console.log('Dated demo served the exact built index')
  }
  const status = await fetch(`${base}/api/v1/guide/exhibits/heluo-bronze-ding-3d`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!status.ok) throw new Error(`Local guide fixture is unavailable (HTTP ${status.status})`)
  const { data } = await status.json()
  if (!data?.available || !data.entries?.some(entry => entry.cardId === 'LS-DING-EARS')) {
    throw new Error('Local guide evidence is not active')
  }
  if (dated) {
    const endpoints = ['/api/v1/health', '/api/v1/ready']
    await Promise.all(endpoints.map(async endpoint => {
      const response = await fetch(`${base}${endpoint}`, { signal: AbortSignal.timeout(5000) })
      if (response.status !== 200 || (await response.json())?.data?.status !== 'UP') {
        throw new Error(`${endpoint} did not report UP (HTTP ${response.status})`)
      }
    }))
    const candidate = new URL('../../docs/plans/luosheng-eval/ding-zh-CN-0.5.0-signoff-candidate.2026-11-22.json', import.meta.url)
    const { cards } = JSON.parse(await readFile(candidate, 'utf8'))
    const actual = new Map(data.entries.map(entry => [entry.cardId, entry]))
    if (data.exhibitSlug !== 'heluo-bronze-ding-3d' || data.locale !== 'zh-CN'
        || cards.length !== 8 || data.entries.length !== cards.length || actual.size !== cards.length
        || !cards.every(card => {
          const entry = actual.get(card.id)
          return entry?.revision === card.revision && entry.text === card.text
            && entry.publicSource === (card.publicSource ?? null)
        })) {
      throw new Error('Dated demo preset does not match the frozen eight cards')
    }
    console.log('Dated demo health and readiness are UP; all eight frozen entries match')
  }
  console.log(`LUOSHENG_LOCAL_DEMO_URL=${base}/ (${smoke ? 'browser smoke' : `${duration}s`}; ${dated ? 'dated internal candidate' : 'synthetic evidence'}; no external model)`)
  if (smoke) {
    const { checkDatedDemo } = await import('./luosheng-dated-demo-check.mjs')
    await checkDatedDemo(base)
    if (rollbackDist) {
      const { stdout } = await promisify(execFile)(process.execPath, ['scripts/luosheng-production-check.mjs'], {
        timeout: 60_000,
        env: { ...process.env, LUOSHENG_PRODUCTION_ORIGIN: '', LUOSHENG_PRODUCTION_DIST: rollbackDist,
          LUOSHENG_CHECK_FRONTEND_ROLLBACK: '1' },
      })
      process.stdout.write(stdout)
    }
  } else {
    await setTimeout(Number(duration) * 1000)
  }
} finally {
  await server.close()
}
