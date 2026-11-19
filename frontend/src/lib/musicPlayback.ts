import { MUSIC_RECORDINGS, type MusicRecording, type MusicScene, type MusicTrack } from './audioScenes'

interface MusicVoice {
  media: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  recording: MusicRecording
  disposed: boolean
  starting: boolean
  attempt: number
  timer: ReturnType<typeof setTimeout> | null
  onError: () => void
}

const FADE_IN_SECONDS = 1.4
const CROSSFADE_SECONDS = 1.8
const LOAD_TIMEOUT_MS = 15_000

/** Streams the approved recordings through the shared Web Audio music bus.
 * Only a playing voice and one incoming/outgoing voice can exist at once.
 * Construction is inert: no Audio element or request exists before start.
 */
export class RecordedMusicPlayer {
  private active: MusicVoice | null = null
  private pending: MusicVoice | null = null
  private retiring: MusicVoice | null = null
  private context: AudioContext | null = null
  private destination: AudioNode | null = null
  private paused = false
  private readonly createMedia: () => HTMLAudioElement
  private readonly onPlaybackFailure: () => void

  constructor(options: { createMedia?: () => HTMLAudioElement, onPlaybackFailure?: () => void } = {}) {
    this.createMedia = options.createMedia ?? (() => new Audio())
    this.onPlaybackFailure = options.onPlaybackFailure ?? (() => {})
  }

  start(context: AudioContext, destination: AudioNode, scene: MusicScene): void {
    const recording = MUSIC_RECORDINGS[scene]
    if (!recording) {
      this.stop(0.6)
      return
    }
    if (this.context !== context || this.destination !== destination) this.stop(0)
    this.context = context
    this.destination = destination
    const wasPaused = this.paused
    this.paused = false

    if (this.active?.recording.track === recording.track) {
      this.discardPending()
      this.active.recording = recording
      if (wasPaused || this.active.media.paused) this.play(this.active)
      else this.ramp(this.active, recording.gain, CROSSFADE_SECONDS)
      return
    }
    if (this.pending?.recording.track === recording.track) {
      this.pending.recording = recording
      if (wasPaused || !this.pending.starting) this.play(this.pending)
      return
    }

    this.discardPending()
    // A→B→A can happen while A is still fading. Reuse A at its current
    // position rather than creating a third element or starting it over.
    if (this.retiring?.recording.track === recording.track) {
      const returning = this.retiring
      this.retiring = null
      this.clearTimer(returning)
      const outgoing = this.active
      this.active = returning
      returning.recording = recording
      if (outgoing) this.retire(outgoing, CROSSFADE_SECONDS)
      if (wasPaused || returning.media.paused) this.play(returning)
      else this.ramp(returning, recording.gain, CROSSFADE_SECONDS)
      return
    }

    this.discardRetiring()
    let media: HTMLAudioElement | null = null
    let source: MediaElementAudioSourceNode | null = null
    let gain: GainNode | null = null
    try {
      media = this.createMedia()
      media.preload = 'none'
      media.loop = true
      media.setAttribute('playsinline', '')
      source = context.createMediaElementSource(media)
      gain = context.createGain()
      gain.gain.setValueAtTime(0, context.currentTime)
      source.connect(gain)
      gain.connect(destination)
      const voice: MusicVoice = {
        media, source, gain, recording, disposed: false, starting: false,
        attempt: 0, timer: null, onError: () => this.fail(voice),
      }
      media.addEventListener('error', voice.onError)
      this.pending = voice
      media.src = recording.src
      // play() must run in the enabling event, before awaiting readiness.
      this.play(voice)
    } catch {
      // Graph construction can fail before a voice owns its resources.
      if (!this.pending) {
        media?.pause()
        media?.removeAttribute('src')
        media?.load()
        source?.disconnect()
        gain?.disconnect()
      }
      this.stop(0.35)
      this.onPlaybackFailure()
    }
  }

