/**
 * Generative music for the Heluo museum.
 *
 * ── What this is trying to be
 *
 * The brief was "bold, distinctive, and genuinely refined". In a museum
 * that rules out the obvious reading of "background music". A melody with
 * a hook is the opposite of refined here: it is pleasant for thirty
 * seconds and then, on a detail page where someone is reading three
 * paragraphs of artifact history, it becomes an advertisement for itself.
 * Once a visitor can hum it, the second visit is "oh, this again" and the
 * spell is broken.
 *
 * So the target is a *soundscape*, not a tune: pentatonic, unhurried,
 * mostly quiet, with note spacing measured in whole seconds. The intended
 * effect is the one described in the plan — "someone is trying out a qin
 * far away in the next gallery". It should be almost unnoticeable, and
 * its absence should be what you notice when the switch goes off.
 *
 * ── How it is built
 *
 * Four voices, all synthesized live on the AudioContext (no buffers, no
 * files, nothing to fetch or license):
 *
 *   drone   a very slow low bed, re-struck every ~20-40s, never sustained
 *           as a held tone — this is the floor the ear reads as "room"
 *   pluck   qin-like: fast inharmonic attack, long decay
 *   breath  a xiao/ceramic-air texture: filtered noise, no clear pitch
 *   shimmer a struck bell partial, used sparingly as punctuation
 *
 * Musical decisions are made in *seconds*, not beats. There is no tempo
 * and no metrical grid anywhere in this file; a phrase is a list of
 * offsets in a time window. That single choice is what keeps this from
 * sounding like a loop.
 *
 * Tuning follows the classical 三分损益法 ("three parts, gain one, lose
 * one") from the 宫 fundamental rather than 12-TET, so the intervals carry
 * the slight ancient shimmer instead of modern piano consonance. Mode and
 * register are chosen per scene from MUSIC_SCENES below.
 *
 * ── Why the state is split the way it is
 *
 * Everything down to LOOKAHEAD_WINDOW is pure: no Web Audio, no timers, no
 * side effects. `planPhrase` is the single source of truth for what the
 * music does, so a test can call it with a fixed seed and assert on the
 * result without an audio device. Everything below it talks to the audio
 * clock.
 */

// =====================================================================
// Pure music theory — no Web Audio, no side effects, fully deterministic.
// =====================================================================

export type MusicScene = 'home' | 'collection' | 'exhibit' | 'story' | 'booking' | 'store' | 'account' | 'quiet'

export type PentatonicMode = 'gong' | 'shang' | 'jue' | 'zhi' | 'yu'

/**
 * The five pitch classes 宫商角徵羽 as 三分损益法 ("three parts: gain one,
 * lose one") cents, generated outward from the 宫 fundamental by
 * alternating ×3/2 (上生) and ×2/3 (下生):
 *
 *   宫   0
 *   商 204  ← 徵 × 2/3
 *   角 408
 *   徵 702  ← 宫 × 3/2
 *   羽 906
 *
 * This is the *pitch material* of 宫调. Every other mode reuses exactly
 * this set — 宫商角徵羽 as 调式 are rotations of one scale, not five
 * different scales. That distinction is the easiest thing to get wrong in
 * this file, and getting it wrong produces intervals that are not
 * pentatonic at all: writing a rotation as semitone offsets and then
 * adding those offsets to their own fifth-chain cents double-counts the
 * chain. So there is one cents array and one rotation table below, and
 * every scale is derived from them.
 *
 * The cents are Pythagorean, not 12-TET, so 角 sits at 408 rather than 400
 * and 羽 at 906 rather than 900. Those few extra cents are audible as a
 * faint ancient shimmer over modern-tempered pitch, which is the point.
 */
const JI_CENTS = [0, 204, 408, 702, 906]

/** Which degree of JI_CENTS acts as each mode's tonic — 宫调 rests on 宫,
 *  商调 on 商, and so on. */
const MODE_ROTATION: Record<PentatonicMode, number> = {
  gong: 0, shang: 1, jue: 2, zhi: 3, yu: 4,
}

