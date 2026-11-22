import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { firstReview } from './ding-first-review.mjs'

const dir = 'docs/plans/luosheng-eval/'
const snapshot = 'ding-zh-CN-0.5.0-review-candidate.json'
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export function eightCandidateBytes(read, effectiveAt) {
  const date = new Date(effectiveAt)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(effectiveAt)
      || !Number.isFinite(date.getTime()) || date.toISOString() !== effectiveAt.replace(/Z$/, '.000Z')) {
    throw new Error('须明确提供有效 UTC 生效时间')
  }
  const raw = read(dir + snapshot)
  const registration = '| `' + snapshot + '` | `' + digest(raw) + '` |'
  if (!read(dir + 'content-queue.md').toString('utf8').split(/\r?\n/).includes(registration)) {
    throw new Error('八卡冻结指纹不匹配')
  }
  const pack = JSON.parse(raw)
  const cards = firstReview(read).map(({ card: { evidenceLocator, canSupport, cannotInfer, reviewNotes, ...card } }) => card)
  if (!isDeepStrictEqual(pack, { formatVersion: 1, releaseVersion: 4, cards })) {
    throw new Error('八卡冻结内容与送审原稿不一致')
  }
  return Buffer.from(JSON.stringify({
    ...pack,
    cards: cards.map(card => ({ ...card, status: 'PUBLISHED', publishedAt: effectiveAt })),
  }, null, 2) + '\n')
}

export function verifyEightCandidate(read, bytes) {
  if (!bytes.length || bytes.length > 256 * 1024) throw new Error('候选大小无效')
  const candidate = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!bytes.equals(eightCandidateBytes(read, candidate?.cards?.[0]?.publishedAt))) {
    throw new Error('候选字节与从冻结八卡生成的预期文件不一致')
  }
  return digest(bytes)
}

export function verifyEightSignoffs(read, bytes, records) {
  const hash = verifyEightCandidate(read, bytes)
  const { cards } = JSON.parse(bytes)
  if (cards[0].publishedAt === '2099-01-01T00:00:00Z') {
    throw new Error('2099 年占位候选只供对照，不可登记签核')
  }
  const expected = new Map(cards.map(({ id, revision }) => [id, revision]))
  const nonblank = value => typeof value === 'string' && value.length > 0 && value === value.trim()
  const dateOnly = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(value + 'T00:00:00.000Z')
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }
  for (const [key, name] of [['content', '内容'], ['assets', '素材／发布']]) {
    const receipt = records?.[key]
    if (!receipt || receipt.decision !== 'APPROVED' || !nonblank(receipt.reference)
        || !nonblank(receipt.role) || !dateOnly(receipt.reviewedOn)
        || (key === 'assets' && !nonblank(receipt.scope))) {
      throw new Error(name + '签核缺少有效结论、凭据编号、角色、日期或许可范围')
    }
    if (receipt.candidateSha256 !== hash) throw new Error(name + '签核与候选 SHA-256 不一致')
    const remaining = new Map(expected)
    if (!Array.isArray(receipt.cards)) throw new Error(name + '签核缺少卡号和修订')
    for (const row of receipt.cards) {
      if (!remaining.has(row?.id) || remaining.get(row.id) !== row.revision) {
        throw new Error(name + '签核含重复、额外或修订不匹配的卡')
      }
      remaining.delete(row.id)
    }
    if (remaining.size) throw new Error(name + '签核未覆盖同批八张卡')
  }
  return hash
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const [, , candidate, flag, receiptPath] = process.argv
    if (!(process.argv.length === 3 || (process.argv.length === 5 && flag === '--signoffs'))) {
      throw new Error('用法：ding-eight-candidate.mjs <八卡候选 JSON 路径> [--signoffs <凭据登记 JSON 路径>]')
    }
    const root = new URL('../../../', import.meta.url)
    const read = path => readFileSync(new URL(path, root))
    const bytes = readFileSync(candidate)
    const hash = receiptPath
      ? verifyEightSignoffs(read, bytes, JSON.parse(readFileSync(receiptPath, 'utf8')))
      : verifyEightCandidate(read, bytes)
    console.log(receiptPath
      ? '双签登记的指纹及八卡修订一致；仍须人工核对原始凭据，不批准发布。'
      : '八卡候选内容匹配；不验证凭据，不批准发布。')
    console.log('SHA-256 ' + hash)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
