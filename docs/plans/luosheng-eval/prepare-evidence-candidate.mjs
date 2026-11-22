import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { auditEvidenceReview, candidateBytes } from './check-evidence-review.mjs'
import { eightCandidateBytes } from './ding-eight-candidate.mjs'

const flags = process.argv.slice(2)
const extended = flags[0] === '--extended'
const eight = flags[0] === '--eight'
const [effectiveAt, destination, ...extra] = flags.slice(Number(extended || eight))

try {
  if (!effectiveAt || !destination || extra.length) {
    throw new Error('用法：prepare-evidence-candidate.mjs [--extended 或 --eight] <候选 UTC 生效时间> <候选文件路径>')
  }

  const root = new URL('../../../', import.meta.url)
  const snapshots = new Map()
  const read = path => {
    if (!snapshots.has(path)) snapshots.set(path, readFileSync(new URL(path, root)))
    return snapshots.get(path)
  }
  const register = read('docs/plans/2026-11-19-luosheng-evidence-cards.md').toString('utf8')
  if (!eight) {
    const { issues } = auditEvidenceReview(register, read, undefined, { extended })
    if (issues.length) throw new Error(issues.join('\n'))
  }

  const bytes = eight ? eightCandidateBytes(read, effectiveAt) : candidateBytes(read, effectiveAt, extended)
  writeFileSync(destination, bytes, { flag: 'wx' })
  console.log(`候选文件已生成\nSHA-256 ${createHash('sha256').update(bytes).digest('hex')}`)
} catch (error) {
  console.error(error.code === 'EEXIST' ? '目标文件已存在，请使用新文件名' : error.message)
  process.exitCode = 1
}