/**
 * Pitch classes of a mode, in cents above that mode's own tonic. Exported
 * because it is the cleanest possible statement of what the modes are,
 * and because a test asserts that generated notes land on these and
 * nowhere else.
 *
 *   gong →   0 204 408 702 906   (0 2 4 7 9 — open, the brightest)
 *   shang →  0 204 498 702 996   (0 2 5 7 10)
 *   jue  →   0 294 498 792 996   (0 3 5 8 10)
 *   zhi  →   0 204 498 702 906   (0 2 5 7 9)
 *   yu   →   0 294 498 702 996   (0 3 5 7 10 — the dark, inward one)
 */
export function modePitchClasses(mode: PentatonicMode): number[] {
  const rotation = MODE_ROTATION[mode]
  const tonic = JI_CENTS[rotation]
  return JI_CENTS.map((_, index) => {
    const position = rotation + index
    const absolute = JI_CENTS[position % JI_CENTS.length] + 1200 * Math.floor(position / JI_CENTS.length)
    return absolute - tonic
  })
}

/**
 * Scale-degree weights for the melodic walk. Degree 0 (the 宫 tonic) and
 * degree 3 (the 徵 fifth) are the resting tones, so they appear most;
 * degree 4 (羽 sixth) is the colour tone and is used sparingly. A flat
 * distribution here is what makes generated melodies wander pointlessly.
 */
const DEGREE_WEIGHTS = [30, 22, 18, 25, 12]

/** Descending steps outnumber ascending ones. Rising lines read as
 *  "building toward something" — an assertion the museum has no reason to
 *  make on every page. Falling lines settle, which is the register a
 *  gallery wants. */
const DESCENT_BIAS = 0.58

/** Semitone span of the melodic walk, and the chance of not moving at all.
 *  A high stay-put probability traded against real leaps is what stops the
 *  output from sounding like a random walk through a scale. */
const MELODY_SPAN_SEMITONES = 12
const NEUTRAL_STEP_CHANCE = 0.22

export interface SceneProfile {
  /** Frequency of this mode's *tonic* — the note the ear treats as home.
   *  The 宫 fundamental the fifth-chain maths works from is derived from
   *  it rather than stored, so each scene is written as "what key is this
   *  page in" and the tuning follows. */
  rootHz: number
  mode: PentatonicMode
  /** Relative loudness of the whole scene, before the music bus. */
  gain: number
  /** Mean seconds between pluck onsets. Larger = sparser. */
  pluckMeanGap: number
  /** Mean seconds between breath textures. */
  breathMeanGap: number
  /** Mean seconds between shimmer bells; Infinity disables them. */
  shimmerMeanGap: number
  /** Mean seconds between drone re-strikes. */
  droneGap: number
  /** Probability a pluck is joined by a low bass pluck. */
  bassChance: number
  /** Scale degrees (indices into the mode) used for the drone bed. */
  droneDegrees: number[]
  /** Registers (octave transpositions) available to the melodic walk. */
  registers: number[]
}

/**
 * Per-route musical identity. Every entry is a deliberate pairing of
 * register, mode and density with what the page is for:
 *
 * - `home`      widest and slowest; the low drone plus a sparse, high
 *               shimmer is the "entering the building" gesture.
 * - `story`     the quietest and sparsest of all. A detail page is
 *               reading; music here is furniture, and `yu` keeps it dark
 *               so it does not compete with text.
 * - `exhibit`   more activity and higher register — a 3D gallery is
 *               navigated rather than read, and benefits from a sense of
 *               air moving.
 * - `store`     the only genuinely bright entry (`zhi`, highest root).
 *               A shop is lighter in tone without being jaunty.
 * - `booking`   deliberately plain; a form should not be scored.
 * - `quiet`     effectively off: only the drone remains, at low gain.
 */
