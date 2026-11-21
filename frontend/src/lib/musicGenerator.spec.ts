import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CROSSFADE,
  GenerativeMusic,
  LOOKAHEAD_WINDOW,
  MUSIC_SCENES,
  createGeneratorState,
  createRandom,
  degreeToFrequency,
  modePitchClasses,
  planPhrase,
  type MusicEvent,
  type MusicScene,
  type PentatonicMode,
} from './musicGenerator'

/**
 * The generator is split so that the musical decisions are pure functions
 * over a seeded PRNG. That is what makes these tests possible at all: every
 * assertion below is about the note sequence, not about sound, and none of
 * it needs an audio device.
 *
 * The scheduling tests at the bottom do need a context, so they run against
 * a minimal stub — enough to observe the audio clock advancing and to count
 * the nodes the scheduler creates.
 */

const ALL_MODES: PentatonicMode[] = ['gong', 'shang', 'jue', 'zhi', 'yu']
const ALL_SCENES = Object.keys(MUSIC_SCENES) as MusicScene[]

/** Every mode's pitch classes, as 12-TET semitone classes rounded to the
 *  nearest semitone. This is the table from classical theory, and it is the
 *  thing the derivation has to reproduce. */
const EXPECTED_SEMITONES: Record<PentatonicMode, number[]> = {
  gong: [0, 2, 4, 7, 9],
  shang: [0, 2, 5, 7, 10],
  jue: [0, 3, 5, 8, 10],
  zhi: [0, 2, 5, 7, 9],
  yu: [0, 3, 5, 7, 10],
}

describe('mode derivation', () => {
  it('derives all five modes as rotations of one scale', () => {
    // The whole reason JI_CENTS and MODE_ROTATION exist. Writing the modes
    // out as semitone offsets and adding those to their own fifth-chain
    // cents double-counts the chain and yields non-pentatonic intervals.
    //
    // The invariant is the cyclic step pattern *up to rotation*, not the
    // pitch-class set. 宫 and 商 share a set ({0,2,4,7,9} both times, once
    // measured from each mode's own tonic), so comparing sets would pass
    // even if a rotation were wrong. Comparing patterns without allowing
    // rotation fails for the same reason in reverse — 宫's steps begin on
    // its 204¢ interval and 商's on its 294¢ one.
    const cyclicPattern = (cents: number[]) => {
      const values = cents.map(value => ((value % 1200) + 1200) % 1200).sort((a, b) => a - b)
      return values.map((value, index) => {
        const next = values[(index + 1) % values.length]
        const step = next - value
        return step > 0 ? step : step + 1200
      })
    }
    const rotations = (pattern: number[]) =>
      pattern.map((_, offset) => pattern.map((_, i) => pattern[(i + offset) % pattern.length]).join(','))

    const reference = rotations(cyclicPattern(modePitchClasses('gong')))
    // 三分损益 gives exactly two distinct steps: 204¢ and 294¢. Seeing any
    // other value here means the chain was combined with the mode offsets
    // twice, or replaced by 12-TET.
    expect(new Set(cyclicPattern(modePitchClasses('gong')))).toEqual(new Set([204, 294]))

    for (const mode of ALL_MODES) {
      const candidate = cyclicPattern(modePitchClasses(mode))
      expect(rotations(candidate).some(pattern => reference.includes(pattern)),
        `${mode} steps ${candidate.join(',')} should rotate to match 宫`).toBe(true)
    }

    // And the patterns do match the classical table.
    for (const mode of ALL_MODES) {
      const semitones = modePitchClasses(mode)
        .map(cents => Math.round(cents / 100) % 12)
        .sort((a, b) => a - b)
      expect(semitones, `${mode} should sound as ${EXPECTED_SEMITONES[mode].join('-')}`)
        .toEqual(EXPECTED_SEMITONES[mode])
    }
  })

  it('keeps 角 and 羽 off their 12-TET values', () => {
    // 408¢ and 906¢ rather than 400¢ and 900¢. Losing these is the tell that
    // someone swapped the Pythagorean chain for equal temperament.
    const gong = modePitchClasses('gong')
    expect(gong[2]).toBeCloseTo(408, 6)
    expect(gong[4]).toBeCloseTo(906, 6)
    expect(gong[1]).toBeCloseTo(204, 6)
    expect(gong[3]).toBeCloseTo(702, 6)
  })

  it('starts every mode on its own tonic at degree zero', () => {
    for (const mode of ALL_MODES) {
      const profile = { ...MUSIC_SCENES.home, mode }
      expect(degreeToFrequency(profile, 0), mode).toBeCloseTo(profile.rootHz, 6)
    }
  })
})

