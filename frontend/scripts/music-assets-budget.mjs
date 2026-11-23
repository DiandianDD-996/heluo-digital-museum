/** Validate the approved R4 music resources actually copied into the build. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const directory = resolve(process.cwd(), 'dist/media/audio/music-r4')
const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'))
const ids = ['home', 'reading', 'bronze', 'jade']
const budget = 6_000_000
assert.equal(manifest.schemaVersion, 1, 'Unsupported music manifest')
assert.equal(manifest.revision, 'r4-approved-web-loop', 'Music must use the approved R4 export')
assert.deepEqual(manifest.tracks.map(track => track.id).sort(), [...ids].sort(), 'Exactly four approved tracks are required')
assert.equal(manifest.sourceLicense.id, 'CC0-1.0', 'Missing verified source license')
for (const docFile of ['CREDITS.md', 'LICENSE-CC0-1.0.txt', 'LICENSE-VCSL-CC0-1.0.txt']) {
  assert.equal(existsSync(resolve(directory, docFile)), true, `Missing attribution/license file: ${docFile}`)
}
assert.deepEqual(readdirSync(directory).filter(file => /\.(mp3|wav|ogg|m4a|flac)$/i.test(file)).sort(),
  ids.map(id => `${id}-r4.m4a`).sort(), 'Only production AAC (.m4a) resources belong in music-r4')

let totalBytes = 0
for (const track of manifest.tracks) {
  const expectedFile = `${track.id}-r4.m4a`
  assert.equal(track.file, expectedFile)
  assert.equal(track.url, `/media/audio/music-r4/${expectedFile}`)
  assert.equal(track.mimeType, 'audio/mp4')
  assert.equal(track.sampleRate, 44100)
  assert.equal(track.channels, 2)
  assert.equal(track.loop.nativeLoop, true)
  assert.equal(track.loop.loopStartSeconds, 0)
  assert.equal(track.loop.loopEndSeconds, track.durationSeconds)
  assert.ok(track.durationSeconds >= 90 && track.durationSeconds <= 120, `${track.id}: unexpected duration`)
  assert.equal(track.decoded.clippedSamples, 0, `${track.id}: clipped export`)
  assert.ok(track.decoded.oversampledPeakDbtp < -3, `${track.id}: insufficient peak headroom`)
  assert.equal(track.headOffsetSamples, 0, `${track.id}: encoder delay is not trimmed`)
  assert.ok(track.repeatBoundary.nearZeroRunAcrossRepeatSeconds < 0.01, `${track.id}: silent loop edge`)
  const bytes = readFileSync(resolve(directory, expectedFile))
  assert.equal(bytes.length, track.bytes, `${track.id}: size differs from validated export`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), track.sha256, `${track.id}: content differs from validated export`)
  totalBytes += bytes.length
}
assert.equal(totalBytes, manifest.totalAudioBytes)
assert.ok(totalBytes <= budget, `Music assets exceed the ${budget} byte budget: ${totalBytes}`)
console.log(`配乐资源门禁通过：${manifest.tracks.length} 首已认可 R4 (AAC .m4a)，${totalBytes} / ${budget} B；散列与 CC0 许可清单一致。`)
