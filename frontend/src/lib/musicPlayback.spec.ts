import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordedMusicPlayer } from './musicPlayback'
import { MUSIC_RECORDINGS, type MusicScene } from './audioScenes'

class FakeMedia extends EventTarget {
  src = ''
  preload = ''
  loop = false
  paused = true
  currentTime = 0
  attempts: { resolve: () => void, reject: (reason?: unknown) => void }[] = []
  setAttribute = vi.fn()
  removeAttribute = vi.fn((name: string) => { if (name === 'src') this.src = '' })
  load = vi.fn()
  pause = vi.fn(() => { this.paused = true })
  play = vi.fn(() => {
    this.paused = false
    return new Promise<void>((resolve, reject) => { this.attempts.push({ resolve, reject }) })
  })
}

function setup() {
  const media: FakeMedia[] = []
  const gains: { gain: { value: number, setValueAtTime: ReturnType<typeof vi.fn>, cancelScheduledValues: ReturnType<typeof vi.fn>, linearRampToValueAtTime: ReturnType<typeof vi.fn> }, connect: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn> }[] = []
  const sources: { connect: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn> }[] = []
  const context = {
    currentTime: 10,
    createMediaElementSource: vi.fn(() => {
      const source = { connect: vi.fn(), disconnect: vi.fn() }
      sources.push(source)
      return source
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: { value: 0, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(),
      }
      gains.push(gain)
      return gain
    }),
  } as unknown as AudioContext
  const destination = {} as AudioNode
  const failure = vi.fn()
  const player = new RecordedMusicPlayer({
    createMedia: () => {
      const element = new FakeMedia()
      media.push(element)
      return element as unknown as HTMLAudioElement
    },
    onPlaybackFailure: failure,
  })
  const start = (scene: MusicScene) => player.start(context, destination, scene)
  return { player, start, media, gains, sources, context, destination, failure }
}

const flushPlayback = async () => { await Promise.resolve(); await Promise.resolve() }

