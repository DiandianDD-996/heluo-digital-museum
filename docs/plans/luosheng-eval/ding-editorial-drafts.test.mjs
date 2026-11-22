import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const json = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'))
const pack = json('ding-zh-CN-0.5.0-drafts.json')
const baseline = [
  ...json('ding-zh-CN-0.3.0-review-candidate.json').cards,
  json('ding-period-zh-CN-draft.json'),
  json('ding-size-zh-CN-draft.json'),
]
const nonBlank = value => typeof value === 'string' && !!value.trim()
const notes = value => Array.isArray(value) && value.length > 0 && value.every(nonBlank)
const normalize = value => value.normalize('NFKC').trim().toLowerCase()

test('鼎的编辑草稿具备可审阅定位、适用范围和排除项，不能当发布包', () => {
  assert.equal(pack.status, 'REVIEW_BUNDLE')
  assert.equal(pack.formatVersion, 1)
  assert.ok(pack.cards.length > 0)
  const ids = new Set(baseline.map(card => card.id))
  for (const card of pack.cards) {
    assert.match(card.id, /^LS-DING-[A-Z0-9-]+$/)
    assert.ok(!ids.has(card.id), card.id)
    ids.add(card.id)
    assert.ok(Number.isInteger(card.revision) && card.revision > 0, card.id)
    assert.equal(card.exhibitSlug, 'heluo-bronze-ding-3d', card.id)
    assert.equal(card.artifactSlug, 'heluo-bronze-ding', card.id)
    assert.equal(card.locale, 'zh-CN', card.id)
    assert.equal(card.status, 'DRAFT', card.id)
    assert.ok(!Object.hasOwn(card, 'publishedAt'), card.id)
    for (const field of ['text', 'evidenceLocator', 'reviewNotes']) assert.ok(nonBlank(card[field]), `${card.id}: ${field}`)
    for (const field of ['aliases', 'canSupport', 'cannotInfer']) assert.ok(notes(card[field]), `${card.id}: ${field}`)
    if (card.publicSource === null) assert.match(card.evidenceLocator, /^本馆观察：/)
    else {
      const source = new URL(card.publicSource)
      assert.equal(source.protocol, 'https:', card.id)
      assert.ok(source.host && !source.username && !source.password, card.id)
    }
  }
})

test('鼎的编辑草稿与旧六卡没有冲突的结构化主张', () => {
  const claims = new Map()
  for (const { artifactSlug, id, claim } of [...baseline, ...pack.cards]) {
    if (claim == null) continue
    assert.ok(nonBlank(claim.key) && nonBlank(claim.value), id)
    const scope = JSON.stringify([artifactSlug, normalize(claim.key)])
    const value = normalize(claim.value)
    if (claims.has(scope)) assert.equal(value, claims.get(scope), id)
    claims.set(scope, value)
  }
})

test('背景解读只计入编辑草稿，不进入送签队列、词表或既有候选', () => {
  const background = pack.cards.find(card => card.id === 'LS-DING-CONTEXT-01')
  assert.equal(background?.editorialOnly, true)
  assert.ok(!Object.hasOwn(background, 'claim'))
  const queue = readFileSync(new URL('content-queue.md', import.meta.url), 'utf8')
    .split('## 2. 送签前')[0]
  const lexicon = readFileSync(new URL('../../../frontend/src/assets/guide/lexicon.zh-CN.json', import.meta.url), 'utf8')
  const candidate = json('ding-zh-CN-0.3.0-release-candidate.json')
  for (const card of pack.cards.filter(card => card.editorialOnly === true)) {
    assert.ok(!queue.includes(card.id) && !lexicon.includes(card.id), card.id)
    assert.ok(card.aliases.every(alias => !lexicon.includes(alias)), card.id)
    assert.ok(![...baseline, ...candidate.cards].some(row => row.id === card.id), card.id)
  }
})
