import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkBatch, checkResult, fixture } from './context-check.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const cards = read('../2026-11-19-luosheng-evidence-cards.md')

const syntheticResult = scenario => ({ ...scenario.expected, actionsExecuted: [] })

const reviewedCopy = {
  'R01-ear': ['supported', 'The other handle sits across the rim.'],
  'R01-feet': ['supported', 'The third foot is behind the body in this view.'],
  'R01-unclear': ['non-claim', 'Do you mean a handle or a foot?'],
  'R02-not-ready': ['supported', 'The side plate shows two feet; the rear plate shows all three.'],
  'U01-find-spot': ['bounded-uncertainty', 'The reference record does not establish the find spot.'],
  'F04-motif-location': ['supported', 'Look just below the rim for a raised line that turns inward.'],
  'F04-motif-follow-up': ['supported', 'Follow one of the broad lines below the rim to its turn.'],
  'U02-motif-meaning': ['supported', 'The plate shows raised lines with visible turns.'],
  'F06-plate-photo': ['supported', 'This plate is a digital render, not a photograph of the original.'],
  'U03-original-color': ['supported', 'The plate records the digitally rendered appearance.'],
  'U04-disputed-date': ['bounded-uncertainty', 'The evidence conflicts, so the date cannot be confirmed.'],
}

const boundaries = {
  'U02-motif-meaning': ' The rendered plate cannot establish what the motif symbolizes.',
  'U03-original-color': ' The rendering cannot establish the original color.',
}

const syntheticBatch = ({ reviewed = false } = {}) => ({
  fixtureVersion: fixture.version,
  evidenceVersion: fixture.evidenceVersion,
  model: 'synthetic',
  promptVersion: 'test',
  runs: fixture.cases.flatMap(scenario => [1, 2, 3].map(round => {
    const run = { caseId: scenario.id, round, result: syntheticResult(scenario) }
    if (reviewed) {
      const [verdict, claim] = reviewedCopy[scenario.id]
      const lead = 'Synthetic answer: '
      run.result.text = lead + claim
      run.review = {
        reviewer: 'synthetic-reviewer',
        segments: [
          { text: lead, verdict: 'non-claim', citationIds: [] },
          { text: claim, verdict, citationIds: [...run.result.citationIds] },
        ],
      }
      if (scenario.expected.requiresBoundedUncertainty) {
        const uncertainty = boundaries[scenario.id]
        run.result.text += uncertainty
        run.review.segments.push({ text: uncertainty, verdict: 'bounded-uncertainty', citationIds: [] })
      }
    }
    return run
  })),
})

test('batch checks all rounds, reporting failures without printing result data', () => {
  const batch = syntheticBatch()
  assert.deepEqual(checkBatch(batch), [])
  batch.evidenceVersion = 'stale'
  batch.promptVersion = ''
  batch.runs[0].result.actionsExecuted = ['secret-test-value']
  batch.runs[1].round = 1
  batch.runs[2].round = 4
  batch.runs[3].caseId = 'unknown'
  const diagnostics = checkBatch(batch).join('\n')
  for (const pattern of [/version mismatch/, /Missing promptVersion/, /must not execute/,
    /duplicate round/, /invalid round/, /unknown case/, /missing round/]) {
    assert.match(diagnostics, pattern)
  }
  assert.doesNotMatch(diagnostics, /secret-test-value/)
})

test('CLI validates JSON input and returns a nonzero status on bad batches', () => {
  const cli = fileURLToPath(new URL('./check-context-batch.mjs', import.meta.url))
  const run = input => spawnSync(process.execPath, [cli], { input, encoding: 'utf8' })
  const accepted = run(JSON.stringify(syntheticBatch()))
  assert.equal(accepted.status, 0)
  assert.match(accepted.stdout, /33 structural results passed/)
  const incomplete = run(JSON.stringify({ ...syntheticBatch(), runs: [] }))
  assert.equal(incomplete.status, 1)
  assert.match(incomplete.stderr, /missing round/)
  assert.equal(run('not-json').status, 1)
})