export const MUSIC_SCENES: Record<MusicScene, SceneProfile> = {
  home: {
    rootHz: 130.81, mode: 'gong', gain: 0.5,
    pluckMeanGap: 5.5, breathMeanGap: 9, shimmerMeanGap: 17, droneGap: 34,
    bassChance: 0.22, droneDegrees: [0, 3], registers: [0, 1, 2],
  },
  collection: {
    rootHz: 146.83, mode: 'zhi', gain: 0.44,
    pluckMeanGap: 4.2, breathMeanGap: 8, shimmerMeanGap: 15, droneGap: 28,
    bassChance: 0.3, droneDegrees: [0, 3], registers: [0, 1],
  },
  exhibit: {
    rootHz: 130.81, mode: 'yu', gain: 0.36,
    pluckMeanGap: 5.8, breathMeanGap: 12, shimmerMeanGap: 30, droneGap: 40,
    bassChance: 0.26, droneDegrees: [0, 3], registers: [0, 1],
  },
  story: {
    rootHz: 110, mode: 'yu', gain: 0.34,
    pluckMeanGap: 8.5, breathMeanGap: 18, shimmerMeanGap: Infinity, droneGap: 52,
    bassChance: 0.25, droneDegrees: [0, 3], registers: [0, 1],
  },
  booking: {
    rootHz: 147, mode: 'shang', gain: 0.3,
    pluckMeanGap: 7.5, breathMeanGap: 13, shimmerMeanGap: Infinity, droneGap: 40,
    bassChance: 0.2, droneDegrees: [0, 3], registers: [1],
  },
  store: {
    rootHz: 196, mode: 'zhi', gain: 0.38,
    pluckMeanGap: 5, breathMeanGap: 12, shimmerMeanGap: 30, droneGap: 36,
    bassChance: 0.24, droneDegrees: [0, 3], registers: [0, 1],
  },
  account: {
    rootHz: 138.59, mode: 'gong', gain: 0.28,
    pluckMeanGap: 6, breathMeanGap: 10, shimmerMeanGap: 22, droneGap: 36,
    bassChance: 0.2, droneDegrees: [0, 3], registers: [1],
  },
  quiet: {
    rootHz: 98, mode: 'yu', gain: 0.22,
    pluckMeanGap: 12, breathMeanGap: 18, shimmerMeanGap: Infinity, droneGap: 44,
    bassChance: 0.15, droneDegrees: [0], registers: [0],
  },
}

export type MusicVoice = 'drone' | 'pluck' | 'breath' | 'shimmer'

export interface MusicEvent {
  /** Seconds from the start of the planning window. */
  offset: number
  voice: MusicVoice
  duration: number
  /** Set for every voice except `breath`, which is unpitched. */
  freq?: number
  gain: number
  /** −1..1 stereo placement, fixed per event for a sense of seating. */
  pan: number
  /** Only meaningful for `pluck`: an octave-lower companion note. */
  bassFreq?: number
}

/**
 * Mulberry32. A tiny seeded PRNG is enough here and keeps the whole
 * generator reproducible in tests, which `Math.random()` cannot.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Convert a 五度相生 cents offset to a frequency multiplier. */
function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

/**
 * Resolve a scale degree to a frequency. Indices below zero and beyond one
 * octave wrap into neighbouring octaves rather than clamping, so the walk
 * can step under the tonic or over the 徵 fifth without a special case.
 */
export function degreeToFrequency(profile: SceneProfile, degree: number, octave = 0): number {
  const rotation = MODE_ROTATION[profile.mode]
  // Invert the rotation to recover the 宫 fundamental this tonic implies,
  // then measure everything in 宫-relative cents from there. This is what
  // keeps the modes genuinely related: they are the same five pitch
  // classes, heard from a different resting point.
  const fundamental = profile.rootHz / centsToRatio(JI_CENTS[rotation])

  const position = rotation + degree
  const wrapped = ((position % 5) + 5) % 5
  const octaveShift = Math.floor(position / 5)
  return fundamental * centsToRatio(JI_CENTS[wrapped] + 1200 * (octaveShift + octave))
}

