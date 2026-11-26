<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useLocale } from '../stores/locale'

const props = defineProps<{
  src: string
  srcset?: string
  sizes?: string
  alt: string
  transitionStyle?: Record<string, string>
}>()

const emit = defineEmits<{
  (event: 'error'): void
}>()

const { locale } = useLocale()
const isEnglish = computed(() => locale.value === 'en-US')

const stageRef = ref<HTMLElement | null>(null)
const triggerBtnRef = ref<HTMLButtonElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
const lightboxRef = ref<HTMLDialogElement | null>(null)

const loupeEnabled = ref(true)
const loupeActive = ref(false)
const loupeX = ref(0)
const loupeY = ref(0)
const loupePctX = ref(50)
const loupePctY = ref(50)
const stageWidth = ref(640)
const stageHeight = ref(480)

const lightboxOpen = ref(false)
const zoomScale = ref<1 | 1.8 | 2.8>(1.8)
const panX = ref(0)
const panY = ref(0)
let dragging = false
let dragStartX = 0
let dragStartY = 0
let panOriginX = 0
let panOriginY = 0

const MAGNIFICATION = 2.5

const isFinePointer = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

function onPointerMove(event: PointerEvent) {
  if (!loupeEnabled.value || !isFinePointer() || event.pointerType === 'touch') return
  const el = stageRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
  stageWidth.value = rect.width
  stageHeight.value = rect.height
  loupeX.value = x
  loupeY.value = y
  loupePctX.value = (x / rect.width) * 100
  loupePctY.value = (y / rect.height) * 100
  loupeActive.value = true
}

function onPointerLeave() {
  loupeActive.value = false
}

const loupeStyle = computed(() => ({
  transform: `translate3d(${loupeX.value.toFixed(1)}px, ${loupeY.value.toFixed(1)}px, 0) translate(-50%, -50%)`,
}))

const loupeImageStyle = computed(() => {
  const lensRadius = 84
  const tx = lensRadius - loupeX.value * MAGNIFICATION
  const ty = lensRadius - loupeY.value * MAGNIFICATION
  return {
    width: `${(stageWidth.value * MAGNIFICATION).toFixed(1)}px`,
    height: `${(stageHeight.value * MAGNIFICATION).toFixed(1)}px`,
    transform: `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`,
  }
})

function openLightbox() {
  const dialog = lightboxRef.value
  if (!dialog || dialog.open) return
  loupeActive.value = false
  zoomScale.value = 1.8
  panX.value = 0
  panY.value = 0
  lightboxOpen.value = true
  dialog.showModal()
  void nextTick(() => {
    if (dialog.open) closeBtnRef.value?.focus({ preventScroll: true })
  })
}

function closeLightbox() {
  lightboxRef.value?.close()
  lightboxOpen.value = false
  dragging = false
  void nextTick(() => {
    triggerBtnRef.value?.focus({ preventScroll: true })
  })
}

function setZoom(next: 1 | 1.8 | 2.8) {
  zoomScale.value = next
  if (next === 1) {
    panX.value = 0
    panY.value = 0
  }
}

function onLightboxPointerDown(event: PointerEvent) {
  if (zoomScale.value <= 1) return
  dragging = true
  dragStartX = event.clientX
  dragStartY = event.clientY
  panOriginX = panX.value
  panOriginY = panY.value
  ;(event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId)
}

function onLightboxPointerMove(event: PointerEvent) {
  if (!dragging) return
  panX.value = Math.max(-420, Math.min(420, panOriginX + (event.clientX - dragStartX)))
  panY.value = Math.max(-320, Math.min(320, panOriginY + (event.clientY - dragStartY)))
}

function onLightboxPointerUp() {
  dragging = false
}

function containTab(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const buttons = lightboxRef.value?.querySelectorAll<HTMLButtonElement>('.loupe-lightbox__actions button:not(:disabled)')
  if (!buttons?.length) return
  const first = buttons[0]
  const last = buttons[buttons.length - 1]
  if (document.activeElement === (event.shiftKey ? first : last)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first)?.focus()
  }
}

</script>

