import { audioSystem } from './audioSystem'
import { RecordedMusicPlayer } from './musicPlayback'
import {
  FALLBACK_SOUNDSCAPE,
  MUSIC_RECORDINGS,
  SCENE_BY_TRACK,
  soundscapeFor,
  type MusicScene,
  type MusicTrack,
  type RouteSoundscape,
} from './audioScenes'

export interface MusicDirectorState {
  activeTrack: MusicTrack | null
  isPausedByVisibility: boolean
  isPlaying: boolean
  manualTrack: MusicTrack | null
}

type StateListener = (state: MusicDirectorState) => void

const listeners = new Set<StateListener>()

let gestureSeen = false
let armed = false
let observingVisibility = false
let routeName: unknown = null
let routeSlug: string | null = null
let sceneOverride: MusicScene | null = null
let manualTrack: MusicTrack | null = null
let isPausedByVisibility = false
let applied: RouteSoundscape = FALLBACK_SOUNDSCAPE
let stopContextObserver: (() => void) | null = null

const music = new RecordedMusicPlayer({
  onPlaybackFailure: () => {
    gestureSeen = false
    isPausedByVisibility = false
    arm()
    emitState()
  },
  onStateChange: () => {
    emitState()
  },
})

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend', 'click'] as const
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

function currentSnapshot(): MusicDirectorState {
  const playback = music.inspect()
  const isPlaying = music.isRunning()
  const trackFromApplied = applied.music !== 'quiet' ? (MUSIC_RECORDINGS[applied.music]?.track ?? null) : null
  const activeTrack = playback.pending
    ?? playback.track
    ?? (isPlaying || isPausedByVisibility ? (manualTrack ?? trackFromApplied) : null)
  return {
    activeTrack,
    isPausedByVisibility,
    isPlaying,
    manualTrack,
  }
}

function emitState(): void {
  const snapshot = currentSnapshot()
  for (const listener of listeners) {
    listener(snapshot)
  }
}

function applyMusic(scene: MusicScene): void {
  if (!audioSystem.isMusicEnabled() || scene === 'quiet') {
    music.stop()
    return
  }
  // Building/resuming the graph and calling media.play() both happen in
  // this gesture. Reading getContext first would lose a returning user's
  // first click on pages without ambience, where no graph yet exists.
  const bus = audioSystem.ensureMusicBus()
  const context = audioSystem.getContext()
  if (context && bus) music.start(context, bus, scene)
}

function applyAmbience(scene: RouteSoundscape['ambience']): void {
  if (scene === null) audioSystem.stopAmbience()
  else if (audioSystem.getAmbienceScene() !== scene) void audioSystem.switchAmbience(scene)
}

function reconcile(): void {
  if (!gestureSeen || isHidden() || !audioSystem.isEnabled()) return
  const selected = soundscapeFor(routeName, routeSlug)
  const resolvedMusic = manualTrack
    ? SCENE_BY_TRACK[manualTrack]
    : (sceneOverride ?? selected.music)
  applied = { ...selected, music: resolvedMusic }
  isPausedByVisibility = false
  applyMusic(applied.music)
  applyAmbience(applied.ambience)
  emitState()
}

function markGesture(): void {
  if (isHidden()) return
  gestureSeen = true
  reconcile()
  if (gestureSeen && audioSystem.getContext() !== null) disarm()
}

function arm(): void {
  if (armed || typeof window === 'undefined') return
  armed = true
  for (const event of UNLOCK_EVENTS) window.addEventListener(event, markGesture, { passive: true })
}

function disarm(): void {
  if (!armed || typeof window === 'undefined') return
  armed = false
  for (const event of UNLOCK_EVENTS) window.removeEventListener(event, markGesture)
}

function onVisibilityChange(): void {
  if (isHidden()) {
    const wasRunning = music.isRunning() || (applied.music !== 'quiet' && gestureSeen && audioSystem.isMusicEnabled())
    music.pause()
    audioSystem.stopAmbience()
    gestureSeen = false
    if (wasRunning) isPausedByVisibility = true
  }
  // Foregrounding does not unexpectedly play sound. The next click or
  // keypress resumes the same recording at its retained position.
  arm()
  emitState()
}

export const musicDirector = {
  init(): void {
    if (!observingVisibility && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
      observingVisibility = true
    }
    if (!stopContextObserver && typeof audioSystem.onContextStateChange === 'function') {
      stopContextObserver = audioSystem.onContextStateChange((state) => {
        if (!audioSystem.isEnabled() || isHidden()) return
        if (state === 'interrupted' || state === 'suspended') {
          arm()
          emitState()
        } else if (state === 'running' && gestureSeen) {
          reconcile()
        }
      })
    }
    if (!gestureSeen) arm()
  },

  setRoute(name: unknown, slug?: unknown): void {
    const normalizedSlug = typeof slug === 'string' ? slug : null
    if (name === routeName && normalizedSlug === routeSlug) return
    routeName = name
    routeSlug = normalizedSlug
    sceneOverride = null
    reconcile()
  },

  refresh({ viaGesture = true }: { viaGesture?: boolean } = {}): void {
    if (!audioSystem.isEnabled()) {
      music.stop()
      audioSystem.stopAmbience()
      isPausedByVisibility = false
      emitState()
      return
    }
    if (!audioSystem.isMusicEnabled()) {
      music.stop()
      isPausedByVisibility = false
    }
    if (viaGesture) markGesture()
    else reconcile()
    emitState()
  },

  setScene(scene: MusicScene): void {
    if (sceneOverride === scene) return
    sceneOverride = scene
    reconcile()
  },

  setManualTrack(track: MusicTrack | null, { viaGesture = true }: { viaGesture?: boolean } = {}): void {
    if (manualTrack === track && (track === null || music.isRunning())) return
    manualTrack = track
    if (viaGesture && !isHidden() && audioSystem.isEnabled()) {
      gestureSeen = true
    }
    if (audioSystem.isEnabled() && gestureSeen && !isHidden()) {
      reconcile()
    } else {
      emitState()
    }
  },

  subscribe(listener: StateListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },

  getState(): MusicDirectorState {
    return currentSnapshot()
  },

  reset(forgetRoute = false): void {
    disarm()
    if (observingVisibility && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    stopContextObserver?.()
    stopContextObserver = null
    observingVisibility = false
    gestureSeen = false
    sceneOverride = null
    manualTrack = null
    isPausedByVisibility = false
    applied = FALLBACK_SOUNDSCAPE
    if (forgetRoute) {
      routeName = null
      routeSlug = null
    }
    music.stop(0)
    emitState()
  },

  isRunning(): boolean { return music.isRunning() },

  inspect() {
    return {
      armed,
      gestureSeen,
      routeName,
      routeSlug,
      music: applied.music,
      manualTrack,
      isPausedByVisibility,
      playback: music.inspect(),
    }
  },
}
