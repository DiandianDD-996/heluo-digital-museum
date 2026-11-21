/**
 * Procedural sound design for the Heluo museum.
 *
 * Every voice is rendered offline through real Web Audio nodes
 * (OfflineAudioContext) rather than hand-looped sample math:
 *
 * - Bells and chimes use additive synthesis over INHARMONIC partial sets
 *   modelled on campanology data — a bianzhong's defining "one bell, two
 *   tones" character comes from a partial a minor third (ratio 1.2) above
 *   the strike tone, which is why it shows up in every bronze voice below.
 * - Reveal/dismiss/ink transitions use struck-crystal additive bells: a
 *   near-unison detuned partial pair beats gently against itself for a
 *   glassy shimmer, with a soft high "tap" excitation instead of a plucked
 *   string transient.
 * - Every voice is sent through ONE shared, synthesized stone-hall impulse
 *   response (via ConvolverNode) so the whole library reads as one
 *   physical space instead of a pile of unrelated one-shots.
 *
 * No audio files, no licensing, no network cost — and no two plays sound
 * bit-identical once audioSystem.ts layers its own pitch/pan humanization
 * on top of these buffers.
 */

// ---------------------------------------------------------------------
// Shared hall reverb
// ---------------------------------------------------------------------

const irCache = new Map<number, AudioBuffer>()

/** A synthesized stone-hall impulse response: a few discrete early
 *  reflections (the sense of nearby walls) ahead of a dense, warmed
 *  noise tail (the sense of a large enclosed volume). */
function getImpulseResponse(sampleRate: number): AudioBuffer {
  const cached = irCache.get(sampleRate)
  if (cached) return cached

  const duration = 2.4
  const length = Math.floor(duration * sampleRate)
  const impulse = new AudioBuffer({ numberOfChannels: 2, length, sampleRate })

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    let lowpassState = 0
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      const decayEnvelope = Math.pow(1 - i / length, 2.6)
      const raw = Math.random() * 2 - 1
      // Warm the noise into a rounder tail instead of harsh static.
      lowpassState += (raw - lowpassState) * 0.32
      let sample = lowpassState * decayEnvelope
      // A handful of early reflections at slightly different times per
      // channel gives the tail a physical sense of wall distance/width.
      const reflectionTimes = channel === 0 ? [0.009, 0.021, 0.037, 0.061] : [0.013, 0.027, 0.044, 0.07]
      for (const reflection of reflectionTimes) {
        if (Math.abs(t - reflection) < 0.0007) sample += 0.55 * (1 - reflection / 0.09)
      }
      data[i] = sample
    }
  }

  irCache.set(sampleRate, impulse)
  return impulse
}

// ---------------------------------------------------------------------
// Offline render helper
// ---------------------------------------------------------------------

async function renderOffline(
  sampleRate: number,
  duration: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(duration * sampleRate))
  const ctx = new OfflineAudioContext(2, length, sampleRate)
  build(ctx)
  return ctx.startRendering()
}

/** Wires a dry bus straight to destination and a wet bus through the
 *  shared hall reverb — every voice below feeds `master` and gets both
 *  paths for free. */
function createReverbBus(ctx: OfflineAudioContext, wetMix: number) {
  const master = ctx.createGain()
  master.connect(ctx.destination)

  if (wetMix > 0) {
    const wet = ctx.createGain()
    wet.gain.value = wetMix
    const convolver = ctx.createConvolver()
    convolver.normalize = true
    convolver.buffer = getImpulseResponse(ctx.sampleRate)
    master.connect(wet)
    wet.connect(convolver)
    convolver.connect(ctx.destination)
  }

  return master
}

