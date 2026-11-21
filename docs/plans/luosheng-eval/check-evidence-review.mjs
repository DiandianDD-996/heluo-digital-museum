import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const root = new URL('../../../', import.meta.url)
const cardsPath = 'docs/plans/2026-11-19-luosheng-evidence-cards.md'
const plates = ['top', 'side', 'back', 'relief'].map(view => `luosheng-ding-${view}.webp`)
const cardIds = ['EARS', 'FEET', 'MOTIF', 'SOURCE'].map(name => `LS-DING-${name}`)
const model = 'frontend/public/media/models/heluo-bronze-ding-v5.5.glb'
const reviewSnapshot = 'ding-zh-CN-0.3.0-review-candidate.json'
export const reviewSnapshotPath = `docs/plans/luosheng-eval/${reviewSnapshot}`
const supplements = [
  ['LS-DING-PERIOD', 'ding-period-zh-CN-draft.json'],
  ['LS-DING-SIZE', 'ding-size-zh-CN-draft.json'],
]
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function releaseCandidate(readAsset, effectiveAt, extended) {
  const date = new Date(effectiveAt)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(effectiveAt)
      || !Number.isFinite(date.getTime()) || date.toISOString() !== effectiveAt.replace(/Z$/, '.000Z')) {
    throw new Error('生效时间须为有效的 UTC 时间，格式为 YYYY-MM-DDTHH:mm:ssZ')
  }
  const pack = JSON.parse(readAsset(reviewSnapshotPath))
  const cards = [...pack.cards]
  if (extended) {
    for (const [id, file] of supplements) {
      const card = JSON.parse(readAsset(`docs/plans/luosheng-eval/${file}`))
      if (card.id !== id) throw new Error(`${file}：卡片编号不匹配`)
      cards.push(card)
    }
  }
  const expected = extended ? [...cardIds, ...supplements.map(([id]) => id)] : cardIds
  if (pack.formatVersion !== 1 || pack.releaseVersion !== 2
      || !isDeepStrictEqual(cards.map(card => card.id), expected)
      || cards.some(card => card.status !== 'DRAFT' || 'publishedAt' in card
        || card.exhibitSlug !== 'heluo-bronze-ding-3d' || card.artifactSlug !== 'heluo-bronze-ding' || card.locale !== 'zh-CN')) {
    throw new Error('冻结快照的卡片、对象、语言或草稿状态不匹配')
  }
  return {
    ...pack, releaseVersion: extended ? 3 : pack.releaseVersion,
    cards: cards.map(card => ({ ...card, status: 'PUBLISHED', publishedAt: effectiveAt })),
  }
}

export const candidateBytes = (readAsset, effectiveAt, extended) =>
  Buffer.from(JSON.stringify(releaseCandidate(readAsset, effectiveAt, extended), null, 2) + '\n', 'utf8')

function publishedCandidateIds(candidate, expectedIds, readAsset, extended) {
  const pack = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(candidate))
  if (pack?.formatVersion !== 1 || !Number.isInteger(pack.releaseVersion)
      || pack.releaseVersion < 1 || pack.releaseVersion > 2147483647 || !Array.isArray(pack.cards)) {
    throw new Error('Invalid envelope')
  }
  const seen = new Set()
  const published = new Set()
  for (const card of pack.cards) {
    if (!expectedIds.includes(card?.id) || seen.has(card.id)) throw new Error('Invalid card id')
    seen.add(card.id)
    if (card.status === 'PUBLISHED') published.add(card.id)
  }
  if (extended && !candidate.equals(candidateBytes(readAsset, pack.cards[0]?.publishedAt, true))) {
    throw new Error('Extended candidate differs from approved review inputs')
  }
  return published
}

function reviewIssue(value, version, candidateHash) {
  const fields = value.split('／').map(part => part.trim())
  const [, date, approvedVersion, , approvedHash] = fields
  if (fields.length !== 5 || fields.some(part => !part || /待签|未签|待核|待填/.test(part))) {
    return '须填写审核人／日期／卡包版本／凭据编号／候选 JSON 的 SHA-256'
  }
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date) : null
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return '审核日期无效'
  }
  if (approvedVersion !== version) return '签核版本与当前卡包不同'
  if (!/^[0-9a-f]{64}$/.test(approvedHash)) return '签核文件指纹无效'
  if (candidateHash && approvedHash !== candidateHash) return '签核指纹与候选文件不一致'
  return null
}