<template>
  <div
    ref="stageRef"
    class="loupe-stage"
    data-testid="artifact-loupe-stage"
    data-cursor="media"
    :style="transitionStyle"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @click="openLightbox"
  >
    <img
      class="loupe-stage__img"
      :src="src"
      :srcset="srcset"
      :sizes="sizes"
      :alt="alt"
      decoding="async"
      @error="emit('error')"
    />

    <!-- Desktop 2.5x Brass Vernier Optical Loupe -->
    <div
      v-if="loupeActive"
      class="loupe-lens"
      data-testid="artifact-loupe-lens"
      :style="loupeStyle"
      aria-hidden="true"
    >
      <img class="loupe-lens__img" :src="src" alt="" :style="loupeImageStyle" />
      <span class="loupe-lens__crosshair"></span>
      <span class="loupe-lens__readout font-mono">2.5× · {{ Math.round(loupePctX) }},{{ Math.round(loupePctY) }}</span>
    </div>

    <div class="loupe-controls" @click.stop>
      <button
        type="button"
        class="loupe-pill loupe-pill--desktop font-mono"
        data-glass="dark"
        :aria-pressed="loupeEnabled"
        @click="loupeEnabled = !loupeEnabled; if (!loupeEnabled) loupeActive = false"
      >
        {{ loupeEnabled ? (isEnglish ? '2.5× Loupe On' : '2.5× 微距镜已启') : (isEnglish ? '2.5× Loupe Off' : '开启 2.5× 微距镜') }}
      </button>
      <button
        ref="triggerBtnRef"
        type="button"
        class="loupe-pill"
        data-glass="dark"
        data-testid="artifact-fullscreen-btn"
        :aria-label="isEnglish ? 'Open fullscreen high-resolution inspection' : '全屏暗房高清检视'"
        @click="openLightbox"
      >
        {{ isEnglish ? 'Fullscreen Zoom' : '全屏高清检视' }}
      </button>
    </div>

    <Teleport to="body">
      <dialog
        ref="lightboxRef"
        class="loupe-lightbox"
        :aria-label="isEnglish ? `${alt} — Darkroom high-resolution view` : `${alt} — 暗房高清缩放检视`"
        data-testid="artifact-loupe-lightbox"
        @click.self="closeLightbox"
        @cancel.prevent="closeLightbox"
        @keydown="containTab"
      >
        <header class="loupe-lightbox__bar">
          <div class="loupe-lightbox__title">
            <span class="font-mono">OPTICAL DARKROOM</span>
            <strong>{{ alt }}</strong>
          </div>
          <div class="loupe-lightbox__actions">
            <div class="loupe-zoom-group" role="group" :aria-label="isEnglish ? 'Zoom level' : '缩放倍率'">
              <button type="button" :class="{ active: zoomScale === 1 }" @click="setZoom(1)">1×</button>
              <button type="button" :class="{ active: zoomScale === 1.8 }" @click="setZoom(1.8)">1.8×</button>
              <button type="button" :class="{ active: zoomScale === 2.8 }" @click="setZoom(2.8)">2.8×</button>
            </div>
            <button
              ref="closeBtnRef"
              type="button"
              class="loupe-lightbox__close"
              data-testid="artifact-lightbox-close"
              :aria-label="isEnglish ? 'Close fullscreen inspection' : '关闭高清检视'"
              autofocus
              @click="closeLightbox"
            >
              {{ isEnglish ? 'Close (Esc)' : '关闭 (Esc)' }}
            </button>
          </div>
        </header>

        <div
          v-if="lightboxOpen"
          class="loupe-lightbox__viewport"
          :class="{ 'is-draggable': zoomScale > 1 }"
          @pointerdown="onLightboxPointerDown"
          @pointermove="onLightboxPointerMove"
          @pointerup="onLightboxPointerUp"
          @pointercancel="onLightboxPointerUp"
        >
          <img
            :src="src"
            :alt="alt"
            draggable="false"
            :style="{ transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoomScale})` }"
          />
        </div>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
.loupe-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  display: grid;
  place-items: center;
  cursor: zoom-in;
}

.loupe-stage__img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  max-height: 484px;
  object-fit: contain;
  border-radius: var(--radius-xs);
  filter: drop-shadow(0 20px 28px var(--plinth-contact-shadow));
}

.loupe-lens {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  width: 168px;
  height: 168px;
  border-radius: 50%;
  border: 1.5px solid var(--accent-bronze);
  background: var(--surface-vitrine);
  box-shadow: 0 0 0 1px oklch(100% 0 0 / 0.16) inset, var(--shadow-lg);
  overflow: hidden;
  pointer-events: none;
}

.loupe-lens__img {
  position: absolute;
  top: 0;
  left: 0;
  max-width: none;
  max-height: none;
  object-fit: contain;
  will-change: transform;
}

.loupe-lens__crosshair {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent calc(50% - 0.5px), oklch(82% 0.054 78 / 0.42) 50%, transparent calc(50% + 0.5px)),
    linear-gradient(0deg, transparent calc(50% - 0.5px), oklch(82% 0.054 78 / 0.42) 50%, transparent calc(50% + 0.5px));
}

.loupe-lens__readout {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-pill);
  background: oklch(10% 0.006 238 / 0.82);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.loupe-controls {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.loupe-pill {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.8rem;
  border-radius: var(--radius-pill);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.loupe-pill:hover {
  border-color: var(--accent-bronze);
}

@media (hover: none), (pointer: coarse) {
  .loupe-pill--desktop,
  .loupe-lens {
    display: none;
  }
}

.loupe-lightbox {
  position: fixed;
  inset: 0;
  z-index: 220;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  grid-template-rows: auto minmax(0, 1fr);
  background: oklch(9% 0.006 238 / 0.96);
  color: var(--ink-on-dark);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.loupe-lightbox[open] {
  display: grid;
}

:global(html:has(.loupe-lightbox[open])) {
  overflow: hidden;
}

.loupe-lightbox__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid oklch(92% 0.008 232 / 0.14);
}

.loupe-lightbox__title {
  display: grid;
  gap: 2px;
}

.loupe-lightbox__title span {
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: var(--accent-bronze);
}

.loupe-lightbox__title strong {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--ink-on-dark);
}

.loupe-lightbox__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.loupe-zoom-group {
  display: inline-flex;
  padding: 3px;
  border: 1px solid oklch(92% 0.008 232 / 0.18);
  border-radius: var(--radius-pill);
  background: oklch(14% 0.007 238 / 0.85);
}

.loupe-zoom-group button {
  min-width: 44px;
  min-height: 44px;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-on-dark-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.loupe-zoom-group button.active {
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
}

.loupe-lightbox__close {
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid oklch(92% 0.008 232 / 0.24);
  border-radius: var(--radius-pill);
  background: oklch(16% 0.007 238 / 0.85);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.loupe-lightbox__viewport {
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: var(--space-6);
  touch-action: none;
}

.loupe-lightbox__viewport.is-draggable {
  cursor: grab;
}

.loupe-lightbox__viewport.is-draggable:active {
  cursor: grabbing;
}

.loupe-lightbox__viewport img {
  max-width: min(86vw, 920px);
  max-height: 76dvh;
  object-fit: contain;
  user-select: none;
  transition: transform 180ms var(--ease-curatorial);
}
</style>
