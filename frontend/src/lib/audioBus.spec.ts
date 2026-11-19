import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

/**
 * The bus graph introduced on 2026-09-26 is pure wiring, so these tests
 * assert on the shape of that wiring rather than on how anything sounds.
 * jsdom ships no Web Audio at all, so the stubs below emulate the two
 * behaviours the real API actually guarantees and that the implementation
 * depends on:
 *
 *   1. `linearRampToValueAtTime` schedules a *future* change. Reading
 *      `.value` immediately after must not report the target — if these
 *      stubs applied ramps instantly they would happily pass an
 *      implementation that clicks.
 *   2. Buffers resolve through `OfflineAudioContext`. The app synthesizes
 *      every voice offline, so without that stub `switchAmbience` rejects
 *      and the tests would be measuring the stub's absence, not the code.
 */

interface StubAudioParam {
  value: number
  scheduled: Array<{ at: number, value: number }>
  // Typed as mocks (not bare function signatures) so assertions can reach
  // `.mockClear()` / `toHaveBeenCalledWith` without a cast.
  setValueAtTime: Mock<(value: number, at: number) => void>
  linearRampToValueAtTime: Mock<(value: number, at: number) => void>
  exponentialRampToValueAtTime: Mock<(value: number, at: number) => void>
  cancelScheduledValues: Mock<(at: number) => void>
}

function createStubParam(initial = 1): StubAudioParam {
  const param: StubAudioParam = {
    value: initial,
    scheduled: [],
    setValueAtTime: vi.fn((value: number, at: number) => {
      param.scheduled.push({ at, value })
    }),
    linearRampToValueAtTime: vi.fn((value: number, at: number) => {
      param.scheduled.push({ at, value })
    }),
    exponentialRampToValueAtTime: vi.fn((value: number, at: number) => {
      param.scheduled.push({ at, value })
    }),
    cancelScheduledValues: vi.fn(() => {
      param.scheduled = []
    }),
  }
  return param
}

interface StubGain {
  gain: StubAudioParam
  connections: unknown[]
  connect: (target: unknown) => unknown
}

function createStubGain(initial = 1): StubGain {
  const node: StubGain = {
    gain: createStubParam(initial),
    connections: [],
    connect(target: unknown) {
      node.connections.push(target)
      return target
    },
  }
  return node
}

interface StubSource {
  buffer: unknown
  loop: boolean
  playbackRate: { value: number }
  started: boolean
  stopped: boolean
  connect: (target: unknown) => unknown
  start: () => void
  stop: () => void
}

interface StubContext {
  currentTime: number
  state: string
  sampleRate: number
  destination: { kind: 'destination' }
  createdGains: StubGain[]
  createdSources: StubSource[]
  createGain: () => StubGain
  createBufferSource: () => StubSource
  createStereoPanner: () => unknown
  resume: () => Promise<void>
  /** Advances the clock and settles every ramp whose time has arrived. */
  advance: (seconds: number) => void
  /** Value a graph node's param would actually be at right now. */
  valueAt: (param: StubAudioParam) => number
}

function createStubContext(): StubContext {
  const context: StubContext = {
    currentTime: 0,
    state: 'running',
    sampleRate: 48000,
    destination: { kind: 'destination' },
    createdGains: [],
    createdSources: [],
    createGain() {
      const node = createStubGain()
      context.createdGains.push(node)
      return node
    },
    createBufferSource() {
      const source: StubSource = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        started: false,
        stopped: false,
        connect: (target: unknown) => target,
        start: vi.fn(() => { source.started = true }),
        stop: vi.fn(() => { source.stopped = true }),
      }
      context.createdSources.push(source)
      return source
    },
    createStereoPanner() {
      return { pan: createStubParam(0), connect: (target: unknown) => target }
    },
    resume: () => Promise.resolve(),
    advance(seconds: number) {
      context.currentTime += seconds
      for (const gain of context.createdGains) {
        const due = gain.gain.scheduled.filter(entry => entry.at <= context.currentTime)
        if (due.length > 0) {
          gain.gain.value = due[due.length - 1].value
          gain.gain.scheduled = gain.gain.scheduled.filter(entry => entry.at > context.currentTime)
        }
      }
    },
    valueAt(param: StubAudioParam) {
      const due = param.scheduled.filter(entry => entry.at <= context.currentTime)
      return due.length > 0 ? due[due.length - 1].value : param.value
    },
  }
  return context
}

