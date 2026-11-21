import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VolumeTier } from '../lib/audioSystem'

vi.mock('../stores/audio', async () => {
  const { computed, ref } = await import('vue')
  const enabled = ref(false)
  const sfxEnabled = ref(true)
  const musicEnabled = ref(true)
  const volumeTier = ref<VolumeTier>('normal')
  const state = {
    enabled, sfxEnabled, musicEnabled, volumeTier,
    isAudible: computed(() => enabled.value && volumeTier.value !== 'silent'),
    isSfxOn: computed(() => sfxEnabled.value),
    isMusicOn: computed(() => musicEnabled.value),
    tierOrder: ['silent', 'quiet', 'normal', 'rich'],
    enable: vi.fn(() => { enabled.value = true }),
    toggle: vi.fn(() => { enabled.value = !enabled.value }),
    setSfxEnabled: vi.fn((value: boolean) => { sfxEnabled.value = value }),
    setMusicEnabled: vi.fn((value: boolean) => { musicEnabled.value = value }),
    setVolumeTier: vi.fn((value: VolumeTier) => { volumeTier.value = value }),
  }
  return { useAudio: () => state }
})

import AudioControl from './AudioControl.vue'
import { useAudio } from '../stores/audio'
import { useLocale } from '../stores/locale'

const audio = useAudio()
let wrapper: VueWrapper | undefined

function render() {
  wrapper = mount(AudioControl, { attachTo: document.body })
  return wrapper
}

beforeEach(() => {
  audio.enabled.value = false
  audio.sfxEnabled.value = true
  audio.musicEnabled.value = true
  audio.volumeTier.value = 'normal'
  useLocale().locale.value = 'zh-CN'
  vi.clearAllMocks()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AudioControl interactions', () => {
  it('stays off on hover and enables from one deliberate click, with usable focus', async () => {
    const control = render()
    await control.trigger('pointerenter', { pointerType: 'mouse' })
    expect(control.find('.audio-panel').exists()).toBe(false)
    expect(audio.enable).not.toHaveBeenCalled()
    await control.get('.audio-toggle').trigger('click')
    await nextTick()
    expect(audio.enable).toHaveBeenCalledTimes(1)
    expect(control.get('.audio-toggle').attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(control.get('.audio-panel__switch').element)
  })

  it('keeps a hover-open panel open on the first click and closes on the next click', async () => {
    audio.enabled.value = true
    const control = render()
    await control.trigger('pointerenter', { pointerType: 'mouse' })
    expect(control.find('.audio-panel').exists()).toBe(true)
    expect(document.activeElement).toBe(document.body)
    await control.get('.audio-toggle').trigger('click')
    await nextTick()
    expect(control.find('.audio-panel').exists()).toBe(true)
    expect(document.activeElement).toBe(control.get('.audio-panel__switch').element)
    await control.get('.audio-toggle').trigger('click')
    expect(control.find('.audio-panel').exists()).toBe(false)
    expect(audio.toggle).not.toHaveBeenCalled()
  })

  it('returns Escape focus to the real trigger button', async () => {
    const control = render()
    await control.get('.audio-toggle').trigger('click')
    control.get<HTMLButtonElement>('.audio-panel__tier').element.focus()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(control.find('.audio-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(control.get('.audio-toggle').element)
  })

  it('keeps focused controls on pointer leave and lets Tab leave without stealing focus', async () => {
    const control = render()
    await control.get('.audio-toggle').trigger('click')
    const outside = document.createElement('button')
    document.body.append(outside)
    control.element.dispatchEvent(new MouseEvent('pointerleave', { relatedTarget: outside }))
    await nextTick()
    expect(control.find('.audio-panel').exists()).toBe(true)
    outside.focus()
    await nextTick()
    expect(control.find('.audio-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(outside)
  })

  it('closes a hover preview on pointer leave or a click outside the control', async () => {
    audio.enabled.value = true
    const control = render()
    await control.trigger('pointerenter', { pointerType: 'mouse' })
    control.element.dispatchEvent(new MouseEvent('pointerleave', { relatedTarget: document.body }))
    await nextTick()
    expect(control.find('.audio-panel').exists()).toBe(false)
    await control.trigger('pointerenter', { pointerType: 'mouse' })
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(control.find('.audio-panel').exists()).toBe(false)
  })

  it('keeps music, interaction sounds, and the silent tier independent of the master switch', async () => {
    const control = render()
    await control.get('.audio-toggle').trigger('click')
    const checks = control.findAll('input[type="checkbox"]')
    await checks[0]!.setValue(false)
    expect(audio.sfxEnabled.value).toBe(false)
    expect(audio.musicEnabled.value).toBe(true)
    await checks[1]!.setValue(false)
    expect(audio.musicEnabled.value).toBe(false)
    await checks[0]!.setValue(true)
    expect(audio.sfxEnabled.value).toBe(true)
    expect(audio.musicEnabled.value).toBe(false)
    await control.findAll('.audio-panel__tier')[0]!.trigger('click')
    expect(audio.volumeTier.value).toBe('silent')
    expect(audio.enabled.value).toBe(true)
    expect(control.find('.audio-panel').exists()).toBe(true)
    expect(audio.toggle).not.toHaveBeenCalled()
  })

  it('closes and restores focus when the master is switched off', async () => {
    const control = render()
    await control.get('.audio-toggle').trigger('click')
    await control.get('.audio-panel__switch').trigger('click')
    expect(audio.enabled.value).toBe(false)
    expect(control.find('.audio-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(control.get('.audio-toggle').element)
  })

  it('does not turn a touch pointer-enter into an unintended toggle-close', async () => {
    audio.enabled.value = true
    const control = render()
    await control.trigger('pointerenter', { pointerType: 'touch' })
    expect(control.find('.audio-panel').exists()).toBe(false)
    await control.get('.audio-toggle').trigger('click')
    expect(control.find('.audio-panel').exists()).toBe(true)
  })

  it('moves a clipped panel inside the viewport and recalculates after resize', async () => {
    vi.stubGlobal('innerWidth', 390)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(260)
    const control = render()
    let right = 232
    vi.spyOn(control.element, 'getBoundingClientRect').mockImplementation(() => ({ right }) as DOMRect)
    await control.get('.audio-toggle').trigger('click')
    await nextTick()
    expect(control.element.getAttribute('style')).toContain('--audio-panel-offset: 44px')
    right = 400
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(control.element.getAttribute('style')).toContain('--audio-panel-offset: -26px')
  })

  it('removes the document Escape behavior on unmount', async () => {
    const control = render()
    await control.get('.audio-toggle').trigger('click')
    control.unmount()
    wrapper = undefined
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