export function auditEvidenceReview(markdown, readAsset, candidate, { extended = false } = {}) {
  const issues = []
  const pending = []
  const rows = markdown.split(/\r?\n/)
    .filter(line => line.startsWith('|') && line.endsWith('|'))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
  const versions = [...markdown.matchAll(extended
    ? /^扩展卡包 `ding-zh-CN@([^`]+)`/gm : /^卡包 `ding-zh-CN@([^`]+)`/gm)]
  const version = versions.length === 1 ? versions[0][1] : undefined
  if (!/^\d+\.\d+\.\d+(?:-draft)?$/.test(version ?? '')) issues.push('缺少唯一有效的卡包版本')
  else if (version.endsWith('-draft')) pending.push('卡包仍为草稿')

  function compare(path, expected) {
    if (!/^[0-9a-f]{64}$/.test(expected ?? '')) {
      issues.push(`${path}：没有唯一有效的 SHA-256`)
      return
    }
    try {
      const actual = sha256(readAsset(path))
      if (actual !== expected) issues.push(`${path}：与审稿快照不一致`)
    } catch {
      issues.push(`${path}：文件无法读取`)
    }
  }

  for (const plate of plates) {
    const records = rows.filter(row => row[0] === `\`${plate}\``)
    const hash = records.length === 1 ? records[0][1]?.match(/^`([0-9a-f]{64})`$/)?.[1] : null
    compare(`frontend/src/assets/${plate}`, hash)
  }
  const modelHashes = [...markdown.matchAll(/源 GLB SHA-256 为 `([0-9a-f]{64})`/g)]
  compare(model, modelHashes.length === 1 ? modelHashes[0][1] : null)
  const snapshotRecords = rows.filter(row => row[0] === `\`${reviewSnapshot}\``)
  const snapshotHash = snapshotRecords.length === 1 ? snapshotRecords[0][1]?.match(/^`([0-9a-f]{64})`$/)?.[1] : null
  compare(reviewSnapshotPath, snapshotHash)
  if (extended) {
    for (const [, file] of supplements) {
      const records = rows.filter(row => row[0] === `\`${file}\``)
      compare(`docs/plans/luosheng-eval/${file}`,
        records.length === 1 ? records[0][1]?.match(/^`([0-9a-f]{64})`$/)?.[1] : null)
    }
  }

  const candidateHash = candidate?.length > 0 && candidate.length <= 256 * 1024 ? sha256(candidate) : null
  if (candidate != null && !candidateHash) issues.push('候选文件为空或超过 256 KiB')
  const publishedRecords = new Set()
  const expectedIds = extended ? [...cardIds, ...supplements.map(([id]) => id)] : cardIds
  for (const id of expectedIds) {
    const records = rows.filter(row => row[0] === (extended ? `扩展 · ${id}` : id))
    if (records.length !== 1 || records[0].length !== 5) {
      issues.push(`${id}：缺少唯一的签核记录`)
      continue
    }
    const [, , editorial, media, status] = records[0]
    if (status === '草稿' || status === '待发布') {
      pending.push(`${id}：尚未同时具备内容、素材签核与发布记录`)
      continue
    }
    if (status !== '已发布') {
      issues.push(`${id}：发布状态无效`)
      continue
    }
    publishedRecords.add(id)
    if (version?.endsWith('-draft')) issues.push(`${id}：草稿卡包不能登记为已发布`)
    for (const [role, value] of [['内容', editorial], ['3D 或发布', media]]) {
      const problem = reviewIssue(value, version, candidateHash)
      if (problem) issues.push(`${id}（${role}）：${problem}`)
    }
  }
  if (publishedRecords.size && candidate == null) issues.push('有已发布登记，必须提供候选 JSON 文件')
  if (candidateHash) {
    try {
      const published = publishedCandidateIds(candidate, expectedIds, readAsset, extended)
      if (published.size !== publishedRecords.size || [...published].some(id => !publishedRecords.has(id))) {
        issues.push('候选文件里的已发布卡片与签核表不一致')
      }
    } catch {
      issues.push('候选文件无法解析，或卡包版本、卡片与冻结快照不符')
    }
  }
  return { version, issues, pending }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const snapshots = new Map()
  const read = path => {
    if (!snapshots.has(path)) snapshots.set(path, readFileSync(new URL(path, root)))
    return snapshots.get(path)
  }
  try {
    const flags = process.argv.slice(2)
    const extended = flags[0] === '--extended'
    const [candidatePath, ...unexpected] = flags.slice(Number(extended))
    if (unexpected.length) throw new Error('Unexpected arguments')
    const candidate = candidatePath == null ? undefined : readFileSync(candidatePath)
    const { version, issues, pending } = auditEvidenceReview(read(cardsPath).toString('utf8'), read, candidate, { extended })
    console.log(`卡包：${version ?? '未知'}；送审预检：${issues.length ? '失败' : pending.length ? '待签或待发布' : '记录齐备'}`)
    for (const message of [...issues, ...pending]) console.log(message)
    if (issues.length) process.exitCode = 1
    else if (pending.length) process.exitCode = 2
    else console.log('登记格式及文件指纹匹配；仍需核对原始凭据和后端卡包格式。')
  } catch {
    console.error('用法：check-evidence-review.mjs [--extended] [候选 JSON 路径]；请检查参数和文件是否可读。')
    process.exitCode = 1
  }
}
