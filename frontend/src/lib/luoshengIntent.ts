import type { GuideStop } from './luoshengPreview'
import type { SiteStop } from './luoshengSiteGuide'
import { isPublicSlotDate, shanghaiDay } from './publicSlotDate'
import {
  aliasFor, discoveryTermPattern, lexicon, peopleValue, pointLabelPattern, pointPattern,
  relativeDatePattern, siteStopsMatching, vocabularyPattern,
} from './luoshengLexicon'

/** Date words come from the lexicon so the parser and the data cannot drift. */
const DATE_WORDS = Object.keys(lexicon.relativeDates)
  .sort((left, right) => right.length - left.length)
  .join('|')

const numeral = '[+-]?\\d+(?:[.点]\\d+)?|负?[零〇一二两三四五六七八九十百千万点]+'
const partyPattern = new RegExp(
  `(${numeral})(?:\\s*(?:至|到|或|[-~—–])\\s*(${numeral}))?\\s*(?:个|名)?\\s*(?:成人|儿童|大人|孩子|人|位|张票)`,
  'g',
)

function requestedParty(text: string, defaultPeople: number) {
  const matches = [...text.matchAll(partyPattern)]
  if (!matches.length) return defaultPeople
  // Keep ambiguous or unsupported counts invalid rather than querying with a smaller group.
  if (matches.length !== 1 || matches[0]?.[2]) return 0
  const count = matches[0]![1]!
  if (/^\+?\d+$/.test(count)) return Number(count)
  const word = peopleValue(count)
  if (word !== undefined) return word
  const tens = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(count)
  return tens ? (peopleValue(tens[1] ?? '一') ?? 0) * 10 + (peopleValue(tens[2] ?? '') ?? 0) : 0
}

type SlotIntent = { date: string; people: number } | { clarifyDate: true; people: number }

const calendarDate = /(?<!\d)(?:(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})(?!\d)(?:\s*[日号])?|(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)|(\d{1,2})\s*月\s*(\d{1,2})\s*[日号])/g
const dateOnly = new RegExp(`^(?:那就|那)?\\s*(?:${calendarDate.source}|${DATE_WORDS})\\s*(?:吧|呢)?[。!！?？]*$`)

function parseSlots(question: string, now = new Date(), previousPeople?: number): SlotIntent | null {
  const text = question.normalize('NFKC').trim()
  if (/(?:不(?:想|要|用|需要|打算)?|别)(?:先|再)?(?:预约|订票)/.test(text)) return null
  if (!/预约|去馆|参观|到馆|名额|余量|时段|门票|(?:有|查|订)票/.test(text)
      && !(previousPeople !== undefined && dateOnly.test(text))) return null
  const people = requestedParty(text, previousPeople ?? 1)
  const today = shanghaiDay(0, now)
  const year = Number(today.slice(0, 4))
  const dates = new Set<string>()
  const calendarMatches = [...text.matchAll(calendarDate)]
  for (const [, chineseYear, chineseMonth, chineseDay, isoYear, isoMonth, isoDay, monthOnly, dayOnly] of calendarMatches) {
    const month = (chineseMonth ?? isoMonth ?? monthOnly)!.padStart(2, '0')
    const day = (chineseDay ?? isoDay ?? dayOnly)!.padStart(2, '0')
    const nextYear = `${year + 1}-${month}-${day}`
    const resolvedYear = chineseYear ?? isoYear ?? (isPublicSlotDate(nextYear, now) ? year + 1 : year)
    dates.add(`${resolvedYear}-${month}-${day}`)
  }
  for (const [relative] of text.matchAll(relativeDatePattern())) {
    dates.add(shanghaiDay(lexicon.relativeDates[relative] ?? 0, now))
  }
  if (dates.size > 1 || /今明两?天|明后两?天|(?:到|至|或|[-–—~])\s*\d{1,2}\s*[日号]/.test(text.replace(calendarDate, ' '))) {
    return { clarifyDate: true, people }
  }
  const [date] = dates
  if (!date) return /名额|余量|可约时段|还有.*票|有没有.*票/.test(text) ? { clarifyDate: true, people } : null
  return { date, people }
}

function parseDeferred(question: string, now?: Date) {
  const parts = /^(先.+?)\s*[，,；;]?\s*(?:然后|之后再|再)\s*(.+)$/.exec(question.normalize('NFKC').trim())
  if (!parts) return null
  const slot = parseSlots(parts[2]!, now, 1) ?? (/^查/.test(parts[2]!) ? parseSlots(parts[2]!.replace(/^查/, ''), now, 1) : null)
  return slot ? { first: parts[1]!, slot } : null
}

