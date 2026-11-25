import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPrefetchCache, readPrefetchCache, schedulePrefetch, writePrefetchCache } from './prefetch'
import { artifactPlateTransitionStyle, isActiveArtifactPlate, markActiveArtifactPlate } from './inkTransitions'
import ArtifactLoupeStage from '../components/ArtifactLoupeStage.vue'
import PlainTextLinks from '../components/PlainTextLinks.vue'

const RouterLinkStub = defineComponent({
  props: ['to'],
  setup: (props, { slots }) => () => h('a', { href: String(props.to) }, slots.default?.()),
})

describe('Phase 4 curatorial flow: prefetch LRU, shared-element plate, optical loupe & inline previews', () => {
  afterEach(() => {
    clearPrefetchCache()
    markActiveArtifactPlate(null)
    vi.useRealTimers()
  })

  it('debounces hover prefetch by 120ms and reuses LRU cached responses', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockResolvedValue({ slug: 'heluo-bronze-ding', title: '河洛青铜鼎' })
    const cancel = schedulePrefetch('/artifacts/heluo-bronze-ding', fetcher, { delayMs: 120 })
    vi.advanceTimersByTime(60)
    expect(fetcher).not.toHaveBeenCalled()
    cancel()
    vi.advanceTimersByTime(200)
    expect(fetcher).not.toHaveBeenCalled()

    schedulePrefetch('/artifacts/heluo-bronze-ding', fetcher, { delayMs: 120 })
    await vi.advanceTimersByTimeAsync(130)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(readPrefetchCache<{ slug: string }>('/artifacts/heluo-bronze-ding')?.slug).toBe('heluo-bronze-ding')

    writePrefetchCache('/artifacts/expired', { ok: true }, -1)
    expect(readPrefetchCache('/artifacts/expired')).toBeUndefined()
  })

  it('marks only one active artifact plate for View Transitions and clears cleanly', () => {
    expect(isActiveArtifactPlate('heluo-bronze-ding')).toBe(false)
    markActiveArtifactPlate('heluo-bronze-ding')
    expect(isActiveArtifactPlate('heluo-bronze-ding')).toBe(true)
    expect(isActiveArtifactPlate('river-map-jade-bi')).toBe(false)
    expect(artifactPlateTransitionStyle('heluo-bronze-ding')).toEqual({ viewTransitionName: 'active-artifact-plate' })
    expect(artifactPlateTransitionStyle('river-map-jade-bi')).toBeUndefined()
    markActiveArtifactPlate(null)
    expect(isActiveArtifactPlate('heluo-bronze-ding')).toBe(false)
  })

  it('opens fullscreen darkroom zoom in ArtifactLoupeStage and closes on Escape', async () => {
    const wrapper = mount(ArtifactLoupeStage, {
      props: { src: '/media/editorial/explore-jade-bi-user-v2.webp', alt: '河图玉璧' },
      global: { stubs: { Teleport: true } },
    })

    expect(wrapper.find('[data-testid="artifact-loupe-lightbox"]').exists()).toBe(false)
    await wrapper.get('[data-testid="artifact-fullscreen-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="artifact-loupe-lightbox"]').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="artifact-loupe-lightbox"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders hover miniature plaque preview cards for cross-referenced artifacts in PlainTextLinks', () => {
    const wrapper = mount(PlainTextLinks, {
      props: {
        text: '可与河图玉璧及三足青铜爵并置观察。',
        enableArtifactPreview: true,
        excludeSlug: 'heluo-bronze-ding',
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    const refs = wrapper.findAll('.inline-artifact-ref')
    expect(refs).toHaveLength(2)
    expect(wrapper.findAll('.inline-artifact-preview img')).toHaveLength(2)
  })
})