/** Weighted pick over the degree weights; returns the chosen index. */
function pickDegree(random: () => number): number {
  const total = DEGREE_WEIGHTS.reduce((sum, weight) => sum + weight, 0)
  let roll = random() * total
  for (let index = 0; index < DEGREE_WEIGHTS.length; index++) {
    roll -= DEGREE_WEIGHTS[index]
    if (roll <= 0) return index
  }
  return DEGREE_WEIGHTS.length - 1
}

/**
 * Exponential-ish gap sampling with a hard floor. The floor matters: a
 * pure exponential can return a gap near zero, which would cluster two
 * notes into what the ear hears as one event and destroy the unhurried
 * feel the whole design rests on.
 */
function sampleGap(random: () => number, mean: number, minGap: number): number {
  const u = Math.max(random(), 1e-6)
  return Math.max(minGap, -Math.log(u) * mean)
}

export interface GeneratorState {
  random: () => number
  /** Where the melodic walk currently sits, as a mode-relative degree. */
  degree: number
  /**
   * Next event time for each voice, on an **absolute** timeline measured
   * from the start of the session.
   *
   * Absolute rather than relative-to-window, deliberately. A relative
   * countdown has to be decremented by the window length after each pass,
   * but a voice only *consumes* its countdown for events that fall inside
   * the window — the final sample, which lands past the end, was taken
   * relative to the window's start. Advancing it as if it were relative to
   * the window's end subtracts a full window that was never elapsed, so the
   * gap stretches by LOOKAHEAD_WINDOW on every pass and the voice falls
   * silent. Tracking absolute time makes the two cases identical.
   */
  next: Record<MusicVoice, number>
}

export function createGeneratorState(seed: number, profile: SceneProfile): GeneratorState {
  const random = createRandom(seed)
  return {
    random,
    degree: pickDegree(random),
    next: {
      pluck: sampleGap(random, profile.pluckMeanGap, profile.pluckMeanGap * 0.4),
      breath: sampleGap(random, profile.breathMeanGap, 2),
      shimmer: profile.shimmerMeanGap === Infinity ? Infinity : sampleGap(random, profile.shimmerMeanGap, 3),
      // The drone opens the scene: entering a room should establish the
      // floor before anything melodic happens over it.
      drone: 0,
    },
  }
}

/**
 * Step the melodic walk. Small intervals dominate with an occasional leap
 * for shape; direction is biased downward per DESCENT_BIAS.
 */
function walkDegree(state: GeneratorState): number {
  const { random } = state
  if (random() < NEUTRAL_STEP_CHANCE) return state.degree

  const roll = random()
  const step = roll < 0.55 ? 1 : roll < 0.85 ? 2 : 3
  const direction = random() < DESCENT_BIAS ? -1 : 1
  let next = state.degree + direction * step

  // Five degrees to the octave, so a twelve-semitone span is five degrees
  // either side. Bound the walk rather than folding it: folding would
  // produce an abrupt register jump every time it reached an edge.
  const span = Math.floor(MELODY_SPAN_SEMITONES / (12 / 5))
  if (next < -span) next = -span
  if (next > span) next = span
  return next
}

/**
 * Plan one phrase covering `[from, from + duration)` on the absolute
 * timeline, advancing the state past the window.
 *
 * Offsets in the returned events are relative to `from`, which is what the
 * scheduler adds to the audio clock.
 *
 * Every emitted offset is strictly inside the window. That matters more
 * than it looks: a voice whose countdown has already run past the end is
 * *carried*, not emitted, and it keeps its absolute position on the
 * timeline. Emitting it early — clamped to the window end, or emitted here
 * and then re-derived from a countdown that has not advanced — would place
 * two notes on top of each other where the windows meet. The seam is the
 * one place in the schedule where a collision cannot be caught by ear
 * until it is already in the shipped soundscape.
 */
