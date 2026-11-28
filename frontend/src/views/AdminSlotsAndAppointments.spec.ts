import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

const apiGet = vi.hoisted(() => vi.fn())
const apiRequest = vi.hoisted(() => vi.fn())
const downloadAdminCsv = vi.hoisted(() => vi.fn(async () => 'heluo-appointments-2030-06-10.csv'))
const refreshAdminNavCounts = vi.hoisted(() => vi.fn(async () => {}))
const auth = vi.hoisted(() => ({
  token: 'admin-token',
  isAdmin: true,
  loggedIn: true,
  user: { nickname: 'Admin', roles: ['ADMIN'] },
  initialize: vi.fn(async () => {}),
}))

vi.mock('../lib/api', () => ({ apiGet, apiRequest }))
vi.mock('../lib/adminCsvExport', () => ({ downloadAdminCsv }))
vi.mock('../composables/useAdminNavCounts', () => ({
  refreshAdminNavCounts,
  setAdminNavCounts: vi.fn(),
  useAdminNavCounts: () => ({ counts: {}, refresh: refreshAdminNavCounts, updateFrom: vi.fn() }),
}))
vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }))

import AdminSlotsView from './AdminSlotsView.vue'
import AdminAppointmentsView from './AdminAppointmentsView.vue'

const wrappers: VueWrapper[] = []

function buildCalendarMonth(month = '2030-06') {
  const days = Array.from({ length: 30 }, (_, idx) => {
    const day = String(idx + 1).padStart(2, '0')
    const visitDate = `${month}-${day}`
    const isTarget = visitDate === '2030-06-15'
    return {
      visitDate,
      isMonday: idx % 7 === 5,
      slotCount: isTarget ? 1 : 0,
      openSlotCount: isTarget ? 1 : 0,
      closedSlotCount: 0,
      totalCapacity: isTarget ? 40 : 0,
      reservedPeople: isTarget ? 12 : 0,
      utilizationRate: isTarget ? 30.0 : 0,
      slots: isTarget
        ? [{
            id: 501,
            visitDate: '2030-06-15',
            startTime: '09:00:00',
            endTime: '10:30:00',
            capacity: 40,
            reservedPeople: 12,
            status: 'OPEN',
          }]
        : [],
    }
  })
  return {
    month,
    startDate: `${month}-01`,
    endDate: `${month}-30`,
    openDays: 1,
    totalSlots: 1,
    totalCapacity: 40,
    totalReserved: 12,
    days,
  }
}