describe('degree to frequency', () => {
  const gong = { ...MUSIC_SCENES.home, mode: 'gong' as const }

  it('wraps above the octave rather than clamping', () => {
    expect(degreeToFrequency(gong, 5)).toBeCloseTo(degreeToFrequency(gong, 0) * 2, 4)
    expect(degreeToFrequency(gong, 10)).toBeCloseTo(degreeToFrequency(gong, 0) * 4, 4)
  })

  it('wraps below the tonic, so the walk can step under its home note', () => {
    expect(degreeToFrequency(gong, -1)).toBeCloseTo(degreeToFrequency(gong, 4) / 2, 4)
    expect(degreeToFrequency(gong, -5)).toBeCloseTo(degreeToFrequency(gong, 0) / 2, 4)
  })

  it('treats the octave argument as a pure transposition', () => {
    for (const degree of [-3, 0, 2, 7]) {
      expect(degreeToFrequency(gong, degree, 1)).toBeCloseTo(degreeToFrequency(gong, degree) * 2, 4)
      expect(degreeToFrequency(gong, degree, -1)).toBeCloseTo(degreeToFrequency(gong, degree) / 2, 4)
    }
  })

  it('stays monotonic across a wide degree range', () => {
    // A rotation bug shows up as a note out of order, which this catches
    // without needing to know the intended frequencies.
    let previous = 0
    for (let degree = -10; degree <= 10; degree++) {
      const freq = degreeToFrequency(gong, degree)
      expect(freq, `degree ${degree}`).toBeGreaterThan(previous)
      previous = freq
    }
  })
})