export function planPhrase(
  state: GeneratorState,
  profile: SceneProfile,
  duration: number,
  from = 0,
): MusicEvent[] {
  const { random } = state
  const events: MusicEvent[] = []
  const until = from + duration

  // Drone: re-struck rather than held, so the bed breathes. A single
  // sustained tone under everything is what makes generative music sound
  // synthetic.
  while (state.next.drone < until) {
    const degree = profile.droneDegrees[Math.floor(random() * profile.droneDegrees.length)]
    events.push({
      offset: state.next.drone - from,
      voice: 'drone',
      duration: Math.min(profile.droneGap * 1.6, 26),
      freq: degreeToFrequency(profile, degree, -1) * (1 + (random() - 0.5) * 0.0015),
      gain: 0.5 + random() * 0.12,
      pan: (random() - 0.5) * 0.5,
    })
    state.next.drone += sampleGap(random, profile.droneGap, profile.droneGap * 0.55)
  }

  // Pluck: the melodic surface — the voice a visitor might notice.
  while (state.next.pluck < until) {
    state.degree = walkDegree(state)
    const octave = profile.registers[Math.floor(random() * profile.registers.length)]
    const event: MusicEvent = {
      offset: state.next.pluck - from,
      voice: 'pluck',
      duration: 2.4 + random() * 2.6,
      freq: degreeToFrequency(profile, state.degree, octave),
      gain: 0.6 + random() * 0.2,
      pan: (random() - 0.5) * 0.6,
    }
    if (random() < profile.bassChance) {
      event.bassFreq = degreeToFrequency(profile, state.degree, Math.max(0, octave - 2))
    }
    events.push(event)
    state.next.pluck += sampleGap(random, profile.pluckMeanGap, profile.pluckMeanGap * 0.4)
  }

  // Breath: unpitched air, placed on its own clock so the two layers never
  // lock into a shared rhythm.
  while (state.next.breath < until) {
    events.push({
      offset: state.next.breath - from,
      voice: 'breath',
      duration: 2.2 + random() * 2.4,
      gain: 0.32 + random() * 0.16,
      pan: (random() - 0.5) * 0.9,
    })
    state.next.breath += sampleGap(random, profile.breathMeanGap, profile.breathMeanGap * 0.45)
  }

  // Shimmer: a bell partial, high and rare. Purely punctuation — its
  // scarcity is what makes it read as an event rather than decoration.
  while (state.next.shimmer < until) {
    events.push({
      offset: state.next.shimmer - from,
      voice: 'shimmer',
      duration: 3.5 + random() * 3,
      freq: degreeToFrequency(profile, pickDegree(random), profile.registers[profile.registers.length - 1]),
      gain: 0.24 + random() * 0.12,
      pan: (random() - 0.5) * 0.8,
    })
    state.next.shimmer += sampleGap(random, profile.shimmerMeanGap, profile.shimmerMeanGap * 0.5)
  }

  events.sort((a, b) => a.offset - b.offset)
  return events
}

/** Seconds of music planned per scheduler pass. Long enough to survive a
 *  busy main thread, short enough that a scene change is responsive. */
export const LOOKAHEAD_WINDOW = 6

/** How often the planner wakes up. Comfortably under the window so a
 *  delayed tick never leaves a hole in the music. */
export const SCHEDULER_INTERVAL_MS = 1200

// =====================================================================
// Live scheduling — creates Web Audio nodes on a real AudioContext.
// =====================================================================

/** Overtone sets for the pitched voices. The pluck is qin-like: a strong
 *  fundamental with a fast-decaying upper partial, struck rather than
 *  bowed. The shimmer reuses the inharmonic bell ratios from the sound
 *  effects library so the two systems share one acoustic world. */
const PLUCK_PARTIALS = [
  { ratio: 1, amp: 1, decay: 1 },
  { ratio: 2.01, amp: 0.36, decay: 0.6 },
  { ratio: 3.02, amp: 0.16, decay: 0.38 },
  { ratio: 4.06, amp: 0.07, decay: 0.24 },
]

const SHIMMER_PARTIALS = [
  { ratio: 1, amp: 0.9, decay: 0.85 },
  { ratio: 2, amp: 0.16, decay: 0.35 },
  { ratio: 3, amp: 0.035, decay: 0.18 },
]

const DRONE_PARTIALS = [
  { ratio: 1, amp: 0.7, decay: 1 },
  { ratio: 2, amp: 0.22, decay: 0.8 },
  { ratio: 3, amp: 0.09, decay: 0.6 },
]