const rejected = new RegExp(
  `^(?:然后|之后|再)?(?:我\\s*)?(?:${DATE_WORDS})?(?:先)?(?:不(?:想|要|用|需要|打算)?|别)(?:先|再)?(?:看|找|预约|订票)`,
)
const rejectedArtifact = /^(?:我\s*)?(?:先)?(?:不(?:想|要|用|需要|打算)?|别)(?:先|再)?(?:看|找)\s*(.+)/

/** A saved position supplies context only when the visitor actually requests it. */
function matchesSavedLookpoint(question: string, stop: GuideStop) {
  const text = question.normalize('NFKC').replace(/[\s。！？!?，,]+$/g, '').trim()
    .replace(/^(?:请|麻烦你)?(?:带我|帮我|我想|我要)?\s*/, '').replace(/(?:吧|好吗|行吗)$/, '')
  const instruction = /^(?:回到|回去(?:看)?|返回|接着看|继续看)/.exec(text)
  if (!instruction && !/^刚才/.test(text)) return false
  const target = text.slice(instruction?.[0].length ?? 0)
  if (/^(?:刚才|原来)(?:的)?(?:位置|看点|细节|图版|那一处|那处)?$/.test(target)) return true
  if (/^(?:河洛)?青铜鼎$/.test(target)) return !!instruction
  const point = target.replace(/^(?:刚才|原来)?(?:的)?(?:那一?[只处个]|那个)?(?:的)?/, '')
    .replace(/^(?:河洛)?青铜鼎(?:的)?/, '')
  return pointPattern(stop).test(point) || (!!instruction && !target && /^(?:回去|返回)$/.test(text))
}

function parseDiscovery(question: string, onArtifact: boolean) {
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
  const vocabulary = vocabularyPattern()
  const searchingFromArtifact = exclusions.length > 0
    || new RegExp(`(?:接着|继续)看(?:${discoveryTermPattern().source})`).test(positive)
    || /想找|找(?:找|一件|别的)|只想看|改看|(?:帮|带)我找/.test(positive)
  if (term && vocabulary.test(term) && (!onArtifact || searchingFromArtifact)) {
    return { kind: 'search', keyword: aliasFor(term.match(vocabulary)?.[0] ?? term), short: false, exclusions } as const
  }
  if (term && (!onArtifact || searchingFromArtifact) && !/3\s*d|三维|展厅|模型/i.test(term)
      && !/^(?:什么|一件|一个)?(?:好看的|有意思的|有趣的)?$/.test(term)) {
    return { kind: 'search', keyword: term.slice(0, 40), short: false, exclusions } as const
  }
  if (exclusions.length || !positive) return { kind: 'clarify-discovery' } as const
  const shortVisit = new RegExp(`五分钟|5\\s*分钟|看一件|别错过(?:这件|那个)?(?:${vocabulary.source})`)
  if (!onArtifact && shortVisit.test(positive)) {
    return { kind: 'search', keyword: '青铜鼎', short: /分钟|看一件/.test(positive), exclusions } as const
  }
  return { kind: 'navigation' } as const
}

function asksAboutCurrentArticle(text: string) {
  const body = text.replace(/[?。!]+$/, '').replace(/^(?:请问|请|可以|能不能)\s*/, '')
  if (/^介绍(?:一下)?(?:这篇(?:文章|专题)?|本文|当前专题)$/.test(body)) return true
  return /^(?:这篇(?:文章|专题)?|本文|当前专题|这[个一]页|这里)(?:主要)?(?:(?:说|讲|写|介绍)(?:了|的)?(?:是)?什么(?:内容)?|是什么|内容是什么)$/.test(body)
}

export type IntentContext = {
  route: string; onArtifact: boolean; now?: Date; composing?: boolean
  pendingSlot?: boolean; previousPeople?: number; savedLookpoint?: GuideStop; lookpoint?: GuideStop | null
}
export type Intent =
  | { kind: 'cancel-slot' }
  | { kind: 'slot-query'; date: string; people: number }
  | { kind: 'slot-clarify'; people: number }
  | { kind: 'resume-lookpoint'; stop: GuideStop }
  | { kind: 'site-page'; route: string; article?: true }
  | { kind: 'site-navigation'; stops: SiteStop[] }
  | { kind: 'discovery-search'; keyword: string; short: boolean; exclusions: string[]; deferredSlot?: SlotIntent }
  | { kind: 'discovery-clarify' }
  | { kind: 'object-evidence' }
  | { kind: 'unknown' }