async function mountPage(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/slots', component: AdminSlotsView },
      { path: '/admin/appointments', component: AdminAppointmentsView },
      { path: '/login', component: { template: '<div>Login</div>' } },
      { path: '/elsewhere', component: { template: '<div>Elsewhere</div>' } },
    ],
  })
  await router.push(initialPath)
  await router.isReady()

  const wrapper = mount(RouterView, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        AdminShell: { template: '<div><slot name="header-actions"/><slot/></div>' },
        FluidButton: {
          props: ['disabled', 'loading', 'type'],
          template: '<button :type="type || \'button\'" :disabled="disabled || loading"><slot/></button>',
        },
        AdminActionButton: {
          props: ['disabled'],
          template: '<button type="button" :disabled="disabled"><slot/></button>',
        },
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

async function confirmDialog(label: string) {
  const btn = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
    .find(el => el.textContent?.trim() === label)
  expect(btn).toBeTruthy()
  btn!.click()
  await flushPromises()
}

beforeEach(() => {
  apiGet.mockReset()
  apiRequest.mockReset().mockResolvedValue({})
  downloadAdminCsv.mockClear()
  refreshAdminNavCounts.mockClear()
})

afterEach(() => {
  wrappers.splice(0).forEach(w => w.unmount())
  document.body.innerHTML = ''
})

describe('AdminSlotsView & AdminAppointmentsView', () => {
  it('loads target month calendar from ?date query, edits a slot, batch generates, and confirms day closure', async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/admin/appointment-slots/calendar')) {
        return buildCalendarMonth('2030-06')
      }
      return {}
    })

    const { wrapper } = await mountPage('/admin/slots?date=2030-06-15')

    expect(apiGet).toHaveBeenCalledWith(
      '/admin/appointment-slots/calendar?month=2030-06',
      'admin-token',
      expect.any(Object),
    )
    expect(wrapper.get('[data-testid="calendar-day-2030-06-15"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="slots-day-panel"]').text()).toContain('09:00 – 10:30')

    // Edit slot capacity and submit PATCH
    await wrapper.get('[data-testid="slot-edit-501"]').trigger('click')
    await flushPromises()
    const drawer = wrapper.get('[data-testid="slots-drawer"]')
    const capacityInput = drawer.find('input[type="number"]')
    await capacityInput.setValue('60')
    await drawer.get('form').trigger('submit')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/appointment-slots/501',
      'PATCH',
      expect.objectContaining({ visitDate: '2030-06-15', capacity: 60, status: 'OPEN' }),
      'admin-token',
    )

    // Batch generate drawer
    await wrapper.get('[data-testid="slots-open-batch-generate"]').trigger('click')
    await flushPromises()
    const genForm = wrapper.get('[data-testid="slots-drawer"] form')
    const dateInputs = genForm.findAll('input[type="date"]')
    await dateInputs[0]!.setValue('2030-06-18')
    await dateInputs[1]!.setValue('2030-06-25')
    await genForm.trigger('submit')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/appointment-slots/batch-generate',
      'POST',
      expect.objectContaining({ dateFrom: '2030-06-18', dateTo: '2030-06-25', skipMondays: true }),
      'admin-token',
    )

    // Switch back to 2030-06-15 (which has an OPEN slot) and trigger temporary day closure
    await wrapper.get('[data-testid="calendar-day-2030-06-15"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="day-close-btn"]').trigger('click')
    await flushPromises()
    await confirmDialog('确认闭馆')

    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/appointment-slots/batch-status',
      'POST',
      expect.objectContaining({ dateFrom: '2030-06-15', dateTo: '2030-06-15', status: 'CLOSED' }),
      'admin-token',
    )
  })

  it('supports quick ticket lookup, check-in by code, server filters, and CSV export', async () => {
    const sampleAppt = {
      id: 88,
      appointmentNo: 'AP20300610ABCD',
      userId: 5,
      slotId: 501,
      visitorCount: 2,
      contactName: '沈砚青',
      contactPhone: '13900001111',
      contactEmail: 'shen@example.test',
      notes: '',
      status: 'CONFIRMED',
      cancelReason: '',
      visitDate: '2030-06-15',
      startTime: '09:00:00',
      endTime: '10:30:00',
      startAt: '2030-06-15T09:00:00',
      verificationCode: 'A1B2C3D4E5',
    }

    apiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/admin/appointments/lookup')) {
        return { appointment: sampleAppt, canCheckInNow: true, checkInHint: '处于可核销时段，可立即入馆核销' }
      }
      if (path.startsWith('/admin/appointments?')) {
        return { items: [sampleAppt], page: 1, size: 20, total: 1, totalPages: 1 }
      }
      return {}
    })
    apiRequest.mockResolvedValue({ ...sampleAppt, status: 'COMPLETED' })

    const { wrapper } = await mountPage('/admin/appointments')

    // Quick lookup + confirm check-in
    await wrapper.get('[data-testid="quick-checkin-input"]').setValue('A1B2C3D4E5')
    await wrapper.get('[data-testid="quick-checkin-lookup"]').trigger('submit')
    await flushPromises()

    expect(apiGet).toHaveBeenCalledWith(
      '/admin/appointments/lookup?code=A1B2C3D4E5',
      'admin-token',
    )
    expect(wrapper.get('[data-testid="quick-checkin-preview"]').text()).toContain('沈砚青')

    await wrapper.get('[data-testid="quick-checkin-confirm"]').trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/appointments/check-in-by-code',
      'POST',
      { verificationCode: 'A1B2C3D4E5' },
      'admin-token',
    )

    // Filter preset + keyword search
    await wrapper.get('[data-testid="appt-preset-today"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="appt-search-input"]').setValue('13900001111')
    await wrapper.get('[data-testid="appt-search-btn"]').trigger('click')
    await flushPromises()

    const lastListCall = String(apiGet.mock.calls.filter(c => String(c[0]).startsWith('/admin/appointments?')).at(-1)?.[0])
    expect(lastListCall).toContain('visitDate=')
    expect(lastListCall).toContain('keyword=13900001111')

    // Export today CSV
    await wrapper.get('[data-testid="admin-appointments-export-today"]').trigger('click')
    await flushPromises()
    expect(downloadAdminCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^\/admin\/appointments\/export\?visitDate=\d{4}-\d{2}-\d{2}$/),
      'admin-token',
      expect.stringMatching(/^heluo-appointments-\d{4}-\d{2}-\d{2}\.csv$/),
    )
  })
})
