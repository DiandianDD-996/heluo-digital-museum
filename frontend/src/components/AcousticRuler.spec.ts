import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MusicTrack } from '../lib/audioScenes'

const mockAudioState = vi.hoisted(() => ({
  enabled: false,
  isPaused: false,
  isMusicOn: true,
  volumeTier: 'normal',
  isMusicAudible: false,
  currentTrack: 'home' as MusicTrack | null,
}))

const mockFuncs = vi.hoisted(() => ({
  enable: vi.fn(),
  resumePlayback: vi.fn(),
  setMusicEnabled: vi.fn(),
  setVolumeTier: vi.fn(),
  acquireMusicAnalyser: vi.fn(),
  releaseMusicAnalyser: vi.fn(),
}))

vi.mock('../stores/audio', async () => {
  const { computed, ref } = await import('vue')
  const enabled = ref(mockAudioState.enabled)
  const isPaused = ref(mockAudioState.isPaused)
  const isMusicOn = ref(mockAudioState.isMusicOn)
  const volumeTier = ref(mockAudioState.volumeTier)
  const isMusicAudible = ref(mockAudioState.isMusicAudible)
  const currentTrack = ref<MusicTrack | null>(mockAudioState.currentTrack)
  return {
    useAudio: () => ({
      enabled,
      isPaused,
      isMusicOn,
      volumeTier,
      isMusicAudible,
      currentTrack,
      isAudible: computed(() => enabled.value && volumeTier.value !== 'silent'),
      enable: mockFuncs.enable.mockImplementation(() => {
        enabled.value = true
        isMusicAudible.value = true
      }),
      resumePlayback: mockFuncs.resumePlayback.mockImplementation(() => {
        isPaused.value = false
        isMusicAudible.value = true
      }),
      setMusicEnabled: mockFuncs.setMusicEnabled.mockImplementation((v: boolean) => {
        isMusicOn.value = v
        isMusicAudible.value = enabled.value && v && volumeTier.value !== 'silent'
      }),
      setVolumeTier: mockFuncs.setVolumeTier.mockImplementation((tier: string) => {
        volumeTier.value = tier
      }),
    }),
  }
})

vi.mock('../lib/audioSystem', () => ({
  audioSystem: {
    acquireMusicAnalyser: mockFuncs.acquireMusicAnalyser,
    releaseMusicAnalyser: mockFuncs.releaseMusicAnalyser,
    getContext: () => ({ sampleRate: 44100 }),
  },
}))

import AcousticRuler from './AcousticRuler.vue'
import { useAudio } from '../stores/audio'

type MutableAudioMock = {
  enabled: { value: boolean }
  isPaused: { value: boolean }
  isMusicOn: { value: boolean }
  volumeTier: { value: string }
  isMusicAudible: { value: boolean }
  currentTrack: { value: MusicTrack | null }
}

describe('AcousticRuler.vue', () => {
  let wrapper: VueWrapper | undefined
  let rafQueue: FrameRequestCallback[] = []
  let nextRafId = 1
  let reducedMotionMatches = false
  let resizeCb: ResizeObserverCallback | undefined
  let intersectionCb: IntersectionObserverCallback | undefined

  const origResizeObserver = globalThis.ResizeObserver
  const origIntersectionObserver = globalThis.IntersectionObserver

  beforeEach(() => {
    rafQueue = []
    nextRafId = 1
    reducedMotionMatches = false
    vi.clearAllMocks()

    const audio = useAudio() as unknown as MutableAudioMock
    audio.enabled.value = false
    audio.isPaused.value = false
    audio.isMusicOn.value = true
    audio.volumeTier.value = 'normal'
    audio.isMusicAudible.value = false
    audio.currentTrack.value = 'home'

    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return nextRafId++
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotionMatches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { resizeCb = cb }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) { intersectionCb = cb }
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds: number[] = []
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = () => []
    } as unknown as typeof IntersectionObserver

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960,
      height: 26,
      left: 0,
      top: 0,
      right: 960,
      bottom: 26,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    globalThis.ResizeObserver = origResizeObserver
    globalThis.IntersectionObserver = origIntersectionObserver
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('draws a single static frame and runs zero rAF loops when silent, then wakes audio on click', async () => {
    wrapper = mount(AcousticRuler, { props: { variant: 'hero' } })
    await nextTick()

    expect(wrapper.attributes('data-ruler-state')).toBe('idle')
    expect(wrapper.attributes('data-raf-active')).toBe('false')
    expect(rafQueue).toHaveLength(0)

    const trigger = wrapper.get('[data-testid="acoustic-ruler-trigger"]')
    expect(trigger.text()).toContain('开启展馆声景')

    await trigger.trigger('click')
    await nextTick()
    expect(mockFuncs.enable).toHaveBeenCalledOnce()
    expect(mockFuncs.acquireMusicAnalyser).toHaveBeenCalled()
    expect(rafQueue.length).toBeGreaterThan(0)
  })

  it('switches palette in pointcloud mode and pauses rAF when scrolled out of viewport', async () => {
    const audio = useAudio() as unknown as MutableAudioMock
    audio.enabled.value = true
    audio.isMusicAudible.value = true
    mockFuncs.acquireMusicAnalyser.mockReturnValue({
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => { arr.fill(64) }),
    })

    wrapper = mount(AcousticRuler, {
      props: { variant: 'darkroom', visualMode: 'solid' },
    })
    await nextTick()
    expect(wrapper.attributes('data-palette')).toBe('darkroom-bronze')
    expect(wrapper.find('[data-testid="acoustic-ruler-trigger"]').exists()).toBe(false)
    expect(rafQueue.length).toBeGreaterThan(0)

    await wrapper.setProps({ visualMode: 'points' })
    expect(wrapper.attributes('data-palette')).toBe('darkroom-pointcloud')

    // Scroll out of viewport -> cancels rAF
    intersectionCb?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    await nextTick()
    expect(wrapper.attributes('data-raf-active')).toBe('false')
    expect(cancelAnimationFrame).toHaveBeenCalled()
    void resizeCb
  })

  it('never starts rAF under prefers-reduced-motion: reduce and releases analyser on unmount', async () => {
    reducedMotionMatches = true
    const audio = useAudio() as unknown as MutableAudioMock
    audio.enabled.value = true
    audio.isMusicAudible.value = true

    wrapper = mount(AcousticRuler, { props: { variant: 'hero' } })
    await nextTick()
    expect(wrapper.attributes('data-ruler-state')).toBe('reduced')
    expect(rafQueue).toHaveLength(0)

    // Even a manual ripple does not schedule rAF when reduced-motion is on
    ;(wrapper.vm as unknown as { triggerRipple: (r?: number) => void }).triggerRipple(0.34)
    expect(rafQueue).toHaveLength(0)

    wrapper.unmount()
    wrapper = undefined
    expect(mockFuncs.releaseMusicAnalyser).toHaveBeenCalled()
  })
})