export function parseIntent(question: string, context: IntentContext): Intent {
  const text = question.normalize('NFKC').trim()
  if (!text || context.composing) return { kind: 'unknown' }

  // Cancel → slots → resume → current page → evidence → discovery → navigation → clarify.
  if (context.pendingSlot && /^(?:我\s*)?(?:(?:别|不用|不要|不想|不)\s*(?:再|先)?(?:预约|订票|查(?:看)?(?:公开)?(?:时段|名额)|看时段)|不查了)/.test(text)) {
    return { kind: 'cancel-slot' }
  }
  const deferred = parseDeferred(text, context.now)
  const slot = deferred ? null : parseSlots(text, context.now, context.previousPeople)
  if (slot) return 'date' in slot ? { kind: 'slot-query', ...slot } : { kind: 'slot-clarify', people: slot.people }
  if (context.savedLookpoint && matchesSavedLookpoint(text, context.savedLookpoint)) {
    return { kind: 'resume-lookpoint', stop: context.savedLookpoint }
  }
  if (/^(?:请)?(?:带我|帮我)?(?:回到|返回|回去看?)(?:刚才|原来)/.test(text)) return { kind: 'unknown' }

  const topic = deferred?.first ?? text
  const discovery = parseDiscovery(topic, context.onArtifact)
  if (discovery.kind === 'appointment') return { kind: 'site-page', route: 'appointment' }
  if (context.route === 'article-detail' && asksAboutCurrentArticle(topic)) {
    return { kind: 'site-page', route: context.route, article: true }
  }
  if (/这里|这一页|这个页面|当前页|我在哪/.test(topic)) return { kind: 'site-page', route: context.route }

  const labels = pointLabelPattern().source
  const stops = siteStopsMatching(topic)
  const mentionsEvidence = new RegExp(
    `年代|朝代|出土|铸造|造的|来历|来源|出处|断过|残缺|多大|尺寸|重量|多重|材质|用途|用来|象征|含义`
    + `|怎么知道|怎么看出来|再指|我说的是|我指的是|另一[只个对处面边]|另外一[只个对处面边]`
    + `|这[只条处边个件两]|是实物|(?:它|实物|照片|图版).*(?:是|看|哪|怎么|什么)`
    + `|^(?:我想|继续|接着|先)?看(?:${labels})`,
  ).test(topic)
  const mentionsPoint = new RegExp(`^(?:${labels})[。!?]*$|(?:三只脚|两条腿|缺了一条)`).test(topic)
  if (context.onArtifact && discovery.kind === 'navigation' && !stops.includes('shop')
      && !(stops.some(stop => stop !== 'ding') && /怎么进|怎么去|去哪里|在哪.*(?:看|进)|哪里能看|带我去|怎么搜/.test(topic))
      && (mentionsEvidence || mentionsPoint)) {
    return { kind: 'object-evidence' }
  }
  if (discovery.kind === 'search') return { ...discovery, kind: 'discovery-search', deferredSlot: deferred?.slot }
  if (discovery.kind === 'clarify-discovery') return { kind: 'discovery-clarify' }
  if (stops.length) return { kind: 'site-navigation', stops }
  if (/网站|博物馆|带我|逛|介绍|开始|你好|能做什么|路线/.test(topic)) return { kind: 'site-page', route: 'home' }
  const offTopicNoise = !/[\u4e00-\u9fff]/.test(topic) || /天气|机票|外卖|股票|笑话|写代码|翻译/.test(topic)
  if (context.onArtifact && !offTopicNoise && topic.length >= 2) return { kind: 'object-evidence' }
  return { kind: 'unknown' }
}

// Compatibility projections for callers of the old pure helpers.
export function slotIntent(question: string, now?: Date, previousPeople?: number): SlotIntent | null {
  const intent = parseIntent(question, { route: '', onArtifact: false, now, previousPeople })
  if (intent.kind === 'slot-query') return { date: intent.date, people: intent.people }
  if (intent.kind === 'slot-clarify') return { clarifyDate: true, people: intent.people }
  return null
}

export function deferredSlotIntent(question: string) {
  const intent = parseIntent(question, { route: '', onArtifact: false })
  return intent.kind === 'discovery-search' && intent.deferredSlot
    ? { first: parseDeferred(question)!.first, slot: intent.deferredSlot }
    : null
}

export function requestsSavedLookpoint(question: string, stop: GuideStop) {
  return parseIntent(question, { route: '', onArtifact: false, savedLookpoint: stop }).kind === 'resume-lookpoint'
}

export function discoveryIntent(question: string, onArtifact: boolean) {
  const intent = parseIntent(question, { route: '', onArtifact })
  if (intent.kind === 'discovery-search') return { kind: 'search', keyword: intent.keyword, short: intent.short, exclusions: intent.exclusions } as const
  if (intent.kind === 'discovery-clarify') return { kind: 'clarify-discovery' } as const
  if (intent.kind === 'object-evidence') return { kind: 'object' } as const
  if (intent.kind === 'site-page' && intent.route === 'appointment') return { kind: 'appointment' } as const
  return { kind: 'navigation' } as const
}
