import { reactive, readonly } from 'vue'
import { apiGet } from '../lib/api'
import { useAuthStore } from '../stores/auth'

export interface AdminNavCounts {
  pendingAppointments: number
  paidOrders: number
  lowStockProducts: number
  draftContents: number
  missingEnContents: number
}

interface SummaryResponse {
  pendingAppointmentCount?: number
  orderStatusCounts?: Record<string, number>
  lowStockProducts?: unknown[]
  todoCounts?: Partial<AdminNavCounts>
}

const state = reactive<AdminNavCounts>({
  pendingAppointments: 0,
  paidOrders: 0,
  lowStockProducts: 0,
  draftContents: 0,
  missingEnContents: 0,
})

let loadingPromise: Promise<void> | null = null
let lastFetchedAt = 0

export function setAdminNavCounts(partial: Partial<AdminNavCounts>): void {
  if (typeof partial.pendingAppointments === 'number') state.pendingAppointments = partial.pendingAppointments
  if (typeof partial.paidOrders === 'number') state.paidOrders = partial.paidOrders
  if (typeof partial.lowStockProducts === 'number') state.lowStockProducts = partial.lowStockProducts
  if (typeof partial.draftContents === 'number') state.draftContents = partial.draftContents
  if (typeof partial.missingEnContents === 'number') state.missingEnContents = partial.missingEnContents
  lastFetchedAt = Date.now()
}

export async function refreshAdminNavCounts(force = false): Promise<void> {
  const auth = useAuthStore()
  if (!auth.isAdmin || !auth.token) return
  if (!force && Date.now() - lastFetchedAt < 15_000) return
  if (loadingPromise) return loadingPromise

  loadingPromise = apiGet<SummaryResponse>('/admin/dashboard/summary', auth.token)
    .then((summary) => {
      if (summary.todoCounts) {
        setAdminNavCounts(summary.todoCounts)
        return
      }
      setAdminNavCounts({
        pendingAppointments: summary.pendingAppointmentCount ?? 0,
        paidOrders: summary.orderStatusCounts?.PAID ?? 0,
        lowStockProducts: Array.isArray(summary.lowStockProducts) ? summary.lowStockProducts.length : 0,
      })
    })
    .catch(() => {})
    .finally(() => {
      loadingPromise = null
    })

  return loadingPromise
}

export function useAdminNavCounts() {
  return {
    counts: readonly(state),
    refresh: refreshAdminNavCounts,
    updateFrom: setAdminNavCounts,
  }
}