/**
 * One shared noise buffer per context, built lazily from a fixed seed so
 * the texture is reproducible; the breath voice reads a random slice of it
 * rather than allocating a buffer per note.
 */
const noiseCache = new WeakMap<AudioContext, AudioBuffer>()

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  const cached = noiseCache.get(context)
  if (cached) return cached
  const length = Math.floor(context.sampleRate * 2)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  const random = createRandom(0x5eed10)
  for (let i = 0; i < length; i++) data[i] = random() * 2 - 1
  noiseCache.set(context, buffer)
  return buffer
}

interface RenderContext {
  context: AudioContext
  destination: AudioNode
  /** Node registry so a scene change or stop can release what is still
   *  ringing instead of abandoning it. */
  active: Set<AudioScheduledSourceNode>
  /** Synthesis-only randomness, kept apart from the generator's own stream
   *  so the planned note sequence does not depend on how many times a synth
   *  parameter happened to be jittered. */
  random: () => number
}

function schedulePluck(ctx: RenderContext, event: MusicEvent, at: number) {
  const { random } = ctx
  const fundamental = event.freq!
  // Partial ratios are deliberately inharmonic: a struck string's upper
  // partials are not exact multiples, and perfect multiples read as a synth
  // pad rather than an instrument.
  for (const partial of PLUCK_PARTIALS) {
    const osc = ctx.context.createOscillator()
    osc.type = 'sine'
    // A few cents of per-note detune: identical partial tuning across notes
    // is what makes synthetic plucks sound like a preset, not an instrument.
    osc.frequency.value = fundamental * partial.ratio
    osc.detune.value = (random() - 0.5) * 7

    const decay = event.duration * partial.decay
    const env = ctx.context.createGain()
    env.gain.setValueAtTime(0, at)
    // Rounded string attack; upper partials soften as the register rises.
    const warmth = Math.min(1, 900 / (fundamental * partial.ratio)) ** 2
    env.gain.linearRampToValueAtTime(partial.amp * warmth * event.gain * 0.28, at + 0.018)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.018 + decay)

    const pan = ctx.context.createStereoPanner()
    pan.pan.value = event.pan

    osc.connect(env).connect(pan).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + event.duration + 0.1)
    ctx.active.add(osc)
    osc.onended = () => ctx.active.delete(osc)
  }

  if (event.bassFreq) {
    const osc = ctx.context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = event.bassFreq
    const env = ctx.context.createGain()
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(0.2 * event.gain, at + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.6)
    osc.connect(env).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 1.7)
    ctx.active.add(osc)
    osc.onended = () => ctx.active.delete(osc)
  }
}

function scheduleBreath(ctx: RenderContext, event: MusicEvent, at: number) {
  const { random } = ctx
  const source = ctx.context.createBufferSource()
  source.buffer = getNoiseBuffer(ctx.context)
  source.loop = true
  // A random slice per event so the same noise never repeats audibly.
  source.loopStart = random() * 1.5
  source.loopEnd = source.loopStart + 0.4

  const band = ctx.context.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 350 + random() * 550
  band.Q.value = 0.7 + random() * 0.5

  const env = ctx.context.createGain()
  env.gain.setValueAtTime(0, at)
  // Slow on both sides: air should drift in and out, never start or stop.
  env.gain.linearRampToValueAtTime(event.gain * 0.07, at + event.duration * 0.45)
  env.gain.linearRampToValueAtTime(0.0001, at + event.duration)

  const pan = ctx.context.createStereoPanner()
  pan.pan.value = event.pan

  source.connect(band).connect(env).connect(pan).connect(ctx.destination)
  source.start(at)
  source.stop(at + event.duration + 0.05)
  ctx.active.add(source)
  source.onended = () => ctx.active.delete(source)
}

