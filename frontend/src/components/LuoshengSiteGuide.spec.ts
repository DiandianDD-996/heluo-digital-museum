import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LuoshengSiteGuide from './LuoshengSiteGuide.vue'
import { useLuoshengStore } from '../stores/luoshengStore'
import { useLocale } from '../stores/locale'
import { audioSystem } from '../lib/audioSystem'

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

  it('ducks music softly when drawer opens, deepens while streaming, and releases on close or unmount', async () => {
    const duckSpy = vi.spyOn(audioSystem, 'setFocusDuck')
    let resolveFetch!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })))

    const wrapper = mount(LuoshengSiteGuide, {
      global: { plugins: [router] },
    })

    // Opening drawer ducks to 0.72
    await wrapper.get('[data-testid="luosheng-fab"]').trigger('click')
    await flushPromises()
    expect(duckSpy).toHaveBeenLastCalledWith('luosheng', true, 0.72)

    // Streaming drops deeper to 0.62
    await wrapper.get('[data-testid="luosheng-input"]').setValue('介绍青铜鼎')
    await wrapper.get('form.luosheng-composer').trigger('submit')
    await flushPromises()
    expect(duckSpy).toHaveBeenCalledWith('luosheng', true, 0.62)

    // Finish stream -> returns to 0.72 while open
    resolveFetch(makeSseResponse([
      'event:done\ndata:{"requestId":"r2","text":"青铜鼎是礼器。","citations":[],"actions":[],"followUps":[],"boundaryNote":"","mode":"ai","degraded":false}\n\n',
    ]))
    await flushPromises()
    expect(duckSpy).toHaveBeenLastCalledWith('luosheng', true, 0.72)

    // Closing drawer releases duck
    await wrapper.get('[data-testid="luosheng-close"]').trigger('click')
    await flushPromises()
    expect(duckSpy).toHaveBeenLastCalledWith('luosheng', false)

    // Unmounting while open also releases duck cleanly
    await wrapper.get('[data-testid="luosheng-fab"]').trigger('click')
    await flushPromises()
    wrapper.unmount()
    expect(duckSpy).toHaveBeenLastCalledWith('luosheng', false)
  })

  it('renders bold and list formatting safely and queues viewer_tour action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeSseResponse([
        'event:done\ndata:{"requestId":"r3","text":"建议按这三步看：**先看双耳**\\n- 第一步：俯视口沿\\n- 第二步：看器腹宽线","citations":[],"actions":[{"type":"viewer_tour","exhibitSlug":"heluo-bronze-ding-3d","label":"开启 3D 三步导览"}],"followUps":[],"boundaryNote":"","mode":"ai","degraded":false}\n\n',
      ]),
    ))

    const wrapper = mount(LuoshengSiteGuide, {
      global: { plugins: [router] },
    })

    await wrapper.get('[data-testid="luosheng-fab"]').trigger('click')
    await wrapper.get('[data-testid="luosheng-input"]').setValue('带我逛青铜鼎')
    await wrapper.get('form.luosheng-composer').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.luosheng-bubble strong').text()).toBe('先看双耳')
    expect(wrapper.findAll('.luosheng-list li')).toHaveLength(2)

    const store = useLuoshengStore()
    await wrapper.get('[data-action-type="viewer_tour"]').trigger('click')
    await flushPromises()
    expect(store.pendingViewerAction?.exhibitSlug).toBe('heluo-bronze-ding-3d')
    expect(store.pendingViewerAction?.tour).toBe(true)
    expect(router.currentRoute.value.path).toBe('/exhibits/heluo-bronze-ding-3d')
    wrapper.unmount()
  })

  it('surfaces a clickable quick-ask capsule on cross-page dividers and balances unclosed ** mid-stream without flicker', async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeSseResponse([
        'event:done\ndata:{"requestId":"r4","text":"你好，我是洛笙。","citations":[],"actions":[],"followUps":[],"boundaryNote":"","mode":"ai","degraded":false}\n\n',
      ]))
      .mockImplementationOnce(() => Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(ctrl) { streamController = ctrl },
      }), { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }))))

    const wrapper = mount(LuoshengSiteGuide, { global: { plugins: [router] } })
    const store = useLuoshengStore()
    await wrapper.get('[data-testid="luosheng-fab"]').trigger('click')
    await wrapper.get('[data-testid="luosheng-input"]').setValue('你好')
    await wrapper.get('form.luosheng-composer').trigger('submit')
    await flushPromises()

    // Switch page context -> inserts divider with quick-ask capsule
    store.setPageContext({
      route: 'artifact-detail',
      path: '/artifacts/river-map-jade-bi',
      title: '河图玉璧（概念展品）',
      artifactSlug: 'river-map-jade-bi',
      exhibitSlug: null,
      articleSlug: null,
    })
    await flushPromises()

    const dividerStarter = wrapper.get('[data-testid="luosheng-divider-starter"]')
    expect(dividerStarter.text()).toContain('这件展品最值得看哪些细节？')

    // Click the divider quick-ask capsule -> starts streaming without raw ** flicker
    await dividerStarter.trigger('click')
    await flushPromises()

    streamController.enqueue(encoder.encode('event:delta\ndata:{"text":"先看外缘与**中央穿孔"}\n\n'))
    await flushPromises()
    expect(wrapper.find('.luosheng-bubble strong').text()).toBe('中央穿孔')
    expect(wrapper.text()).not.toContain('**')

    streamController.enqueue(encoder.encode('event:done\ndata:{"requestId":"r5","text":"先看外缘与**中央穿孔**的留白。","citations":[],"actions":[],"followUps":[],"boundaryNote":"","mode":"ai","degraded":false}\n\n'))
    streamController.close()
    await flushPromises()

    expect(wrapper.find('[data-testid="luosheng-divider-starter"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('先看外缘与中央穿孔的留白。')
    wrapper.unmount()
  })
})
