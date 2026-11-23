import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VolumeTier } from '../lib/audioSystem'
import type { MusicTrack } from '../lib/audioScenes'

vi.mock('../stores/audio', async () => {
  const { computed, ref } = await import('vue')
  const enabled = ref(false)
  const sfxEnabled = ref(true)
  const musicEnabled = ref(true)
  const volumeTier = ref<VolumeTier>('normal')
  const isPaused = ref(false)
  const currentTrack = ref<MusicTrack | null>('home')
  const manualTrack = ref<MusicTrack | null>(null)
  const state = {
    enabled, sfxEnabled, musicEnabled, volumeTier, isPaused, currentTrack, manualTrack,
    isAudible: computed(() => enabled.value && volumeTier.value !== 'silent'),
    isSfxOn: computed(() => sfxEnabled.value),
    isMusicOn: computed(() => musicEnabled.value),
    tierOrder: ['silent', 'quiet', 'normal', 'rich'],
    enable: vi.fn(() => { enabled.value = true }),
    toggle: vi.fn(() => { enabled.value = !enabled.value }),
    setSfxEnabled: vi.fn((value: boolean) => { sfxEnabled.value = value }),
    setMusicEnabled: vi.fn((value: boolean) => { musicEnabled.value = value }),
    setVolumeTier: vi.fn((value: VolumeTier) => { volumeTier.value = value }),
    setManualTrack: vi.fn((track: MusicTrack | null) => {
      manualTrack.value = track
      if (track) currentTrack.value = track
    }),
    resumePlayback: vi.fn(() => { isPaused.value = false }),
  }
  return { useAudio: () => state }
})

import AudioControl from './AudioControl.vue'
import { useAudio } from '../stores/audio'
import { useLocale } from '../stores/locale'

const audio = useAudio() as unknown as {
  enabled: { value: boolean }
  sfxEnabled: { value: boolean }
  musicEnabled: { value: boolean }
  volumeTier: { value: VolumeTier }
  isPaused: { value: boolean }
  currentTrack: { value: MusicTrack | null }
  manualTrack: { value: MusicTrack | null }
  enable: ReturnType<typeof vi.fn>
  toggle: ReturnType<typeof vi.fn>
  setSfxEnabled: ReturnType<typeof vi.fn>
  setMusicEnabled: ReturnType<typeof vi.fn>
  setVolumeTier: ReturnType<typeof vi.fn>
  setManualTrack: ReturnType<typeof vi.fn>
  resumePlayback: ReturnType<typeof vi.fn>
}
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
  audio.isPaused.value = false
  audio.currentTrack.value = 'home'
  audio.manualTrack.value = null
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

  it('displays curatorial track placard, allows manual track switching and auto reset, and toggles CC0 sound notes', async () => {
    audio.enabled.value = true
    const control = render()
    await control.get('.audio-toggle').trigger('click')

    // Track placard shows active movement
    expect(control.get('[data-testid="audio-track-placard"]').text()).toContain('入馆·河洛晨光')

    // Manual track pills: Auto, home, reading, bronze, jade
    const trackBtns = control.findAll('.audio-panel__track-btn')
    expect(trackBtns).toHaveLength(5)
    expect(trackBtns[0]?.classes()).toContain('is-active')

    await trackBtns[4]?.trigger('click')
    expect(audio.setManualTrack).toHaveBeenCalledWith('jade')
    expect(trackBtns[4]?.classes()).toContain('is-active')
    expect(control.get('[data-testid="audio-track-placard"]').text()).toContain('温润·玉石')

    await trackBtns[3]?.trigger('click')
    expect(audio.setManualTrack).toHaveBeenCalledWith('bronze')
    expect(trackBtns[3]?.classes()).toContain('is-active')
    expect(control.get('[data-testid="audio-track-placard"]').text()).toContain('观器·温金')

    await trackBtns[0]?.trigger('click')
    expect(audio.setManualTrack).toHaveBeenCalledWith(null)

    // Paused state surface & resume
    audio.isPaused.value = true
    await nextTick()
    expect(control.get('[data-testid="audio-track-placard"]').text()).toContain('已暂停 · 点击继续')
    await control.get('.audio-panel__resume').trigger('click')
    expect(audio.resumePlayback).toHaveBeenCalledOnce()

    // Collapsible CC0 sound notes
    const notes = control.get('.audio-panel__notes')
    expect(notes.text()).toContain('VSCO 2 CE')
    expect(notes.text()).toContain('VCSL')
    expect(notes.text()).toContain('Sam Gossner')
  })
})