test('strict review checks all 33 synthetic records and requires review explicitly', () => {
  const batch = syntheticBatch({ reviewed: true })
  assert.equal(batch.runs.length, 33)
  assert.deepEqual(checkBatch(batch, { requireReview: true }), [])
  assert.deepEqual(checkBatch(syntheticBatch(), { requireReview: true }),
    batch.runs.map(({ caseId, round }) => `${caseId}/${round}: Missing answer text`))
})

for (const [name, mutate, diagnostic] of [
  ['missing segment', run => run.review.segments.shift(), /exact answer/],
  ['edited text', run => { run.review.segments[1].text += '.' }, /exact answer/],
  ['reordered segments', run => run.review.segments.reverse(), /exact answer/],
  ['out-of-turn citation', run => { run.review.segments[1].citationIds = ['LS-DING-EARS'] }, /Invalid segment citation/],
  ['uncited claim', run => { run.review.segments[1].citationIds = [] }, /requires a citation/],
  ['unsupported verdict', run => { run.review.segments[1].verdict = 'unsupported' }, /Unsupported or unresolved/],
  ['pending verdict', run => { run.review.segments[1].verdict = 'pending' }, /Unsupported or unresolved/],
  ['missing reviewer', run => { delete run.review.reviewer }, /Missing human reviewer/],
]) {
  test(`strict review rejects ${name}`, () => {
    const batch = syntheticBatch({ reviewed: true })
    mutate(batch.runs.find(run => run.caseId === 'R01-feet'))
    const errors = checkBatch(batch, { requireReview: true })
    assert.equal(errors.length, 1)
    assert.match(errors[0], /^R01-feet\/1:/)
    assert.match(errors[0], diagnostic)
  })
}

test('U01 strict review requires an uncertainty segment and accounts for the reference citation', () => {
  const batch = syntheticBatch({ reviewed: true })
  const run = batch.runs.find(run => run.caseId === 'U01-find-spot')
  const segment = run.review.segments[1]
  segment.verdict = 'supported'
  assert.deepEqual(checkBatch(batch, { requireReview: true }), ['U01-find-spot/1: Missing bounded uncertainty'])
  segment.verdict = 'bounded-uncertainty'
  segment.citationIds = []
  assert.deepEqual(checkBatch(batch, { requireReview: true }), ['U01-find-spot/1: Unreviewed response citation'])
})

test('U02 strict review requires both an observed detail and a boundary on meaning', () => {
  const batch = syntheticBatch({ reviewed: true })
  const run = batch.runs.find(run => run.caseId === 'U02-motif-meaning')
  const boundary = run.review.segments.pop()
  run.result.text = run.review.segments.map(segment => segment.text).join('')
  assert.deepEqual(checkBatch(batch, { requireReview: true }), ['U02-motif-meaning/1: Missing bounded uncertainty'])
  run.review.segments.splice(1, 1, { ...boundary, citationIds: ['LS-DING-MOTIF'] })
  run.result.text = run.review.segments.map(segment => segment.text).join('')
  assert.deepEqual(checkBatch(batch, { requireReview: true }), ['U02-motif-meaning/1: Missing supported answer claim'])
})

test('U03 strict review requires a separate boundary on original color', () => {
  const batch = syntheticBatch({ reviewed: true })
  const run = batch.runs.find(run => run.caseId === 'U03-original-color')
  run.review.segments.pop()
  run.result.text = run.review.segments.map(segment => segment.text).join('')
  assert.deepEqual(checkBatch(batch, { requireReview: true }), ['U03-original-color/1: Missing bounded uncertainty'])
})

test('U04 strict review requires acknowledgement of uncertainty', () => {
  const batch = syntheticBatch({ reviewed: true })
  const run = batch.runs.find(run => run.caseId === 'U04-disputed-date')
  run.review.segments[1].verdict = 'non-claim'
  assert.deepEqual(checkBatch(batch, { requireReview: true }), ['U04-disputed-date/1: Missing bounded uncertainty'])
})

