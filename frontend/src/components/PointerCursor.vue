<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePointerCapabilities } from '../composables/usePointerCapabilities'
import { usePointerMotion } from '../composables/usePointerMotion'
import { subscribeMotionFrame } from '../lib/motionFrame'
import { POINTER_TIER_EVENT, resolveCursorIntent, type MotionTier } from '../lib/pointerMotion'
import { useLightPreset } from '../stores/lightPreset'

const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const dot = ref<HTMLSpanElement | null>(null)
const halo = ref<HTMLSpanElement | null>(null)
const pulse = ref<HTMLSpanElement | null>(null)
const trailA = ref<HTMLSpanElement | null>(null)
const trailB = ref<HTMLSpanElement | null>(null)
const keyboardMode = ref(false)
const directInputTier = ref<MotionTier | null>(null)
const { preset } = useLightPreset()
const { tier, reducedTransparency, downgradeForFps } = usePointerCapabilities()
const { pointer, position, updatePosition, setVisible, setPressed, setIntent, setTier } = usePointerMotion()
const enabled = computed(() => !props.disabled && !keyboardMode.value && directInputTier.value === null && tier.value !== 'static')

let stopFrame: (() => void) | undefined
let previousX = 0
let previousY = 0
let previousMoveTime = 0
let sampledTime = 0
let sampledFrames = 0
let performanceProbeActive = false
let frameCheckQueued = false
let lastIntentTarget: EventTarget | null = null
let mounted = false
let haloX = 0
let haloY = 0
let trailAX = 0
let trailAY = 0
let trailBX = 0
let trailBY = 0
let haloReady = false
let pulseTimer: ReturnType<typeof setTimeout> | undefined

function updateCapabilityClass() {
  const root = document.documentElement
  const previousTier = root.dataset.motionTier
  const nextTier = props.disabled || keyboardMode.value ? 'static' : (directInputTier.value ?? tier.value)
  root.classList.toggle('pointer-motion-enabled', enabled.value)
  root.dataset.motionTier = nextTier
  root.dataset.reducedTransparency = reducedTransparency.value ? 'true' : 'false'
  setTier(nextTier)
  if (!enabled.value) hidePointer()
  if (previousTier !== nextTier) {
    root.dispatchEvent(new CustomEvent(POINTER_TIER_EVENT, { detail: { tier: nextTier } }))
  }
}

function hidePointer(resetPosition = true) {
  setVisible(false)
  stopFrame?.()
  stopFrame = undefined
  sampledFrames = 0
  sampledTime = 0
  performanceProbeActive = false
  haloReady = false
  halo.value?.setAttribute('data-pulling', 'false')
  if (resetPosition) {
    previousMoveTime = 0
    lastIntentTarget = null
  }
}