function scheduleShimmer(ctx: RenderContext, event: MusicEvent, at: number) {
  const { random } = ctx
  const fundamental = event.freq!
  for (const partial of SHIMMER_PARTIALS) {
    const osc = ctx.context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = fundamental * partial.ratio
    osc.detune.value = (random() - 0.5) * 5

    const decay = event.duration * partial.decay
    const env = ctx.context.createGain()
    env.gain.setValueAtTime(0, at)
    const warmth = Math.min(1, 800 / (fundamental * partial.ratio)) ** 2
    env.gain.linearRampToValueAtTime(partial.amp * warmth * event.gain * 0.09, at + 0.035)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.035 + decay)

    const pan = ctx.context.createStereoPanner()
    pan.pan.value = event.pan

    osc.connect(env).connect(pan).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + event.duration + 0.1)
    ctx.active.add(osc)
    osc.onended = () => ctx.active.delete(osc)
  }
}

function scheduleDrone(ctx: RenderContext, event: MusicEvent, at: number) {
  const { random } = ctx
  const fundamental = event.freq!
  for (const partial of DRONE_PARTIALS) {
    const osc = ctx.context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = fundamental * partial.ratio
    osc.detune.value = (random() - 0.5) * 6

    const env = ctx.context.createGain()
    env.gain.setValueAtTime(0, at)
    // Very slow swell at both ends — the drone must never announce its own
    // attack, or it becomes an event instead of a floor.
    env.gain.linearRampToValueAtTime(partial.amp * event.gain * 0.16, at + 6)
    env.gain.linearRampToValueAtTime(partial.amp * event.gain * 0.13, at + Math.max(6, event.duration - 6))
    env.gain.linearRampToValueAtTime(0.0001, at + event.duration)

    const pan = ctx.context.createStereoPanner()
    pan.pan.value = event.pan

    osc.connect(env).connect(pan).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + event.duration + 0.05)
    ctx.active.add(osc)
    osc.onended = () => ctx.active.delete(osc)
  }
}

export interface SceneCrossfade {
  /** Seconds the outgoing scene takes to fall silent. */
  fadeOut: number
  /** Seconds the incoming scene takes to reach its level. */
  fadeIn: number
}

export const DEFAULT_CROSSFADE: SceneCrossfade = { fadeOut: 3.2, fadeIn: 2.6 }

/**
 * Live generative layer. One instance owns one gain node on the music bus
 * and one scheduler timer; scene changes re-seed the generator and
 * crossfade rather than hard-cutting.
 */
export class GenerativeMusic {
  private context: AudioContext | null = null
  private output: GainNode | null = null
  private destination: AudioNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private state: GeneratorState | null = null
  private profile: SceneProfile | null = null
  private scene: MusicScene | null = null
  private seed = 0
  /** Synthesis jitter, seeded from the same seed but a separate stream so
   *  the note sequence stays reproducible. */
  private synthRandom: () => number = createRandom(1)
  private active = new Set<AudioScheduledSourceNode>()
  /**
   * Event times run on an absolute timeline so the state never has to
   * reconcile a window-relative countdown with a moving window start.
   * `origin` maps that timeline onto `context.currentTime`, and `cursor` is
   * where planning has reached. Both are reset on every start.
   */
  private origin = 0
  private cursor = 0

  /** Start, or cross-fade to, a scene. Safe to call repeatedly with the
   *  same scene: the scheduler keeps running and nothing restarts. */
  start(context: AudioContext, destination: AudioNode, scene: MusicScene, seed = Date.now()): void {
    if (this.scene === scene && this.timer !== null && this.output) return

    const profile = MUSIC_SCENES[scene]
    const previous = this.output
    const now = context.currentTime

    const output = context.createGain()
    output.gain.setValueAtTime(0, now)
    output.gain.linearRampToValueAtTime(profile.gain, now + DEFAULT_CROSSFADE.fadeIn)
    output.connect(destination)

    // The outgoing scene is retired on the crossfade's own schedule, so old
    // and new overlap deliberately. Releasing its sources now would cut the
    // very tail the fade exists to preserve.
    if (previous) {
      previous.gain.cancelScheduledValues(now)
      previous.gain.setValueAtTime(previous.gain.value, now)
      previous.gain.linearRampToValueAtTime(0.0001, now + DEFAULT_CROSSFADE.fadeOut)
      setTimeout(() => {
        try { previous.disconnect() } catch { /* Already torn down. */ }
      }, DEFAULT_CROSSFADE.fadeOut * 1000 + 250)
      this.releaseSources(DEFAULT_CROSSFADE.fadeOut)
    }

    this.context = context
    this.destination = output
    this.output = output
    this.scene = scene
    this.profile = profile
    this.seed = seed
    this.state = createGeneratorState(seed, profile)
    this.synthRandom = createRandom((seed ^ 0x9e3779b9) >>> 0)
    this.origin = now
    this.cursor = 0

    this.startScheduler()
  }