describe('recorded museum music playback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('constructs no media or request until an audible scene is started', () => {
    const { start, media, player } = setup()
    expect(media).toHaveLength(0)
    start('quiet')
    expect(media).toHaveLength(0)
    expect(player.isRunning()).toBe(false)
  })

  it('calls play synchronously and routes the stream into the supplied bus', async () => {
    const { start, media, gains, sources, destination, player } = setup()
    start('home')
    expect(media[0]?.src).toBe('/media/audio/music-r3/home-r3.mp3')
    expect(media[0]?.play).toHaveBeenCalledOnce()
    expect(media[0]?.loop).toBe(true)
    expect(sources[0]?.connect).toHaveBeenCalledWith(gains[0])
    expect(gains[0]?.connect).toHaveBeenCalledWith(destination)
    expect(gains[0]?.gain.linearRampToValueAtTime).not.toHaveBeenCalled()
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    expect(player.inspect().track).toBe('home')
    expect(gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(MUSIC_RECORDINGS.home?.gain, 11.4)
  })

  it('keeps position and element when related pages use the same recording', async () => {
    const { start, media, gains } = setup()
    start('story')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    media[0]!.currentTime = 47
    start('booking')
    start('account')
    expect(media).toHaveLength(1)
    expect(media[0]?.currentTime).toBe(47)
    expect(media[0]?.play).toHaveBeenCalledOnce()
    expect(gains[0]?.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(MUSIC_RECORDINGS.account?.gain, 11.8)
  })

  it('continues the old piece until the replacement actually plays and then releases it', async () => {
    const { start, media, player, sources } = setup()
    start('home')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    start('story')
    expect(player.inspect()).toMatchObject({ track: 'home', pending: 'reading', mediaCount: 2 })
    expect(media[0]?.pause).not.toHaveBeenCalled()
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    expect(player.inspect()).toMatchObject({ track: 'reading', retiring: 'home', mediaCount: 2 })
    vi.advanceTimersByTime(1800)
    expect(player.inspect().mediaCount).toBe(1)
    expect(media[0]?.src).toBe('')
    expect(sources[0]?.disconnect).toHaveBeenCalledOnce()
  })

  it('cancels a slow B when navigation returns to the still-playing A', async () => {
    const { start, media, player } = setup()
    start('home')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    media[0]!.currentTime = 31
    start('story')
    start('home')
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    expect(player.inspect()).toMatchObject({ track: 'home', pending: null, mediaCount: 1 })
    expect(media).toHaveLength(2)
    expect(media[0]?.currentTime).toBe(31)
    expect(media[1]?.src).toBe('')
  })

  it('reuses A during an A→B→A crossfade and cancels its old retirement timer', async () => {
    const { start, media, player } = setup()
    start('home')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    start('story')
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    vi.advanceTimersByTime(800)
    start('home')
    vi.advanceTimersByTime(1100)
    expect(player.inspect()).toMatchObject({ track: 'home', retiring: 'reading', mediaCount: 2 })
    expect(media).toHaveLength(2)
    vi.advanceTimersByTime(700)
    expect(player.inspect()).toMatchObject({ track: 'home', retiring: null, mediaCount: 1 })
    expect(media[0]?.src).not.toBe('')
  })

  it('never keeps three elements when a third scene arrives during a fade', async () => {
    const { start, media, player, sources } = setup()
    start('home')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    start('story')
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    start('exhibit')
    expect(player.inspect().mediaCount).toBe(2)
    expect(sources[0]?.disconnect).toHaveBeenCalledOnce()
    media[2]?.attempts[0]?.resolve()
    await flushPlayback()
    vi.advanceTimersByTime(1800)
    expect(player.inspect()).toMatchObject({ track: 'bronze', mediaCount: 1 })
  })

  it('does not resurrect an old load after mute and re-enable', async () => {
    const { start, media, player } = setup()
    start('home')
    player.stop()
    start('story')
    media[0]?.attempts[0]?.resolve()
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    expect(player.inspect()).toMatchObject({ track: 'reading', pending: null, mediaCount: 1 })
    expect(media[0]?.src).toBe('')
  })

  it('stops music on quiet scenes and repeated stop calls preserve the fade', async () => {
    const { start, media, player } = setup()
    start('home')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    start('quiet')
    player.stop()
    expect(player.isRunning()).toBe(false)
    expect(media[0]?.pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(600)
    expect(player.inspect().mediaCount).toBe(0)
  })

  it('silently releases a blocked element and permits a fresh gesture retry', async () => {
    const { start, media, player, failure } = setup()
    start('home')
    media[0]?.attempts[0]?.reject(new DOMException('Gesture required', 'NotAllowedError'))
    await flushPlayback()
    expect(player.inspect().mediaCount).toBe(0)
    expect(failure).toHaveBeenCalledOnce()
    start('home')
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    expect(player.inspect().track).toBe('home')
  })

  it('ignores an obsolete rejection after the next request already works', async () => {
    const { start, media, player, failure } = setup()
    start('home')
    start('story')
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    media[0]?.attempts[0]?.reject(new Error('old request'))
    await flushPlayback()
    expect(player.inspect().track).toBe('reading')
    expect(failure).not.toHaveBeenCalled()
  })

  it('fails closed on media errors and times out a load that never resolves', async () => {
    const { start, media, player, failure } = setup()
    start('home')
    media[0]?.dispatchEvent(new Event('error'))
    expect(failure).toHaveBeenCalledOnce()
    start('story')
    vi.advanceTimersByTime(15_000)
    expect(failure).toHaveBeenCalledTimes(2)
    expect(player.inspect().mediaCount).toBe(0)
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    expect(player.isRunning()).toBe(false)
  })

  it('pauses immediately when hidden and resumes the same element at its position', async () => {
    const { start, media, player } = setup()
    start('story')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    media[0]!.currentTime = 58
    player.pause()
    expect(media[0]?.paused).toBe(true)
    expect(player.isRunning()).toBe(false)
    start('story')
    expect(media).toHaveLength(1)
    expect(media[0]?.currentTime).toBe(58)
    expect(media[0]?.play).toHaveBeenCalledTimes(2)
    media[0]?.attempts[1]?.resolve()
    await flushPlayback()
    expect(player.isRunning()).toBe(true)
  })

  it('invalidates pending playback on hide and accepts only the later resume attempt', async () => {
    const { start, media, player, failure } = setup()
    start('story')
    player.pause()
    start('story')
    media[0]?.attempts[0]?.reject(new DOMException('Paused', 'AbortError'))
    media[0]?.attempts[1]?.resolve()
    await flushPlayback()
    expect(failure).not.toHaveBeenCalled()
    expect(player.inspect()).toMatchObject({ track: 'reading', pending: null, paused: false })
  })

  it('disconnects all media nodes on teardown, including an ongoing crossfade', async () => {
    const { start, media, player, sources, gains } = setup()
    start('home')
    media[0]?.attempts[0]?.resolve()
    await flushPlayback()
    start('exhibit')
    media[1]?.attempts[0]?.resolve()
    await flushPlayback()
    player.stop(0)
    expect(player.inspect().mediaCount).toBe(0)
    expect(sources.every(source => source.disconnect.mock.calls.length === 1)).toBe(true)
    expect(gains.every(gain => gain.disconnect.mock.calls.length === 1)).toBe(true)
  })

  it('releases partially constructed media when the audio graph cannot be created', () => {
    const { start, media, player, context, failure } = setup()
    vi.mocked(context.createGain).mockImplementationOnce(() => { throw new Error('Audio graph unavailable') })
    expect(() => start('home')).not.toThrow()
    expect(media[0]?.pause).toHaveBeenCalledOnce()
    expect(media[0]?.load).toHaveBeenCalledOnce()
    expect(player.inspect().mediaCount).toBe(0)
    expect(failure).toHaveBeenCalledOnce()
  })
})
