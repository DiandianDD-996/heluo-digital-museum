import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LuoshengSiteGuide from './LuoshengSiteGuide.vue'
import { useLuoshengStore } from '../stores/luoshengStore'
import { useLocale } from '../stores/locale'

function makeSseResponse(events: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  })
}

describe('LuoshengSiteGuide v2', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    window.sessionStorage.clear()
    setActivePinia(createPinia())
    const { locale } = useLocale()
    locale.value = 'zh-CN'
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div />' } },
        { path: '/exhibits/:slug', name: 'exhibit-detail', component: { template: '<div />' } },
        { path: '/artifacts/:slug', name: 'artifact-detail', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
  })

  it('streams multi-turn replies, preserves history across close/reopen, queues 3D action, and supports clear', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse([
      'event:delta\ndata:{"text":"侧面看只有两条腿，是因为第三只足被挡住了。"}\n\n',
      'event:done\ndata:{"requestId":"r1","text":"侧面看只有两条腿，是因为第三只足被挡住了。","citations":[{"id":"LS-DING-FEET","title":"已签核证据 · LS-DING-FEET","revision":"v2","internalPath":"/exhibits/heluo-bronze-ding-3d","publicSourceUrl":null,"boundaryNote":"遮挡不代表缺损。"}],"actions":[{"type":"viewer_focus","exhibitSlug":"heluo-bronze-ding-3d","part":"feet","view":"back","mode":"solid","label":"在 3D 展柜切到背面看三足"}],"followUps":["顶上立耳能提吗？"],"boundaryNote":"遮挡不代表缺损。","mode":"ai","degraded":false}\n\n',
    ])))

    const wrapper = mount(LuoshengSiteGuide, {
      global: { plugins: [router] },
    })

    // Open drawer
    await wrapper.get('[data-testid="luosheng-fab"]').trigger('click')
    expect(wrapper.find('[data-testid="luosheng-drawer"]').exists()).toBe(true)

    // Ask question
    await wrapper.get('[data-testid="luosheng-input"]').setValue('侧面为什么只有两条腿？')
    await wrapper.get('form.luosheng-composer').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('侧面看只有两条腿，是因为第三只足被挡住了。')
    expect(wrapper.get('[data-testid="luosheng-mode-badge"]').text()).toBe('AI 讲解')

    // Close and reopen — history MUST NOT be cleared!
    await wrapper.get('[data-testid="luosheng-close"]').trigger('click')
    expect(wrapper.find('[data-testid="luosheng-drawer"]').exists()).toBe(false)
    await wrapper.get('[data-testid="luosheng-fab"]').trigger('click')
    expect(wrapper.text()).toContain('侧面看只有两条腿，是因为第三只足被挡住了。')

    // Clicking 3D focus action queues pendingViewerAction & navigates to exhibit page
    const store = useLuoshengStore()
    await wrapper.get('[data-action-type="viewer_focus"]').trigger('click')
    await flushPromises()
    expect(store.pendingViewerAction?.exhibitSlug).toBe('heluo-bronze-ding-3d')
    expect(store.pendingViewerAction?.part).toBe('feet')
    expect(router.currentRoute.value.path).toBe('/exhibits/heluo-bronze-ding-3d')

    // Clear conversation resets messages
    await wrapper.get('[data-testid="luosheng-clear"]').trigger('click')
    expect(store.messages).toHaveLength(0)
    wrapper.unmount()
  })

  it('renders bilingual English UI cleanly when locale is en-US (D1)', async () => {
    const { locale } = useLocale()
    locale.value = 'en-US'
    const wrapper = mount(LuoshengSiteGuide, {
      global: { plugins: [router] },
    })

    expect(wrapper.get('[data-testid="luosheng-fab"]').text()).toContain('Luosheng')
    await wrapper.get('[data-testid="luosheng-fab"]').trigger('click')
    expect(wrapper.get('[data-testid="luosheng-drawer"]').text()).toContain('Curatorial Guide')
    wrapper.unmount()
  })
})
