import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import LuoshengPreset from './LuoshengPreset.vue'
import { useLocale } from '../stores/locale'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ apiGet: get }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/' }), useRouter: () => ({}) }))
vi.mock('../stores/luoshengStore', () => ({ useLuoshengStore: () => ({ pendingPlateAction: null }) }))
const pack = (text: string) => ({ available: true, entries: [{ cardId: 'LS-DING-EARS', text }] })
const { locale } = useLocale()
const render = () => mount(LuoshengPreset, { props: { exhibitSlug: 'ding' }, global: {
  stubs: { LuoshengApprovedFigure: { props: ['caption'], template: '<p>{{ caption }}</p>' } },
} })
afterEach(() => { locale.value = 'zh-CN'; get.mockReset() })

it('clears loaded Chinese text when an English request fails', async () => {
  get.mockResolvedValueOnce(pack('中文证据')).mockRejectedValueOnce(new Error('offline'))
  const view = render()
  await flushPromises()
  expect(view.text()).toContain('中文证据')
  locale.value = 'en-US'
  await flushPromises()
  expect(view.text()).toContain('Viewed from above')
  expect(view.text()).not.toContain('中文证据')
  view.unmount()
})

it('ignores a late Chinese response after the English request completes', async () => {
  let finish!: (result: ReturnType<typeof pack>) => void
  get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(pack('English evidence'))
  const view = render()
  locale.value = 'en-US'
  await nextTick()
  await flushPromises()
  finish(pack('迟到的中文'))
  await flushPromises()
  expect(view.text()).toContain('English evidence')
  expect(view.text()).not.toContain('迟到的中文')
  view.unmount()
})
