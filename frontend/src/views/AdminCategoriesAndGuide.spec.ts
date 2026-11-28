import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

import AdminCategoriesView from './AdminCategoriesView.vue'
import AdminGuideView from './AdminGuideView.vue'

function makeRouter(component: any, path: string) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/admin', component: { template: '<div>Dashboard</div>' } },
      { path: '/login', component: { template: '<div>Login</div>' } },
    ],
  })
}

beforeEach(() => {
  apiGet.mockReset()
  apiRequest.mockReset().mockResolvedValue({})
})

describe('AdminCategoriesView & AdminGuideView', () => {
  it('lists categories and creates a new curatorial category', async () => {
    apiGet.mockResolvedValue([
      { id: 1, code: 'BRONZE', name: '青铜礼器', nameEn: 'Ritual Bronzes', description: '青铜', sortOrder: 10, enabled: true },
    ])
    const router = makeRouter(AdminCategoriesView, '/admin/categories')
    await router.push('/admin/categories')
    await router.isReady()

    const wrapper = mount(AdminCategoriesView, {
      global: {
        plugins: [router],
        stubs: {
          AdminShell: { template: '<div><slot name="header-actions"/><slot/></div>' },
          FluidButton: { props: ['type', 'disabled', 'loading'], template: '<button :type="type || \'button\'" :disabled="disabled || loading"><slot/></button>' },
          AdminActionButton: { template: '<button type="button"><slot/></button>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('青铜礼器')
    await wrapper.get('[data-testid="admin-create-category-btn"]').trigger('click')
    await flushPromises()

    const form = wrapper.get('[data-testid="admin-category-drawer"] form')
    const inputs = form.findAll('input')
    await inputs[0]!.setValue('POTTERY')
    await inputs[1]!.setValue('40')
    await inputs[2]!.setValue('彩陶意象')
    await inputs[3]!.setValue('Painted Pottery')
    await form.trigger('submit')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/categories',
      'POST',
      expect.objectContaining({ code: 'POTTERY', name: '彩陶意象', nameEn: 'Painted Pottery', sortOrder: 40, enabled: true }),
      'admin-token',
    )
  })

  it('governs Luosheng runtime mode and invalidates knowledge cache on dedicated guide page', async () => {
    const overview = {
      enabled: true,
      modelEnabled: true,
      usedToday: 18,
      dailyLimit: 200,
      inFlight: 1,
      degradationCount: 2,
      redlineBlockCount: 1,
      runtimeMode: 'NORMAL',
      paused: false,
      filePaused: false,
    }
    apiGet.mockResolvedValue(overview)
    apiRequest.mockResolvedValue({ ...overview, runtimeMode: 'DETERMINISTIC' })

    const router = makeRouter(AdminGuideView, '/admin/guide')
    await router.push('/admin/guide')
    await router.isReady()

    const wrapper = mount(AdminGuideView, {
      global: {
        plugins: [router],
        stubs: {
          AdminShell: { template: '<div><slot name="header-actions"/><slot/></div>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('18 / 200')
    await wrapper.get('[data-testid="guide-page-mode-deterministic"]').trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/admin/guide/runtime-mode', 'POST', { mode: 'DETERMINISTIC' }, 'admin-token')

    await wrapper.get('[data-testid="guide-page-cache-invalidate"]').trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/admin/guide/cache/invalidate', 'POST', undefined, 'admin-token')
  })
})