test('strict CLI validates records without exposing answer text or reviewer', () => {
  const cli = fileURLToPath(new URL('./check-context-batch.mjs', import.meta.url))
  const run = batch => spawnSync(process.execPath, [cli, '--require-review'], {
    input: JSON.stringify(batch), encoding: 'utf8',
  })
  const batch = syntheticBatch({ reviewed: true })
  const accepted = run(batch)
  assert.equal(accepted.status, 0)
  assert.match(accepted.stdout, /No automated fact judgment was made/)
  batch.runs[0].review.segments.pop()
  const rejected = run(batch)
  assert.equal(rejected.status, 1)
  assert.match(rejected.stderr, /R01-ear\/1: Review segments do not cover the exact answer/)
  for (const result of [accepted, rejected]) {
    assert.doesNotMatch(result.stdout + result.stderr, /Synthetic answer|synthetic-reviewer/)
  }
})

test('fixtures match the draft card inventory and isolate the R01 context variable', () => {
  const knownCards = new Set([...cards.matchAll(/^## (LS-DING-[A-Z]+)[:：]/gm)].map(match => match[1]))
  assert.equal(fixture.version, 3)
  assert.equal(cards.match(/卡包 `ding-zh-CN@([^`]+)`/)?.[1], fixture.evidenceVersion)
  assert.equal(new Set(fixture.cases.map(item => item.id)).size, fixture.cases.length)
  const paired = fixture.cases.filter(item => item.id.startsWith('R01-'))
  assert.equal(paired.length, 3)
  assert.deepEqual(new Set(paired.map(item => item.input.observation)), new Set(['ear', 'feet', null]))
  assert.equal(new Set(paired.map(({ input: { observation, ...rest } }) => JSON.stringify(rest))).size, 1)
  assert.deepEqual(
    fixture.cases.filter(item => item.input.evidenceProfile).map(item => [item.id, item.input.evidenceProfile]),
    [['U04-disputed-date', 'isolated-structured-date-conflict']],
  )
  for (const scenario of fixture.cases) {
    assert(scenario.review.trim())
    for (const id of scenario.expected.citationIds) assert(knownCards.has(id), `Unknown card: ${id}`)
  }
})

for (const scenario of fixture.cases) {
  test(`${scenario.id}: accepts the synthetic reference result`, () => {
    checkResult(scenario, syntheticResult(scenario))
  })
}

const example = id => fixture.cases.find(item => item.id === id)
test('the paired follow-up isolates the observation and must answer from its own card', () => {
  const motif = example('F04-motif-follow-up')
  const feet = example('R02-not-ready')
  assert.equal(motif.input.question, feet.input.question)
  assert.equal(motif.input.viewerReady, feet.input.viewerReady)
  assert.equal(example(motif.input.previousCaseId).expected.observation, motif.input.observation)
  assert.throws(() => checkResult(motif, syntheticResult(feet)), /observation/)
})

for (const [id, overrides, diagnostic] of [
  ['R01-feet', { observation: 'ear' }, /observation/],
  ['R01-ear', { citationIds: ['LS-DING-FEET'] }, /citation IDs/],
  ['R01-unclear', { kind: 'answer' }, /kind/],
  ['R01-feet', { actionsExecuted: ['back'] }, /must not execute/],
  ['R02-not-ready', { suggestion: 'back' }, /suggestion/],
  ['U01-find-spot', { kind: 'answer' }, /kind/],
  ['F04-motif-follow-up', { citationIds: ['LS-DING-FEET'] }, /citation IDs/],
  ['F04-motif-location', { actionsExecuted: ['open-plate'] }, /must not execute/],
  ['F06-plate-photo', { citationIds: ['LS-DING-FEET'] }, /citation IDs/],
  ['U03-original-color', { suggestion: 'back' }, /suggestion/],
  ['U04-disputed-date', { kind: 'insufficient-evidence' }, /kind/],
  ['U04-disputed-date', { citationIds: ['LS-DING-SOURCE'] }, /citation IDs/],
  ['U04-disputed-date', { actionsExecuted: ['back'] }, /must not execute/],
]) {
  test(`${id}: rejects ${Object.keys(overrides).join(', ')} regression`, () => {
    const scenario = example(id)
    assert.throws(() => checkResult(scenario, { ...syntheticResult(scenario), ...overrides }), diagnostic)
  })
}
