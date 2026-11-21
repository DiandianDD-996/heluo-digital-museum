import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLuoshengNarration } from './luoshengNarration'

const initial = { clip: '/media/guide/ding-ear.mp3', turn: 'ear:1', enabled: true }
const lifecycles: ReturnType<typeof effectScope>[] = []

function setup() {
  const lifecycle = effectScope()
  lifecycles.push(lifecycle)
  const scope = ref<typeof initial | null>({ ...initial })
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = []
  const createAudio = vi.fn(() => {
    const media = document.createElement('audio')
    vi.spyOn(media, 'play').mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })))
    vi.spyOn(media, 'pause').mockImplementation(() => {})
    vi.spyOn(media, 'load').mockImplementation(() => {})
    return media
  })
  const player = lifecycle.run(() => useLuoshengNarration(scope, createAudio))!
  const media = (index = 0) => createAudio.mock.results[index]!.value as HTMLAudioElement
  return { lifecycle, scope, pending, createAudio, media, ...player }
}

afterEach(() => {
  for (const lifecycle of lifecycles.splice(0)) lifecycle.stop()
})

describe('Luosheng narration lifecycle', () => {
  it('only loads on explicit play and ignores duplicate play while starting', async () => {
    const player = setup()
    expect(player.createAudio).not.toHaveBeenCalled()
    const start = player.play()
    await player.play()
    expect(player.status.value).toBe('starting')
    expect(player.media().getAttribute('src')).toBe(initial.clip)
    expect(player.media().play).toHaveBeenCalledTimes(1)
    player.pending[0]!.resolve()
    await start
    expect(player.status.value).toBe('playing')
  })

  it.each([
    'https://example.test/ding.mp3', '//example.test/ding.mp3', '/media/guide/../ding.mp3',
    '/media/guide/ding.mp3?x=1', '/media/guide/ding.mp3\n', '/media/guide/ding.html',
  ])('rejects an unapproved audio path (%j)', async (clip) => {
    const player = setup()
    player.scope.value = { ...initial, clip }
    await player.play()
    expect(player.status.value).toBe('idle')
    expect(player.createAudio).not.toHaveBeenCalled()
  })

  it('preserves playback position and ignores the superseded start on pause and resume', async () => {
    const player = setup()
    const first = player.play()
    const media = player.media()
    media.currentTime = 3
    player.pause()
    expect(player.status.value).toBe('paused')
    player.pending[0]!.resolve()
    await first
    expect(player.status.value).toBe('paused')
    const resume = player.play()
    expect(media.currentTime).toBe(3)
    expect(player.createAudio).toHaveBeenCalledTimes(1)
    player.pending[1]!.resolve()
    await resume
    expect(player.status.value).toBe('playing')
  })

  it.each([
    { ...initial, turn: 'ear:2' }, { ...initial, clip: '/media/guide/ding-feet.ogg' },
    { ...initial, enabled: false }, null,
  ])('releases old audio and ignores old events and rejection after scope changes (%j)', async (replacement) => {
    const player = setup()
    const old = player.play()
    const media = player.media()
    player.scope.value = replacement
    expect(player.status.value).toBe('idle')
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(media.hasAttribute('src')).toBe(false)
    expect(media.load).toHaveBeenCalledTimes(1)
    if (!replacement?.enabled) await player.play()
    expect(player.createAudio).toHaveBeenCalledTimes(1)
    player.scope.value = { ...initial }
    expect(player.createAudio).toHaveBeenCalledTimes(1)
    const next = player.play()
    media.dispatchEvent(new Event('ended'))
    media.dispatchEvent(new Event('error'))
    player.pending[0]!.reject(new Error('superseded playback'))
    await old
    expect(player.status.value).toBe('starting')
    player.pending[1]!.resolve()
    await next
    expect(player.status.value).toBe('playing')
  })

  it.each(['ended', 'error'] as const)('releases media on %s', async (event) => {
    const player = setup()
    const play = player.play()
    const media = player.media()
    player.pending[0]!.resolve()
    await play
    media.dispatchEvent(new Event(event))
    expect(media.hasAttribute('src')).toBe(false)
    expect(media.load).toHaveBeenCalledOnce()
    expect(player.status.value).toBe(event === 'ended' ? 'idle' : 'unavailable')
  })

  it('reports a current playback rejection and permits just an explicit retry', async () => {
    const player = setup()
    const first = player.play()
    player.pending[0]!.reject(new Error('media unavailable'))
    await first
    expect(player.status.value).toBe('unavailable')
    expect(player.media().load).toHaveBeenCalledOnce()
    expect(player.createAudio).toHaveBeenCalledTimes(1)
    const retry = player.play()
    player.pending[1]!.resolve()
    await retry
    expect(player.status.value).toBe('playing')
  })

  it('releases audio on explicit stop and on disposal, and never restarts after disposal', async () => {
    const player = setup()
    const first = player.play()
    player.stop()
    player.pending[0]!.resolve()
    await first
    expect(player.status.value).toBe('idle')
    expect(player.media().hasAttribute('src')).toBe(false)
    const second = player.play()
    player.lifecycle.stop()
    player.pending[1]!.resolve()
    await second
    expect(player.status.value).toBe('idle')
    expect(player.media(1).hasAttribute('src')).toBe(false)
    await player.play()
    expect(player.createAudio).toHaveBeenCalledTimes(2)
  })
})
