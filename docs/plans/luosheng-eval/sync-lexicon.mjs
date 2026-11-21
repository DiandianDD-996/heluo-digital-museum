#!/usr/bin/env node
/**
 * 校验前端词表与证据卡是否一致。
 *
 * 用法：node docs/plans/luosheng-eval/sync-lexicon.mjs [--check] [--pack <证据包>]
 *
 * 规则：
 * 1. 每个看点引用的卡片必须存在，修订号必须一致；
 * 2. 标签必须是卡片 aliases 中的一项，或在 reviewedAdditions 中写明理由；
 * 3. reviewedAdditions 的键必须是对应看点真实存在的标签；
 * 4. 建议问题的 supports 必须指向同展品已存在的卡片；
 * 5. 卡片中未被词表使用的别名只提示，不判失败。
 *
 * 退出码：0 一致；1 不一致或输入无效。
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const root = new URL('../../../', import.meta.url)
const lexiconPath = 'frontend/src/assets/guide/lexicon.zh-CN.json'
const defaultPack = 'docs/plans/luosheng-eval/ding-zh-CN-0.3.0-review-candidate.json'

const flags = process.argv.slice(2)
const checkOnly = flags.includes('--check')
const packIndex = flags.indexOf('--pack')
const packPath = packIndex >= 0 ? flags[packIndex + 1] : defaultPack
const unknownFlags = flags.filter((flag, index) =>
  flag !== '--check' && flag !== '--pack' && flags[index - 1] !== '--pack')

function read(path) {
  const absolute = /^(?:[A-Za-z]:[\\/]|\/)/.test(path)
  const target = absolute || path.startsWith('file:') ? pathToFileURL(path.replace(/^file:\/\//, '')) : new URL(path, root)
  return JSON.parse(readFileSync(target, 'utf8'))
}

const issues = []
const notices = []

try {
  if (unknownFlags.length) throw new Error(`未知参数：${unknownFlags.join(' ')}`)
  if (checkOnly && flags.length && !packPath) throw new Error('--pack 需要一个路径')
  const lexicon = read(lexiconPath)
  const pack = read(packPath)
  if (lexicon.version !== 1) throw new Error(`词表 version 须为 1，实际 ${lexicon.version}`)
  if (!Array.isArray(pack.cards)) throw new Error('证据包缺少 cards 数组')

  const bySlug = new Map()
  for (const card of pack.cards) {
    if (!bySlug.has(card.artifactSlug)) bySlug.set(card.artifactSlug, new Map())
    bySlug.get(card.artifactSlug).set(card.id, card)
  }

  const usedAliases = new Map()
  const statuses = new Set()

  for (const [exhibitSlug, exhibit] of Object.entries(lexicon.exhibits ?? {})) {
    const cards = bySlug.get(exhibit.artifactSlug)
    if (!cards) {
      issues.push(`${exhibitSlug}: 证据包中没有藏品 ${exhibit.artifactSlug}`)
      continue
    }
    const points = Array.isArray(exhibit.points) ? exhibit.points : []
    for (const point of points) {
      const card = cards.get(point.cardId)
      if (!card) {
        issues.push(`${exhibitSlug}/${point.stop}: 找不到卡片 ${point.cardId}`)
        continue
      }
      statuses.add(card.status)
      if (card.revision !== point.revision) {
        issues.push(`${exhibitSlug}/${point.stop}: 修订号不一致，词表 ${point.revision}，卡片 ${card.revision}`)
      }
      const aliases = new Set(Array.isArray(card.aliases) ? card.aliases : [])
      const reviewed = point.reviewedAdditions ?? {}
      for (const label of point.labels ?? []) {
        if (aliases.has(label)) {
          usedAliases.set(`${point.cardId}\u0000${label}`, true)
          continue
        }
        if (typeof reviewed[label] === 'string' && reviewed[label].trim()) continue
        issues.push(`${exhibitSlug}/${point.stop}: 标签「${label}」既不在卡片别名中，也没有审阅说明`)
      }
      for (const label of Object.keys(reviewed)) {
        if (!(point.labels ?? []).includes(label)) {
          issues.push(`${exhibitSlug}/${point.stop}: 审阅说明「${label}」不是该看点的标签`)
        }
      }
    }

    const validStops = new Set(points.map(point => point.stop))
    for (const [stop, questions] of Object.entries(exhibit.suggestedQuestions ?? {})) {
      if (stop !== 'global' && !validStops.has(stop)) {
        issues.push(`${exhibitSlug}: 建议问题分组「${stop}」没有对应看点`)
      }
      for (const question of questions ?? []) {
        if (typeof question.q !== 'string' || !question.q.trim()) {
          issues.push(`${exhibitSlug}/${stop}: 建议问题缺少文本`)
        }
        if (question.q && [...question.q].length > 14) {
          notices.push(`${exhibitSlug}/${stop}: 「${question.q}」超过 14 字，界面上可能折行`)
        }
        for (const id of question.supports ?? []) {
          if (!cards.has(id)) issues.push(`${exhibitSlug}/${stop}: 建议问题「${question.q}」引用了不存在的卡片 ${id}`)
        }
      }
    }

    for (const point of points) {
      if (!(point.labels ?? []).length) issues.push(`${exhibitSlug}/${point.stop}: 没有标签`)
    }
  }

  for (const card of pack.cards) {
    for (const alias of card.aliases ?? []) {
      if (!usedAliases.has(`${card.id}\u0000${alias}`)) {
        notices.push(`卡片 ${card.id}: 别名「${alias}」未进入词表`)
      }
    }
  }

  if (statuses.size) {
    const label = [...statuses].join('/')
    notices.push(`证据包卡片状态：${label}${statuses.has('PUBLISHED') ? '' : '（尚未签核，词表校验不代表可发布）'}`)
  }
} catch (error) {
  console.error(`词表校验无法执行：${error.message}`)
  process.exitCode = 1
  process.exit()
}

for (const notice of notices) console.log(`提示：${notice}`)

if (issues.length) {
  console.error(`\n词表与证据包不一致（${issues.length} 项）：`)
  for (const issue of issues) console.error(`- ${issue}`)
  process.exitCode = 1
} else {
  console.log(`\n词表与证据包一致。`)
}