/** `buildBuses` creates exactly five gain nodes in order: master, sfx,
 *  ambience, music, duck — music and duck are deliberately separate so
 *  ducking cannot move the level the user configured. */
function busGains(context: StubContext) {
  return {
    master: context.createdGains[0],
    sfx: context.createdGains[1],
    ambience: context.createdGains[2],
    music: context.createdGains[3],
    duck: context.createdGains[4],
  }
}

/** Minimal stand-ins for the offline rendering path used by
 *  soundSynthesis.ts. Without these, every `loadSound` rejects. */
function stubOfflineAudio() {
  vi.stubGlobal('AudioBuffer', class {
    numberOfChannels: number
    length: number
    sampleRate: number
    private channels: Float32Array[]
    constructor(options: { numberOfChannels: number, length: number, sampleRate: number }) {
      this.numberOfChannels = options.numberOfChannels
      this.length = options.length
      this.sampleRate = options.sampleRate
      this.channels = Array.from({ length: options.numberOfChannels }, () => new Float32Array(options.length))
    }
    getChannelData(channel: number) {
      return this.channels[channel]
    }
  })

  const offlineContext = () => ({
    sampleRate: 48000,
    destination: { kind: 'offline-destination' },
    createGain: () => createStubGain(),
    createConvolver: () => ({ buffer: null, normalize: true, connect: (t: unknown) => t }),
    createBufferSource: () => ({
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      connect: (t: unknown) => t,
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      Q: { value: 1 },
      frequency: createStubParam(350),
      connect: (t: unknown) => t,
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: createStubParam(440),
      detune: { value: 0 },
      connect: (t: unknown) => t,
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBuffer: (channels: number, length: number) => new AudioBuffer({ numberOfChannels: channels, length, sampleRate: 48000 }),
    startRendering: () => Promise.resolve(new AudioBuffer({ numberOfChannels: 2, length: 128, sampleRate: 48000 })),
  })

  vi.stubGlobal('OfflineAudioContext', vi.fn(function (this: unknown) { return offlineContext() }))
}

async function loadSystem(options: { context?: StubContext | null, reducedMotion?: boolean } = {}) {
  vi.resetModules()
  const context = options.context === undefined ? createStubContext() : options.context
  vi.stubGlobal('matchMedia', () => ({ matches: options.reducedMotion ?? false }))
  stubOfflineAudio()
  if (context) {
    vi.stubGlobal('AudioContext', vi.fn(function (this: unknown) { return context }))
  } else {
    vi.stubGlobal('AudioContext', undefined)
  }
  const module = await import('./audioSystem')
  return { ...module, stub: context }
}

/** Ramps are scheduled slightly out in real time; settling the clock past
 *  the longest ramp in the implementation yields the steady-state value. */
const SETTLE = 2

describe('audio bus architecture', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('routes every voice through masterGain instead of straight to destination', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    const { master, sfx, ambience, music, duck } = busGains(stub)
    expect(master).toBeDefined()
    expect(master.connections).toContain(stub.destination)
    expect(sfx.connections).toContain(master)
    expect(ambience.connections).toContain(master)
    // Music detours through the duck stage before reaching master.
    expect(music.connections).toContain(duck)
    expect(duck.connections).toContain(master)
    expect(music.connections).not.toContain(master)
  })

  it('leaves sub-bus gains at their reference balance so pre-refactor loudness is preserved', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub, DEFAULT_BUS_LEVELS } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    const { sfx, ambience, music } = busGains(stub)
    expect(sfx.gain.value).toBe(DEFAULT_BUS_LEVELS.sfx)
    expect(ambience.gain.value).toBe(DEFAULT_BUS_LEVELS.ambience)
    expect(music.gain.value).toBe(DEFAULT_BUS_LEVELS.music)
  })

  it('keeps master at unity on the normal tier', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub, VOLUME_TIER_GAIN } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    expect(audioSystem.getVolumeTier()).toBe('normal')
    expect(busGains(stub).master.gain.value).toBe(VOLUME_TIER_GAIN.normal)
    expect(VOLUME_TIER_GAIN.normal).toBe(1)
  })

  it('mutes the master bus when the system is disabled', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()
    audioSystem.disable()

    expect(audioSystem.isEnabled()).toBe(false)
    expect(busGains(stub).master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))
    stub.advance(SETTLE)
    expect(stub.valueAt(busGains(stub).master.gain)).toBe(0)
  })

  it('does not move the master gain instantly on enable or disable', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()
    audioSystem.disable()

    // Still 1 the instant the switch was flipped: the change is ramped.
    expect(stub.valueAt(busGains(stub).master.gain)).toBe(1)
  })
})