function noiseBuffer(ctx: OfflineAudioContext, duration: number): AudioBuffer {
  const length = Math.max(1, Math.floor(duration * ctx.sampleRate))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

// ---------------------------------------------------------------------
// Additive inharmonic bells (qing stone / bianzhong bronze / jade disc)
// ---------------------------------------------------------------------

interface Overtone {
  ratio: number
  amp: number
  decayScale: number
  detuneCents?: number
}

/** Bianzhong-style bronze bell — hum tone, strike tone, and the tierce a
 *  minor third above it (the acoustic source of a bell's "two tones"). */
const BRONZE_OVERTONES: Overtone[] = [
  { ratio: 0.5, amp: 0.5, decayScale: 1.7, detuneCents: -4 },
  { ratio: 1, amp: 1, decayScale: 1, detuneCents: 0 },
  { ratio: 1.2, amp: 0.55, decayScale: 0.85, detuneCents: 6 },
  { ratio: 1.5, amp: 0.4, decayScale: 0.7 },
  { ratio: 2, amp: 0.32, decayScale: 0.55 },
  { ratio: 3, amp: 0.14, decayScale: 0.32 },
  { ratio: 4, amp: 0.07, decayScale: 0.22 },
]

/** Muted, fast-decaying partials for the ink material — darker and
 *  breathier than the glass/bronze/jade voices, no bright shimmer. */
const INK_OVERTONES: Overtone[] = [
  { ratio: 1, amp: 0.85, decayScale: 0.7 },
  { ratio: 1.9, amp: 0.3, decayScale: 0.5 },
  { ratio: 3.4, amp: 0.12, decayScale: 0.32 },
]

interface BellSpec {
  fundamental: number
  overtones: Overtone[]
  duration: number
  attack: number
  baseDecay: number
  strike?: { amount: number; centerFreq: number; q: number; decay: number }
  reverbSend: number
}

async function renderBell(sampleRate: number, spec: BellSpec): Promise<AudioBuffer> {
  return renderOffline(sampleRate, spec.duration, (ctx) => {
    const master = createReverbBus(ctx, spec.reverbSend)

    for (const overtone of spec.overtones) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = spec.fundamental * overtone.ratio
      if (overtone.detuneCents) osc.detune.value = overtone.detuneCents

      const decay = Math.max(0.03, spec.baseDecay * overtone.decayScale)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, 0)
      env.gain.linearRampToValueAtTime(overtone.amp, spec.attack)
      env.gain.exponentialRampToValueAtTime(Math.max(overtone.amp * 0.001, 0.0001), spec.attack + decay)

      osc.connect(env)
      env.connect(master)
      osc.start(0)
      osc.stop(spec.duration)
    }

    if (spec.strike) {
      const source = ctx.createBufferSource()
      source.buffer = noiseBuffer(ctx, 0.05)

      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = spec.strike.centerFreq
      bandpass.Q.value = spec.strike.q

      const env = ctx.createGain()
      env.gain.setValueAtTime(spec.strike.amount, 0)
      env.gain.exponentialRampToValueAtTime(0.0001, spec.strike.decay)

      source.connect(bandpass)
      bandpass.connect(env)
      env.connect(master)
      source.start(0)
    }
  })
}

// ---------------------------------------------------------------------
// Filtered-noise textures (ink breath, flowing water)
// ---------------------------------------------------------------------

interface NoiseSweepSpec {
  duration: number
  filterFrom: number
  filterPeak: number
  filterTo: number
  peakAt: number
  q?: number
  subThump?: { freq: number; amount: number; decay: number }
  reverbSend: number
  gain?: number
}

async function renderNoiseSweep(sampleRate: number, spec: NoiseSweepSpec): Promise<AudioBuffer> {
  return renderOffline(sampleRate, spec.duration, (ctx) => {
    const master = createReverbBus(ctx, spec.reverbSend)

    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx, spec.duration)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = spec.q ?? 0.7
    const peakTime = spec.duration * spec.peakAt
    filter.frequency.setValueAtTime(spec.filterFrom, 0)
    filter.frequency.linearRampToValueAtTime(spec.filterPeak, peakTime)
    filter.frequency.linearRampToValueAtTime(spec.filterTo, spec.duration)

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, 0)
    envelope.gain.linearRampToValueAtTime(spec.gain ?? 0.8, Math.max(peakTime * 0.6, 0.01))
    envelope.gain.linearRampToValueAtTime(0.0001, spec.duration)

    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(master)
    source.start(0)

    if (spec.subThump) {
      const sub = ctx.createOscillator()
      sub.type = 'sine'
      sub.frequency.value = spec.subThump.freq
      const subEnv = ctx.createGain()
      subEnv.gain.setValueAtTime(spec.subThump.amount, 0)
      subEnv.gain.exponentialRampToValueAtTime(0.0001, spec.subThump.decay)
      sub.connect(subEnv)
      subEnv.connect(master)
      sub.start(0)
      sub.stop(spec.duration)
    }
  })
}

