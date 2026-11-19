import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  start: vi.fn(), stop: vi.fn(), pause: vi.fn(), ensureBus: vi.fn(),
  switchAmbience: vi.fn(), stopAmbience: vi.fn(),
  state: { enabled: false, music: true, context: null as unknown, ambience: null as string | null },
  failure: null as (() => void) | null,
}))

vi.mock('./musicPlayback', () => ({
  RecordedMusicPlayer: class {
    constructor(options: { onPlaybackFailure: () => void }) { mocks.failure = options.onPlaybackFailure }
    start = mocks.start
    stop = mocks.stop
    pause = mocks.pause
    isRunning = () => false
    inspect = () => ({ track: null })
  },
}))

vi.mock('./audioSystem', () => ({
  audioSystem: {
    isEnabled: () => mocks.state.enabled,
    isMusicEnabled: () => mocks.state.enabled && mocks.state.music,
    getContext: () => mocks.state.context,
    ensureMusicBus: () => {
      mocks.ensureBus()
      if (!mocks.state.enabled || !mocks.state.music) return null
      mocks.state.context ??= { currentTime: 0, state: 'running' }
      return { bus: true }
    },
    switchAmbience: (scene: string) => { mocks.state.ambience = scene; return mocks.switchAmbience(scene) },
    stopAmbience: () => { mocks.state.ambience = null; mocks.stopAmbience() },
    getAmbienceScene: () => mocks.state.ambience,
  },
}))

import { musicDirector } from './musicDirector'

function gesture(event = 'pointerdown') { window.dispatchEvent(new Event(event)) }
function enable(route = 'home', slug?: string) {
  mocks.state.enabled = true
  musicDirector.setRoute(route, slug)
  musicDirector.init()
  gesture()
}

