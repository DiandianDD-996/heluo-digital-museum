import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { auditEvidenceReview, reviewSnapshotPath } from './check-evidence-review.mjs'

const root = new URL('../../../', import.meta.url)
const dir = 'docs/plans/luosheng-eval/'
const evidencePath = 'docs/plans/2026-11-19-luosheng-evidence-cards.md'
const oldLocators = {
  EARS: '俯视图口沿左右两侧；v5.5 资产记录「处理范围」',
  FEET: '侧视、背视图下半部对照；v5.5 资产记录「处理范围」',
  MOTIF: '正面局部图的口沿下方与器腹凸线；不作寓意判断',
  SOURCE: '证据卡文档「出处卡核对记录」；馆藏 API 138016 的 accession_number、title、find_spot',
  PERIOD: '扩展六卡内容核对记录；馆藏 API 138016 的文化分期和年代，不作出土地判断',
  SIZE: '扩展六卡内容核对记录；馆藏 API 138016 的整体尺寸字段，不给两个数标定方向',
}
const editorialIds = ['LS-DING-RECORD-02', 'LS-DING-MODEL-02']
const expectedIds = new Set([...Object.keys(oldLocators).map(key => 'LS-DING-' + key), ...editorialIds])
const nonBlank = value => typeof value === 'string' && value.trim().length > 0

export function firstReview(read) {
  const evidence = read(evidencePath).toString('utf8')
  const { issues } = auditEvidenceReview(evidence, read, undefined, { extended: true })
  if (issues.length) throw new Error(issues.join('\n'))
  const queue = read(dir + 'content-queue.md').toString('utf8')
    .split(/^## 1\. .*$/m)[1]?.split(/^## 2\. .*$/m)[0] ?? ''
  const ordered = [...queue.matchAll(/^\|\s*(\d+)\s*\|\s+\x60(LS-DING-[A-Z0-9-]+)\x60\s*\|/gm)]
  const ids = ordered.map(row => row[2])
  if (ids.length !== expectedIds.size || new Set(ids).size !== expectedIds.size
      || ordered.some((row, index) => Number(row[1]) !== index + 1 || !expectedIds.has(row[2]))) {
    throw new Error('首批名单须按顺序保留六张既有草稿及两张指定新稿，不可重复')
  }
  const inputs = new Map()
  function add(card, file) {
    if (!expectedIds.has(card?.id)) return
    if (inputs.has(card.id)) throw new Error(card.id + '：草稿重复')
    inputs.set(card.id, { card, file })
  }
  const json = path => JSON.parse(read(path))
  json(reviewSnapshotPath).cards.forEach(card => add(card, reviewSnapshotPath))
  for (const name of ['period', 'size']) {
    const file = dir + 'ding-' + name + '-zh-CN-draft.json'
    add(json(file), file)
  }
  const editorial = dir + 'ding-zh-CN-0.5.0-drafts.json'
  json(editorial).cards.forEach(card => add(card, editorial))
  return ids.map(id => {
    const { card, file } = inputs.get(id) ?? {}
    const isEditorial = editorialIds.includes(id)
    const locator = isEditorial ? card?.evidenceLocator : oldLocators[id.slice(8)]
    if (!card || card.status !== 'DRAFT' || Object.hasOwn(card, 'publishedAt') || card.editorialOnly === true
        || !Number.isInteger(card.revision) || card.revision < 1 || !nonBlank(card.text) || !nonBlank(locator)
        || card.exhibitSlug !== 'heluo-bronze-ding-3d' || card.artifactSlug !== 'heluo-bronze-ding'
        || card.locale !== 'zh-CN' || isEditorial !== (file === editorial)) {
      throw new Error(id + '：缺少有效的待审草稿或来源定位')
    }
    return { card, file, locator }
  })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new Error('此工具不接收发布参数')
    const rows = firstReview(path => readFileSync(new URL(path, root)))
    console.log('# 洛笙首批八张 · 待人工审阅（未送签、不可发布）')
    console.log('\n旧六卡与图版按既有指纹检查；新两卡只读取当前编辑草稿，不是冻结或签核凭据。')
    for (const { card, file, locator } of rows) {
      console.log('\n## ' + card.id + ' · 修订 ' + card.revision)
      console.log('\n' + card.text)
      console.log('\n- 原稿：' + file)
      console.log('- 定位：' + locator)
      if (card.publicSource) console.log('- 公开来源：' + card.publicSource)
      if (card.reviewNotes) console.log('- 复核提示：' + card.reviewNotes)
      console.log('- 内容审阅：待签；素材／发布审阅：待签')
    }
    process.exitCode = 2
  } catch (error) {
    console.error('送审材料预检失败：' + error.message)
    process.exitCode = 1
  }
}
