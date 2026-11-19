/** Validate the approved music resources actually copied into the build. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const directory = resolve(process.cwd(), 'dist/media/audio/music-r3')
const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'))
const ids = ['home', 'reading', 'bronze']
const budget = 6_000_000
assert.equal(manifest.schemaVersion, 1, 'Unsupported music manifest')
assert.equal(manifest.revision, 'r3-approved-web-loop', 'Music must use the approved R3 export')
assert.deepEqual(manifest.tracks.map(track => track.id).sort(), [...ids].sort(), 'Exactly three approved tracks are required')
assert.equal(manifest.sourceLicense.id, 'CC0-1.0', 'Missing verified source license')
assert.deepEqual(readdirSync(directory).filter(file => /\.(mp3|wav|ogg|m4a|flac)$/i.test(file)).sort(),
  ids.map(id => `${id}-r3.mp3`).sort(), 'Only production MP3 resources belong in the public directory')

let totalBytes = 0
for (const track of manifest.tracks) {
  const expectedFile = `${track.id}-r3.mp3`
  assert.equal(track.file, expectedFile)
  assert.equal(track.url, `/media/audio/music-r3/${expectedFile}`)
  assert.equal(track.mimeType, 'audio/mpeg')
  assert.equal(track.sampleRate, 44100)
  assert.equal(track.channels, 2)
  assert.equal(track.loop.nativeLoop, true)
  assert.equal(track.loop.loopStartSeconds, 0)
  assert.equal(track.loop.loopEndSeconds, track.durationSeconds)
  assert.ok(track.durationSeconds >= 90 && track.durationSeconds <= 120, `${track.id}: unexpected duration`)
  assert.equal(track.decoded.clippedSamples, 0, `${track.id}: clipped export`)
  assert.ok(track.decoded.oversampledPeakDbtp < -3, `${track.id}: insufficient peak headroom`)
  assert.equal(track.gapless.headOffsetSamples, 0, `${track.id}: encoder delay is not trimmed`)
  assert.equal(track.gapless.tailOffsetSamples, 0, `${track.id}: encoder padding is not trimmed`)
  assert.equal(track.gapless.decodedFrames, Math.round(track.durationSeconds * track.sampleRate))
  const bytes = readFileSync(resolve(directory, expectedFile))
  assert.equal(bytes.length, track.bytes, `${track.id}: size differs from validated export`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), track.sha256, `${track.id}: content differs from validated export`)
  totalBytes += bytes.length
}
assert.equal(totalBytes, manifest.totalAudioBytes)
assert.ok(totalBytes <= budget, `Music assets exceed the ${budget} byte budget: ${totalBytes}`)
console.log(`配乐资源门禁通过：${manifest.tracks.length} 首已认可R3，${totalBytes} / ${budget} B；文件与音频验收清单一致。`)
