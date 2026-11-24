import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RakingLightViewer from './RakingLightViewer.vue'

describe('RakingLightViewer optical stage', () => {
  it('gracefully falls back when WebGL is unavailable, supports loupe and ink-rubbing mode, and emits user-interact', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    })

    const wrapper = mount(RakingLightViewer, {
      props: {
        imageUrl: '/media/editorial/explore-river-map-stone-user-v2.webp',
        alt: '河洛图纹石板 · 斜射光刻痕检视',
      },
    })
    await flushPromises()

    expect(wrapper.emitted('state-change')?.at(-1)).toEqual(['ready'])
    expect(wrapper.find('[data-testid="raking-light-viewer"]').exists()).toBe(true)
    expect(wrapper.get('.raking-telemetry').text()).toContain('034°')
    expect(wrapper.get('.raking-telemetry').text()).toContain('14°')

    // Toggle 2.4x optical loupe
    await wrapper.get('[data-testid="raking-loupe-toggle"]').trigger('click')
    expect(wrapper.emitted('user-interact')).toBeTruthy()
    expect(wrapper.get('[data-testid="raking-loupe-toggle"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.classes()).toContain('is-loupe')

    // Programmatic controller methods (ink-rubbing relief + light angle preset)
    const vm = wrapper.vm as unknown as {
      setMode: (mode: 'solid' | 'points') => void
      setView: (view: 'front' | 'left' | 'right' | 'back' | 'top') => void
      rotate: () => void
    }
    vm.setMode('points')
    await flushPromises()
    expect(wrapper.classes()).toContain('is-rubbing')
    expect(wrapper.emitted('mode-change')?.at(-1)).toEqual(['points'])

    vm.setView('top')
    await flushPromises()
    expect(wrapper.get('.raking-telemetry').text()).toContain('090°')
    expect(wrapper.get('.raking-telemetry').text()).toContain('62°')

    wrapper.unmount()
  })
})
