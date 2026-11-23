/**
 * Reactive view over the audio system's preferences and playback state.
 *
 * `audioSystem` is a plain singleton — the browser owns the AudioContext
 * and it has to outlive any component tree, so making it reactive itself
 * would mean fighting the lifecycle it is deliberately outside of. This
 * store is the translation layer instead: Vue reads and writes here, and
 * every setter forwards to the singleton, which remains the single source
 * of truth for persistence.
 */
import { computed, ref, watch } from 'vue'
import { audioSystem, VOLUME_TIER_ORDER, type VolumeTier } from '../lib/audioSystem'
import type { MusicTrack } from '../lib/audioScenes'
import { musicDirector } from '../lib/musicDirector'
import { syncMediaSession } from '../lib/mediaSession'
import { useLocale } from './locale'

const enabled = ref(audioSystem.isEnabled())
const sfxEnabled = ref(audioSystem.isSfxToggleOn())
const musicEnabled = ref(audioSystem.isMusicToggleOn())
const volumeTier = ref<VolumeTier>(audioSystem.getVolumeTier())

const initialDirector = musicDirector.getState()
const activeTrack = ref<MusicTrack | null>(initialDirector.activeTrack)
const isPausedByVisibility = ref(initialDirector.isPausedByVisibility)
const isMusicPlaying = ref(initialDirector.isPlaying)
const manualTrack = ref<MusicTrack | null>(initialDirector.manualTrack)

musicDirector.subscribe((state) => {
  activeTrack.value = state.activeTrack
  isPausedByVisibility.value = state.isPausedByVisibility
  isMusicPlaying.value = state.isPlaying
  manualTrack.value = state.manualTrack
})

function syncDirectorSnapshot() {
  const state = musicDirector.getState()
  activeTrack.value = state.activeTrack
  isPausedByVisibility.value = state.isPausedByVisibility
  isMusicPlaying.value = state.isPlaying
  manualTrack.value = state.manualTrack
}

/** Mirrors state after the singleton has been mutated, so a caller never
 *  has to remember which of the two is authoritative. */
function sync() {
  enabled.value = audioSystem.isEnabled()
  sfxEnabled.value = audioSystem.isSfxToggleOn()
  musicEnabled.value = audioSystem.isMusicToggleOn()
  volumeTier.value = audioSystem.getVolumeTier()
  musicDirector.refresh()
  syncDirectorSnapshot()
}

let mediaSessionWired = false

function ensureMediaSessionSync() {
  if (mediaSessionWired) return
  mediaSessionWired = true
  const { locale } = useLocale()
  watch(
    [enabled, musicEnabled, volumeTier, activeTrack, isPausedByVisibility, isMusicPlaying, locale],
    () => {
      const playing = enabled.value && musicEnabled.value && volumeTier.value !== 'silent' && isMusicPlaying.value
      const paused = enabled.value && musicEnabled.value && isPausedByVisibility.value
      syncMediaSession({
        track: activeTrack.value,
        isPlaying: playing,
        isPaused: paused,
        locale: locale.value,
        onPlay: () => {
          if (!audioSystem.isEnabled()) audioSystem.enable()
          if (!audioSystem.isMusicToggleOn()) audioSystem.setMusicEnabled(true)
          sync()
        },
        onPause: () => {
          audioSystem.setMusicEnabled(false)
          sync()
        },
        onStop: () => {
          audioSystem.disable()
          sync()
        },
      })
    },
    { immediate: true },
  )
}

export function useAudio() {
  ensureMediaSessionSync()

  const isEnabled = computed(() => enabled.value)
  const isSfxOn = computed(() => sfxEnabled.value)
  const isMusicOn = computed(() => musicEnabled.value)
  const tier = computed(() => volumeTier.value)
  /** True when sound is on but nothing can currently be heard — the header
   *  uses this to show a "muted" state that is distinct from "off". */
  const isAudible = computed(() => enabled.value && volumeTier.value !== 'silent')
  const isMusicAudible = computed(
    () => enabled.value && musicEnabled.value && volumeTier.value !== 'silent' && isMusicPlaying.value,
  )
  const isPaused = computed(() => enabled.value && musicEnabled.value && isPausedByVisibility.value)
  const currentTrack = computed(() => activeTrack.value)

  function toggle() {
    audioSystem.toggle()
    sync()
  }

  function enable() {
    audioSystem.enable()
    sync()
  }

  function disable() {
    audioSystem.disable()
    sync()
  }

  function setSfxEnabled(value: boolean) {
    audioSystem.setSfxEnabled(value)
    sync()
  }

  function setMusicEnabled(value: boolean) {
    audioSystem.setMusicEnabled(value)
    sync()
  }

  function setVolumeTier(value: VolumeTier) {
    audioSystem.setVolumeTier(value)
    sync()
  }

  function setManualTrack(track: MusicTrack | null) {
    musicDirector.setManualTrack(track)
    syncDirectorSnapshot()
  }

  function resumePlayback() {
    musicDirector.refresh({ viaGesture: true })
    syncDirectorSnapshot()
  }

  return {
    enabled,
    isEnabled,
    isAudible,
    isMusicAudible,
    isMusicPlaying,
    isPaused,
    currentTrack,
    manualTrack,
    sfxEnabled,
    isSfxOn,
    musicEnabled,
    isMusicOn,
    volumeTier,
    tier,
    tierOrder: VOLUME_TIER_ORDER,
    toggle,
    enable,
    disable,
    setSfxEnabled,
    setMusicEnabled,
    setVolumeTier,
    setManualTrack,
    resumePlayback,
    sync,
  }
}
