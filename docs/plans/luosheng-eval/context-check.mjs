import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

export const fixture = JSON.parse(readFileSync(new URL('./context-cases.json', import.meta.url), 'utf8'))

export function checkResult(scenario, result) {
  assert(result && typeof result === 'object', 'Missing result')
  assert(Array.isArray(result.actionsExecuted) && result.actionsExecuted.length === 0, 'A reply must not execute any action')
  for (const field of ['kind', 'observation', 'suggestion']) {
    assert(result[field] === scenario.expected[field], `Unexpected ${field}`)
  }
  assert(Array.isArray(result.citationIds), 'Expected a citation ID array')
  assert(
    result.citationIds.length === scenario.expected.citationIds.length
      && new Set(result.citationIds).size === result.citationIds.length
      && result.citationIds.every(id => scenario.expected.citationIds.includes(id)),
    'Unexpected citation IDs',
  )
}

export function checkReview(scenario, run) {
  const text = run.result.text
  const review = run.review
  assert(typeof text === 'string' && text.trim(), 'Missing answer text')
  assert(typeof review?.reviewer === 'string' && review.reviewer.trim(), 'Missing human reviewer')
  assert(Array.isArray(review.segments) && review.segments.length > 0, 'Missing review segments')
  const used = new Set()
  const verdicts = new Set()
  let reconstructed = ''
  for (const segment of review.segments) {
    assert(typeof segment?.text === 'string' && segment.text.length > 0, 'Empty review segment')
    assert(['supported', 'bounded-uncertainty', 'non-claim'].includes(segment.verdict),
      'Unsupported or unresolved review segment')
    assert(Array.isArray(segment.citationIds), 'Missing segment citations')
    const ids = new Set(segment.citationIds)
    assert(ids.size === segment.citationIds.length && [...ids].every(id => run.result.citationIds.includes(id)),
      'Invalid segment citation')
    if (segment.verdict === 'supported') assert(ids.size > 0, 'Supported claim requires a citation')
    if (segment.verdict === 'non-claim') assert(ids.size === 0, 'Non-claim must not carry citations')
    if (segment.verdict !== 'non-claim') assert(segment.text.trim(), 'Claim must not be whitespace')
    for (const id of ids) used.add(id)
    verdicts.add(segment.verdict)
    reconstructed += segment.text
  }
  assert(reconstructed === text, 'Review segments do not cover the exact answer')
  assert(run.result.citationIds.every(id => used.has(id)), 'Unreviewed response citation')
  if (['answer', 'plate-provenance'].includes(scenario.expected.kind)) {
    assert(verdicts.has('supported'), 'Missing supported answer claim')
  }
  if (['insufficient-evidence', 'disputed-evidence'].includes(scenario.expected.kind)
      || scenario.expected.requiresBoundedUncertainty) {
    assert(verdicts.has('bounded-uncertainty'), 'Missing bounded uncertainty')
  }
}

export function checkBatch(batch, { requireReview = false } = {}) {
  const errors = []
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) return ['Expected a batch object']
  if (batch.fixtureVersion !== fixture.version) errors.push('Fixture version mismatch')
  if (batch.evidenceVersion !== fixture.evidenceVersion) errors.push('Evidence version mismatch')
  for (const key of ['model', 'promptVersion']) {
    if (typeof batch[key] !== 'string' || !batch[key].trim()) errors.push(`Missing ${key}`)
  }
  if (!Array.isArray(batch.runs)) return [...errors, 'Expected a runs array']

  const cases = new Map(fixture.cases.map(scenario => [scenario.id, scenario]))
  const seen = new Map(fixture.cases.map(scenario => [scenario.id, new Set()]))
  for (const [index, run] of batch.runs.entries()) {
    const scenario = cases.get(run?.caseId)
    const label = `Record ${index + 1}`
    if (!scenario) {
      errors.push(`${label}: unknown case`)
      continue
    }
    const rounds = seen.get(scenario.id)
    if (![1, 2, 3].includes(run.round)) {
      errors.push(`${label}: invalid round`)
      continue
    }
    if (rounds.has(run.round)) errors.push(`${scenario.id}/${run.round}: duplicate round`)
    rounds.add(run.round)
    try {
      checkResult(scenario, run.result)
      if (requireReview) checkReview(scenario, run)
    } catch (error) {
      errors.push(`${scenario.id}/${run.round}: ${error.message}`)
    }
  }
  for (const [id, rounds] of seen) {
    for (const round of [1, 2, 3]) {
      if (!rounds.has(round)) errors.push(`${id}/${round}: missing round`)
    }
  }
  return errors
}
