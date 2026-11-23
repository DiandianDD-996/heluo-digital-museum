/**
 * Museum Audio System
 * 河洛数字博物馆音效系统
 *
 * Manages interaction sounds, transitions, ambience, and narrative audio
 * with spatial positioning, adaptive volume, and user preferences.
 *
 * Interaction and ambience tones are synthesized in-memory through Web
 * Audio graphs (see soundSynthesis.ts). Recorded music enters the same
 * bus graph through musicPlayback.ts. Every effect adds a small pitch/pan/volume
 * drift on top of the cached buffer so repeated interactions (hovering ten
 * cards in a row) never sound like the exact same clip looping.
 *
 * Routing (added 2026-09-26): every voice now lands on one of three
 * sub-buses under a single master gain, instead of connecting straight to
 * `destination`:
 *
 *     sfxBus ────────┐
 *     musicBus ──────┼──→ masterGain ──→ destination
 *     ambienceBus ───┘
 *
 * Three reasons this indirection earns its keep: the master switch can
 * mute everything in one ramp rather than racing N live sources, sound
 * effects and music can be toggled independently, and the music bed can
 * duck under a narrative bell without touching the bell's own level. The
 * default tier keeps all three sub-bus gains at exactly 1.0, so the
 * pre-existing per-voice volumes are unchanged.
 */
import { synthesizeSound } from './soundSynthesis'

export type InteractionSound = 'click' | 'hover' | 'toggle' | 'error' | 'success' | 'awaken-bronze' | 'awaken-jade' | 'awaken-ink'
export type TransitionSound = 'pageChange' | 'reveal' | 'dismiss'
export type AmbienceScene = 'hall' | 'bronze' | 'jade' | 'river'
export type NarrativeSound = 'opening' | 'discovery' | 'ending'

/**
 * Master volume tiers, surfaced by the header control. `normal` is the
 * reference tier — its multiplier is 1.0 so it reproduces the exact
 * loudness the system shipped with before the bus refactor.
 */
export type VolumeTier = 'silent' | 'quiet' | 'normal' | 'rich'

export const VOLUME_TIER_GAIN: Record<VolumeTier, number> = {
  silent: 0,
  quiet: 0.45,
  normal: 1,
  rich: 1.45,
}

export const VOLUME_TIER_ORDER: VolumeTier[] = ['silent', 'quiet', 'normal', 'rich']

/** Sub-bus balance. These are relative weights *within* a tier, not
 *  absolute gains: ambience sits lowest because it plays continuously,
 *  and music sits below it so a reading page never competes with itself. */
export interface BusLevels {
  sfx: number
  music: number
  ambience: number
}

export const DEFAULT_BUS_LEVELS: BusLevels = {
  sfx: 1,
  music: 0.62,
  ambience: 0.32,
}

const STORAGE_KEYS = {
  master: 'museum-audio-enabled',
  sfx: 'museum-audio-sfx',
  music: 'museum-audio-music',
  tier: 'museum-audio-volume-tier',
} as const

/** Ducking depth applied to the music bed while a narrative/bell voice
 *  speaks — the museum equivalent of a narrator leaning into the mic. */
const DUCK_DEPTH = 0.42
const DUCK_ATTACK = 0.18
const DUCK_RELEASE = 1.6

interface PlayOptions {
  volume?: number
  pan?: number // -1 (left) to 1 (right)
  rate?: number // playback rate (pitch adjustment)
}

class MuseumAudioSystem {
  private context: AudioContext | null = null
  private sounds: Map<string, AudioBuffer> = new Map()
  private currentAmbience: AudioBufferSourceNode | null = null
  private currentAmbienceGain: GainNode | null = null
  private currentAmbienceScene: AmbienceScene | null = null
  private enabled: boolean = false
  private sfxEnabled: boolean = true
  private musicEnabled: boolean = true
  private volumeTier: VolumeTier = 'normal'
  private busLevels: BusLevels = { ...DEFAULT_BUS_LEVELS }
  private lastPlayTime: Map<string, number> = new Map()
  private loadingPromises: Map<string, Promise<AudioBuffer>> = new Map()
  private sfxEpoch = 0

