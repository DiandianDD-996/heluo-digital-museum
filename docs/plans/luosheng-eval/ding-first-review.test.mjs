import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { firstReview } from './ding-first-review.mjs'
import { eightCandidateBytes, verifyEightCandidate, verifyEightSignoffs } from './ding-eight-candidate.mjs'

const read = path => readFileSync(new URL(path, new URL('../../../', import.meta.url)))
const queue = 'docs/plans/luosheng-eval/content-queue.md'
const editorial = 'docs/plans/luosheng-eval/ding-zh-CN-0.5.0-drafts.json'
const modify = (path, update) => name => name === path ? Buffer.from(update(read(name).toString('utf8'))) : read(name)

test('eight-card signoff candidate is deterministic and permits only status and effective-time changes', () => {
  const time = '2099-01-01T00:00:00Z'
  const bytes = eightCandidateBytes(read, time)
  assert.deepEqual(bytes, eightCandidateBytes(read, time))
  assert.equal(verifyEightCandidate(read, bytes), createHash('sha256').update(bytes).digest('hex'))
  const pack = JSON.parse(bytes)
  assert.equal(pack.cards.length, 8)
  assert.ok(pack.cards.every(card => card.status === 'PUBLISHED' && card.publishedAt === time))
  pack.cards[0].text += '变更'
  assert.throws(() => verifyEightCandidate(read, Buffer.from(JSON.stringify(pack, null, 2) + '\n')), /不一致/)
  const snapshotPath = 'docs/plans/luosheng-eval/ding-zh-CN-0.5.0-review-candidate.json'
  assert.throws(() => eightCandidateBytes(modify(snapshotPath, src => src + '\n'), time), /指纹/)
  assert.throws(() => eightCandidateBytes(read, '2099-02-29T00:00:00Z'), /UTC/)
})

test('checked-in signoff-only candidate matches the frozen review snapshot and recorded fingerprint', () => {
  const name = 'ding-zh-CN-0.5.0-signoff-candidate.json'
  const bytes = read('docs/plans/luosheng-eval/' + name)
  assert.deepEqual(bytes, eightCandidateBytes(read, '2099-01-01T00:00:00Z'))
  assert.ok(read(queue).toString('utf8').includes('| `' + name + '` | `' + verifyEightCandidate(read, bytes) + '` |'))
})

function signoffFixture(time = '2027-01-01T00:00:00Z') {
  const bytes = eightCandidateBytes(read, time)
  const cards = JSON.parse(bytes).cards.map(({ id, revision }) => ({ id, revision }))
  const receipt = (reference, role) => ({
    reference, role, reviewedOn: '2026-12-01', decision: 'APPROVED',
    candidateSha256: verifyEightCandidate(read, bytes), cards: structuredClone(cards),
  })
  return { bytes, records: {
    content: receipt('TEST-CONTENT', '测试内容审核'),
    assets: { ...receipt('TEST-ASSETS', '测试素材审核'), scope: '夹具图版、模型与发布许可' },
  } }
}

test('eight-card signoff preflight matches both receipts to all exact candidate revisions', () => {
  const { bytes, records } = signoffFixture()
  records.assets.cards.reverse()
  assert.equal(verifyEightSignoffs(read, bytes, records), verifyEightCandidate(read, bytes))
})

test('signoff preflight rejects missing, partial, stale, and ambiguous approvals', () => {
  const { bytes, records } = signoffFixture()
  for (const mutate of [
    row => { delete row.assets },
    row => { row.content.cards.pop() },
    row => { row.assets.cards[0].revision += 1 },
    row => { row.content.cards[1] = row.content.cards[0] },
    row => { row.assets.candidateSha256 = '0'.repeat(64) },
    row => { row.assets.scope = ' ' },
    row => { row.content.reviewedOn = '2026-02-30' },
    row => { row.content.decision = 'PENDING' },
  ]) {
    const invalid = structuredClone(records)
    mutate(invalid)
    assert.throws(() => verifyEightSignoffs(read, bytes, invalid), /签核/)
  }
})

test('numbered receipts do not make the 2099 placeholder eligible', () => {
  const { bytes, records } = signoffFixture('2099-01-01T00:00:00Z')
  assert.throws(() => verifyEightSignoffs(read, bytes, records), /占位/)
})

test('dated trial candidate retains its exact registered fingerprint', () => {
  const name = 'ding-zh-CN-0.5.0-signoff-candidate.2026-11-22.json'
  const bytes = read('docs/plans/luosheng-eval/' + name)
  assert.deepEqual(bytes, eightCandidateBytes(read, '2026-11-21T16:00:00Z'))
  assert.equal(verifyEightCandidate(read, bytes), '1f8d3c15ab6bc7d9b694eb212205778e2d27d82f8c7017333c8521342405d1cf')
})

test('frozen eight-card snapshot has the recorded bytes and the same reviewed draft content', () => {
  const name = 'ding-zh-CN-0.5.0-review-candidate.json'
  const bytes = read('docs/plans/luosheng-eval/' + name)
  const hash = createHash('sha256').update(bytes).digest('hex')
  assert.ok(read(queue).toString('utf8').includes('| `' + name + '` | `' + hash + '` |'))
  const cards = firstReview(read).map(({ card: { evidenceLocator, canSupport, cannotInfer, reviewNotes, ...card } }) => card)
  assert.deepEqual(JSON.parse(bytes), { formatVersion: 1, releaseVersion: 4, cards })
})

test('first review is ordered, preserves the exact draft text, and never claims approval', () => {
  const result = firstReview(read)
  assert.deepEqual(result.map(({ card }) => card.id), [
    'LS-DING-SOURCE', 'LS-DING-EARS', 'LS-DING-FEET', 'LS-DING-MOTIF',
    'LS-DING-RECORD-02', 'LS-DING-MODEL-02', 'LS-DING-PERIOD', 'LS-DING-SIZE',
  ])
  for (const { card, file, locator } of result) {
    const input = JSON.parse(read(file))
    assert.deepEqual(card, input.cards?.find(row => row.id === card.id) ?? input)
    assert.equal(card.status, 'DRAFT')
    assert.ok(locator)
  }
  const command = fileURLToPath(new URL('./ding-first-review.mjs', import.meta.url))
  const run = spawnSync(process.execPath, [command], { encoding: 'utf8' })
  assert.equal(run.status, 2, run.stderr)
  assert.match(run.stdout, /待人工审阅/)
  assert.doesNotMatch(run.stdout, /approved\.sha256|publishedAt/)
})

test('first review refuses duplicate or editorial-only rows and changed frozen assets', () => {
  assert.throws(() => firstReview(modify(queue, src => src.replace('| 6 | `LS-DING-MODEL-02`', '| 6 | `LS-DING-RECORD-02`'))), /名单/)
  assert.throws(() => firstReview(modify(editorial, src => {
    const pack = JSON.parse(src)
    pack.cards.find(card => card.id === 'LS-DING-MODEL-02').editorialOnly = true
    return JSON.stringify(pack)
  })), /LS-DING-MODEL-02/)
  assert.throws(() => firstReview(path => path.endsWith('-side.webp') ? Buffer.from('changed') : read(path)), /side\.webp/)
})
