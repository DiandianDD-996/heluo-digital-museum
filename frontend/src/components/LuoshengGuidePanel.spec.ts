import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const PATH = '/artifacts/test-exhibit'

async function setup(reply: unknown = { kind: 'CLARIFY', citations: [] }) {
  vi.stubEnv('VITE_GUIDE_SITE_ENABLED', 'true')
  vi.stubEnv('VITE_GUIDE_TURNS_ENABLED', 'true')
  const fetched: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input)
    fetched.push(url)
    if (reply === 'HANG') return new Promise<Response>(() => {})
    const data = url.includes('/search?') ? { items: [] }
      : url.includes('/appointment-slots?') ? [] : reply
    return new Response(JSON.stringify({ code: 'OK', data }), { headers: { 'Content-Type': 'application/json' } })
  }))
  const { useLuoshengVisit } = await import('../stores/luoshengVisit')
  const { default: Panel } = await import('./LuoshengSiteGuide.vue')
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: PATH, name: 'artifact-detail', component: { template: '<main />' } },
      ...['explore', 'exhibits', 'appointment', 'shop'].map(name => ({
        path: '/' + name, name, component: { template: '<main />' },
      })),
    ],
  })
  await router.push(PATH)
  const visit = useLuoshengVisit(pinia)
  // The lexicon keys exhibits by their 3D slug, so suggestions resolve for a real entry.
  visit.object = { path: PATH, slug: 'test-exhibit', exhibit: 'heluo-bronze-ding-3d', title: '测试展品', summary: '测试摘要' }
  const panel = mount(Panel, { global: { plugins: [pinia, router] } })
  await panel.get('.site-guide-trigger').trigger('click')
  return { panel, visit, fetched }
}

describe('洛笙面板的易用性', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('空态显示三条来自词表的建议问题', async () => {
    const { panel } = await setup()
    const labels = panel.findAll('.site-guide-prompts button').map(button => button.text())
      .filter(text => !['更多', '收起', '我先自己逛'].includes(text) && !text.startsWith('再看'))
    // No confirmed part yet, so exhibit-wide questions lead and no part is presumed.
    expect(labels[0]).toBe('这件鼎参考的是哪件藏品？')
    expect(labels).toHaveLength(3)
    panel.unmount()
  })

  it('没有档案的展品不会凭空给建议', async () => {
    const { panel, visit } = await setup()
    visit.object = { path: PATH, slug: 'test-exhibit', exhibit: 'unknown-3d', title: '测试展品', summary: '测试摘要' }
    await flushPromises()
    const suggestions = panel.findAll('.site-guide-prompts button').map(button => button.text())
      .filter(text => !['更多', '我先自己逛'].includes(text) && !text.startsWith('再看'))
    expect(suggestions).toEqual([])
    panel.unmount()
  })

  it('澄清回复给出可点击的部位按钮，点击后按该部位提问', async () => {
    const { panel, fetched } = await setup()
    await panel.get('.site-guide-form input').setValue('它是什么年代的？')
    await panel.get('.site-guide-form').trigger('submit')
    await vi.waitFor(() => expect(panel.find('.site-guide-clarify').exists()).toBe(true))
    const options = panel.findAll('.site-guide-clarify button')
    expect(options.map(option => option.text())).toEqual(['鼎耳', '三足', '纹样'])
    const before = fetched.filter(url => url.endsWith('/guide/turns')).length
    await options[1]!.trigger('click')
    await flushPromises()
    expect(fetched.filter(url => url.endsWith('/guide/turns')).length).toBe(before + 1)
    panel.unmount()
  })

  it('缺证回复说明现有资料不能确认，而不是留白', async () => {
    const { panel } = await setup({ kind: 'INSUFFICIENT_EVIDENCE', text: null, citations: [] })
    await panel.get('.site-guide-form input').setValue('它以前断过吗？')
    await panel.get('.site-guide-form').trigger('submit')
    await vi.waitFor(() => expect(panel.find('.site-guide-insufficient').exists()).toBe(true))
    expect(panel.find('.site-guide-insufficient').text()).toContain('还不能确认')
    panel.unmount()
  })

  it('进度提示只在等待超过两秒后出现', async () => {
    // Only the timer is faked; promises and dynamic imports stay real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { panel } = await setup('HANG')
    await panel.get('.site-guide-form input').setValue('它是什么年代的？')
    await panel.get('.site-guide-form').trigger('submit')
    for (let tick = 0; tick < 20; tick++) await Promise.resolve()
    await flushPromises()
    expect(panel.find('.site-guide-progress').exists()).toBe(false)
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(panel.find('.site-guide-progress').text()).toBe('正在核对资料…')
    panel.unmount()
  })
})