describe('volume tiers', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('maps each tier to its gain and ramps instead of jumping', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub, VOLUME_TIER_GAIN } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    const { master } = busGains(stub)
    master.gain.linearRampToValueAtTime.mockClear()

    for (const tier of ['quiet', 'rich', 'silent'] as const) {
      audioSystem.setVolumeTier(tier)
      expect(audioSystem.getVolumeTier()).toBe(tier)
      expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(VOLUME_TIER_GAIN[tier], expect.any(Number))
      stub.advance(SETTLE)
      expect(stub.valueAt(master.gain)).toBe(VOLUME_TIER_GAIN[tier])
    }
    expect(master.gain.setValueAtTime).toHaveBeenCalled()
  })

  it('persists the chosen tier', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const first = await loadSystem()
    first.audioSystem.setVolumeTier('quiet')
    expect(localStorage.getItem('museum-audio-volume-tier')).toBe('quiet')

    const second = await loadSystem()
    expect(second.audioSystem.getVolumeTier()).toBe('quiet')
  })

  it('falls back to the normal tier when storage holds junk', async () => {
    localStorage.setItem('museum-audio-volume-tier', 'deafening')
    const { audioSystem } = await loadSystem()
    expect(audioSystem.getVolumeTier()).toBe('normal')
  })

  it('treats silent as a real tier, not a disable', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()
    audioSystem.setVolumeTier('silent')

    stub.advance(SETTLE)
    expect(stub.valueAt(busGains(stub).master.gain)).toBe(0)
    expect(audioSystem.isEnabled()).toBe(true)
  })
})

describe('independent sfx and music switches', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('defaults both on, independently of the master switch', async () => {
    const { audioSystem } = await loadSystem()
    expect(audioSystem.isSfxToggleOn()).toBe(true)
    expect(audioSystem.isMusicToggleOn()).toBe(true)
    // Master still defaults to silent; the sub-switches express intent.
    expect(audioSystem.isEnabled()).toBe(false)
  })

  it('mutes only the music bus when music is switched off', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    const { sfx, music } = busGains(stub)
    audioSystem.setMusicEnabled(false)

    expect(music.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))
    stub.advance(SETTLE)
    expect(stub.valueAt(music.gain)).toBe(0)
    expect(stub.valueAt(sfx.gain)).toBe(1)
    expect(audioSystem.isSfxToggleOn()).toBe(true)
    expect(audioSystem.ensureMusicBus()).toBeNull()
  })

  it('mutes only the sfx bus when sfx is switched off', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    const { sfx, music } = busGains(stub)
    audioSystem.setSfxEnabled(false)

    stub.advance(SETTLE)
    expect(stub.valueAt(sfx.gain)).toBe(0)
    expect(stub.valueAt(music.gain)).not.toBe(0)
    expect(audioSystem.isSfxEnabled()).toBe(false)
  })

  it('silences both when the master switch is off, whatever the sub-switches say', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem } = await loadSystem()
    audioSystem.enable()
    audioSystem.disable()

    expect(audioSystem.isSfxEnabled()).toBe(false)
    expect(audioSystem.isMusicEnabled()).toBe(false)
  })

  it('persists sub-switch preferences across reloads', async () => {
    const first = await loadSystem()
    first.audioSystem.setSfxEnabled(false)
    first.audioSystem.setMusicEnabled(false)

    const second = await loadSystem()
    expect(second.audioSystem.isSfxToggleOn()).toBe(false)
    expect(second.audioSystem.isMusicToggleOn()).toBe(false)
  })

  it('applies saved off switches to the first graph and leaves music unducked', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    localStorage.setItem('museum-audio-sfx', 'false')
    localStorage.setItem('museum-audio-music', 'false')
    const { audioSystem, stub } = await loadSystem()
    audioSystem.enable()
    const { sfx, music, duck } = busGains(stub!)
    expect(sfx.gain.value).toBe(0)
    expect(music.gain.value).toBe(0)
    await audioSystem.playInteraction('click')
    await audioSystem.playTransition('pageChange')
    await audioSystem.playNarrative('opening')
    expect(stub!.createdSources).toHaveLength(0)
    expect(duck.gain.linearRampToValueAtTime).not.toHaveBeenCalled()
  })

  it.each(['sfx', 'master'] as const)('does not revive pending effects after %s is switched off and on', async (control) => {
    const { audioSystem, stub } = await loadSystem()
    audioSystem.enable()
    const pending = [
      audioSystem.playInteraction('click'),
      audioSystem.playTransition('pageChange'),
      audioSystem.playNarrative('opening'),
    ]
    if (control === 'sfx') {
      audioSystem.setSfxEnabled(false)
      audioSystem.setSfxEnabled(true)
    } else {
      audioSystem.disable()
      audioSystem.enable()
    }
    await Promise.all(pending)
    expect(stub!.createdSources).toHaveLength(0)
    expect(busGains(stub!).duck.gain.linearRampToValueAtTime).not.toHaveBeenCalled()
    await audioSystem.playInteraction('click')
    expect(stub!.createdSources).toHaveLength(1)
  })

  it('survives blocked storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const { audioSystem } = await loadSystem()
    expect(audioSystem.isSfxToggleOn()).toBe(true)
    expect(audioSystem.isMusicToggleOn()).toBe(true)
    expect(() => audioSystem.setSfxEnabled(false)).not.toThrow()
  })
})

