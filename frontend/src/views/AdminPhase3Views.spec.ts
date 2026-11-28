import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

const apiGet = vi.hoisted(() => vi.fn())
const apiRequest = vi.hoisted(() => vi.fn())
const downloadAdminCsv = vi.hoisted(() => vi.fn(async () => 'heluo-orders-2026-11-28.csv'))
const refreshAdminNavCounts = vi.hoisted(() => vi.fn(async () => {}))
const toggleTheme = vi.hoisted(() => vi.fn())
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
  useAdminNavCounts: () => ({
    counts: { pendingOrders: 3, lowStockProducts: 2, pendingAppointments: 1, guideReviewNeeded: 0 },
    refresh: refreshAdminNavCounts,
    updateFrom: vi.fn(),
  }),
}))
vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('../stores/theme', () => ({
  useTheme: () => ({ isDark: { value: false }, toggleTheme }),
}))

import AdminCommandPalette from '../components/AdminCommandPalette.vue'
import AdminExhibitsView from './AdminExhibitsView.vue'
import AdminProductsView from './AdminProductsView.vue'
import AdminOrdersView from './AdminOrdersView.vue'
import AdminLogsView from './AdminLogsView.vue'
import AdminUsersView from './AdminUsersView.vue'

const wrappers: VueWrapper[] = []

