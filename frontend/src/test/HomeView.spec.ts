import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import HomeView from '../views/HomeView.vue'

const RouterLinkStub = defineComponent({
  props: ['to'],
  setup: (props, { slots }) => () => h('a', { 'data-to': props.to }, slots.default?.()),
})

describe('HomeView', () => {
  it('shows the museum value proposition', () => {
    const pointerSurfaceMounted = vi.fn()
    const wrapper = mount(HomeView, {
      global: {
        directives: { pointerSurface: { mounted: pointerSurfaceMounted } },
        stubs: { RouterLink: RouterLinkStub, ElButton: true, PointerDotField: true },
      },
    })

    expect(wrapper.text()).toContain('从一件器物，走进河洛文明')
    expect(wrapper.text()).toContain('先在线近看一件青铜')
    expect(wrapper.text()).toContain('一鼎之间')
    expect(wrapper.text()).toContain('沿着河流阅读文明')
    expect(wrapper.find('.home-themes').exists()).toBe(true)
    expect(pointerSurfaceMounted).not.toHaveBeenCalled()
  })

  it('keeps the primary exploration and visitor-route destinations available', () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: { RouterLink: RouterLinkStub, ElButton: true, PointerDotField: true },
      },
    })

    expect(wrapper.get('.home-primary').attributes('data-to')).toBe('/explore')
    expect(wrapper.get('.home-cover__actions').attributes('data-motion')).toBe('intro-cta')
    expect(wrapper.get('.home-primary').text()).toContain('探索馆藏')

    const routes = wrapper.findAll('.home-cover a')
    expect(routes.map(route => route.attributes('data-to'))).toEqual(['/explore', '/exhibits', '/appointment'])
    expect(wrapper.get('.home-closeup a').attributes('data-to')).toBe('/artifacts/heluo-bronze-ding')
    expect(wrapper.findAll('.home-theme')).toHaveLength(3)
    expect(wrapper.findAll('.home-theme img').every(image => image.attributes('alt') === '')).toBe(true)
    const heroPicture = wrapper.get('.home-cover picture.home-cover__picture')
    const heroSource = heroPicture.get('source')
    const heroImage = heroPicture.get('.corridor-home__hero-media')
    expect(heroSource.attributes('media')).toBe('(max-width: 760px)')
    expect(heroSource.attributes('srcset')).toContain('home-hero-light-v4-portrait.webp 483w')
    expect(heroImage.attributes('fetchpriority')).toBe('high')
    expect(wrapper.find('.home-cover__armillary').exists()).toBe(true)
    const closeup3d = wrapper.get('.home-inline-link')
    expect(closeup3d.attributes('data-to')).toBeTruthy()

    const cardImages = wrapper.findAll('.home-theme img')
    expect(cardImages[0]?.attributes('src')).toBe('/media/editorial/explore-bronze-jue-user-v2.webp')
    expect(cardImages[2]?.attributes('src')).toBe('/media/editorial/heluo-river-map-home-384w-v1.webp')
    expect(cardImages.every(image => {
      const srcset = image.attributes('srcset') ?? ''
      return srcset.includes('640w') && (srcset.includes('192w') || srcset.includes('320w'))
    })).toBe(true)
    expect(cardImages.every(image => image.attributes('sizes') === '(max-width: 760px) 112px, (max-width: 1100px) 30vw, 380px')).toBe(true)
    expect(wrapper.get('.home-visit a').attributes('data-to')).toBe('/appointment')
    expect(wrapper.findAll('.home-primary')).toHaveLength(1)
  })

})