  /** Change scene without tearing the scheduler down. */
  setScene(scene: MusicScene): void {
    if (!this.context || !this.destination) return
    if (this.scene === scene) return
    this.start(this.context, this.destination, scene, this.seed + 1)
  }

  getScene(): MusicScene | null {
    return this.scene
  }

  private startScheduler(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.tick()
    this.timer = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS)
  }

  /**
   * One planning pass. Events are scheduled against the audio clock, not
   * the JS timer, so timer jitter shifts which notes get queued rather
   * than how they are spaced.
   */
  private tick(): void {
    const context = this.context
    const state = this.state
    const profile = this.profile
    const output = this.output
    if (!context || !state || !profile || !output) return
    // A suspended context (backgrounded tab) would otherwise accumulate a
    // backlog of notes that all fire at once on resume.
    if (context.state !== 'running') return

    const now = context.currentTime
    const origin = this.origin
    let base = Math.max(now + 0.1, this.cursor)

    // If the planner fell far behind — a long stall, or a context that was
    // suspended — pull the event times forward rather than emitting a burst
    // of back-dated notes. Voices already due are dropped by the guard
    // below, so nothing fires retroactively either way.
    if (base > now + LOOKAHEAD_WINDOW * 4) base = now + 0.1

    const render: RenderContext = {
      context,
      destination: output,
      active: this.active,
      random: this.synthRandom,
    }

    for (const event of planPhrase(state, profile, LOOKAHEAD_WINDOW, base - origin)) {
      const at = base + event.offset
      if (at < now) continue
      switch (event.voice) {
        case 'pluck': schedulePluck(render, event, at); break
        case 'breath': scheduleBreath(render, event, at); break
        case 'shimmer': scheduleShimmer(render, event, at); break
        case 'drone': scheduleDrone(render, event, at); break
      }
    }

    // The window advanced, so the next pass picks up where this one ended.
    this.cursor = base + LOOKAHEAD_WINDOW
  }

  /** Fade out and stop everything, releasing all scheduled nodes. */
  stop(fade = 2.5): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }

    const context = this.context
    const output = this.output
    if (context && output) {
      const now = context.currentTime
      output.gain.cancelScheduledValues(now)
      output.gain.setValueAtTime(output.gain.value, now)
      output.gain.linearRampToValueAtTime(0.0001, now + fade)
      setTimeout(() => {
        try { output.disconnect() } catch { /* Already disconnected. */ }
      }, fade * 1000 + 250)
    }

    // Let the fade play out before the sources are stopped, otherwise the
    // release ramp has nothing left to fade.
    this.releaseSources(fade)
    this.output = null
    this.destination = null
    this.context = null
    this.scene = null
    this.profile = null
    this.state = null
  }

  /**
   * Stop every source still ringing, `delay` seconds from now. Called on
   * scene change and on stop so a long pluck tail cannot outlive the scene
   * that owns it — but only after the fade has had its time.
   */
  private releaseSources(delay: number): void {
    const context = this.context
    if (!context) {
      this.active.clear()
      return
    }
    const at = context.currentTime + delay
    for (const source of this.active) {
      try {
        source.stop(at)
      } catch { /* Already stopped, or never started. */ }
    }
    this.active.clear()
  }

  /** For tests and teardown assertions. */
  activeSourceCount(): number {
    return this.active.size
  }

  isRunning(): boolean {
    return this.timer !== null
  }
}