async function mountRoute(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', component: { template: '<div>Dashboard</div>' } },
      { path: '/admin/exhibits', component: AdminExhibitsView },
      { path: '/admin/products', component: AdminProductsView },
      { path: '/admin/orders', component: AdminOrdersView },
      { path: '/admin/logs', component: AdminLogsView },
      { path: '/admin/users', component: AdminUsersView },
      { path: '/admin/slots', component: { template: '<div>Slots</div>' } },
      { path: '/admin/appointments', component: { template: '<div>Appointments</div>' } },
      { path: '/admin/articles', component: { template: '<div>Articles</div>' } },
      { path: '/admin/artifacts', component: { template: '<div>Artifacts</div>' } },
      { path: '/admin/categories', component: { template: '<div>Categories</div>' } },
      { path: '/admin/guide', component: { template: '<div>Guide</div>' } },
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

describe('Admin 2.0 Phase 3 specialized views and command palette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    apiRequest.mockResolvedValue({})
  })

  afterEach(() => {
    while (wrappers.length > 0) {
      wrappers.pop()?.unmount()
    }
    vi.restoreAllMocks()
  })

  it('opens command palette via Ctrl+K, filters commands, jumps on Enter, and closes on Escape', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin', component: { template: '<div>Dashboard</div>' } },
        { path: '/admin/orders', component: { template: '<div>Orders</div>' } },
        { path: '/admin/products', component: { template: '<div>Products</div>' } },
        { path: '/admin/slots', component: { template: '<div>Slots</div>' } },
        { path: '/admin/appointments', component: { template: '<div>Appointments</div>' } },
        { path: '/admin/articles', component: { template: '<div>Articles</div>' } },
        { path: '/admin/artifacts', component: { template: '<div>Artifacts</div>' } },
        { path: '/admin/exhibits', component: { template: '<div>Exhibits</div>' } },
        { path: '/admin/categories', component: { template: '<div>Categories</div>' } },
        { path: '/admin/guide', component: { template: '<div>Guide</div>' } },
        { path: '/admin/users', component: { template: '<div>Users</div>' } },
        { path: '/admin/logs', component: { template: '<div>Logs</div>' } },
      ],
    })
    await router.push('/admin')
    await router.isReady()

    const wrapper = mount(AdminCommandPalette, {
      attachTo: document.body,
      props: {
        open: false,
        'onUpdate:open': (val: boolean) => {
          void wrapper.setProps({ open: val })
        },
      },
      global: { plugins: [router] },
    })
    wrappers.push(wrapper)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="admin-command-palette"]').exists()).toBe(true)

    await wrapper.find('[data-testid="admin-command-input"]').setValue('订单')
    await flushPromises()
    await wrapper.find('[data-testid="admin-command-palette"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/admin/orders')
    expect(wrapper.find('[data-testid="admin-command-palette"]').exists()).toBe(false)

    await wrapper.setProps({ open: true })
    await flushPromises()
    await wrapper.find('[data-testid="admin-command-palette"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('[data-testid="admin-command-palette"]').exists()).toBe(false)
  })

  it('supports exhibits server search and bilingual drawer PATCH', async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/admin/exhibits')) {
        return {
          items: [
            {
              id: 21,
              artifactId: 5,
              artifactTitle: '莲鹤方壶',
              artifactPublished: true,
              title: '莲鹤方壶 3D 点云',
              slug: 'lotus-crane-3d',
              displayNo: '3D-01',
              summary: '青铜铸造',
              description: '三维扫描模型',
              modelUrl: '/models/lotus.glb',
              modelSourceRef: 'heluo-scan-01',
              modelFormat: 'GLB',
              modelSizeBytes: 204800,
              mobileModelUrl: '',
              mobileModelSizeBytes: null,
              coverImageUrl: '/images/lotus.webp',
              coverAssetRef: 'lotus-cover',
              sourceCredit: '河南博物院数字馆藏',
              sourceUrl: 'https://example.org',
              licenseLabel: 'CC BY-NC 4.0',
              collectionLocation: '二号青铜厅',
              status: 'PUBLISHED',
              deleted: false,
              titleEn: '',
              summaryEn: '',
              descriptionEn: '',
            },
          ],
          total: 1,
          totalPages: 1,
        }
      }
      if (path.startsWith('/admin/artifacts')) {
        return { items: [{ id: 5, title: '莲鹤方壶', slug: 'lotus-crane' }] }
      }
      return {}
    })

    const { wrapper } = await mountRoute('/admin/exhibits')
    await wrapper.find('[data-testid="exhibits-search-input"]').setValue('莲鹤')
    await wrapper.find('[data-testid="exhibits-search-btn"]').trigger('click')
    await flushPromises()

    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('/admin/exhibits?'), 'admin-token', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('keyword=%E8%8E%B2%E9%B9%A4'), 'admin-token', expect.objectContaining({ signal: expect.any(AbortSignal) }))

    await wrapper.find('[data-testid="exhibit-edit-21"]').trigger('click')
    await flushPromises()
    const drawer = wrapper.find('[data-testid="admin-exhibit-drawer"]')
    expect(drawer.exists()).toBe(true)

    const enTitleLabel = drawer.findAll('label').find((label) => label.text().includes('展项英文名称'))
    await enTitleLabel!.find('input').setValue('Lotus and Crane Vessel 3D')
    await drawer.find('form').trigger('submit')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/exhibits/21',
      'PATCH',
      expect.objectContaining({ titleEn: 'Lotus and Crane Vessel 3D', modelFormat: 'GLB' }),
      'admin-token',
    )
  })

  it('supports products lowStock filter, inline +10 restock, and provenance metadata PATCH', async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/admin/products')) {
        return {
          items: [
            {
              id: 31,
              sku: 'HL-LOTUS-01',
              name: '青铜爵纹胸针',
              slug: 'jue-brooch',
              price: '88.00',
              stockQuantity: 4,
              lockedStock: 1,
              coverImageUrl: '/images/brooch.webp',
              summary: '馆藏纹样文创',
              description: '铜镀金工艺',
              status: 'PUBLISHED',
              deleted: false,
              nameEn: 'Bronze Jue Brooch',
              summaryEn: 'Curated lapel pin',
              descriptionEn: '',
              categoryCode: 'accessories',
              inspirationArtifactSlug: 'bronze-jue',
            },
          ],
          total: 1,
          totalPages: 1,
        }
      }
      if (path.startsWith('/admin/artifacts')) {
        return { items: [{ id: 8, title: '乳钉纹青铜爵', slug: 'bronze-jue' }] }
      }
      return {}
    })

    const { wrapper } = await mountRoute('/admin/products')
    await wrapper.find('[data-testid="products-low-stock-tab"]').trigger('click')
    await flushPromises()
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('lowStock=true'), 'admin-token', expect.objectContaining({ signal: expect.any(AbortSignal) }))

    await wrapper.find('[data-testid="product-restock-trigger-31"]').trigger('click')
    await wrapper.find('[data-testid="product-restock-plus10-31"]').trigger('click')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/admin/products/31/stock', 'PATCH', { stockQuantity: 14 }, 'admin-token')

    await wrapper.find('[data-testid="product-edit-31"]').trigger('click')
    await flushPromises()
    const drawer = wrapper.find('[data-testid="admin-product-drawer"]')
    await drawer.find('form').trigger('submit')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/products/31',
      'PATCH',
      expect.objectContaining({ sku: 'HL-LOTUS-01', inspirationArtifactSlug: 'bronze-jue' }),
      'admin-token',
    )
  })

  it('opens order detail timeline drawer, completes PAID orders, and exports filtered CSV', async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === '/admin/orders/41') {
        return {
          id: 41,
          orderNo: 'ORD-20261128-0041',
          userId: 9,
          username: 'visitor_a',
          userNickname: '河洛游客',
          status: 'PAID',
          totalAmount: '128.00',
          payableAmount: '128.00',
          notificationEmail: 'visitor@example.com',
          cancelReason: null,
          expiresAt: '2026-11-28T09:00:00',
          createdAt: '2026-11-28T08:00:00',
          paidAt: '2026-11-28T08:02:00',
          completedAt: null,
          cancelledAt: null,
          paymentNo: 'MOCK-PAY-41',
          items: [
            {
              productId: 31,
              sku: 'HL-LOTUS-01',
              name: '青铜爵纹胸针',
              coverImageUrl: '/images/brooch.webp',
              unitPrice: '64.00',
              quantity: 2,
              subtotalAmount: '128.00',
            },
          ],
        }
      }
      return {
        items: [
          {
            id: 41,
            orderNo: 'ORD-20261128-0041',
            userId: 9,
            status: 'PAID',
            totalAmount: '128.00',
            payableAmount: '128.00',
            notificationEmail: 'visitor@example.com',
            createdAt: '2026-11-28T08:00:00',
          },
        ],
        total: 1,
        totalPages: 1,
      }
    })

    const { wrapper } = await mountRoute('/admin/orders')
    await wrapper.find('[data-testid="order-detail-btn-41"]').trigger('click')
    await flushPromises()

    const drawer = wrapper.find('[data-testid="admin-order-detail-drawer"]')
    expect(drawer.exists()).toBe(true)
    expect(drawer.text()).toContain('MOCK-PAY-41')
    expect(drawer.text()).toContain('青铜爵纹胸针')

    await wrapper.find('[data-testid="admin-orders-export"]').trigger('click')
    await flushPromises()
    expect(downloadAdminCsv).toHaveBeenCalledWith('/admin/orders/export', 'admin-token', 'heluo-orders.csv')

    const completeBtn = drawer.findAll('button').find((btn) => btn.text().includes('标记该订单已完成'))
    await completeBtn?.trigger('click')
    await flushPromises()

    const confirmBtn = document.body.querySelector('[data-confirm-primary]') as HTMLButtonElement | null
    confirmBtn?.click()
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/admin/orders/41/complete', 'POST', undefined, 'admin-token')
  })

  it('filters audit logs by module and manages viewer accounts safely', async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/admin/operation-logs')) {
        return {
          items: [
            {
              id: 88,
              actorUserId: 1,
              actorUsername: 'admin_qa',
              module: 'ORDER',
              action: 'COMPLETE_ORDER',
              targetType: 'ORDER',
              targetId: '41',
              createdAt: '2026-11-28T08:15:00',
            },
          ],
          total: 1,
          totalPages: 1,
        }
      }
      if (path.startsWith('/admin/users')) {
        return {
          items: [
            {
              id: 51,
              username: 'luoyang_fan',
              nickname: '洛水游人',
              email: 'fan@example.com',
              phone: '13800001111',
              status: 'ACTIVE',
              roles: ['USER'],
              createdAt: '2026-11-28T07:00:00',
            },
          ],
          total: 1,
          totalPages: 1,
        }
      }
      return {}
    })

    const logsCtx = await mountRoute('/admin/logs')
    await logsCtx.wrapper.find('[data-testid="logs-module-switch"]').findAll('button')[4].trigger('click')
    await flushPromises()
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('module=ORDER'), 'admin-token', expect.objectContaining({ signal: expect.any(AbortSignal) }))

    const usersCtx = await mountRoute('/admin/users')
    await usersCtx.wrapper.find('[data-testid="users-search-input"]').setValue('luoyang')
    await usersCtx.wrapper.find('[data-testid="users-search-btn"]').trigger('click')
    await flushPromises()
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('keyword=luoyang'), 'admin-token', expect.objectContaining({ signal: expect.any(AbortSignal) }))

    const disableBtn = usersCtx.wrapper.find('[data-testid="users-table"]').findAll('button').find((b) => b.text().includes('禁用'))
    await disableBtn?.trigger('click')
    await flushPromises()
    const confirmBtn = document.body.querySelector('[data-confirm-primary]') as HTMLButtonElement | null
    confirmBtn?.click()
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/admin/users/51/status', 'PATCH', { status: 'DISABLED' }, 'admin-token')
  })
})