  // Bus graph. All nullable, all created together in `ensureContext()`.
  private masterGain: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private ambienceBus: GainNode | null = null
  private duckGain: GainNode | null = null
  private themeFilter: BiquadFilterNode | null = null
  private spaceFilter: BiquadFilterNode | null = null
  private musicAnalyser: AnalyserNode | null = null
  private analyserConsumers = 0
  private duckReleaseTimer: ReturnType<typeof setTimeout> | null = null
  private narrativeDuckFactor = 1
  private focusDuckSources: Map<string, number> = new Map()
  private currentDuckTarget = 1
  private acousticTheme: 'light' | 'dark' = 'light'
  private acousticSpace: 'default' | 'pointcloud' = 'default'
  private listenedContext: AudioContext | null = null
  private contextStateCallbacks: Set<(state: string) => void> = new Set()

  constructor() {
    this.volumeTier = this.loadTier()
    this.sfxEnabled = this.loadFlag(STORAGE_KEYS.sfx, true)
    this.musicEnabled = this.loadFlag(STORAGE_KEYS.music, true)
    this.enabled = this.loadPreference()

    // Respect user preference for reduced motion
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.enabled = false
    }
  }

  // -------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------

  private loadPreference(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.master) === 'true'
    } catch {
      return false
    }
  }

  private savePreference(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.master, String(this.enabled))
    } catch { /* Audio remains usable when browser storage is unavailable. */ }
  }

  /** Absent keys mean "never expressed a preference" → fall back to the
   *  supplied default, so existing users keep music and sfx on. */
  private loadFlag(key: string, fallback: boolean): boolean {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      return raw === null ? fallback : raw === 'true'
    } catch {
      return fallback
    }
  }

  private saveFlag(key: string, value: boolean): void {
    try {
      localStorage.setItem(key, String(value))
    } catch { /* Non-fatal: the in-memory value still governs this session. */ }
  }

  private loadTier(): VolumeTier {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.tier) : null
      return raw && (VOLUME_TIER_ORDER as string[]).includes(raw) ? raw as VolumeTier : 'normal'
    } catch {
      return 'normal'
    }
  }

  private saveTier(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.tier, this.volumeTier)
    } catch { /* Non-fatal. */ }
  }

  // -------------------------------------------------------------------
  // Graph construction
  // -------------------------------------------------------------------

  private ensureContext(): void {
    if (!this.context) {
      this.context = new AudioContext()
    }

    if (this.listenedContext !== this.context && typeof this.context.addEventListener === 'function') {
      const ctx = this.context
      this.listenedContext = ctx
      ctx.addEventListener('statechange', () => {
        if (this.context !== ctx) return
        const state = ctx.state as string
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
        if (this.enabled && !hidden && (state === 'suspended' || state === 'interrupted')) {
          void ctx.resume().catch(() => {})
        }
        for (const cb of this.contextStateCallbacks) cb(state)
      })
    }

    if (!this.masterGain) this.buildBuses(this.context)

    // Resume context if suspended or iOS Safari interrupted
    const state = this.context.state as string
    if (state === 'suspended' || state === 'interrupted') {
      void this.context.resume().catch(() => {})
    }
  }

  private buildBuses(context: AudioContext): void {
    const master = context.createGain()
    master.gain.value = this.masterGainValue()
    master.connect(context.destination)

    const sfx = context.createGain()
    const ambience = context.createGain()
    // Music runs through a dedicated duck stage so narrative voices and
    // companion drawers can lower the bed without disturbing the bed's own level.
    const music = context.createGain()
    const duck = context.createGain()

    sfx.gain.value = this.sfxEnabled ? this.busLevels.sfx : 0
    ambience.gain.value = this.busLevels.ambience
    music.gain.value = this.musicEnabled ? this.busLevels.music : 0
    this.currentDuckTarget = this.computeDuckTarget()
    duck.gain.value = this.currentDuckTarget

    sfx.connect(master)
    ambience.connect(master)

    if (typeof context.createBiquadFilter === 'function') {
      const themeFilter = context.createBiquadFilter()
      themeFilter.type = 'highshelf'
      themeFilter.frequency.value = 7500
      themeFilter.gain.value = this.acousticTheme === 'dark' ? -1.2 : 0

      const spaceFilter = context.createBiquadFilter()
      spaceFilter.type = 'lowshelf'
      spaceFilter.frequency.value = 220
      spaceFilter.gain.value = this.acousticSpace === 'pointcloud' ? -3.5 : 0

      music.connect(themeFilter)
      themeFilter.connect(spaceFilter)
      spaceFilter.connect(duck)
      this.themeFilter = themeFilter
      this.spaceFilter = spaceFilter
    } else {
      music.connect(duck)
    }

    duck.connect(master)

    this.masterGain = master
    this.sfxBus = sfx
    this.musicBus = music
    this.ambienceBus = ambience
    this.duckGain = duck
    this.musicAnalyser = null
  }

  /** The tier multiplier, folded with the master on/off state so a single
   *  node governs everything downstream. */
  private masterGainValue(): number {
    if (!this.enabled) return 0
    return VOLUME_TIER_GAIN[this.volumeTier]
  }

  /** Ramps rather than jumps — a step change on a live signal is an
   *  audible click, which is exactly the kind of detail that makes an
   *  otherwise careful soundscape feel cheap. */
  private rampMaster(duration = 0.25): void {
    if (!this.masterGain || !this.context) return
    const now = this.context.currentTime
    const target = this.masterGainValue()
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
    this.masterGain.gain.linearRampToValueAtTime(target, now + duration)
  }

  private async loadSound(name: string): Promise<AudioBuffer> {
    if (this.sounds.has(name)) {
      return this.sounds.get(name)!
    }

    // Prevent duplicate loading
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!
    }

    this.ensureContext()
    const sampleRate = this.context!.sampleRate

    const loadPromise = synthesizeSound(sampleRate, name).then((audioBuffer) => {
      this.sounds.set(name, audioBuffer)
      this.loadingPromises.delete(name)
      return audioBuffer
    })

    this.loadingPromises.set(name, loadPromise)
    return loadPromise
  }

  // -------------------------------------------------------------------
  // Bus access (consumed by the recorded music player)
  // -------------------------------------------------------------------

  /** The live AudioContext, or null before the first user gesture. Music
   *  scheduling waits for this rather than forcing a context into being,
   *  so a muted visitor never pays for an audio graph. */
  getContext(): AudioContext | null {
    return this.context
  }

  /** Ensures the graph exists and returns the music sub-bus input. */
  ensureMusicBus(): GainNode | null {
    if (!this.enabled || !this.musicEnabled) return null
    try {
      this.ensureContext()
    } catch {
      return null
    }
    return this.musicBus
  }

  isMusicEnabled(): boolean {
    return this.enabled && this.musicEnabled
  }

  isSfxEnabled(): boolean {
    return this.enabled && this.sfxEnabled
  }

  onContextStateChange(listener: (state: string) => void): () => void {
    this.contextStateCallbacks.add(listener)
    return () => { this.contextStateCallbacks.delete(listener) }
  }

  /** Lazily attaches a read-only AnalyserNode side-tap on duckGain without
   *  altering the main musicBus → duckGain → masterGain signal path. */
  acquireMusicAnalyser(): AnalyserNode | null {
    this.analyserConsumers += 1
    if (!this.context || !this.duckGain || typeof this.context.createAnalyser !== 'function') {
      return null
    }
    if (!this.musicAnalyser) {
      const analyser = this.context.createAnalyser()
      analyser.fftSize = 2048
      analyser.minDecibels = -90
      analyser.maxDecibels = -18
      analyser.smoothingTimeConstant = 0.82
      this.duckGain.connect(analyser)
      this.musicAnalyser = analyser
    }
    return this.musicAnalyser
  }

  releaseMusicAnalyser(): void {
    this.analyserConsumers = Math.max(0, this.analyserConsumers - 1)
  }

  getAnalyserConsumerCount(): number {
    return this.analyserConsumers
  }

  private rampParam(param: AudioParam, target: number, duration: number): void {
    if (!this.context) return
    const now = this.context.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(target, now + duration)
  }

  setThemeAcoustic(theme: 'light' | 'dark'): void {
    this.acousticTheme = theme
    if (this.themeFilter) {
      this.rampParam(this.themeFilter.gain, theme === 'dark' ? -1.2 : 0, 0.8)
    }
  }

  setSpaceAcoustic(mode: 'default' | 'pointcloud'): void {
    this.acousticSpace = mode
    if (this.spaceFilter) {
      this.rampParam(this.spaceFilter.gain, mode === 'pointcloud' ? -3.5 : 0, 0.6)
    }
  }

  setFocusDuck(sourceId: string, active: boolean, depth = 0.72): void {
    if (active) {
      this.focusDuckSources.set(sourceId, Math.max(0.1, Math.min(1, depth)))
    } else {
      this.focusDuckSources.delete(sourceId)
    }
    this.recomputeDuckGain(0.35, 1.6)
  }

  // -------------------------------------------------------------------
  // Playback
  // -------------------------------------------------------------------

  /**
   * Preload essential sounds for first interaction
   */
  async preloadEssentials(): Promise<void> {
    if (!this.isSfxEnabled()) return

    const essentialSounds: string[] = ['click', 'hover', 'toggle']
    await Promise.all(essentialSounds.map(name => this.loadSound(name).catch(() => {})))
  }

  /**
   * Play interaction sound with spatial positioning, volume control, and a
   * touch of humanization so repeated plays don't sound mechanically
   * identical (real bells never strike exactly the same way twice).
   */
  async playInteraction(
    soundName: InteractionSound,
    options: PlayOptions = {}
  ): Promise<void> {
    if (!this.isSfxEnabled()) return
    const epoch = this.sfxEpoch

    try {
      const buffer = await this.loadSound(soundName)
      if (epoch !== this.sfxEpoch || !this.isSfxEnabled() || this.context?.state !== 'running') return
      const context = this.context!

      const source = context.createBufferSource()
      const gainNode = context.createGain()
      const panNode = context.createStereoPanner()

      const humanizedRate = (options.rate ?? 1) * (1 + (Math.random() - 0.5) * 0.03)
      const humanizedPan = options.pan ?? (Math.random() - 0.5) * 0.14
      const humanizedVolume = (options.volume ?? 0.3) * (0.92 + Math.random() * 0.16)

      source.buffer = buffer
      source.playbackRate.value = humanizedRate
      gainNode.gain.value = humanizedVolume
      panNode.pan.value = Math.max(-1, Math.min(1, humanizedPan))

      source
        .connect(gainNode)
        .connect(panNode)
        .connect(this.sfxBus ?? context.destination)

      source.start(0)
    } catch (error) {
      console.warn(`Failed to play interaction sound "${soundName}":`, error)
    }
  }

  /**
   * Play transition sound
   */
  async playTransition(
    soundName: TransitionSound,
    options: PlayOptions = {}
  ): Promise<void> {
    if (!this.isSfxEnabled()) return
    const epoch = this.sfxEpoch

    try {
      const buffer = await this.loadSound(soundName)
      if (epoch !== this.sfxEpoch || !this.isSfxEnabled() || this.context?.state !== 'running') return
      const context = this.context!

      const source = context.createBufferSource()
      const gainNode = context.createGain()

      const humanizedRate = (options.rate ?? 1) * (1 + (Math.random() - 0.5) * 0.02)
      const humanizedVolume = (options.volume ?? 0.25) * (0.94 + Math.random() * 0.12)

      source.buffer = buffer
      source.playbackRate.value = humanizedRate
      gainNode.gain.value = humanizedVolume

      source
        .connect(gainNode)
        .connect(this.sfxBus ?? context.destination)

      source.start(0)
    } catch (error) {
      console.warn(`Failed to play transition sound "${soundName}":`, error)
    }
  }

  /**
   * Play a narrative voice (opening / discovery / ending) and duck the
   * music bed underneath it. Without this the music and the bell occupy
   * the same register and the bell reads as part of the music instead of
   * as an event.
   */
  async playNarrative(
    soundName: NarrativeSound,
    options: PlayOptions = {}
  ): Promise<void> {
    if (!this.isSfxEnabled()) return
    const epoch = this.sfxEpoch

    try {
      const buffer = await this.loadSound(soundName)
      if (epoch !== this.sfxEpoch || !this.isSfxEnabled() || this.context?.state !== 'running') return
      const context = this.context!
      this.duckMusic()

      const source = context.createBufferSource()
      const gainNode = context.createGain()
      const panNode = context.createStereoPanner()

      source.buffer = buffer
      source.playbackRate.value = (options.rate ?? 1) * (1 + (Math.random() - 0.5) * 0.02)
      gainNode.gain.value = (options.volume ?? 0.3) * (0.94 + Math.random() * 0.12)
      panNode.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0))

      source
        .connect(gainNode)
        .connect(panNode)
        .connect(this.sfxBus ?? context.destination)

      source.start(0)
    } catch (error) {
      console.warn(`Failed to play narrative sound "${soundName}":`, error)
    }
  }

  private computeDuckTarget(): number {
    let target = this.narrativeDuckFactor
    for (const depth of this.focusDuckSources.values()) {
      target = Math.min(target, depth)
    }
    return Math.max(0, Math.min(1, target))
  }

  private recomputeDuckGain(attackSeconds = DUCK_ATTACK, releaseSeconds = DUCK_RELEASE): void {
    const target = this.computeDuckTarget()
    const duration = target < this.currentDuckTarget ? attackSeconds : releaseSeconds
    this.currentDuckTarget = target
    if (!this.duckGain || !this.context) return
    this.rampParam(this.duckGain.gain, target, duration)
  }

  /**
   * Briefly lower the music bed. Re-entrant by design: a second call while
   * already ducked simply extends the release, so overlapping narrative
   * cues don't stack into an ever-deeper duck.
   */
  private duckMusic(): void {
    if (!this.duckGain || !this.context) return
    this.narrativeDuckFactor = DUCK_DEPTH
    this.recomputeDuckGain(DUCK_ATTACK, DUCK_RELEASE)

    if (this.duckReleaseTimer) clearTimeout(this.duckReleaseTimer)
    this.duckReleaseTimer = setTimeout(() => {
      this.narrativeDuckFactor = 1
      this.recomputeDuckGain(DUCK_ATTACK, DUCK_RELEASE)
      this.duckReleaseTimer = null
    }, 900)
  }

  // Legacy ambient bed retained for bus-level tests; inactive under the complete R3 mix.

  /**
   * Switch ambient soundscape with crossfade. Re-entrant: asking for the
   * scene that is already playing is a no-op rather than a rebuild, which
   * matters because route watchers can fire more than once for one
   * navigation (query changes, guard redirects).
   */
  private ambienceRequest = 0

  async switchAmbience(sceneName: AmbienceScene): Promise<void> {
    const request = ++this.ambienceRequest
    if (!this.enabled) return
    if (this.currentAmbienceScene === sceneName && this.currentAmbience) return

    this.ensureContext()
    const context = this.context!
    const fadeOutDuration = 1.0
    const fadeInDuration = 1.5

    try {
      // Keep the current room audible until the latest replacement is ready.
      // A rapid A -> B -> A must not leave A scheduled to stop.
      const buffer = await this.loadSound(`ambience-${sceneName}`)
      if (request !== this.ambienceRequest || !this.enabled || context.state !== 'running') return

      // Fade out current ambience
      if (this.currentAmbience && this.currentAmbienceGain) {
        const oldGain = this.currentAmbienceGain
        const oldSource = this.currentAmbience

        oldGain.gain.setValueAtTime(oldGain.gain.value, context.currentTime)
        oldGain.gain.linearRampToValueAtTime(0, context.currentTime + fadeOutDuration)

        setTimeout(() => {
          try { oldSource.stop() } catch { /* Already stopped by a later switch. */ }
        }, fadeOutDuration * 1000)
      }

      const source = context.createBufferSource()
      const gainNode = context.createGain()

      source.buffer = buffer
      source.loop = true
      gainNode.gain.setValueAtTime(0, context.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.15, context.currentTime + fadeInDuration)

      source
        .connect(gainNode)
        .connect(this.ambienceBus ?? context.destination)

      source.start(0)

      this.currentAmbience = source
      this.currentAmbienceGain = gainNode
      this.currentAmbienceScene = sceneName
    } catch (error) {
      console.warn(`Failed to switch ambience to "${sceneName}":`, error)
    }
  }

  /** Which ambience is currently playing, for route-driven callers that
   *  want to skip redundant switches without awaiting one. */
  getAmbienceScene(): AmbienceScene | null {
    return this.currentAmbienceScene
  }

  /**
   * Stop current ambient sound
   */
  stopAmbience(): void {
    ++this.ambienceRequest
    if (this.currentAmbience && this.currentAmbienceGain && this.context) {
      const fadeOutDuration = 1.0

      this.currentAmbienceGain.gain.setValueAtTime(
        this.currentAmbienceGain.gain.value,
        this.context.currentTime
      )
      this.currentAmbienceGain.gain.linearRampToValueAtTime(
        0,
        this.context.currentTime + fadeOutDuration
      )

      const source = this.currentAmbience
      this.currentAmbience = null
      this.currentAmbienceGain = null
      this.currentAmbienceScene = null

      setTimeout(() => {
        try { source.stop() } catch { /* Already stopped. */ }
      }, fadeOutDuration * 1000)
    }
  }

  /**
   * Adaptive play: adjusts volume based on user interaction frequency
   * Prevents audio fatigue from rapid repeated interactions
   */
  async adaptivePlay(soundName: InteractionSound): Promise<void> {
    const now = Date.now()
    const lastPlayed = this.lastPlayTime.get(soundName) ?? 0
    const timeSinceLastPlay = now - lastPlayed

    // Reduce volume for rapid consecutive plays
    const volume = timeSinceLastPlay < 100 ? 0.1 : timeSinceLastPlay < 300 ? 0.2 : 0.3

    await this.playInteraction(soundName, { volume })
    this.lastPlayTime.set(soundName, now)
  }

  // -------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------

  /**
   * Toggle audio system on/off
   */
  toggle(): boolean {
    if (this.enabled) this.disable()
    else this.enable()

    return this.enabled
  }

  /**
   * Check if audio is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Manually enable audio (for user gesture requirement)
   */
  enable(): void {
    this.enabled = true
    this.savePreference()
    try {
      this.ensureContext()
    } catch {
      this.enabled = false
      this.savePreference()
      return
    }
    this.rampMaster()
  }

  /**
   * Manually disable audio. The graph is unwound through a ramp rather
   * than torn down, so re-enabling stays instant and a bell already
   * ringing fades instead of cutting off mid-decay.
   */
  disable(): void {
    ++this.sfxEpoch
    this.enabled = false
    this.savePreference()
    this.rampMaster(0.4)
    this.stopAmbience()
  }

  setSfxEnabled(value: boolean): void {
    if (!value) ++this.sfxEpoch
    this.sfxEnabled = value
    this.saveFlag(STORAGE_KEYS.sfx, value)
    if (this.sfxBus && this.context) {
      const now = this.context.currentTime
      this.sfxBus.gain.cancelScheduledValues(now)
      this.sfxBus.gain.setValueAtTime(this.sfxBus.gain.value, now)
      this.sfxBus.gain.linearRampToValueAtTime(value ? this.busLevels.sfx : 0, now + 0.25)
    }
  }

  setMusicEnabled(value: boolean): void {
    this.musicEnabled = value
    this.saveFlag(STORAGE_KEYS.music, value)
    if (this.musicBus && this.context) {
      const now = this.context.currentTime
      this.musicBus.gain.cancelScheduledValues(now)
      this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, now)
      this.musicBus.gain.linearRampToValueAtTime(value ? this.busLevels.music : 0, now + 0.25)
    }
  }

  isSfxToggleOn(): boolean {
    return this.sfxEnabled
  }

  isMusicToggleOn(): boolean {
    return this.musicEnabled
  }

  setVolumeTier(tier: VolumeTier): void {
    this.volumeTier = tier
    this.saveTier()
    this.rampMaster()
  }

  getVolumeTier(): VolumeTier {
    return this.volumeTier
  }
}

// Singleton instance
export const audioSystem = new MuseumAudioSystem()

// Auto-preload on first user interaction
let preloaded = false
const preloadOnInteraction = () => {
  if (!preloaded) {
    preloaded = true
    void audioSystem.preloadEssentials()
    document.removeEventListener('click', preloadOnInteraction)
    document.removeEventListener('keydown', preloadOnInteraction)
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', preloadOnInteraction, { once: true })
  document.addEventListener('keydown', preloadOnInteraction, { once: true })
}
