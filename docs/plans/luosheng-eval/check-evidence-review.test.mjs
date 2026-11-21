import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditEvidenceReview } from './check-evidence-review.mjs'

const read = path => readFileSync(new URL(path, new URL('../../../', import.meta.url)))
const draft = read('docs/plans/2026-11-19-luosheng-evidence-cards.md').toString('utf8')

test('the actual snapshot matches, but all four cards still need release approval', () => {
  const result = auditEvidenceReview(draft, read)
  assert.deepEqual(result.issues, [])
  assert.equal(result.pending.length, 5)
  const command = fileURLToPath(new URL('./check-evidence-review.mjs', import.meta.url))
  const run = spawnSync(process.execPath, [command], { encoding: 'utf8' })
  assert.equal(run.status, 2)
  assert.match(run.stdout, /LS-DING-SOURCE/)
})

test('changed plate and missing model both fail the snapshot check', () => {
  const result = auditEvidenceReview(draft, path => {
    if (path.endsWith('relief.webp')) return Buffer.from('replacement')
    if (path.endsWith('.glb')) throw new Error('missing')
    return read(path)
  })
  assert.equal(result.issues.length, 2)
  assert.match(result.issues[0], /relief.webp/)
  assert.match(result.issues[1], /v5.5.glb/)
})

test('pending review rejects modified or missing frozen content before formal sign-off', () => {
  const suffix = 'ding-zh-CN-0.3.0-review-candidate.json'
  const changed = auditEvidenceReview(draft, path => path.endsWith(suffix)
    ? Buffer.concat([read(path), Buffer.from('\n')]) : read(path))
  assert.equal(changed.issues.length, 1)
  assert.match(changed.issues[0], /review-candidate\.json.*不一致/)
  const missing = auditEvidenceReview(draft, path => {
    if (path.endsWith(suffix)) throw new Error('missing')
    return read(path)
  })
  assert.equal(missing.issues.length, 1)
  assert.match(missing.issues[0], /review-candidate\.json.*无法读取/)
})