describe('recorded music director', () => {
  beforeEach(() => {
    musicDirector.reset(true)
    vi.clearAllMocks()
    mocks.state.enabled = false
    mocks.state.music = true
    mocks.state.context = null
    mocks.state.ambience = null
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  })
  afterEach(() => { musicDirector.reset(true); vi.restoreAllMocks() })

  it('does not build a graph or load music before a gesture, including restored on preference', () => {
    mocks.state.enabled = true
    musicDirector.setRoute('home')
    musicDirector.init()
    musicDirector.refresh({ viaGesture: false })
    expect(mocks.ensureBus).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.switchAmbience).not.toHaveBeenCalled()
  })

  it.each(['home', 'artifact-detail'])('builds the missing graph on the very first gesture at %s', (route) => {
    enable(route, route === 'artifact-detail' ? 'water-bird-bronze' : undefined)
    expect(mocks.ensureBus).toHaveBeenCalledOnce()
    expect(mocks.start).toHaveBeenCalledOnce()
    expect(mocks.start.mock.calls[0]?.[2]).toBe(route === 'home' ? 'home' : 'story')
    expect(musicDirector.inspect().armed).toBe(false)
  })

  it('starts during the click that turns on sound even when pointerdown was muted', () => {
    musicDirector.setRoute('artifact-detail', 'water-bird-bronze')
    musicDirector.init()
    gesture()
    expect(mocks.start).not.toHaveBeenCalled()
    mocks.state.enabled = true
    musicDirector.refresh()
    expect(mocks.start).toHaveBeenCalledOnce()
    expect(mocks.start.mock.calls[0]?.[2]).toBe('story')
  })

  it('uses the latest route selected before the first touchend gesture', () => {
    mocks.state.enabled = true
    musicDirector.setRoute('home')
    musicDirector.setRoute('exhibit-detail', 'heluo-bronze-ding-3d')
    musicDirector.init()
    gesture('touchend')
    expect(mocks.start.mock.calls[0]?.[2]).toBe('exhibit')
  })

  it('does not reconcile every interaction after successful unlock', () => {
    enable()
    mocks.start.mockClear()
    gesture()
    gesture('keydown')
    gesture('click')
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('rearms after a blocked playback and retries from a later gesture', () => {
    enable()
    mocks.start.mockClear()
    mocks.failure?.()
    expect(musicDirector.inspect().armed).toBe(true)
    gesture('click')
    expect(mocks.start).toHaveBeenCalledOnce()
  })

  it('stops on master off and starts again from the same route on enable', () => {
    enable('exhibit-detail', 'heluo-bronze-ding-3d')
    mocks.start.mockClear()
    mocks.stop.mockClear()
    mocks.state.enabled = false
    musicDirector.refresh()
    expect(mocks.stop).toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    mocks.state.enabled = true
    musicDirector.refresh()
    expect(mocks.start.mock.calls[0]?.[2]).toBe('exhibit')
  })

  it('stops on music off without reintroducing an old synthetic ambience layer', () => {
    enable('home')
    mocks.start.mockClear()
    mocks.switchAmbience.mockClear()
    mocks.stop.mockClear()
    mocks.state.music = false
    musicDirector.refresh()
    expect(mocks.stop).toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.switchAmbience).not.toHaveBeenCalled()
    expect(mocks.state.ambience).toBeNull()
  })

  it('does not restart either layer on an identical route and slug', () => {
    enable('exhibit-detail', 'heluo-bronze-ding-3d')
    mocks.start.mockClear()
    mocks.switchAmbience.mockClear()
    musicDirector.setRoute('exhibit-detail', 'heluo-bronze-ding-3d')
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.switchAmbience).not.toHaveBeenCalled()
  })

  it('updates same-name routes when their content slug changes', () => {
    enable('exhibit-detail', 'heluo-bronze-ding-3d')
    mocks.start.mockClear()
    musicDirector.setRoute('exhibit-detail', 'unknown-material')
    expect(mocks.start.mock.calls[0]?.[2]).toBe('story')
    expect(mocks.state.ambience).toBeNull()
  })

  it('keeps the approved content mapping through preference refresh', () => {
    enable('exhibit-detail', 'heluo-bronze-ding-3d')
    mocks.start.mockClear()
    musicDirector.refresh()
    expect(mocks.start.mock.calls[0]?.[2]).toBe('exhibit')
  })

  it('keeps a deliberate scene override until the route or slug changes', () => {
    enable('explore')
    musicDirector.setScene('story')
    mocks.start.mockClear()
    musicDirector.refresh()
    expect(mocks.start.mock.calls[0]?.[2]).toBe('story')
    musicDirector.setRoute('shop')
    expect(mocks.start.mock.lastCall?.[2]).toBe('store')
  })

  it.each(['admin', 'admin-operations', 'not-found', 'unmapped'])('makes %s silent without requesting another recording', (route) => {
    enable('home')
    mocks.start.mockClear()
    mocks.stop.mockClear()
    musicDirector.setRoute(route)
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.stop).toHaveBeenCalled()
    expect(mocks.state.ambience).toBeNull()
  })

  it('pauses a hidden page and waits for a visible gesture before resuming its latest route', () => {
    enable('home')
    mocks.start.mockClear()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(mocks.pause).toHaveBeenCalledOnce()
    musicDirector.setRoute('artifact-detail', 'water-bird-bronze')
    gesture()
    expect(mocks.start).not.toHaveBeenCalled()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    musicDirector.refresh({ viaGesture: false })
    expect(mocks.start).not.toHaveBeenCalled()
    gesture('keydown')
    expect(mocks.start.mock.calls[0]?.[2]).toBe('story')
  })

  it('retains the actual route through teardown and reinitialization', () => {
    enable('exhibit-detail', 'heluo-bronze-ding-3d')
    musicDirector.reset()
    mocks.start.mockClear()
    musicDirector.init()
    gesture('keydown')
    expect(mocks.start.mock.calls[0]?.[2]).toBe('exhibit')
  })

  it('removes visibility listeners on teardown', () => {
    enable('home')
    musicDirector.reset()
    mocks.pause.mockClear()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(mocks.pause).not.toHaveBeenCalled()
  })
})
