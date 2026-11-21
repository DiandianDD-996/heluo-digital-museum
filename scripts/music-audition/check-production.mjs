/** Read-only verification of the locally deployed app and approved music. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const origin = process.env.MUSIC_APP_URL || 'http://localhost:8088'
const dist = path.join(root, 'frontend/dist')
const evidence = path.join(root, 'artifacts/music-r3-integration-2026-09-27')
const checked = []
const digest = value => createHash('sha256').update(value).digest('hex')
const get = (relative, options = {}) => fetch(new URL(relative, origin), { signal: AbortSignal.timeout(15000), ...options })

for (const endpoint of ['/api/v1/health', '/api/v1/ready']) {
  const response = await get(endpoint)
  assert.equal(response.status, 200, endpoint)
  assert.equal((await response.json()).data.status, 'UP', endpoint)
  checked.push(`${endpoint}: HTTP 200 and data.status=UP`)
}
const localHtml = await readFile(path.join(dist, 'index.html'), 'utf8')
for (const route of ['/', '/explore', '/artifacts/water-bird-bronze', '/appointment', '/exhibits/heluo-bronze-ding-3d']) {
  const response = await get(route)
  assert.equal(response.status, 200, route)
  assert.equal(await response.text(), localHtml, `${route}: deployed HTML differs from this build`)
  checked.push(`${route}: current build HTML`)
}

const manifestResponse = await get('/media/audio/music-r3/manifest.json')
assert.equal(manifestResponse.status, 200)
const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer())
assert.equal(digest(manifestBytes), digest(await readFile(path.join(dist, 'media/audio/music-r3/manifest.json'))))
const manifest = JSON.parse(manifestBytes)
for (const track of manifest.tracks) {
  const response = await get(track.url)
  assert.equal(response.status, 200, track.url)
  assert.match(response.headers.get('content-type') || '', /^audio\/mpeg\b/)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(bytes.length, track.bytes)
  assert.equal(digest(bytes), track.sha256)
  const head = await get(track.url, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(Number(head.headers.get('content-length')), track.bytes)
  const range = await get(track.url, { headers: { Range: 'bytes=0-63' } })
  assert.equal(range.status, 206)
  assert.equal(range.headers.get('content-range'), `bytes 0-63/${track.bytes}`)
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(0, 64))
  checked.push(`${track.id}: anonymous GET/HEAD/Range, MIME, size and SHA256 match approved export`)
}

const buildAssets = (await readdir(path.join(dist, 'assets'))).filter(file => /\.(?:js|css)$/.test(file))
for (const file of buildAssets) {
  const response = await get(`/assets/${file}`)
  assert.equal(response.status, 200, file)
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(await readFile(path.join(dist, 'assets', file))), file)
}
checked.push(`${buildAssets.length} deployed JS/CSS assets match local production build`)
await mkdir(evidence, { recursive: true })
await writeFile(path.join(evidence, 'production-http-check.json'), JSON.stringify({
  checkedAt: new Date().toISOString(), origin, results: checked,
  limit: 'HTTP health, build identity and media serving only; real navigation is verified separately.',
}, null, 2) + '\n')
console.log(JSON.stringify({ origin, passed: checked.length, assets: buildAssets.length, musicBytes: manifest.totalAudioBytes }))
