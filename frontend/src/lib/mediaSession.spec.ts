import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetMediaSessionBindingForTests, syncMediaSession } from './mediaSession'

describe('mediaSession integration', () => {
  beforeEach(() => {
    resetMediaSessionBindingForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('degrades silently when navigator.mediaSession is unavailable', () => {
    vi.stubGlobal('navigator', {})
    expect(() => syncMediaSession({
      track: 'home',
      isPlaying: true,
      isPaused: false,
      locale: 'zh-CN',
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onStop: vi.fn(),
    })).not.toThrow()
  })

  it('updates bilingual metadata, playbackState, and delegates play/pause/stop actions', () => {
    const handlers = new Map<string, () => void>()
    const mediaSession = {
      metadata: null as unknown,
      playbackState: 'none',
      setActionHandler: vi.fn((action: string, handler: () => void) => {
        handlers.set(action, handler)
      }),
    }
    class FakeMediaMetadata {
      title: string
      artist: string
      album: string
      artwork: Array<{ src: string, sizes: string, type: string }>
      constructor(init: { title: string, artist: string, album: string, artwork: Array<{ src: string, sizes: string, type: string }> }) {
        this.title = init.title
        this.artist = init.artist
        this.album = init.album
        this.artwork = init.artwork
      }
    }
    vi.stubGlobal('MediaMetadata', FakeMediaMetadata)
    vi.stubGlobal('navigator', { mediaSession })

    const onPlay = vi.fn()
    const onPause = vi.fn()
    const onStop = vi.fn()

    syncMediaSession({
      track: 'bronze',
      isPlaying: true,
      isPaused: false,
      locale: 'zh-CN',
      onPlay,
      onPause,
      onStop,
    })

    expect(mediaSession.playbackState).toBe('playing')
    expect((mediaSession.metadata as FakeMediaMetadata).title).toBe('《观器·温金》')
    expect((mediaSession.metadata as FakeMediaMetadata).album).toBe('展馆原声 R4')
    expect((mediaSession.metadata as FakeMediaMetadata).artwork[0]?.src).toContain('explore-bronze-ding-user-v2.webp')

    handlers.get('pause')?.()
    handlers.get('play')?.()
    handlers.get('stop')?.()
    expect(onPause).toHaveBeenCalledOnce()
    expect(onPlay).toHaveBeenCalledOnce()
    expect(onStop).toHaveBeenCalledOnce()

    syncMediaSession({
      track: 'jade',
      isPlaying: false,
      isPaused: true,
      locale: 'en-US',
      onPlay,
      onPause,
      onStop,
    })
    expect(mediaSession.playbackState).toBe('paused')
    expect((mediaSession.metadata as FakeMediaMetadata).title).toBe('Luminous Jade & Stone')
    expect((mediaSession.metadata as FakeMediaMetadata).album).toBe('Museum Soundscape R4')
    expect((mediaSession.metadata as FakeMediaMetadata).artwork[0]?.src).toContain('explore-jade-bi-user-v2.webp')

    syncMediaSession({
      track: null,
      isPlaying: false,
      isPaused: false,
      locale: 'zh-CN',
      onPlay,
      onPause,
      onStop,
    })
    expect(mediaSession.playbackState).toBe('none')
    expect(mediaSession.metadata).toBeNull()
  })
})
