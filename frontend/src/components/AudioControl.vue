<script setup lang="ts">
/**
 * Header sound control: one master switch, with everything else tucked
 * into a panel that opens on hover or click.
 *
 * Why a panel rather than three buttons: the header already carries theme,
 * locale and account, and a museum brand bar that grows a fourth permanent
 * control starts reading as a toolbar. Sound is a preference people set
 * once and then forget, so it earns one icon and a disclosure.
 *
 * Hover and click are both supported because they serve different people.
 * A mouse user should be able to glance at the tier without committing to
 * a click; a keyboard or touch user needs a real toggle. Hover therefore
 * does not steal focus or trap anything, while click moves focus into the
 * panel so the next Tab lands somewhere sensible.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAudio } from '../stores/audio'
import { useLocale } from '../stores/locale'
import type { VolumeTier } from '../lib/audioSystem'

const { enabled, isAudible, isSfxOn, isMusicOn, volumeTier, tierOrder, toggle, enable, setSfxEnabled, setMusicEnabled, setVolumeTier } = useAudio()
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
  return copy.value.on
})

function togglePanel() {
  if (open.value && openedByClick) {
    close()
    return
  }
  if (!enabled.value) {
    // Turning sound on is the only meaningful first action, and it needs
    // the click as its gesture. Opening a panel of controls for a system
    // that is off would just be a dead end.
    enable()
  }
  // A hover preview becomes a clicked-open panel; the first click must
  // not immediately undo the pointerenter that preceded it.
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
  // Focus inside the panel means someone is using it — closing on pointer
  // leave would yank it away mid-interaction for keyboard users on a
  // machine that also has a mouse.
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
  // Choosing `silent` while the master switch is on is a request to hear
  // nothing; leaving the master on means one click restores the previous
  // volume instead of re-running the whole enable path.
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
    :class="{ 'audio-control--open': open, 'audio-control--off': !enabled }"
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
      <svg v-if="isAudible" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M18.5 5.5a9 9 0 010 13"/></svg>
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

        <label class="audio-panel__check">
          <input type="checkbox" :checked="isSfxOn" @change="setSfxEnabled(($event.target as HTMLInputElement).checked)" />
          <span>{{ copy.sfx }}</span>
        </label>

        <label class="audio-panel__check">
          <input type="checkbox" :checked="isMusicOn" @change="setMusicEnabled(($event.target as HTMLInputElement).checked)" />
          <span>{{ copy.music }}</span>
        </label>

        <p class="audio-panel__hint">{{ copy.hint }}</p>
      </div>
    </Transition>
  </div>
</template>