function triggerClickPulse(x: number, y: number) {
  const el = pulse.value
  if (!el || !enabled.value) return
  el.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0)`)
  el.classList.remove('is-pulsing')
  void el.offsetWidth
  el.classList.add('is-pulsing')
  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => {
    pulse.value?.classList.remove('is-pulsing')
  }, 560)
}

function ensureFrame() {
  if (!mounted || stopFrame || !enabled.value || !pointer.visible) return
  stopFrame = subscribeMotionFrame((_time, deltaMs) => {
    dot.value?.style.setProperty('transform', `translate3d(${position.clientX}px, ${position.clientY}px, 0)`)
    if (!haloReady) {
      haloX = position.clientX
      haloY = position.clientY
      trailAX = position.clientX
      trailAY = position.clientY
      trailBX = position.clientX
      trailBY = position.clientY
      haloReady = true
    }

    const clampedDt = Math.min(deltaMs, 64)
    const followAlpha = 1 - Math.exp(-clampedDt / 58)
    haloX += (position.clientX - haloX) * followAlpha
    haloY += (position.clientY - haloY) * followAlpha

    const trailAAlpha = 1 - Math.exp(-clampedDt / 92)
    trailAX += (haloX - trailAX) * trailAAlpha
    trailAY += (haloY - trailAY) * trailAAlpha

    const trailBAlpha = 1 - Math.exp(-clampedDt / 138)
    trailBX += (trailAX - trailBX) * trailBAlpha
    trailBY += (trailAY - trailBY) * trailBAlpha

    const lagX = position.clientX - haloX
    const lagY = position.clientY - haloY
    const lagDistance = Math.hypot(lagX, lagY)
    const pullAngle = Math.atan2(lagY, lagX)
    const pullScale = 1 + Math.min(lagDistance / 120, .06)
    halo.value?.style.setProperty(
      'transform',
      `translate3d(${haloX}px, ${haloY}px, 0) rotate(${pullAngle}rad) scaleX(${pullScale}) scaleY(${1 / pullScale})`,
    )
    halo.value?.setAttribute('data-pulling', String(lagDistance > .75))

    trailA.value?.style.setProperty('transform', `translate3d(${trailAX}px, ${trailAY}px, 0)`)
    trailB.value?.style.setProperty('transform', `translate3d(${trailBX}px, ${trailBY}px, 0)`)

    sampledTime += deltaMs
    sampledFrames += 1
    if (sampledFrames >= 20) {
      const fps = sampledFrames / (sampledTime / 1000)
      const nextTier = downgradeForFps(fps)
      performanceProbeActive = fps < 40 && nextTier === 'restrained'
      sampledFrames = 0
      sampledTime = 0
    }

    if (!performanceProbeActive && lagDistance <= .75) {
      stopFrame?.()
      stopFrame = undefined
    }
  })
}

function queueFrameCheck() {
  if (frameCheckQueued) return
  frameCheckQueued = true
  void nextTick(() => {
    frameCheckQueued = false
    if (mounted) ensureFrame()
  })
}

function useSystemPointerFor(event: PointerEvent): boolean {
  if (!event.pointerType || event.pointerType === 'mouse') return false
  keyboardMode.value = false
  directInputTier.value = event.pointerType === 'pen' ? 'restrained' : 'static'
  setPressed(false)
  hidePointer()
  // Restore the native cursor in the same input event; a deferred watcher leaves
  // hybrid devices with cursor:none until Vue's next render flush.
  updateCapabilityClass()
  return true
}

function onPointerMove(event: PointerEvent) {
  if (useSystemPointerFor(event)) return
  directInputTier.value = null
  keyboardMode.value = false
  const time = event.timeStamp || performance.now()
  const elapsed = previousMoveTime ? Math.max(time - previousMoveTime, 1) : 16.67
  const velocityX = (event.clientX - previousX) / elapsed * 1000
  const velocityY = (event.clientY - previousY) / elapsed * 1000
  previousX = event.clientX
  previousY = event.clientY
  previousMoveTime = time
  if (!haloReady) {
    haloX = event.clientX
    haloY = event.clientY
    trailAX = event.clientX
    trailAY = event.clientY
    trailBX = event.clientX
    trailBY = event.clientY
    haloReady = true
  }
  updatePosition(event.clientX, event.clientY, velocityX, velocityY)
  if (event.target !== lastIntentTarget) {
    lastIntentTarget = event.target
    setIntent(resolveCursorIntent(event.target))
  }
  if (enabled.value) setVisible(true)
  ensureFrame()
  // A keyboard-to-pointer switch remounts the cursor on the next Vue flush.
  // Re-request the shared frame there without writing DOM from pointermove.
  queueFrameCheck()
}

function onPointerDown(event: PointerEvent) {
  if (useSystemPointerFor(event)) return
  setPressed(true)
  triggerClickPulse(event.clientX, event.clientY)
}
function onPointerUp() { setPressed(false) }
function onPointerLeave(event: PointerEvent) {
  if (!event.relatedTarget) {
    lastIntentTarget = null
    hidePointer()
  }
}
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Tab') keyboardMode.value = true
}
function onVisibilityChange() {
  if (document.hidden) hidePointer()
}
function onBlur() { hidePointer(); setPressed(false) }

watch([enabled, tier, reducedTransparency, directInputTier], updateCapabilityClass)

onMounted(() => {
  mounted = true
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })
  window.addEventListener('pointercancel', onPointerUp, { passive: true })
  window.addEventListener('pointerout', onPointerLeave, { passive: true })
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibilityChange)
  updateCapabilityClass()
})

onBeforeUnmount(() => {
  mounted = false
  frameCheckQueued = false
  if (pulseTimer) clearTimeout(pulseTimer)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('pointerout', onPointerLeave)
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('blur', onBlur)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopFrame?.()
  document.documentElement.classList.remove('pointer-motion-enabled')
  delete document.documentElement.dataset.motionTier
  delete document.documentElement.dataset.reducedTransparency
})
</script>

<template>
  <div
    v-if="enabled"
    class="pointer-cursor"
    :class="{ 'is-visible': pointer.visible && enabled, 'is-pressed': pointer.pressed }"
    :data-intent="pointer.intent"
    :data-preset="preset"
    aria-hidden="true"
  >
    <span ref="trailB" class="pointer-cursor__trail pointer-cursor__trail--far"></span>
    <span ref="trailA" class="pointer-cursor__trail pointer-cursor__trail--near"></span>
    <span ref="halo" class="pointer-cursor__halo" data-pulling="false"></span>
    <span ref="dot" class="pointer-cursor__dot"></span>
    <span ref="pulse" class="pointer-cursor__pulse"></span>
  </div>
</template>
