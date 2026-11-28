import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

const apiGet = vi.hoisted(() => vi.fn())
const apiRequest = vi.hoisted(() => vi.fn())
const auth = vi.hoisted(() => ({
  token: 'admin-token',
  isAdmin: true,
  loggedIn: true,
  user: { nickname: 'Admin', roles: ['ADMIN'] },
  initialize: vi.fn(async () => {}),
}))

vi.mock('../lib/api', () => ({ apiGet, apiRequest }))
vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }))

import AdminDashboardView from './AdminDashboardView.vue'

function samplePayload(overrides: Record<string, unknown> = {}) {
  return {
    rangeDays: 30,
    hasRealTraffic: false,
    hasDemoTraffic: false,
    usingDemoTraffic: false,
    kpis: {
      periodPv: 0,
      prevPeriodPv: 0,
      periodUv: 0,
      prevPeriodUv: 0,
      periodAppointments: 0,
      prevPeriodAppointments: 0,
      periodVisitors: 0,
      periodCheckedInVisitors: 0,
      checkInRate: 0,
      periodSalesAmount: '0.00',
      prevPeriodSalesAmount: '0.00',
      periodPaidOrders: 0,
      newUsersCount: 2,
      prevNewUsersCount: 1,
      totalUsers: 8,
      totalPublishedArtifacts: 6,
      totalPublishedArticles: 4,
      totalPublishedExhibits: 2,
    },
    trafficSeries: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      pv: 0,
      uv: 0,
    })),
    appointmentSeries: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      bookedPeople: 0,
      checkedInPeople: 0,
      cancelledPeople: 0,
      bookingCount: 0,
    })),
    upcomingSlots: Array.from({ length: 14 }, (_, i) => ({
      visitDate: `2026-12-${String(i + 1).padStart(2, '0')}`,
      weekdayLabel: i % 7 === 0 ? '周一' : '周二',
      isClosedMonday: i % 7 === 0,
      capacity: i % 7 === 0 ? 0 : 160,
      reservedPeople: 0,
      slotCount: i % 7 === 0 ? 0 : 4,
      utilizationRate: 0,
    })),
    salesSeries: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      salesAmount: '0.00',
      orderCount: 0,
    })),
    orderStatusCounts: { PENDING_PAYMENT: 0, PAID: 1, CANCELLED: 0, COMPLETED: 2 },
    topContent: [],
    slotTimeDistribution: [],
    todoCounts: {
      pendingAppointments: 3,
      paidOrders: 1,
      lowStockProducts: 2,
      draftContents: 1,
      missingEnContents: 0,
    },
    lowStockProducts: [{ id: 8, sku: 'HL-CUP-01', slug: 'cup', name: '河流纹茶杯套装', stockQuantity: 3, availableStock: 3 }],
    ...overrides,
  }
}

async function mountDashboard() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', component: AdminDashboardView },
      { path: '/admin/slots', component: { template: '<div>Slots</div>' } },
      { path: '/admin/appointments', component: { template: '<div>Appointments</div>' } },
      { path: '/admin/orders', component: { template: '<div>Orders</div>' } },
      { path: '/admin/products', component: { template: '<div>Products</div>' } },
      { path: '/admin/artifacts', component: { template: '<div>Artifacts</div>' } },
      { path: '/admin/articles', component: { template: '<div>Articles</div>' } },
      { path: '/admin/exhibits', component: { template: '<div>Exhibits</div>' } },
      { path: '/admin/categories', component: { template: '<div>Categories</div>' } },
      { path: '/admin/guide', component: { template: '<div>Guide</div>' } },
      { path: '/login', component: { template: '<div>Login</div>' } },
    ],
  })
  await router.push('/admin')
  await router.isReady()

  const wrapper = mount(AdminDashboardView, {
    global: {
      plugins: [router],
      stubs: {
        AdminShell: { template: '<div><slot name="header-actions"/><slot/></div>' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  apiGet.mockReset()
  apiRequest.mockReset().mockResolvedValue({})
  apiGet.mockImplementation((path: string) => {
    if (path.startsWith('/admin/dashboard/analytics')) {
      const days = path.includes('days=7') ? 7 : path.includes('days=90') ? 90 : 30
      return Promise.resolve(samplePayload({ rangeDays: days }))
    }
    if (path === '/admin/guide/overview') {
      return Promise.resolve({ enabled: true, usedToday: 12, dailyLimit: 200, inFlight: 0, runtimeMode: 'NORMAL' })
    }
    return Promise.resolve({})
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AdminDashboardView', () => {
  it('defaults to demo preview when no real traffic exists and renders charts + todos', async () => {
    const { wrapper } = await mountDashboard()

    expect(wrapper.get('[data-testid="dashboard-mode-banner"]').text()).toContain('DEMO PREVIEW')
    expect(wrapper.text()).toContain('网站人流变化趋势')
    expect(wrapper.text()).toContain('预约客流与入馆核销趋势')
    expect(wrapper.text()).toContain('未来 14 天预约承载力')
    expect(wrapper.text()).toContain('热门馆藏与 3D 展项访问榜')
    expect(wrapper.text()).toContain('河流纹茶杯套装 仅余 3 件')
    expect(wrapper.text()).toContain('洛笙向导 · 智能模型运行中')
    expect(wrapper.find('.admin-kpi-spark').exists()).toBe(true)
    expect(wrapper.find('.admin-kpi-gauge').exists()).toBe(true)
    expect(wrapper.find('.admin-kpi-bars').exists()).toBe(true)
    expect(wrapper.find('.admin-kpi-dots').exists()).toBe(true)
    expect(wrapper.find('.admin-chart-card--darkroom').exists()).toBe(true)
    expect(wrapper.find('.order-ratio-bar').exists()).toBe(true)
    expect(wrapper.find('.horizon-calendar-grid').exists()).toBe(true)
  })

  it('switches date range and toggles between demo preview and live telemetry', async () => {
    const { wrapper } = await mountDashboard()

    await wrapper.get('[data-testid="dashboard-range-switch"] button:first-child').trigger('click')
    await flushPromises()
    expect(apiGet).toHaveBeenCalledWith('/admin/dashboard/analytics?days=7&includeDemo=false', 'admin-token', expect.any(Object))

    await wrapper.get('[data-testid="dashboard-mode-switch"] button:first-child').trigger('click')
    await flushPromises()
    expect(apiGet).toHaveBeenCalledWith('/admin/dashboard/analytics?days=7&includeDemo=true', 'admin-token', expect.any(Object))

    await wrapper.get('[data-testid="dashboard-mode-switch"] button:last-child').trigger('click')
    await flushPromises()
    expect(apiGet).toHaveBeenCalledWith('/admin/dashboard/analytics?days=7&includeDemo=false', 'admin-token', expect.any(Object))
    expect(wrapper.get('[data-testid="dashboard-mode-banner"]').text()).toContain('LIVE TELEMETRY')
  })

  it('navigates directly to /admin/slots when clicking an open day in capacity horizon', async () => {
    const { wrapper, router } = await mountDashboard()

    const openDay = wrapper.findAll('.horizon-day').find(btn => !btn.attributes('disabled'))
    expect(openDay).toBeTruthy()
    await openDay!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/admin/slots')
    expect(String(router.currentRoute.value.query.date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
