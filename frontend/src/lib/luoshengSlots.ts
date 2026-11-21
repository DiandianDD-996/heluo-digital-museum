import { apiGet } from './api'
import { isPublicSlotDate } from './luoshengIntent'
export { deferredSlotIntent, isPublicSlotDate, shanghaiDay, slotIntent } from './luoshengIntent'

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