describe('ambience scene contract', () => {
  it('keeps the current room when returning before a replacement is ready', async () => {
    const { audioSystem, stub } = await loadSystem()
    audioSystem.enable()
    await audioSystem.switchAmbience('hall')
    const currentGain = stub!.createdGains[stub!.createdGains.length - 1]
    currentGain.gain.linearRampToValueAtTime.mockClear()
    const pending = audioSystem.switchAmbience('jade')
    await audioSystem.switchAmbience('hall')
    await pending
    expect(audioSystem.getAmbienceScene()).toBe('hall')
    expect(stub!.createdSources).toHaveLength(1)
    expect(currentGain.gain.linearRampToValueAtTime).not.toHaveBeenCalled()
  })

  it('discards pending ambience after mute', async () => {
    const { audioSystem, stub } = await loadSystem()
    audioSystem.enable()
    const pending = audioSystem.switchAmbience('jade')
    audioSystem.disable()
    await pending
    expect(audioSystem.getAmbienceScene()).toBeNull()
    expect(stub!.createdSources).toHaveLength(0)
  })

  it('only starts the latest of concurrent scene requests', async () => {
    const { audioSystem, stub } = await loadSystem()
    audioSystem.enable()
    await Promise.all([audioSystem.switchAmbience('jade'), audioSystem.switchAmbience('hall')])
    expect(audioSystem.getAmbienceScene()).toBe('hall')
    expect(stub!.createdSources).toHaveLength(1)
  })

  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('records the active scene and exposes it for route watchers', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem } = await loadSystem()
    audioSystem.enable()

    await audioSystem.switchAmbience('hall')
    expect(audioSystem.getAmbienceScene()).toBe('hall')
  })

  it('does not rebuild when asked for the scene already playing', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    await audioSystem.switchAmbience('jade')
    const sourcesAfterFirst = stub.createdSources.length
    await audioSystem.switchAmbience('jade')
    expect(stub.createdSources.length).toBe(sourcesAfterFirst)
  })

  it('connects ambience to the ambience bus, not straight to destination', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem, stub } = await loadSystem()
    if (!stub) throw new Error('stub context missing')
    audioSystem.enable()

    await audioSystem.switchAmbience('river')
    const sceneGain = stub.createdGains[stub.createdGains.length - 1]
    expect(sceneGain.connections).toContain(busGains(stub).ambience)
  })

  it('clears the active scene on stop so it can be re-entered', async () => {
    localStorage.setItem('museum-audio-enabled', 'true')
    const { audioSystem } = await loadSystem()
    audioSystem.enable()

    await audioSystem.switchAmbience('river')
    audioSystem.stopAmbience()
    expect(audioSystem.getAmbienceScene()).toBeNull()
  })

  it('does nothing while the system is disabled', async () => {
    const { audioSystem } = await loadSystem()
    await audioSystem.switchAmbience('hall')
    expect(audioSystem.getAmbienceScene()).toBeNull()
  })
})
