import { describe, expect, it, vi } from 'vitest'
import { apiGet } from './api'
import { deferredSlotIntent, isPublicSlotDate, readGuideSlots, shanghaiDay, slotIntent } from './luoshengSlots'

vi.mock('./api', () => ({ apiGet: vi.fn() }))

describe('洛笙公开时段查询', () => {
  it('按上海跨日计算 14 天窗口并拒绝无效日期', () => {
    const now = new Date('2026-11-20T17:00:00Z')
    expect(shanghaiDay(0, now)).toBe('2026-11-21')
    expect(isPublicSlotDate('2026-12-04', now)).toBe(true)
    expect(isPublicSlotDate('2026-12-05', now)).toBe(false)
    expect(isPublicSlotDate('2026-11-31', now)).toBe(false)
    expect(slotIntent('明天还有三个人的名额吗？')).toEqual({ date: shanghaiDay(1), people: 3 })
  })

  it('解析中文月日、完整日期及上海年末的开放窗口', () => {
    const now = new Date('2026-11-20T17:00:00Z')
    for (const phrase of ['11 月 23 日', '2026年11月23号', '2026-11-23', '后天（11月23日）']) {
      expect(slotIntent(`${phrase}还有三人名额吗？`, now)).toEqual({ date: '2026-11-23', people: 3 })
    }
    const endOfYear = new Date('2026-12-28T17:00:00Z')
    expect(slotIntent('1月2日还有公开时段吗？', endOfYear)).toEqual({ date: '2027-01-02', people: 1 })
    expect(slotIntent('2026年1月2日还有公开时段吗？', endOfYear)).toEqual({ date: '2026-01-02', people: 1 })
    expect(slotIntent('明天或者后天三人有名额吗？', now)).toEqual({ clarifyDate: true, people: 3 })
    expect(slotIntent('11月22日至23日，哪天有票？', now)).toEqual({ clarifyDate: true, people: 1 })
    expect(slotIntent('还有三人名额吗？', now)).toEqual({ clarifyDate: true, people: 3 })
    expect(slotIntent('怎么预约参观？', now)).toBeNull()
    expect(slotIntent('大后天还有名额吗？', now)).toEqual({ date: '2026-11-24', people: 1 })
  })

  it('只在本轮日期澄清后承接简短答复或新报的人数', () => {
    const now = new Date('2026-11-20T17:00:00Z')
    expect(slotIntent('那就明天吧', now, 3)).toEqual({ date: '2026-11-22', people: 3 })
    expect(slotIntent('11 月 23 日呢？', now, 3)).toEqual({ date: '2026-11-23', people: 3 })
    expect(slotIntent('后天两个人还有名额吗？', now, 3)).toEqual({ date: '2026-11-23', people: 2 })
    expect(slotIntent('明天', now)).toBeNull()
    expect(slotIntent('那它是什么时候铸造的？', now, 3)).toBeNull()
    expect(slotIntent('明天不预约，只想看鼎', now, 3)).toBeNull()
  })

  it('区分有三人名额、名额不足、没有时段和查询失败', async () => {
    const date = shanghaiDay(1)
    const slot = { visitDate: date, startTime: '10:30:00', endTime: '11:00:00', remainingPeople: 1 }
    vi.mocked(apiGet).mockResolvedValueOnce([slot, { ...slot, remainingPeople: 3 }])
      .mockResolvedValueOnce([slot]).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'))
    const signal = new AbortController().signal
    for (const message of ['10:30–11:00 可选', '空位不足 3 人', '没有公开可约时段', '公开时段暂时查不到']) {
      expect(await readGuideSlots(date, 3, signal)).toEqual({ date, text: expect.stringContaining(message) })
    }
    expect(apiGet).toHaveBeenLastCalledWith(`/appointment-slots?dateFrom=${date}&dateTo=${date}`, undefined, { signal })
  })

  it('按完整人数过滤，不把十一人截成一人', async () => {
    const date = shanghaiDay(1)
    for (const [word, people] of [['十一人', 11], ['二十五位', 25], ['三十个人', 30], ['１２名成人', 12], ['十一张票', 11]] as const) {
      expect(slotIntent(`明天还有${word}的名额吗？`)).toEqual({ date, people })
    }
    expect(slotIntent('明天还有时段吗？')).toEqual({ date, people: 1 })
    const early = { visitDate: date, startTime: '10:30:00', endTime: '11:00:00', remainingPeople: 6 }
    vi.mocked(apiGet).mockResolvedValueOnce([early, { ...early, startTime: '11:00:00', endTime: '11:30:00', remainingPeople: 11 }])
    const intent = slotIntent('明天十一人参观')
    if (!intent || !('date' in intent)) throw new Error('Expected a date')
    const { people } = intent
    expect(await readGuideSlots(date, people, new AbortController().signal)).toMatchObject({ text: expect.stringContaining('11:00–11:30 可选') })
  })

  it('不查询人数模糊、冲突或超限的时段', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockClear()
    for (const word of ['三到五人', '3-5人', '二或三位', '两名成人和三个孩子', '三十一人', '二点五人', '2.5人', '零人', '-2人', '一百人']) {
      const intent = slotIntent(`明天还有${word}的预约吗？`)
      if (!intent || !('date' in intent)) throw new Error('Expected a date')
      const { date, people } = intent
      expect(await readGuideSlots(date, people, signal)).toEqual({ text: '每次预约支持 1–30 人，请确认参观人数。' })
    }
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('只从后半句暂存时段，支持有无逗号且不把拒绝当成待查', () => {
    const expected = { first: '先看青铜鼎', slot: { date: shanghaiDay(1), people: 3 } }
    expect(deferredSlotIntent('先看青铜鼎再看看明天三个人还有没有票')).toEqual(expected)
    expect(deferredSlotIntent('先看青铜鼎，再查明天三个人的预约时段')).toEqual(expected)
    expect(deferredSlotIntent('先看青铜鼎，然后明天不预约')).toBeNull()
    expect(slotIntent('明天不预约，只想看鼎')).toBeNull()
  })
})