test('candidate generation preserves all approved content and never overwrites a candidate', t => {
  const folder = mkdtempSync(join(tmpdir(), 'luosheng-candidate-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const command = fileURLToPath(new URL('./prepare-evidence-candidate.mjs', import.meta.url))
  const run = (time, file) => spawnSync(process.execPath, [command, time, join(folder, file)], { encoding: 'utf8' })
  const time = '2040-11-19T10:00:00Z'
  const result = run(time, 'first.json')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(run(time, 'second.json').status, 0)
  const first = readFileSync(join(folder, 'first.json'))
  assert.deepEqual(first, readFileSync(join(folder, 'second.json')))
  assert.match(result.stdout, new RegExp(createHash('sha256').update(first).digest('hex')))
  const frozen = JSON.parse(read('docs/plans/luosheng-eval/ding-zh-CN-0.3.0-review-candidate.json'))
  assert.deepEqual(JSON.parse(first), {
    ...frozen,
    cards: frozen.cards.map(card => ({ ...card, status: 'PUBLISHED', publishedAt: time })),
  })
  assert.equal(run('2040-11-20T10:00:00Z', 'first.json').status, 1)
  assert.deepEqual(readFileSync(join(folder, 'first.json')), first)
  assert.equal(run('2040-02-30T10:00:00Z', 'invalid.json').status, 1)
  assert.throws(() => readFileSync(join(folder, 'invalid.json')), { code: 'ENOENT' })
})

test('a missing review row and duplicate hash row fail the document check', () => {
  const hashRow = draft.match(/^\| `luosheng-ding-top\.webp` .*$/m)?.[0]
  assert(hashRow)
  const changed = draft.replace(/^\| LS-DING-EARS .*$/m, '').replace(hashRow, `${hashRow}\n${hashRow}`)
  const result = auditEvidenceReview(changed, read)
  assert.equal(result.issues.length, 2)
  assert.match(result.issues[0], /top.webp/)
  assert.match(result.issues[1], /LS-DING-EARS/)
})

const cards = ['EARS', 'FEET', 'MOTIF', 'SOURCE'].map(name => ({
  id: 'LS-DING-' + name, status: 'PUBLISHED',
}))
const candidate = Buffer.from(JSON.stringify({ formatVersion: 1, releaseVersion: 3, cards }))
const hash = createHash('sha256').update(candidate).digest('hex')
const editorial = 'Fixture Editor／2026-11-19／0.3.0／TEST-CONTENT／' + hash
const media = 'Fixture Publisher／2026-11-20／0.3.0／TEST-MEDIA／' + hash
const release = draft.replace('ding-zh-CN@0.3.0-draft', 'ding-zh-CN@0.3.0')
  .replace(/^(\| LS-DING-[A-Z]+ \| [^|]+ \|).*$/gm, '$1 ' + editorial + ' | ' + media + ' | 已发布 |')

test('complete synthetic records pass structural validation', () => {
  assert.deepEqual(auditEvidenceReview(release, read, candidate), { version: '0.3.0', issues: [], pending: [] })
})

test('published records require the exact reviewed file, including same-version changes', () => {
  assert.match(auditEvidenceReview(release, read).issues[0], /必须提供/)
  const changed = Buffer.concat([candidate, Buffer.from(' ')])
  const issues = auditEvidenceReview(release, read, changed).issues
  assert.equal(issues.length, 8)
  assert(issues.every(issue => /指纹与候选文件不一致/.test(issue)))
  assert.match(auditEvidenceReview(release, read, Buffer.alloc(256 * 1024 + 1)).issues[0], /超过/)
})

test('an exact digest is not sufficient when the candidate omits a published card', () => {
  const incomplete = Buffer.from(JSON.stringify({ formatVersion: 1, releaseVersion: 3, cards: cards.slice(1) }))
  const records = release.replaceAll(hash, createHash('sha256').update(incomplete).digest('hex'))
  assert.deepEqual(auditEvidenceReview(records, read, incomplete).issues, ['候选文件里的已发布卡片与签核表不一致'])
})

test('malformed JSON is rejected even when the digest matches', () => {
  const broken = Buffer.from('{')
  const records = release.replaceAll(hash, createHash('sha256').update(broken).digest('hex'))
  assert.match(auditEvidenceReview(records, read, broken).issues[0], /无法解析/)
})

for (const [label, oldValue, newValue, expected] of [
  ['free text', editorial, '看过了', /须填写/],
  ['empty receipt', media, media.replace('TEST-MEDIA', ''), /须填写/],
  ['missing reviewer', editorial, editorial.replace('Fixture Editor', ''), /须填写/],
  ['impossible date', editorial, editorial.replace('2026-11-19', '2026-02-30'), /日期无效/],
  ['previous pack', media, media.replace('0.3.0', '0.2.0'), /签核版本/],
  ['invalid hash', media, media.replace(hash, 'not-a-hash'), /指纹无效/],
]) {
  test('published records reject ' + label, () => {
    const result = auditEvidenceReview(release.replace(oldValue, newValue), read, candidate)
    assert.equal(result.issues.length, 1)
    assert.match(result.issues[0], expected)
    assert.equal(result.pending.length, 0)
  })
}

test('an unknown release state cannot stand in for a published record', () => {
  const result = auditEvidenceReview(release.replace('已发布', '完成'), read, candidate)
  assert.deepEqual(result.issues, ['LS-DING-EARS：发布状态无效', '候选文件里的已发布卡片与签核表不一致'])
})

test('release marks do not override draft status or ambiguous versions', () => {
  const changed = release.replace('ding-zh-CN@0.3.0', 'ding-zh-CN@0.3.0-draft')
    .replaceAll('／0.3.0／', '／0.3.0-draft／')
  assert.equal(auditEvidenceReview(changed, read, candidate).issues.filter(issue => /草稿卡包/.test(issue)).length, 4)
  const duplicate = release.replace(/^卡包 .*$/m, '$&\n$&')
  assert.match(auditEvidenceReview(duplicate, read, candidate).issues[0], /唯一有效/)
})

test('well-formed reviews do not override mismatched assets or an unpublished card', () => {
  const unpublished = Buffer.from(JSON.stringify({ formatVersion: 1, releaseVersion: 3, cards: cards.slice(1) }))
  const records = release.replace('已发布', '待发布')
    .replaceAll(hash, createHash('sha256').update(unpublished).digest('hex'))
  const result = auditEvidenceReview(records, path =>
    path.endsWith('top.webp') ? Buffer.from('replacement') : read(path), unpublished)
  assert.equal(result.issues.length, 1)
  assert.match(result.issues[0], /top.webp/)
  assert.equal(result.pending.length, 1)
  assert.match(result.pending[0], /LS-DING-EARS/)
})

test('extended review is pending and detects a modified supplement before candidate generation', () => {
  const mode = { extended: true }
  const actual = auditEvidenceReview(draft, read, undefined, mode)
  assert.equal(actual.version, '0.4.0-draft')
  assert.deepEqual(actual.issues, [])
  assert.equal(actual.pending.length, 7)
  const changed = auditEvidenceReview(draft, path => path.endsWith('ding-period-zh-CN-draft.json')
    ? Buffer.concat([read(path), Buffer.from('\n')]) : read(path), undefined, mode)
  assert.deepEqual(changed.issues, ['docs/plans/luosheng-eval/ding-period-zh-CN-draft.json：与审稿快照不一致'])
})

test('extended candidate can use six fresh attestations without altering the four-card workflow', t => {
  const folder = mkdtempSync(join(tmpdir(), 'luosheng-extended-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const prepare = fileURLToPath(new URL('./prepare-evidence-candidate.mjs', import.meta.url))
  const target = join(folder, 'extended.json')
  const time = '2040-11-21T00:00:00Z'
  const args = [prepare, '--extended', time, target]
  const run = spawnSync(process.execPath, args, { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  assert.equal(spawnSync(process.execPath, args, { encoding: 'utf8' }).status, 1)
  const bytes = readFileSync(target)
  const pack = JSON.parse(bytes)
  assert.equal(pack.releaseVersion, 3)
  assert.deepEqual(pack.cards.map(card => card.id), [...cards.map(card => card.id), 'LS-DING-PERIOD', 'LS-DING-SIZE'])
  assert(pack.cards.every(card => card.status === 'PUBLISHED' && card.publishedAt === time))
  assert.match(pack.cards[4].text, /1962\.281/)
  assert.match(pack.cards[5].text, /24\.5 × 20/)
  const digest = createHash('sha256').update(bytes).digest('hex')
  assert.match(run.stdout, new RegExp(digest))
  const mode = { extended: true }
  assert(auditEvidenceReview(draft, read, bytes, mode).issues.length > 0)
  assert(auditEvidenceReview(release, read, bytes).issues.length > 0)
  const approvals = draft.replace('ding-zh-CN@0.4.0-draft', 'ding-zh-CN@0.4.0')
    .replace(/^(\| 扩展 · LS-DING-[A-Z]+ \| [^|]+ \|).*$/gm,
      '$1 Test Editor／2026-11-21／0.4.0／FAKE-EDITORIAL／' + digest
      + ' | Test Publisher／2026-11-21／0.4.0／FAKE-RELEASE／' + digest + ' | 已发布 |')
  assert.deepEqual(auditEvidenceReview(approvals, read, bytes, mode), { version: '0.4.0', issues: [], pending: [] })
  const unsignedSize = approvals.replace(/^(\| 扩展 · LS-DING-SIZE \| [^|]+ \|).*$/m, '$1 待签 | 待签 | 草稿 |')
  assert.match(auditEvidenceReview(unsignedSize, read, bytes, mode).issues.join('\n'), /清单|不一致/)
  const tampered = Buffer.from(bytes.toString().replace('24.5 × 20', '99 × 99'))
  const newDigest = createHash('sha256').update(tampered).digest('hex')
  assert.match(auditEvidenceReview(approvals.replaceAll(digest, newDigest), read, tampered, mode).issues.join('\n'),
    /冻结快照/)
})
