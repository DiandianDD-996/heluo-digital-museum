/**
 * Reactive view over the audio system's preferences.
 *
 * `audioSystem` is a plain singleton — the browser owns the AudioContext
 * and it has to outlive any component tree, so making it reactive itself
 * would mean fighting the lifecycle it is deliberately outside of. This
 * store is the translation layer instead: Vue reads and writes here, and
 * every setter forwards to the singleton, which remains the single source
 * of truth for persistence.
 *
 * The four preferences are independent on purpose:
 *
 *   - `enabled`  — the master switch. Everything downstream ramps to 0.
 *   - `sfx`      — interaction and transition sounds.
 *   - `music`    — the approved recorded music.
 *   - `tier`     — how loud, relative to the `normal` reference.
 *
 * `tier: 'silent'` and `enabled: false` are *not* the same thing: silent is
 * a chosen volume, and it keeps the graph and playback position alive so
 * turning it back up is instant rather than a cold start.
 */
import { computed, ref } from 'vue'
import { audioSystem, VOLUME_TIER_ORDER, type VolumeTier } from '../lib/audioSystem'
import { musicDirector } from '../lib/musicDirector'

const enabled = ref(audioSystem.isEnabled())
const sfxEnabled = ref(audioSystem.isSfxToggleOn())
const musicEnabled = ref(audioSystem.isMusicToggleOn())
const volumeTier = ref<VolumeTier>(audioSystem.getVolumeTier())

/** Mirrors state after the singleton has been mutated, so a caller never
 *  has to remember which of the two is authoritative. */
function sync() {
  enabled.value = audioSystem.isEnabled()
  sfxEnabled.value = audioSystem.isSfxToggleOn()
  musicEnabled.value = audioSystem.isMusicToggleOn()
  volumeTier.value = audioSystem.getVolumeTier()
  // The music director's decision depends on exactly these flags, so it is
  // told here rather than watching them: a watcher would fire a tick later
  // and would also react to state changes the user did not cause.
  musicDirector.refresh()
}

export function useAudio() {
  const isEnabled = computed(() => enabled.value)
  const isSfxOn = computed(() => sfxEnabled.value)
  const isMusicOn = computed(() => musicEnabled.value)
  const tier = computed(() => volumeTier.value)
  /** True when sound is on but nothing can currently be heard — the header
   *  uses this to show a "muted" state that is distinct from "off". */
  const isAudible = computed(() => enabled.value && volumeTier.value !== 'silent')

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

  return {
    enabled,
    isEnabled,
    isAudible,
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
    sync,
  }
}
