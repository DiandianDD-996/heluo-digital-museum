import type { TrafficSeriesPoint } from '../components/admin/charts/AreaTrendChart.vue'
import type { AppointmentSeriesPoint } from '../components/admin/charts/AppointmentFlowChart.vue'
import type { UpcomingHorizonDay } from '../components/admin/charts/CapacityHorizonChart.vue'
import type { RankedContentItem } from '../components/admin/charts/RankedBarChart.vue'
import type { SalesSeriesPoint } from '../components/admin/charts/SalesTrendChart.vue'

export interface DashboardAnalyticsPayload {
  rangeDays: number
  hasRealTraffic: boolean
  hasDemoTraffic: boolean
  usingDemoTraffic: boolean
  kpis: {
    periodPv: number
    prevPeriodPv: number
    periodUv: number
    prevPeriodUv: number
    periodAppointments: number
    prevPeriodAppointments: number
    periodVisitors: number
    periodCheckedInVisitors: number
    checkInRate: number
    periodSalesAmount: string
    prevPeriodSalesAmount: string
    periodPaidOrders: number
    newUsersCount: number
    prevNewUsersCount: number
    totalUsers: number
    totalPublishedArtifacts: number
    totalPublishedArticles: number
    totalPublishedExhibits: number
  }
  trafficSeries: TrafficSeriesPoint[]
  appointmentSeries: AppointmentSeriesPoint[]
  upcomingSlots: UpcomingHorizonDay[]
  salesSeries: SalesSeriesPoint[]
  orderStatusCounts: Record<string, number>
  topContent: RankedContentItem[]
  slotTimeDistribution: Array<{ timeLabel: string; visitors: number; share: number }>
  todoCounts: {
    pendingAppointments: number
    paidOrders: number
    lowStockProducts: number
    draftContents: number
    missingEnContents: number
  }
  lowStockProducts: Array<{
    id: number
    sku: string
    slug: string
    name: string
    stockQuantity: number
    availableStock: number
  }>
}

