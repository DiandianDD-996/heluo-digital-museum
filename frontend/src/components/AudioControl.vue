<script setup lang="ts">
/**
 * Header sound control: one master switch, with everything else tucked
 * into a panel that opens on hover or click.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAudio } from '../stores/audio'
import { useLocale } from '../stores/locale'
import type { VolumeTier } from '../lib/audioSystem'
import type { MusicTrack } from '../lib/audioScenes'
import { MUSIC_CATALOG, MUSIC_TRACK_ORDER } from '../lib/musicCatalog'

const {
  enabled,
  isAudible,
  isSfxOn,
  isMusicOn,
  isPaused,
  currentTrack,
  manualTrack,
  volumeTier,
  tierOrder,
  toggle,
  enable,
  setSfxEnabled,
  setMusicEnabled,
  setVolumeTier,
  setManualTrack,
  resumePlayback,
} = useAudio()
const { locale, t } = useLocale()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelOffset = ref(0)
let openedByClick = false

const copy = computed(() => t.value.audio)
const masterLabel = computed(() => enabled.value ? copy.value.sound : copy.value.mute)
const stateLabel = computed(() => {
  if (!enabled.value) return copy.value.muted
  if (isPaused?.value) return copy.value.paused
  return copy.value.on
})

const activeTrackMeta = computed(() => {
  const id = currentTrack?.value
  return id ? MUSIC_CATALOG[id] : null
})

const trackLabel = computed(() => {
  const meta = activeTrackMeta.value
  if (!meta) return ''
  return locale.value === 'en-US' ? meta.titleEn : `《${meta.titleZh}》`
})

function selectTrack(track: MusicTrack | null) {
  if (track !== null && !isMusicOn.value) setMusicEnabled(true)
  setManualTrack?.(track)
}

function togglePanel() {
  if (open.value && openedByClick) {
    close()
    return
  }
  if (!enabled.value) {
    enable()
  } else if (isPaused?.value) {
    resumePlayback?.()
  }
  openedByClick = true
  open.value = true
  void nextTick(() => {
    if (open.value && openedByClick) panel.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  })
}

function close(restoreFocus = false) {
  open.value = false
  openedByClick = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}

function onPointerEnter(event: PointerEvent) {
  if (event.pointerType !== 'touch' && enabled.value) open.value = true
}

function onPointerLeave(event: PointerEvent) {
  if (root.value?.contains(document.activeElement) && document.activeElement !== root.value) return
  if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget)) return
  close()
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!root.value) return
  if (event.target instanceof Node && root.value.contains(event.target)) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close(true)
  }
}

function onFocusOut(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget)) return
  close()
}

function positionPanel() {
  if (!open.value || !root.value || !panel.value) return
  const viewport = document.documentElement.clientWidth || window.innerWidth
  const width = panel.value.offsetWidth
  const initialLeft = root.value.getBoundingClientRect().right - width
  const clampedLeft = Math.min(Math.max(16, initialLeft), Math.max(16, viewport - width - 16))
  panelOffset.value = clampedLeft - initialLeft
}

function chooseTier(value: VolumeTier) {
  setVolumeTier(value)
}

function toggleMaster() {
  toggle()
  if (!enabled.value) close(true)
}

watch(open, (value) => {
  if (value) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.addEventListener('resize', positionPanel)
    void nextTick(positionPanel)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    window.removeEventListener('resize', positionPanel)
  }
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('resize', positionPanel)
})
</script>

<template>
  <div
    ref="root"
    class="audio-control"
    :class="{ 'audio-control--open': open, 'audio-control--off': !enabled, 'audio-control--paused': isPaused }"
    :style="{ '--audio-panel-offset': `${panelOffset}px` }"
    data-glass="compact"
    data-glass-interactive
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @focusout="onFocusOut"
  >
    <button
      ref="trigger"
      class="theme-toggle audio-toggle"
      type="button"
      :aria-label="enabled ? (locale === 'zh-CN' ? '声音设置，当前已开启' : 'Sound settings, currently on') : (locale === 'zh-CN' ? '开启声音' : 'Enable sound')"
      :aria-expanded="open"
      aria-haspopup="true"
      aria-controls="audio-control-panel"
      @click="togglePanel"
    >
      <svg v-if="isAudible && !isPaused" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M18.5 5.5a9 9 0 010 13"/></svg>
      <svg v-else-if="enabled" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
      <span>{{ masterLabel }}</span>
    </button>

    <Transition name="audio-panel">
      <div
        v-if="open"
        ref="panel"
        id="audio-control-panel"
        class="audio-panel"
        role="group"
        :aria-label="copy.panel"
      >
        <p class="audio-panel__title">
          <span>{{ copy.panel }}</span>
          <em>{{ stateLabel }}</em>
        </p>

        <button
          class="audio-panel__switch"
          type="button"
          :aria-pressed="enabled"
          @click="toggleMaster"
        >
          {{ copy.master }}
          <i aria-hidden="true" />
        </button>

        <div v-if="enabled" class="audio-panel__placard" data-testid="audio-track-placard">
          <button
            v-if="isPaused"
            type="button"
            class="audio-panel__resume"
            @click="resumePlayback?.()"
          >
            <span>{{ copy.resumeHint }}</span>
            <small v-if="trackLabel">{{ trackLabel }}</small>
          </button>
          <p v-else-if="activeTrackMeta" class="audio-panel__now">
            <span class="audio-panel__now-label">{{ copy.nowPlaying }} · {{ trackLabel }}</span>
            <span class="audio-panel__now-meta font-mono">{{ activeTrackMeta.durationLabel }}</span>
          </p>
          <p v-else class="audio-panel__now is-quiet">
            <span>{{ isMusicOn ? copy.quietRoom : copy.musicOff }}</span>
          </p>
        </div>

        <fieldset class="audio-panel__fieldset">
          <legend>{{ copy.volume }}</legend>
          <div class="audio-panel__tiers">
            <button
              v-for="value in tierOrder"
              :key="value"
              type="button"
              class="audio-panel__tier"
              :class="{ 'is-active': volumeTier === value }"
              :aria-pressed="volumeTier === value"
              @click="chooseTier(value)"
            >
              {{ copy.tiers[value] }}
            </button>
          </div>
        </fieldset>

        <fieldset v-if="enabled" class="audio-panel__fieldset">
          <legend>{{ copy.tracks }}</legend>
          <div class="audio-panel__tracks">
            <button
              type="button"
              class="audio-panel__track-btn"
              :class="{ 'is-active': (manualTrack ?? null) === null }"
              :aria-pressed="(manualTrack ?? null) === null"
              @click="selectTrack(null)"
            >
              {{ copy.trackAuto }}
            </button>
            <button
              v-for="id in MUSIC_TRACK_ORDER"
              :key="id"
              type="button"
              class="audio-panel__track-btn"
              :class="{ 'is-active': manualTrack === id }"
              :aria-pressed="manualTrack === id"
              @click="selectTrack(id)"
            >
              {{ locale === 'en-US' ? MUSIC_CATALOG[id].titleEn : MUSIC_CATALOG[id].titleZh }}
            </button>
          </div>
        </fieldset>

        <label class="audio-panel__check">
          <input type="checkbox" :checked="isSfxOn" @change="setSfxEnabled(($event.target as HTMLInputElement).checked)" />
          <span>{{ copy.sfx }}</span>
        </label>

        <label class="audio-panel__check">
          <input type="checkbox" :checked="isMusicOn" @change="setMusicEnabled(($event.target as HTMLInputElement).checked)" />
          <span>{{ copy.music }}</span>
        </label>

        <details class="audio-panel__notes">
          <summary>{{ copy.notesTitle }}</summary>
          <p>{{ copy.notesBody }}</p>
        </details>

        <p class="audio-panel__hint">{{ copy.hint }}</p>
      </div>
    </Transition>
  </div>
</template>
