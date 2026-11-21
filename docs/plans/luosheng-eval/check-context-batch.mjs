import { readFileSync } from 'node:fs'
import { checkBatch } from './context-check.mjs'

let batch
const flags = process.argv.slice(2)
const requireReview = flags[0] === '--require-review'
if (flags.length > Number(requireReview)) {
  console.error('Usage: check-context-batch.mjs [--require-review]')
  process.exit(1)
}
try {
  batch = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''))
} catch {
  console.error('Expected one JSON batch on standard input.')
  process.exitCode = 1
}

if (!process.exitCode) {
  const errors = checkBatch(batch, { requireReview })
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else if (requireReview) {
    console.log(`${batch.runs.length} structural results and manual review records passed validation. No automated fact judgment was made.`)
  } else {
    console.log(`${batch.runs.length} structural results passed. Manual review is still required.`)
  }
}
