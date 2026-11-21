import { apiGet, type ContentPage } from './api'
import type { SearchResult } from './content'
import type { GuideStop } from './luoshengPreview'

const rejected = /^(?:然后|之后|再)?(?:我\s*)?(?:今天|明天|后天)?(?:先)?(?:不(?:想|要|用|需要|打算)?|别)(?:先|再)?(?:看|找|预约|订票)/
const rejectedArtifact = /^(?:我\s*)?(?:先)?(?:不(?:想|要|用|需要|打算)?|别)(?:先|再)?(?:看|找)\s*(.+)/
const dingExcluded = /^(?:(?:这件|那个|那件|河洛|青铜)*鼎(?:了|吧|啦)?|鼎耳)$/
const pointNames = {
  ear: /^(?:鼎耳|耳朵|耳)$/,
  feet: /^(?:三足|鼎足|足|脚|三只脚)$/,
  motif: /^(?:纹样|花纹)$/,
} satisfies Record<GuideStop, RegExp>

/** A saved position supplies context only when the visitor actually requests it. */
export function requestsSavedLookpoint(question: string, stop: GuideStop) {
  const text = question.normalize('NFKC').replace(/[\s。！？!?，,]+$/g, '').trim()
    .replace(/^(?:请|麻烦你)?(?:带我|帮我|我想|我要)?\s*/, '').replace(/(?:吧|好吗|行吗)$/, '')
  const instruction = /^(?:回到|回去(?:看)?|返回|接着看|继续看)/.exec(text)
  if (!instruction && !/^刚才/.test(text)) return false
  const target = text.slice(instruction?.[0].length ?? 0)
  if (/^(?:刚才|原来)(?:的)?(?:位置|看点|细节|图版|那一处|那处)?$/.test(target)) return true
  if (/^(?:河洛)?青铜鼎$/.test(target)) return !!instruction
  const point = target.replace(/^(?:刚才|原来)?(?:的)?(?:那一?[只处个]|那个)?(?:的)?/, '')
    .replace(/^(?:河洛)?青铜鼎(?:的)?/, '')
  return pointNames[stop].test(point) || (!!instruction && !target && /^(?:回去|返回)$/.test(text))
}

export function discoveryIntent(question: string, onArtifact: boolean) {
  const text = question.normalize('NFKC').trim()
  const clauses = text.split(/[，。！？,.!?；;]+|但(?:是)?(?=(?:我|只|想|要|帮|带))|(?=只(?:想)?看)/).map(part => part.trim()).filter(Boolean)
  const exclusions = clauses.flatMap(part => {
    const match = rejectedArtifact.exec(part)
    if (!match) return []
    const term = match[1]!.replace(/(?:了|吧|啦)$/, '').trim()
    return term ? [term] : []
  })
  const positive = clauses.filter(part => !rejected.test(part)).join('，')
  if (/3\s*d|三维|数字展厅/i.test(positive) && /在哪|哪里|怎么进/.test(positive)) return { kind: 'navigation' } as const
  if (/预约|订票|到馆|名额|门票|开放时间|时段/.test(positive)) return { kind: 'appointment' } as const
  const explicit = positive.match(/(?:想(?:找|看(?:看)?)|(?:只|要|先|接着|继续|改)看|(?:带|帮)我看|找(?:一件|找)?)([^，。！？,.!?]+)/)
  const term = explicit?.[1]?.replace(/^(?:个|一件|和)|(?:相关|有关)(?:的东西|的藏品)?$|(?:吧|呢|吗|呀)$/g, '').trim()
  const searchingFromArtifact = exclusions.length > 0 || /想找|找(?:找|一件|别的)|只想看|改看|(?:帮|带)我找/.test(positive)
  if (term && /玉器|玉璧|水鸟|青铜|鼎/.test(term) && (!onArtifact || searchingFromArtifact)) {
    const keyword = term.match(/玉器|玉璧|水鸟|青铜鼎|鼎/)?.[0] ?? term
    return { kind: 'search', keyword: keyword === '鼎' ? '青铜鼎' : keyword, short: false, exclusions } as const
  }
  if (term && (!onArtifact || searchingFromArtifact) && !/3\s*d|三维|展厅|模型/i.test(term)
      && !/^(?:什么|一件|一个)?(?:好看的|有意思的|有趣的)?$/.test(term)) {
    return { kind: 'search', keyword: term.slice(0, 40), short: false, exclusions } as const
  }
  if (exclusions.length || !positive) return { kind: 'clarify-discovery' } as const
  if (onArtifact) return { kind: 'object' } as const
  if (/五分钟|5\s*分钟|看一件|青铜鼎|鼎耳|别错过(?:这件|那个)?鼎/.test(positive)) {
    return { kind: 'search', keyword: '青铜鼎', short: /分钟|看一件/.test(positive), exclusions } as const
  }
  return { kind: 'navigation' } as const
}

export async function findGuideArtifacts(keyword: string, signal: AbortSignal, exclusions: readonly string[] = []) {
  const find = async (word: string) => {
    const result = await apiGet<ContentPage<SearchResult>>(
      `/search?keyword=${encodeURIComponent(word)}&type=artifact&page=1&size=8`,
      undefined,
      { signal },
    )
    return result.items.filter(item => item.type === 'artifact' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
      && !exclusions.some(term => (dingExcluded.test(term) && item.slug === 'heluo-bronze-ding') || item.title.includes(term)))
  }
  const items = await find(keyword)
  if (!items.length && keyword === '玉器') return { items: await find('玉璧'), keyword: '玉璧' }
  return { items, keyword }
}

export function guideArtifactReason(item: SearchResult, requested: string, matched: string) {
  const alias = requested !== matched ? `按馆内检索别名，把「${requested}」换成「${matched}」。` : ''
  const fields = [
    [item.title, '公开标题'],
    [item.summary, '公开摘要'],
    [item.titleEn, '英文标题'],
    [item.summaryEn, '英文摘要'],
  ] as const
  const term = matched.normalize('NFKC').toLowerCase()
  const field = fields.find(([value]) => value?.normalize('NFKC').toLowerCase().includes(term))
  return alias + (field ? `这件展品的${field[1]}提到了「${matched}」。` : `这是馆藏检索「${matched}」返回的公开条目。`)
}

export function guideArtifactCover(url: string) {
  // Only reuse public images hosted by the museum; never initiate a third-party request.
  return /^\/media\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|avif|png|jpe?g)$/i.test(url) ? url : undefined
}