  private play(voice: MusicVoice): void {
    if (voice.disposed) return
    voice.starting = true
    const attempt = ++voice.attempt
    this.clearTimer(voice)
    voice.timer = setTimeout(() => this.fail(voice), LOAD_TIMEOUT_MS)
    try {
      void voice.media.play().then(() => {
        if (voice.disposed || attempt !== voice.attempt || this.paused) return
        voice.starting = false
        this.clearTimer(voice)
        if (this.pending === voice) {
          const outgoing = this.active
          this.pending = null
          this.active = voice
          if (outgoing) this.retire(outgoing, CROSSFADE_SECONDS)
          this.ramp(voice, voice.recording.gain, outgoing ? CROSSFADE_SECONDS : FADE_IN_SECONDS)
        } else if (this.active === voice) {
          this.ramp(voice, voice.recording.gain, FADE_IN_SECONDS)
        }
      }).catch(() => {
        if (!voice.disposed && attempt === voice.attempt && !this.paused) this.fail(voice)
      })
    } catch {
      this.fail(voice)
    }
  }

  private fail(voice: MusicVoice): void {
    if (voice.disposed) return
    if (this.retiring === voice) {
      this.discardRetiring()
      return
    }
    this.stop(0.35)
    this.onPlaybackFailure()
  }

  private ramp(voice: MusicVoice, value: number, seconds: number): void {
    if (!this.context || voice.disposed) return
    const param = voice.gain.gain
    const now = this.context.currentTime
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now)
    else {
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
    }
    if (seconds <= 0) param.setValueAtTime(value, now)
    else param.linearRampToValueAtTime(value, now + seconds)
  }

  private retire(voice: MusicVoice, seconds: number): void {
    this.discardRetiring()
    this.retiring = voice
    this.ramp(voice, 0, seconds)
    this.clearTimer(voice)
    voice.timer = setTimeout(() => {
      if (this.retiring === voice) this.retiring = null
      this.disposeVoice(voice)
    }, seconds * 1000)
  }

  /** Retain position while hidden; the director asks for a fresh gesture. */
  pause(): void {
    this.paused = true
    this.discardRetiring()
    for (const voice of [this.active, this.pending]) {
      if (!voice) continue
      this.clearTimer(voice)
      voice.attempt++
      voice.starting = false
      this.ramp(voice, 0, 0)
      voice.media.pause()
    }
  }

  stop(fadeSeconds = 0.35): void {
    this.paused = false
    if (!this.active && !this.pending) {
      if (fadeSeconds <= 0) this.discardRetiring()
      return
    }
    this.discardPending()
    this.discardRetiring()
    const active = this.active
    this.active = null
    if (!active) return
    active.attempt++
    if (fadeSeconds > 0) this.retire(active, fadeSeconds)
    else this.disposeVoice(active)
  }

  private clearTimer(voice: MusicVoice): void {
    if (voice.timer !== null) clearTimeout(voice.timer)
    voice.timer = null
  }

  private discardPending(): void {
    if (this.pending) this.disposeVoice(this.pending)
    this.pending = null
  }

  private discardRetiring(): void {
    if (this.retiring) this.disposeVoice(this.retiring)
    this.retiring = null
  }

  private disposeVoice(voice: MusicVoice): void {
    if (voice.disposed) return
    voice.disposed = true
    voice.attempt++
    this.clearTimer(voice)
    voice.media.removeEventListener('error', voice.onError)
    voice.media.pause()
    voice.media.removeAttribute('src')
    voice.media.load()
    voice.source.disconnect()
    voice.gain.disconnect()
  }

  isRunning(): boolean {
    return !this.paused && (this.active !== null || this.pending !== null)
  }

  inspect(): { track: MusicTrack | null, pending: MusicTrack | null, retiring: MusicTrack | null, paused: boolean, mediaCount: number } {
    return {
      track: this.active?.recording.track ?? null,
      pending: this.pending?.recording.track ?? null,
      retiring: this.retiring?.recording.track ?? null,
      paused: this.paused,
      mediaCount: [this.active, this.pending, this.retiring].filter(Boolean).length,
    }
  }
}
