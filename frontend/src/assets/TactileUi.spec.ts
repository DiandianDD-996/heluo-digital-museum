import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminActionButton from '../components/AdminActionButton.vue'
import EditorialCard from '../components/EditorialCard.vue'
import FluidButton from '../components/FluidButton.vue'
import MuseumSearchField from '../components/MuseumSearchField.vue'

describe('Heluo Editorial 2.0 shared UI component contract', () => {
  it('keeps the native button API with clean variant classes and accessible attributes', () => {
    const wrapper = mount(FluidButton, { props: { variant: 'primary' }, slots: { default: '开始探索' } })
    const button = wrapper.get('button')

    expect(button.classes()).toContain('fluid-button--primary')
    expect(button.attributes('type')).toBe('button')
    expect(wrapper.get('.fluid-button__fill').attributes('aria-hidden')).toBe('true')
  })

  it('preserves semantic leading icon, submit and clear behavior on MuseumSearchField', async () => {
    const wrapper = mount(MuseumSearchField, {
      props: { modelValue: '青铜', label: '搜索文物或文章', submitLabel: '搜索', clearLabel: '清除搜索' },
    })

    expect(wrapper.get('.museum-search-field__leading').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.museum-search-field__submit').attributes('type')).toBe('submit')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)

    await wrapper.get('.museum-search-field__clear').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('renders editorial cards and admin action buttons cleanly', () => {
    const card = mount(EditorialCard, {
      props: { to: '/explore', mediaAlt: '河洛文物' },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    const action = mount(AdminActionButton, { props: { action: 'publish' }, slots: { default: '发布' } })

    expect(card.classes()).toContain('editorial-card')
    expect(action.get('button').classes()).toContain('admin-action-button')
  })

  it('styles shared controls with hairline borders, zero !important and explicit accessibility fallbacks', () => {
    const componentsCss = readFileSync(resolve(process.cwd(), 'src/styles/04-components.css'), 'utf8')
    expect(componentsCss).toContain('.fluid-button--primary')
    expect(componentsCss).toContain('.museum-search-field__control')
    expect(componentsCss).toContain('.editorial-card')
    expect(componentsCss).not.toContain('!important')
    expect(componentsCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(componentsCss).toContain('@media (forced-colors: active)')
  })
})