function isoDateOffset(daysOffset: number): string {
  const now = new Date()
  const target = new Date(now.getTime() + daysOffset * 86_400_000)
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function weekdayZh(isoDate: string): string {
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const parsed = new Date(`${isoDate}T12:00:00+08:00`)
  return labels[parsed.getDay()] ?? '周二'
}

/**
 * Generates deterministic museum preview series when local development data is still sparse,
 * keeping existing backend real metrics untouched when already populated.
 */
export function buildDemoPreviewOverlay(real: DashboardAnalyticsPayload): DashboardAnalyticsPayload {
  const days = real.rangeDays
  const clone: DashboardAnalyticsPayload = JSON.parse(JSON.stringify(real))

  // 1. Traffic fallback if DB demo seed hasn't been inserted yet
  const hasAnyTraffic = clone.trafficSeries.some(d => d.pv > 0)
  if (!hasAnyTraffic) {
    let pvSum = 0
    let uvSum = 0
    clone.trafficSeries = Array.from({ length: days }, (_, idx) => {
      const date = isoDateOffset(idx - (days - 1))
      const dow = new Date(`${date}T12:00:00+08:00`).getDay()
      const factor = dow === 1 ? 0.45 : (dow === 0 || dow === 6) ? 1.46 : 1.0
      const wave = 1 + 0.14 * Math.sin(idx * 0.45) + 0.06 * Math.cos(idx * 0.88)
      const growth = 0.85 + (idx / Math.max(1, days - 1)) * 0.32
      const pv = Math.round(330 * factor * wave * growth)
      const uv = Math.round(pv * 0.44)
      pvSum += pv
      uvSum += uv
      return { date, pv, uv }
    })
    clone.kpis.periodPv = pvSum
    clone.kpis.prevPeriodPv = Math.round(pvSum * 0.87)
    clone.kpis.periodUv = uvSum
    clone.kpis.prevPeriodUv = Math.round(uvSum * 0.89)
    clone.topContent = [
      { routeType: 'EXHIBIT', slug: 'heluo-bronze-ding-3d', title: '河洛青铜鼎 · 3D 数字重制展项', pv: Math.round(pvSum * 0.145), uv: Math.round(uvSum * 0.19) },
      { routeType: 'ARTIFACT', slug: 'heluo-bronze-ding', title: '河洛青铜鼎（数字重制）', pv: Math.round(pvSum * 0.105), uv: Math.round(uvSum * 0.14) },
      { routeType: 'EXHIBIT', slug: 'river-map-stone-raking', title: '河洛图纹石板 · 交互斜射光检视', pv: Math.round(pvSum * 0.088), uv: Math.round(uvSum * 0.12) },
      { routeType: 'ARTIFACT', slug: 'river-map-jade-bi', title: '河图玉璧（概念展品）', pv: Math.round(pvSum * 0.072), uv: Math.round(uvSum * 0.10) },
      { routeType: 'ARTIFACT', slug: 'heluo-bronze-jue', title: '河洛纹青铜爵（概念展品）', pv: Math.round(pvSum * 0.058), uv: Math.round(uvSum * 0.08) },
      { routeType: 'ARTICLE', slug: 'how-to-read-bronze', title: '第一次看青铜器，可以从哪三个问题开始？', pv: Math.round(pvSum * 0.044), uv: Math.round(uvSum * 0.06) },
    ]
  }

  // 2. Appointments & check-in rhythm overlay if DB has fewer than 2 days of bookings
  const apptActiveDays = clone.appointmentSeries.filter(d => d.bookedPeople > 0).length
  if (apptActiveDays < 2) {
    let totalVisitors = 0
    let totalCheckedIn = 0
    let totalOrders = 0
    clone.appointmentSeries = Array.from({ length: days }, (_, idx) => {
      const date = isoDateOffset(idx - (days - 1))
      const dow = new Date(`${date}T12:00:00+08:00`).getDay()
      if (dow === 1) {
        return { date, bookedPeople: 0, checkedInPeople: 0, cancelledPeople: 0, bookingCount: 0 }
      }
      const isWeekend = dow === 0 || dow === 6
      const base = isWeekend ? 116 : 68
      const bookedPeople = Math.round(base + 18 * Math.sin(idx * 0.61) + (idx / Math.max(1, days)) * 12)
      const isPastOrToday = idx < days - 1
      const checkedInPeople = isPastOrToday ? Math.round(bookedPeople * (0.82 + 0.06 * Math.cos(idx))) : Math.round(bookedPeople * 0.35)
      const cancelledPeople = Math.max(1, Math.round(bookedPeople * 0.07))
      const bookingCount = Math.max(4, Math.round(bookedPeople / 2.3))
      totalVisitors += bookedPeople
      totalCheckedIn += checkedInPeople
      totalOrders += bookingCount
      return { date, bookedPeople, checkedInPeople, cancelledPeople, bookingCount }
    })
    clone.kpis.periodAppointments = totalOrders
    clone.kpis.prevPeriodAppointments = Math.round(totalOrders * 0.91)
    clone.kpis.periodVisitors = totalVisitors
    clone.kpis.periodCheckedInVisitors = totalCheckedIn
    clone.kpis.checkInRate = totalVisitors > 0 ? Math.round((totalCheckedIn / totalVisitors) * 1000) / 10 : 0
    clone.slotTimeDistribution = [
      { timeLabel: '09:00', visitors: Math.round(totalVisitors * 0.28), share: 28 },
      { timeLabel: '10:30', visitors: Math.round(totalVisitors * 0.34), share: 34 },
      { timeLabel: '13:30', visitors: Math.round(totalVisitors * 0.23), share: 23 },
      { timeLabel: '15:15', visitors: Math.round(totalVisitors * 0.15), share: 15 },
    ]
  }

  // 3. Upcoming 14-day capacity overlay if future slots exist with zero reservations
  const hasFutureReservations = clone.upcomingSlots.some(d => d.reservedPeople > 0)
  if (!hasFutureReservations) {
    clone.upcomingSlots = Array.from({ length: 14 }, (_, idx) => {
      const visitDate = isoDateOffset(idx)
      const dow = new Date(`${visitDate}T12:00:00+08:00`).getDay()
      const closed = dow === 1
      if (closed) {
        return { visitDate, weekdayLabel: '周一', isClosedMonday: true, capacity: 0, reservedPeople: 0, slotCount: 0, utilizationRate: 0 }
      }
      const capacity = 160
      const nearBonus = Math.max(0, 1 - idx / 15)
      const weekendBoost = (dow === 0 || dow === 6) ? 1.38 : 0.85
      const reservedPeople = Math.min(capacity, Math.round((46 + 86 * nearBonus) * weekendBoost * (0.9 + 0.15 * Math.sin(idx * 1.1))))
      const rate = Math.round((reservedPeople / capacity) * 1000) / 10
      return {
        visitDate,
        weekdayLabel: weekdayZh(visitDate),
        isClosedMonday: false,
        capacity,
        reservedPeople,
        slotCount: 4,
        utilizationRate: rate,
      }
    })
  }

  // 4. Sales & order distribution overlay if DB has no recent sales
  const hasRealSales = clone.salesSeries.some(d => Number.parseFloat(d.salesAmount) > 0)
  if (!hasRealSales) {
    let salesSum = 0
    let paidOrdersSum = 0
    clone.salesSeries = Array.from({ length: days }, (_, idx) => {
      const date = isoDateOffset(idx - (days - 1))
      const dow = new Date(`${date}T12:00:00+08:00`).getDay()
      const weekendBoost = (dow === 0 || dow === 6) ? 1.55 : 1.0
      const orderCount = Math.max(1, Math.round((2 + 2 * Math.sin(idx * 0.72) + (idx / Math.max(1, days)) * 1.5) * weekendBoost))
      const avgTicket = 89 + ((idx * 19) % 58)
      const amount = Math.round(orderCount * avgTicket * 100) / 100
      salesSum += amount
      paidOrdersSum += orderCount
      return { date, salesAmount: amount.toFixed(2), orderCount }
    })
    clone.kpis.periodSalesAmount = salesSum.toFixed(2)
    clone.kpis.prevPeriodSalesAmount = (salesSum * 0.84).toFixed(2)
    clone.kpis.periodPaidOrders = paidOrdersSum
    clone.orderStatusCounts = {
      COMPLETED: Math.round(paidOrdersSum * 0.68),
      PAID: Math.max(2, Math.round(paidOrdersSum * 0.16)),
      PENDING_PAYMENT: Math.max(1, Math.round(paidOrdersSum * 0.08)),
      CANCELLED: Math.max(1, Math.round(paidOrdersSum * 0.08)),
    }
  }

  return clone
}