// ---------------------------------------------------------------------
// Crisp chime sweep (page transitions) — a bright airy swish resolving
// into a short silvery bell ping, instead of a bass-heavy whoosh-thump.
// ---------------------------------------------------------------------

interface ChimeSweepSpec {
  duration: number
  filterFrom: number
  filterPeak: number
  filterTo: number
  peakAt: number
  q?: number
  noiseGain: number
  pingFundamental: number
  pingOvertones: Overtone[]
  pingDelay: number
  reverbSend: number
}

async function renderChimeSweep(sampleRate: number, spec: ChimeSweepSpec): Promise<AudioBuffer> {
  return renderOffline(sampleRate, spec.duration, (ctx) => {
    const master = createReverbBus(ctx, spec.reverbSend)

    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx, spec.duration)

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = spec.q ?? 0.6
    const peakTime = spec.duration * spec.peakAt
    filter.frequency.setValueAtTime(spec.filterFrom, 0)
    filter.frequency.linearRampToValueAtTime(spec.filterPeak, peakTime)
    filter.frequency.linearRampToValueAtTime(spec.filterTo, spec.duration)

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, 0)
    envelope.gain.linearRampToValueAtTime(spec.noiseGain, Math.max(peakTime * 0.6, 0.01))
    envelope.gain.linearRampToValueAtTime(0.0001, spec.duration)

    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(master)
    source.start(0)

    for (const overtone of spec.pingOvertones) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = spec.pingFundamental * overtone.ratio
      if (overtone.detuneCents) osc.detune.value = overtone.detuneCents

      const decay = Math.max(0.03, (spec.duration - spec.pingDelay) * overtone.decayScale)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, spec.pingDelay)
      env.gain.linearRampToValueAtTime(overtone.amp, spec.pingDelay + 0.006)
      env.gain.exponentialRampToValueAtTime(Math.max(overtone.amp * 0.001, 0.0001), spec.pingDelay + decay)

      osc.connect(env)
      env.connect(master)
      osc.start(0)
      osc.stop(spec.duration)
    }
  })
}

// ---------------------------------------------------------------------
// Percussive knocks (bamboo tally, dull error thud)
// ---------------------------------------------------------------------

interface KnockSpec {
  duration: number
  centerFreq: number
  q: number
  tickFreq?: number
  detuneTick?: number
  amount: number
  decay: number
  reverbSend: number
}

async function renderKnock(sampleRate: number, spec: KnockSpec): Promise<AudioBuffer> {
  return renderOffline(sampleRate, spec.duration, (ctx) => {
    const master = createReverbBus(ctx, spec.reverbSend)

    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx, spec.duration)

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = spec.centerFreq
    bandpass.Q.value = spec.q

    const env = ctx.createGain()
    env.gain.setValueAtTime(spec.amount, 0)
    env.gain.exponentialRampToValueAtTime(0.0001, spec.decay)

    source.connect(bandpass)
    bandpass.connect(env)
    env.connect(master)
    source.start(0)

    if (spec.tickFreq) {
      const tick = ctx.createOscillator()
      tick.type = 'triangle'
      tick.frequency.value = spec.tickFreq
      if (spec.detuneTick) tick.detune.value = spec.detuneTick
      const tickEnv = ctx.createGain()
      tickEnv.gain.setValueAtTime(spec.amount * 0.6, 0)
      tickEnv.gain.exponentialRampToValueAtTime(0.0001, spec.decay * 0.6)
      tick.connect(tickEnv)
      tickEnv.connect(master)
      tick.start(0)
      tick.stop(spec.duration)
    }
  })
}

// ---------------------------------------------------------------------
// Ambient pads (looping beds)
// ---------------------------------------------------------------------

interface PadSpec {
  duration: number
  fundamental: number
  overtones: Overtone[]
  fadeTime: number
  tremoloRate?: number
  tremoloDepth?: number
  noiseAmount?: number
  noiseLowpass?: number
  reverbSend: number
  gain?: number
}

