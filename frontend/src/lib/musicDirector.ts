import { audioSystem } from './audioSystem'
import { RecordedMusicPlayer } from './musicPlayback'
import { FALLBACK_SOUNDSCAPE, soundscapeFor, type MusicScene, type RouteSoundscape } from './audioScenes'

const music = new RecordedMusicPlayer({
  onPlaybackFailure: () => {
    gestureSeen = false
    arm()
  },
})

let gestureSeen = false
let armed = false
let observingVisibility = false
let routeName: unknown = null
let routeSlug: string | null = null
let sceneOverride: MusicScene | null = null
let applied: RouteSoundscape = FALLBACK_SOUNDSCAPE

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend', 'click'] as const
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

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
  applied = sceneOverride ? { ...selected, music: sceneOverride } : selected
  applyMusic(applied.music)
  applyAmbience(applied.ambience)
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
    music.pause()
    audioSystem.stopAmbience()
    gestureSeen = false
  }
  // Foregrounding does not unexpectedly play sound. The next click or
  // keypress resumes the same recording at its retained position.
  arm()
}

export const musicDirector = {
  init(): void {
    if (!observingVisibility && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
      observingVisibility = true
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
      return
    }
    if (!audioSystem.isMusicEnabled()) music.stop()
    if (viaGesture) markGesture()
    else reconcile()
  },

  setScene(scene: MusicScene): void {
    if (sceneOverride === scene) return
    sceneOverride = scene
    reconcile()
  },

  reset(forgetRoute = false): void {
    disarm()
    if (observingVisibility && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    observingVisibility = false
    gestureSeen = false
    sceneOverride = null
    applied = FALLBACK_SOUNDSCAPE
    if (forgetRoute) {
      routeName = null
      routeSlug = null
    }
    music.stop(0)
  },

  isRunning(): boolean { return music.isRunning() },

  inspect() {
    return { armed, gestureSeen, routeName, routeSlug, music: applied.music, playback: music.inspect() }
  },
}