describe('seeded randomness', () => {
  it('produces the same stream for the same seed', () => {
    const a = createRandom(12345)
    const b = createRandom(12345)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })

  it('produces different streams for different seeds', () => {
    const a = createRandom(1)
    const b = createRandom(2)
    const drawA = Array.from({ length: 10 }, () => a())
    const drawB = Array.from({ length: 10 }, () => b())
    expect(drawA).not.toEqual(drawB)
  })

  it('stays inside [0, 1)', () => {
    const random = createRandom(99)
    for (let i = 0; i < 500; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('phrase planning', () => {
  /** Collect several consecutive windows, the way the scheduler does. */
  function planMinutes(scene: MusicScene, seed: number, windows = 40): { events: MusicEvent[], state: ReturnType<typeof createGeneratorState> } {
    const profile = MUSIC_SCENES[scene]
    const state = createGeneratorState(seed, profile)
    const events: MusicEvent[] = []
    for (let i = 0; i < windows; i++) {
      events.push(...planPhrase(state, profile, LOOKAHEAD_WINDOW, i * LOOKAHEAD_WINDOW))
    }
    return { events, state }
  }

  /** The same events, but on the absolute timeline the scheduler uses:
   *  window start + offset. `offset` alone is window-relative, so
   *  consecutive events in the flat list can appear to go backwards when
   *  they cross a seam. Anything asserting on *spacing* has to work in
   *  these units, not in offsets. */
  function planAbsolute(scene: MusicScene, seed: number, windows = 40): Array<{ voice: string, at: number, freq?: number }> {
    const profile = MUSIC_SCENES[scene]
    const state = createGeneratorState(seed, profile)
    const out: Array<{ voice: string, at: number, freq?: number }> = []
    for (let i = 0; i < windows; i++) {
      const from = i * LOOKAHEAD_WINDOW
      for (const event of planPhrase(state, profile, LOOKAHEAD_WINDOW, from)) {
        out.push({ voice: event.voice, at: from + event.offset, freq: event.freq })
      }
    }
    return out
  }

  it('is reproducible from a seed', () => {
    const first = planMinutes('home', 4242).events
    const second = planMinutes('home', 4242).events
    expect(second).toEqual(first)
  })

  it('gives a different phrase for a different seed', () => {
    const a = planMinutes('home', 1).events.map(event => event.freq)
    const b = planMinutes('home', 2).events.map(event => event.freq)
    expect(a).not.toEqual(b)
  })

  it('opens every scene with the drone before anything melodic', () => {
    // Entering a room should establish the floor first, so the offset-zero
    // event is always the drone.
    for (const scene of ALL_SCENES) {
      const profile = MUSIC_SCENES[scene]
      const events = planPhrase(createGeneratorState(7, profile), profile, LOOKAHEAD_WINDOW)
      expect(events[0].voice, scene).toBe('drone')
      expect(events[0].offset, scene).toBe(0)
    }
  })

  it('keeps every event inside the requested window', () => {
    // Offsets are the scheduler's contract: it adds them to the window
    // start, so an offset at or beyond `LOOKAHEAD_WINDOW` would land inside
    // the next window and collide with whatever that pass plans.
    for (const scene of ALL_SCENES) {
      for (const event of planMinutes(scene, 31).events) {
        expect(event.offset, `${scene} ${event.voice}`).toBeLessThan(LOOKAHEAD_WINDOW)
        expect(event.offset, `${scene} ${event.voice}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('respects the per-scene minimum gap so notes never cluster', () => {
    // The floors in sampleGap exist because two notes that close together
    // read as one event, which destroys the unhurried feel.
    //
    // Measured on the absolute timeline on purpose. Planning runs window by
    // window and each voice's countdown starts wherever the previous
    // window left it, so a note can land just after a seam while the next
    // one lands just inside the following window — a gap that is invisible
    // in offset units, where the pair appears to run backwards, but is
    // plainly audible. This is a regression guard for exactly that.
    for (const scene of ALL_SCENES) {
      const profile = MUSIC_SCENES[scene]
      const plucks = planAbsolute(scene, 88, 40).filter(event => event.voice === 'pluck')
      for (let i = 1; i < plucks.length; i++) {
        const gap = plucks[i].at - plucks[i - 1].at
        expect(gap, `${scene} plucks at ${plucks[i].at.toFixed(3)}s`).toBeGreaterThan(0)
        expect(gap, `${scene} plucks at ${plucks[i].at.toFixed(3)}s`)
          .toBeGreaterThanOrEqual(profile.pluckMeanGap * 0.4 - 1e-9)
      }
    }
  })

  it('never emits a shimmer for a scene that disabled it', () => {
    for (const scene of ALL_SCENES) {
      if (MUSIC_SCENES[scene].shimmerMeanGap !== Infinity) continue
      const shimmers = planMinutes(scene, 5).events.filter(event => event.voice === 'shimmer')
      expect(shimmers, scene).toHaveLength(0)
    }
  })

  it('emits every voiced event with a finite frequency and a sane duration', () => {
    for (const scene of ALL_SCENES) {
      for (const event of planMinutes(scene, 909).events) {
        expect(Number.isFinite(event.gain), `${scene} gain`).toBe(true)
        expect(event.gain).toBeGreaterThan(0)
        expect(event.pan).toBeGreaterThanOrEqual(-1)
        expect(event.pan).toBeLessThanOrEqual(1)
        expect(event.duration).toBeGreaterThan(0)
        expect(Number.isFinite(event.duration)).toBe(true)
        if (event.voice === 'breath') {
          // Unpitched by design — a frequency here would mean the noise
          // layer had been replaced by a tone without anyone noticing.
          expect(event.freq, 'breath should be unpitched').toBeUndefined()
        } else {
          expect(Number.isFinite(event.freq), `${scene} ${event.voice} freq`).toBe(true)
          expect(event.freq!).toBeGreaterThan(20)
          expect(event.freq!).toBeLessThan(12000)
        }
      }
    }
  })

  it('bounds the melodic walk instead of letting it drift', () => {
    // Five degrees to the octave, so a 12-semitone span is five either side,
    // and the drone sits an octave below the lowest register.
    const { events } = planMinutes('exhibit', 13, 120)
    const profile = MUSIC_SCENES.exhibit
    const tonic = profile.rootHz
    for (const event of events) {
      // `breath` is unpitched air — it has no frequency to bound, and
      // asserting on one would only be asserting on `undefined`.
      if (event.voice === 'breath') continue
      // The drone is measured down one octave from the reference range, so
      // its floor is a further octave below the registers.
      const lower = event.voice === 'drone'
        ? tonic * Math.pow(2, profile.registers[0] - 3)
        : tonic * Math.pow(2, profile.registers[0] - 2)
      const upper = tonic * Math.pow(2, profile.registers[profile.registers.length - 1] + 2)
      expect(event.freq!, `${event.voice} at ${event.offset.toFixed(2)}s`).toBeLessThan(upper)
      expect(event.freq!, `${event.voice} at ${event.offset.toFixed(2)}s`).toBeGreaterThan(lower)
    }
  })

  it('walks the melody over time rather than repeating one note', () => {
    const pitches = new Set(
      planMinutes('collection', 21, 60).events
        .filter(event => event.voice === 'pluck')
        .map(event => event.freq!.toFixed(3)),
    )
    expect(pitches.size).toBeGreaterThan(3)
  })

  it('lands every pitched note on the scene scale', () => {
    // The strongest statement of intent: whatever the walk does, it stays
    // inside the mode. Matching by pitch class rather than by frequency
    // means this catches an off-scale note at any octave.
    for (const scene of ALL_SCENES) {
      const profile = MUSIC_SCENES[scene]
      const allowedClasses = modePitchClasses(profile.mode).map(cents => ((cents % 1200) + 1200) % 1200)

      for (const event of planMinutes(scene, 77, 30).events) {
        if (event.voice === 'breath') continue
        const cents = 1200 * Math.log2(event.freq! / profile.rootHz)
        const asClass = ((cents % 1200) + 1200) % 1200
        const nearest = Math.min(...allowedClasses.map(allowed =>
          Math.min(Math.abs(allowed - asClass), 1200 - Math.abs(allowed - asClass))))
        // The drone carries a deliberate ±0.075% detune, worth about 1.3¢.
        expect(nearest, `${scene} ${event.voice} at ${event.freq?.toFixed(2)} Hz`).toBeLessThan(4)
      }
    }
  })

  it('is quiet by design', () => {
    // A soundscape that is meant to be almost unnoticeable should be
    // measurably sparse. If a future tweak makes it busy, this fails before
    // anyone has to listen for it.
    for (const scene of ALL_SCENES) {
      const profile = MUSIC_SCENES[scene]
      const minutes = 10
      const windows = (minutes * 60) / LOOKAHEAD_WINDOW
      const plucks = planMinutes(scene, 3, windows).events.filter(event => event.voice === 'pluck').length
      const expected = (minutes * 60) / profile.pluckMeanGap
      expect(plucks, `${scene} plucks in ${minutes} min`).toBeLessThan(expected * 2.2)
    }
  })
})

// =====================================================================
// Scheduling — needs a context stub, but only for the clock and node count.
// =====================================================================

function createStubParam(initial = 1) {
  const param = {
    value: initial,
    scheduled: [] as Array<{ at: number, value: number }>,
    setValueAtTime: vi.fn((value: number, at: number) => { param.scheduled.push({ at, value }) }),
    linearRampToValueAtTime: vi.fn((value: number, at: number) => { param.scheduled.push({ at, value }) }),
    exponentialRampToValueAtTime: vi.fn((value: number, at: number) => { param.scheduled.push({ at, value }) }),
    cancelScheduledValues: vi.fn(() => { param.scheduled = [] }),
  }
  return param
}

function createScheduleStub() {
  const created: { gains: unknown[], sources: unknown[] } = { gains: [], sources: [] }

  const makeNode = (extra: Record<string, unknown> = {}) => {
    const node: Record<string, unknown> = {
      connect: (target: unknown) => target,
      ...extra,
    }
    return node
  }

  const context = {
    currentTime: 0,
    state: 'running',
    sampleRate: 48000,
    destination: { kind: 'destination' },
    created,
    createGain() {
      const node = { gain: createStubParam(1), connect: (target: unknown) => target }
      created.gains.push(node)
      return node
    },
    createOscillator() {
      const node = makeNode({
        type: 'sine',
        frequency: createStubParam(440),
        detune: { value: 0 },
        onended: null as null | (() => void),
        start: vi.fn(),
        stop: vi.fn(),
      })
      created.sources.push(node)
      return node
    },
    createBufferSource() {
      const node = makeNode({
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        onended: null as null | (() => void),
        start: vi.fn(),
        stop: vi.fn(),
      })
      created.sources.push(node)
      return node
    },
    createBiquadFilter: () => makeNode({ type: 'bandpass', frequency: createStubParam(800), Q: { value: 1 } }),
    createStereoPanner: () => makeNode({ pan: createStubParam(0) }),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  }
  return context
}

/**
 * Advances the stub's audio clock alongside vitest's fake timers.
 *
 * The two are separate on purpose, and the scheduler is written against the
 * audio clock: a real `AudioContext` moves `currentTime` whether or not the
 * JS timer fires, and the `at < now` guard drops anything already past.
 * Leaving the stub's clock at zero makes every later tick schedule into a
 * past that never happened, so the notes vanish and the test measures the
 * stub rather than the scheduler.
 */
function advance(context: { currentTime: number }, ms: number): void {
  context.currentTime += ms / 1000
  vi.advanceTimersByTime(ms)
}

describe('generative scheduler', () => {
  afterEach(() => { vi.useRealTimers() })

  it('starts a scene and reports it as running', () => {
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()

    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 1)
    expect(music.getScene()).toBe('home')
    expect(music.isRunning()).toBe(true)
  })

  it('creates one output gain per scene and crossfades rather than hard-cutting', () => {
    // The output gain is the *first* node `start` asks for; everything
    // after it is an envelope belonging to the first window's notes. Order
    // is what makes it identifiable — the count is not meaningful, since it
    // depends on how many notes the scene happened to plan.
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    const destination = context.destination as unknown as AudioNode

    music.start(context as unknown as AudioContext, destination, 'home', 1)
    const first = context.created.gains[0] as { gain: ReturnType<typeof createStubParam> }

    // A fade-in rather than a hard cut on the way in.
    expect(first.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))
    expect(first.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      MUSIC_SCENES.home.gain,
      expect.any(Number),
    )

    // A scene change prepends exactly one new gain, which becomes the new
    // output; the previous window's envelopes are already behind it.
    const before = context.created.gains.length
    music.setScene('store')
    expect(music.getScene()).toBe('store')
    const second = context.created.gains[before] as { gain: ReturnType<typeof createStubParam> }
    expect(second.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      MUSIC_SCENES.store.gain,
      expect.any(Number),
    )

    // The outgoing scene ramps down over the crossfade, not instantly.
    // Note which node that is: each `setScene` fades out the output it is
    // replacing, so by now that is `second`, not the original `first`.
    // Fading to ~0 rather than 0 is deliberate — a linear ramp to exactly
    // zero is inaudible at the tail, and it leaves the source stop to
    // `releaseSources` rather than pretending the fade ended the note.
    second.gain.linearRampToValueAtTime.mockClear()
    music.setScene('story')
    expect(second.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1)
    const [target, at] = second.gain.linearRampToValueAtTime.mock.calls[0]
    expect(target).toBeLessThan(0.001)
    expect(target).toBeGreaterThanOrEqual(0)
    expect(at).toBeGreaterThan(0)
    // The fade runs over the crossfade's own schedule, not the next tick.
    expect(at).toBeLessThanOrEqual(DEFAULT_CROSSFADE.fadeOut + 0.001)
  })

  it('does not restart when asked for the scene already playing', () => {
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    const destination = context.destination as unknown as AudioNode

    music.start(context as unknown as AudioContext, destination, 'story', 4)
    const gainsAfterStart = context.created.gains.length
    const sourcesAfterStart = context.created.sources.length

    music.start(context as unknown as AudioContext, destination, 'story', 4)
    expect(context.created.gains.length).toBe(gainsAfterStart)
    expect(context.created.sources.length).toBe(sourcesAfterStart)
  })

  it('schedules notes ahead of the audio clock', () => {
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 1)

    expect(context.created.sources.length).toBeGreaterThan(0)
    const started = context.created.sources as Array<{ start: { mock: { calls: number[][] } } }>
    for (const source of started) {
      expect(source.start.mock.calls.length).toBeGreaterThan(0)
      expect(source.start.mock.calls[0][0]).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps the window contiguous across ticks instead of double-booking it', () => {
    // Each pass plans the next window on the absolute timeline, so
    // successive windows neither overlap (which would thicken the texture)
    // nor leave a gap (which would be a hole in the music).
    //
    // Deliberately uses `home` rather than a sparse scene: `collection`
    // legitimately plans zero events for some windows — a 5.89 s pluck is
    // followed by a ~13 s gap — so "the next tick adds sources" would be
    // asserting on density, not on contiguity. What is being checked here
    // is that the windows tile without repeating, which needs a scene that
    // actually has notes in every window.
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 9)

    const afterFirst = context.created.sources.length
    expect(afterFirst).toBeGreaterThan(0)

    advance(context, 1200)
    const afterSecond = context.created.sources.length
    expect(afterSecond).toBeGreaterThan(afterFirst)

    // A second window is not meant to be dramatically denser than the first.
    const firstWindow = afterSecond - afterFirst
    expect(firstWindow / afterFirst).toBeLessThan(3)

    // And the third pass must keep going, not restate the first window.
    advance(context, 1200)
    const secondWindow = context.created.sources.length - afterSecond
    expect(secondWindow).toBeGreaterThan(0)
    expect(secondWindow / firstWindow).toBeLessThan(3)
  })

  it('drops events that are already in the past rather than firing them at once', () => {
    // A suspended context — a backgrounded tab — would otherwise hand the
    // scheduler a backlog that all plays on resume. The guard has to hold
    // even when the clock jumps forward by minutes.
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 3)

    const before = context.created.sources.length
    context.currentTime += 120
    vi.advanceTimersByTime(1200)

    const fresh = context.created.sources.slice(before) as Array<{ start: { mock: { calls: number[][] } } }>
    const startTimes = fresh
      .map(source => source.start.mock.calls[0]?.[0])
      .filter((at): at is number => typeof at === 'number')

    // Nothing is back-dated: every note is still ahead of the clock.
    for (const at of startTimes) {
      expect(at).toBeGreaterThanOrEqual(context.currentTime - 0.5)
    }

    // And the burst is confined to a single window. If the skipped two
    // minutes had been replayed, the notes would be spread across them
    // instead of packed into the next six seconds.
    if (startTimes.length > 1) {
      const spread = Math.max(...startTimes) - Math.min(...startTimes)
      expect(spread).toBeLessThan(LOOKAHEAD_WINDOW + 1)
    }

    // Sanity: it did keep playing rather than falling silent for good.
    expect(startTimes.length).toBeGreaterThan(0)
  })

  it('plans nothing while the context is suspended', () => {
    // The clock stops when a context is suspended, so scheduling against it
    // is meaningless until it resumes.
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 3)

    context.state = 'suspended'
    const before = context.created.sources.length
    vi.advanceTimersByTime(1200)
    expect(context.created.sources.length).toBe(before)

    context.state = 'running'
    advance(context, 1200)
    expect(context.created.sources.length).toBeGreaterThan(before)
  })

  it('stops cleanly and can be restarted', () => {
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    const destination = context.destination as unknown as AudioNode

    music.start(context as unknown as AudioContext, destination, 'home', 1)
    music.stop()
    expect(music.isRunning()).toBe(false)
    expect(music.getScene()).toBeNull()

    const countAfterStop = context.created.sources.length
    vi.advanceTimersByTime(5000)
    expect(context.created.sources.length).toBe(countAfterStop)

    music.start(context as unknown as AudioContext, destination, 'home', 2)
    expect(music.isRunning()).toBe(true)
  })

  it('releases its sources on stop rather than abandoning them', () => {
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 1)

    const sources = context.created.sources as Array<{ stop: { mock: { calls: Array<[number?]> } } }>
    music.stop()
    const stopped = sources.filter(source => source.stop.mock.calls.length > 0)
    expect(stopped.length).toBeGreaterThan(0)
    // Released in the future, so the fade-out has something left to fade.
    expect(stopped.every(source => (source.stop.mock.calls[0][0] ?? 0) > 0)).toBe(true)
    expect(music.activeSourceCount()).toBe(0)
  })

  it('does not schedule while the context is suspended', () => {
    // A backgrounded tab must not accumulate a backlog that all fires at
    // once on resume.
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 1)

    const before = context.created.sources.length
    context.state = 'suspended'
    vi.advanceTimersByTime(12000)
    expect(context.created.sources.length).toBe(before)
  })

  it('accumulates nothing when stop is called twice', () => {
    vi.useFakeTimers()
    const context = createScheduleStub()
    const music = new GenerativeMusic()
    music.start(context as unknown as AudioContext, context.destination as unknown as AudioNode, 'home', 1)

    music.stop()
    const afterFirst = context.created.sources.length
    music.stop()
    vi.advanceTimersByTime(8000)
    expect(context.created.sources.length).toBe(afterFirst)
  })

  it('uses a crossfade long enough to be inaudible as a cut', () => {
    expect(DEFAULT_CROSSFADE.fadeIn).toBeGreaterThan(1)
    expect(DEFAULT_CROSSFADE.fadeOut).toBeGreaterThan(1)
  })

  it('exposes no scene before it is started', () => {
    expect(new GenerativeMusic().getScene()).toBeNull()
    expect(new GenerativeMusic().isRunning()).toBe(false)
  })

  it('ignores setScene before start', () => {
    const music = new GenerativeMusic()
    music.setScene('store')
    expect(music.getScene()).toBeNull()
  })
})