async function renderPad(sampleRate: number, spec: PadSpec): Promise<AudioBuffer> {
  return renderOffline(sampleRate, spec.duration, (ctx) => {
    const master = createReverbBus(ctx, spec.reverbSend)

    // Fade in / sustain / fade out — starts and ends at zero so a looped
    // `source.loop = true` playback never clicks at the seam.
    const sustain = ctx.createGain()
    sustain.gain.setValueAtTime(0, 0)
    sustain.gain.linearRampToValueAtTime(spec.gain ?? 0.5, spec.fadeTime)
    sustain.gain.setValueAtTime(spec.gain ?? 0.5, Math.max(spec.fadeTime, spec.duration - spec.fadeTime))
    sustain.gain.linearRampToValueAtTime(0, spec.duration)
    sustain.connect(master)

    let tremolo: GainNode | undefined
    if (spec.tremoloRate) {
      tremolo = ctx.createGain()
      tremolo.gain.value = 1
      const lfo = ctx.createOscillator()
      lfo.frequency.value = spec.tremoloRate
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = spec.tremoloDepth ?? 0.15
      lfo.connect(lfoGain)
      lfoGain.connect(tremolo.gain)
      lfo.start(0)
      lfo.stop(spec.duration)
      tremolo.connect(sustain)
    }

    const voiceBus = tremolo ?? sustain
    for (const overtone of spec.overtones) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = spec.fundamental * overtone.ratio
      if (overtone.detuneCents) osc.detune.value = overtone.detuneCents
      const gain = ctx.createGain()
      gain.gain.value = overtone.amp
      osc.connect(gain)
      gain.connect(voiceBus)
      osc.start(0)
      osc.stop(spec.duration)
    }

    if (spec.noiseAmount) {
      const source = ctx.createBufferSource()
      source.buffer = noiseBuffer(ctx, spec.duration)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = spec.noiseLowpass ?? 600
      const gain = ctx.createGain()
      gain.gain.value = spec.noiseAmount
      source.connect(filter)
      filter.connect(gain)
      gain.connect(sustain)
      source.start(0)
    }
  })
}

// ---------------------------------------------------------------------
// Voice library
// ---------------------------------------------------------------------

const BELLS: Record<string, BellSpec> = {
  click: { fundamental: 392, overtones: INK_OVERTONES, duration: 0.35, attack: 0.012, baseDecay: 0.09, reverbSend: 0.08, strike: { amount: 0.12, centerFreq: 900, q: 0.7, decay: 0.025 } },
  hover: { fundamental: 330, overtones: INK_OVERTONES, duration: 0.22, attack: 0.018, baseDecay: 0.055, reverbSend: 0.04, strike: { amount: 0.04, centerFreq: 700, q: 0.6, decay: 0.02 } },
  success: { fundamental: 523.25, overtones: BRONZE_OVERTONES, duration: 1.4, attack: 0.008, baseDecay: 0.5, reverbSend: 0.24, strike: { amount: 0.3, centerFreq: 1400, q: 2.8, decay: 0.05 } },
  'awaken-bronze': { fundamental: 392, overtones: BRONZE_OVERTONES, duration: 0.9, attack: 0.006, baseDecay: 0.32, reverbSend: 0.16, strike: { amount: 0.22, centerFreq: 1100, q: 2.5, decay: 0.04 } },
  'awaken-jade': { fundamental: 440, overtones: INK_OVERTONES, duration: 0.6, attack: 0.025, baseDecay: 0.18, reverbSend: 0.14, strike: { amount: 0.07, centerFreq: 1100, q: 0.7, decay: 0.03 } },
  'awaken-ink': { fundamental: 220, overtones: INK_OVERTONES, duration: 0.55, attack: 0.015, baseDecay: 0.28, reverbSend: 0.18, strike: { amount: 0.1, centerFreq: 600, q: 1, decay: 0.06 } },
  reveal: { fundamental: 349.23, overtones: INK_OVERTONES, duration: 0.7, attack: 0.035, baseDecay: 0.22, reverbSend: 0.12, strike: { amount: 0.04, centerFreq: 1000, q: 0.6, decay: 0.025 } },
  dismiss: { fundamental: 261.63, overtones: INK_OVERTONES, duration: 0.55, attack: 0.025, baseDecay: 0.18, reverbSend: 0.1, strike: { amount: 0.03, centerFreq: 800, q: 0.6, decay: 0.025 } },
  opening: { fundamental: 261.6, overtones: BRONZE_OVERTONES, duration: 2.4, attack: 0.02, baseDecay: 1.1, reverbSend: 0.32, strike: { amount: 0.25, centerFreq: 900, q: 2, decay: 0.08 } },
  discovery: { fundamental: 329.63, overtones: BRONZE_OVERTONES, duration: 1.2, attack: 0.025, baseDecay: 0.38, reverbSend: 0.18, strike: { amount: 0.12, centerFreq: 900, q: 0.8, decay: 0.04 } },
  ending: { fundamental: 220, overtones: BRONZE_OVERTONES, duration: 3, attack: 0.03, baseDecay: 1.4, reverbSend: 0.35, strike: { amount: 0.2, centerFreq: 700, q: 1.8, decay: 0.1 } },
}

