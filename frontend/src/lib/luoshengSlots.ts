import { apiGet } from './api'

export function shanghaiDay(offset = 0, now = new Date()) {
  const shanghai = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const base = new Date(`${shanghai}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + offset)
  return base.toISOString().slice(0, 10)
}

export function isPublicSlotDate(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
    && date >= shanghaiDay(0, now) && date <= shanghaiDay(13, now)
}

const digits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
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
  if (digits[count]) return digits[count]
  const tens = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(count)
  return tens ? (digits[tens[1] ?? '一'] ?? 0) * 10 + (digits[tens[2] ?? ''] ?? 0) : 0
}

type SlotIntent = { date: string; people: number } | { clarifyDate: true; people: number }

const calendarDate = /(?<!\d)(?:(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})(?!\d)(?:\s*[日号])?|(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)|(\d{1,2})\s*月\s*(\d{1,2})\s*[日号])/g
const relativeDays = { 今天: 0, 明天: 1, 后天: 2, 大后天: 3 } as const
const dateOnly = new RegExp(`^(?:那就|那)?\\s*(?:${calendarDate.source}|大后天|后天|明天|今天)\\s*(?:吧|呢)?[。!！?？]*$`)

export function slotIntent(question: string, now = new Date(), previousPeople?: number): SlotIntent | null {
  const text = question.normalize('NFKC').trim()
  if (/(?:不(?:想|要|用|需要|打算)?|别)(?:先|再)?(?:预约|订票)/.test(text)) return null
  if (!/预约|去馆|参观|到馆|名额|余量|时段|门票|票/.test(text)
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
  for (const [relative] of text.matchAll(/大后天|后天|明天|今天/g)) {
    dates.add(shanghaiDay(relativeDays[relative as keyof typeof relativeDays], now))
  }
  if (dates.size > 1 || /今明两?天|明后两?天|(?:到|至|或|[-–—~])\s*\d{1,2}\s*[日号]/.test(text.replace(calendarDate, ' '))) {
    return { clarifyDate: true, people }
  }
  const [date] = dates
  if (!date) return /名额|余量|可约时段|还有.*票|有没有.*票/.test(text) ? { clarifyDate: true, people } : null
  return { date, people }
}

export function deferredSlotIntent(question: string) {
  const parts = /^(先.+?)\s*[，,；;]?\s*(?:然后|之后再|再)\s*(.+)$/.exec(question.normalize('NFKC').trim())
  if (!parts) return null
  const slot = slotIntent(parts[2]!)
  return slot ? { first: parts[1]!, slot } : null
}

type Slot = { visitDate: string; startTime: string; endTime: string; remainingPeople: number }
export async function readGuideSlots(date: string, people: number, signal: AbortSignal) {
  if (!isPublicSlotDate(date)) return { text: `${date} 不在当前 14 天的公开预约范围内，请换个日期。` }
  if (!Number.isInteger(people) || people < 1 || people > 30) return { text: '每次预约支持 1–30 人，请确认参观人数。' }
  try {
    const slots = await apiGet<Slot[]>(`/appointment-slots?dateFrom=${date}&dateTo=${date}`, undefined, { signal })
    const first = slots.find(slot => slot.visitDate === date && slot.remainingPeople >= people)
    const checked = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })
    const label = `${date}（上海时间 ${checked} 查询）`
    const text = first ? `${label}，${first.startTime.slice(0, 5)}–${first.endTime.slice(0, 5)} 可选，查询时余 ${first.remainingPeople} 个名额。`
      : slots.length ? `${label}，当前公开时段的空位不足 ${people} 人。`
        : `${label}，当前没有公开可约时段。`
    return { text, date }
  } catch {
    return { text: `${date} 的公开时段暂时查不到，请稍后再试。`, date }
  }
}
