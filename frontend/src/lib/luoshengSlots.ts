import { apiGet } from './api'
import { isPublicSlotDate } from './publicSlotDate'
import ui from '../assets/guide/ui.zh-CN.json'
import { formatGuideCopy as copy } from './luoshengCopy'
export { isPublicSlotDate, shanghaiDay } from './publicSlotDate'
export { deferredSlotIntent, slotIntent } from './luoshengIntent'

type Slot = { visitDate: string; startTime: string; endTime: string; remainingPeople: number }
export async function readGuideSlots(date: string, people: number, signal: AbortSignal) {
  if (!isPublicSlotDate(date)) return { text: copy(ui.slots.outOfWindow, { date }) }
  if (!Number.isInteger(people) || people < 1 || people > 30) return { text: ui.slots.invalidParty }
  try {
    const slots = await apiGet<Slot[]>(`/appointment-slots?dateFrom=${date}&dateTo=${date}`, undefined, { signal })
    const first = slots.find(slot => slot.visitDate === date && slot.remainingPeople >= people)
    const checked = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })
    const label = copy(ui.slots.checked, { date, checked })
    const text = first ? copy(ui.slots.available, {
      label, start: first.startTime.slice(0, 5), end: first.endTime.slice(0, 5), remaining: first.remainingPeople,
    }) : slots.length ? copy(ui.slots.insufficient, { label, people }) : copy(ui.slots.empty, { label })
    return { text, date }
  } catch {
    return { text: copy(ui.slots.unavailable, { date }), date }
  }
}