const KNOCKS: Record<string, KnockSpec> = {
  toggle: { duration: 0.14, centerFreq: 950, q: 3.2, tickFreq: 520, amount: 0.5, decay: 0.045, reverbSend: 0.04 },
  error: { duration: 0.26, centerFreq: 220, q: 1.6, tickFreq: 96, detuneTick: 35, amount: 0.45, decay: 0.09, reverbSend: 0.08 },
}

const SWEEPS: Record<string, NoiseSweepSpec> = {
  'ambience-river': { duration: 7, filterFrom: 500, filterPeak: 950, filterTo: 500, peakAt: 0.5, q: 0.5, reverbSend: 0.22, gain: 0.4 },
}

const CHIMES: Record<string, ChimeSweepSpec> = {
  pageChange: {
    duration: 0.6,
    filterFrom: 350,
    filterPeak: 1000,
    filterTo: 450,
    peakAt: 0.3,
    q: 0.6,
    noiseGain: 0.1,
    pingFundamental: 392,
    pingOvertones: [
      { ratio: 1, amp: 0.8, decayScale: 0.55 },
      { ratio: 2, amp: 0.12, decayScale: 0.3 },
      { ratio: 3, amp: 0.025, decayScale: 0.18 },
    ],
    pingDelay: 0.04,
    reverbSend: 0.22,
  },
}

const PADS: Record<string, PadSpec> = {
  'ambience-hall': { duration: 6, fundamental: 55, overtones: [{ ratio: 1, amp: 0.6, decayScale: 1 }, { ratio: 2, amp: 0.25, decayScale: 1 }, { ratio: 3, amp: 0.1, decayScale: 1 }], fadeTime: 1.2, tremoloRate: 0.12, tremoloDepth: 0.1, noiseAmount: 0.06, noiseLowpass: 500, reverbSend: 0.4, gain: 0.5 },
  'ambience-bronze': { duration: 6, fundamental: 65.4, overtones: BRONZE_OVERTONES.slice(0, 4), fadeTime: 1.4, tremoloRate: 0.09, tremoloDepth: 0.12, noiseAmount: 0.03, noiseLowpass: 300, reverbSend: 0.38, gain: 0.42 },
  'ambience-jade': { duration: 6, fundamental: 110, overtones: INK_OVERTONES, fadeTime: 1.5, tremoloRate: 0.08, tremoloDepth: 0.04, noiseAmount: 0.015, noiseLowpass: 600, reverbSend: 0.2, gain: 0.14 },
}

const cache = new Map<string, Promise<AudioBuffer>>()

/** Synthesizes (and caches) the named voice at the given sample rate.
 *  Async: every voice is rendered through a real Web Audio graph. */
export function synthesizeSound(sampleRate: number, name: string): Promise<AudioBuffer> {
  const key = `${name}@${sampleRate}`
  const cached = cache.get(key)
  if (cached) return cached

  let promise: Promise<AudioBuffer>
  if (BELLS[name]) promise = renderBell(sampleRate, BELLS[name])
  else if (CHIMES[name]) promise = renderChimeSweep(sampleRate, CHIMES[name])
  else if (SWEEPS[name]) promise = renderNoiseSweep(sampleRate, SWEEPS[name])
  else if (KNOCKS[name]) promise = renderKnock(sampleRate, KNOCKS[name])
  else if (PADS[name]) promise = renderPad(sampleRate, PADS[name])
  else return Promise.reject(new Error(`No synthesis spec for sound "${name}"`))

  cache.set(key, promise)
  return promise
}
