import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

async function runDatedDemo(preset, failedEndpoint) {
  const upstream = createServer((request, reply) => {
    reply.setHeader('content-type', 'application/json')
    if (['/api/v1/health', '/api/v1/ready'].includes(request.url)) {
      reply.end(JSON.stringify({ data: { status: request.url === failedEndpoint ? 'DOWN' : 'UP' } }))
    } else {
      reply.end(JSON.stringify({ data: preset }))
    }
  })
  await new Promise((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen(0, '127.0.0.1', resolve)
  })
  try {
    const child = spawn(process.execPath, ['scripts/luosheng-local-demo.mjs'], {
      cwd: fileURLToPath(new URL('../../../frontend/', import.meta.url)),
      env: { ...process.env, MUSEUM_DEV_API_URL: `http://127.0.0.1:${upstream.address().port}`,
        LUOSHENG_LOCAL_DEMO_DATED: '1', LUOSHENG_LOCAL_DEMO_SMOKE: '0', LUOSHENG_LOCAL_DEMO_SECONDS: '1',
        LUOSHENG_DATED_DEMO_DIST: '', LUOSHENG_DATED_DEMO_ROLLBACK_DIST: '' },
      timeout: 15_000,
    })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const [exitCode] = await once(child, 'close')
    return { output, exitCode }
  } finally {
    await new Promise(resolve => upstream.close(resolve))
  }
}

test('dated demo does not advertise a different preset with the same ear card', async () => {
  const { output, exitCode } = await runDatedDemo({ available: true, entries: [{ cardId: 'LS-DING-EARS', revision: 1 }] })
  assert.doesNotMatch(output, /LUOSHENG_LOCAL_DEMO_URL=/)
  assert.match(output, /Dated demo preset does not match the frozen eight cards/)
  assert.equal(exitCode, 1)
})

for (const endpoint of ['/api/v1/health', '/api/v1/ready']) {
  test(`dated demo does not advertise a matching preset when ${endpoint} is DOWN`, async () => {
    const { cards } = JSON.parse(await readFile(new URL('./ding-zh-CN-0.5.0-signoff-candidate.2026-11-22.json', import.meta.url), 'utf8'))
    const { output, exitCode } = await runDatedDemo({ available: true, exhibitSlug: 'heluo-bronze-ding-3d', locale: 'zh-CN',
      entries: cards.map(({ id, revision, text, publicSource }) => ({ cardId: id, revision, text, publicSource: publicSource ?? null })) }, endpoint)
    assert.doesNotMatch(output, /LUOSHENG_LOCAL_DEMO_URL=/)
    assert.ok(output.includes(`${endpoint} did not report UP`), output)
    assert.equal(exitCode, 1)
  })
}
