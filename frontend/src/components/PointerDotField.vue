<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePointerCapabilities } from '../composables/usePointerCapabilities'
import { usePointerMotion, type PointerPositionSubscriber } from '../composables/usePointerMotion'
import { subscribeMotionFrame } from '../lib/motionFrame'
import {
  createFlowMotes,
  pushTrailSample,
  renderLightField,
  spawnRipplePulse,
  stepLightFieldEffects,
  type LightFieldRuntime,
  type LightFieldVariant,
} from '../lib/lightFieldRenderers'
import {
  createDotFieldPoints,
  resetDotFieldTargets,
  resolveDotFieldRadius,
  setDotFieldPointerTarget,
  settleDotFieldPoints,
  type DotFieldPoint,
} from '../lib/pointerDotField'
import {
  createHeroDotFieldState,
  createHeroGridNodes,
  renderHeroDotField,
  spawnHeroWave,
  stepHeroDotField,
} from '../lib/heroDotFieldRenderers'
import { POINTER_TIER_EVENT, type MotionTier } from '../lib/pointerMotion'
import { LIGHT_PRESET_EVENT, useLightPreset, type LightPresetId } from '../stores/lightPreset'

type DotFieldState = 'idle' | 'active' | 'settling' | 'static' | 'disabled'

const props = withDefaults(defineProps<{ variant?: LightFieldVariant }>(), { variant: 'paper' })
const isHeroMatrix = () => props.variant === 'image'
const canvas = ref<HTMLCanvasElement | null>(null)
const state = ref<DotFieldState>('disabled')
const intersecting = ref(true)
const darkTheme = ref(false)
const applicationTier = ref<MotionTier>('full')
const { preset } = useLightPreset()
const { tier, reducedTransparency, downgradeForFps } = usePointerCapabilities()
const { pointer, subscribePosition } = usePointerMotion()

let host: HTMLElement | null = null
let context: CanvasRenderingContext2D | null = null
let points: DotFieldPoint[] = []
let width = 0
let height = 0
let radius = 170
let pointerInside = false
let pointerLocalX = 0
let pointerLocalY = 0
let stopFrame: (() => void) | undefined
let stopPosition: (() => void) | undefined
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let sampledFrames = 0
let sampledTime = 0
let mounted = false

const runtime: LightFieldRuntime = {
  preset: preset.value,
  variant: props.variant,
  dark: false,
  width: 0,
  height: 0,
  radius: 170,
  timeMs: 0,
  pointerInside: false,
  pointerX: 0,
  pointerY: 0,
  smoothX: 0,
  smoothY: 0,
  pointerSpeed: 0,
  presence: 0,
  points: [],
  trail: [],
  ripples: [],
  motes: [],
}

// A temporary application downgrade must not remove the already-static
// transparency fallback. Capability-level static modes still take priority.
const hasStaticOpaqueField = () => mounted
  && intersecting.value
  && reducedTransparency.value
  && tier.value !== 'static'
const supportsCanvasMode = () => mounted
  && !reducedTransparency.value
  && tier.value === 'full'
  && applicationTier.value === 'full'
const canRenderCanvas = () => mounted
  && intersecting.value
  && supportsCanvasMode()

const heroState = createHeroDotFieldState()

function syncRuntimeMeta() {
  runtime.preset = preset.value
  runtime.variant = props.variant
  runtime.dark = darkTheme.value
  runtime.width = width
  runtime.height = height
  runtime.radius = radius
  runtime.pointerInside = pointerInside
  runtime.pointerX = pointerLocalX
  runtime.pointerY = pointerLocalY
  runtime.points = points

  if (isHeroMatrix()) {
    heroState.dark = darkTheme.value
    heroState.width = width
    heroState.height = height
    heroState.pointerInside = pointerInside
    heroState.pointerX = pointerLocalX
    heroState.pointerY = pointerLocalY
  }
}

function drawPoints() {
  if (!context || !canRenderCanvas()) return
  syncRuntimeMeta()
  if (isHeroMatrix()) renderHeroDotField(context, heroState)
  else renderLightField(context, runtime)
}

function resizeField() {
  if (!canRenderCanvas()) {
    releaseCanvasField(hasStaticOpaqueField() ? 'static' : 'disabled')
    return
  }
  if (!canvas.value || !host) return
  const bounds = host.getBoundingClientRect()
  width = Math.max(bounds.width, 0)
  height = Math.max(bounds.height, 0)
  if (!width || !height) {
    releaseCanvasField('disabled')
    return
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  canvas.value.width = Math.round(width * dpr)
  canvas.value.height = Math.round(height * dpr)
  context = canvas.value.getContext('2d')
  if (!context) {
    releaseCanvasField('disabled')
    return
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  points = createDotFieldPoints(width, height)
  radius = resolveDotFieldRadius(width, height)
  runtime.motes = createFlowMotes(width, height, props.variant)
  runtime.trail = []
  runtime.ripples = []
  runtime.presence = 0
  if (isHeroMatrix()) {
    heroState.width = width
    heroState.height = height
    heroState.nodes = createHeroGridNodes(width, height)
    heroState.waves = []
    heroState.presence = 0
  }
  pointerInside = false
  state.value = 'idle'
  drawPoints()
}

function stopMotion() {
  stopFrame?.()
  stopFrame = undefined
}

function releaseCanvasField(nextState: Extract<DotFieldState, 'static' | 'disabled'>) {
  stopMotion()
  pointerInside = false
  sampledFrames = 0
  sampledTime = 0
  points = []
  runtime.points = []
  runtime.motes = []
  runtime.trail = []
  runtime.ripples = []
  runtime.presence = 0
  heroState.nodes = []
  heroState.waves = []
  heroState.presence = 0
  context = null
  width = 0
  height = 0
  if (canvas.value && (canvas.value.width !== 0 || canvas.value.height !== 0)) {
    canvas.value.width = 0
    canvas.value.height = 0
  }
  state.value = nextState
}

function onHostPointerDown(event: PointerEvent) {
  if (!canRenderCanvas() || !host || (event.pointerType && event.pointerType !== 'mouse')) return
  const bounds = host.getBoundingClientRect()
  const localX = event.clientX - bounds.left
  const localY = event.clientY - bounds.top
  if (localX < 0 || localX > bounds.width || localY < 0 || localY > bounds.height) return
  pointerInside = true
  pointerLocalX = localX
  pointerLocalY = localY
  syncRuntimeMeta()
  if (isHeroMatrix()) spawnHeroWave(heroState, localX, localY)
  else spawnRipplePulse(runtime, localX, localY, true)
  state.value = 'active'
  ensureFrame()
}

function startFieldRuntime() {
  if (!host) return
  if (!stopPosition) stopPosition = subscribePosition(handlePointerPosition)
  window.addEventListener('pointerdown', onHostPointerDown, { passive: true })
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(resizeField)
    resizeObserver.observe(host)
  }
  if (!intersectionObserver) {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting.value = entry?.isIntersecting ?? false
    })
    intersectionObserver.observe(host)
  }
}

function stopFieldRuntime() {
  stopPosition?.()
  stopPosition = undefined
  window.removeEventListener('pointerdown', onHostPointerDown)
  resizeObserver?.disconnect()
  resizeObserver = undefined
  intersectionObserver?.disconnect()
  intersectionObserver = undefined
}

function refreshFieldMode() {
  if (supportsCanvasMode()) {
    startFieldRuntime()
    if (canRenderCanvas()) resizeField()
    else releaseCanvasField('disabled')
    return
  }
  stopFieldRuntime()
  intersecting.value = true
  releaseCanvasField(hasStaticOpaqueField() ? 'static' : 'disabled')
}

function ensureFrame() {
  if (!mounted || stopFrame || !canRenderCanvas() || !points.length || !context) return
  stopFrame = subscribeMotionFrame((_time, deltaMs) => {
    syncRuntimeMeta()
    let allSettled = false
    if (isHeroMatrix()) {
      allSettled = stepHeroDotField(heroState, deltaMs)
      renderHeroDotField(context!, heroState)
    } else {
      const gridSettled = settleDotFieldPoints(points, deltaMs, pointerInside)
      const effectsSettled = stepLightFieldEffects(runtime, deltaMs)
      renderLightField(context!, runtime)
      allSettled = gridSettled && effectsSettled
    }

    sampledFrames += 1
    sampledTime += deltaMs
    if (sampledFrames >= 30) {
      downgradeForFps(sampledFrames / (sampledTime / 1000))
      sampledFrames = 0
      sampledTime = 0
    }

    if (allSettled) {
      stopMotion()
      state.value = pointerInside ? 'active' : 'idle'
    }
  })
}

function leaveField() {
  if (!pointerInside) return
  pointerInside = false
  resetDotFieldTargets(points)
  state.value = 'settling'
  ensureFrame()
}

let lastSweepRippleAt = 0

const handlePointerPosition: PointerPositionSubscriber = (position) => {
  if (!canRenderCanvas() || !host || !points.length) return
  const bounds = host.getBoundingClientRect()
  const localX = position.clientX - bounds.left
  const localY = position.clientY - bounds.top
  const inside = localX >= 0 && localX <= bounds.width && localY >= 0 && localY <= bounds.height
  if (!inside) {
    leaveField()
    return
  }

  const entering = !pointerInside
  pointerInside = true
  pointerLocalX = localX
  pointerLocalY = localY
  const speed = Math.hypot(position.velocityX, position.velocityY)
  if (entering) {
    runtime.smoothX = localX
    runtime.smoothY = localY
    heroState.smoothX = localX
    heroState.smoothY = localY
  }
  runtime.pointerSpeed = Math.max(runtime.pointerSpeed, speed)
  syncRuntimeMeta()
  pushTrailSample(runtime, localX, localY, speed)

  // Spawn delicate ripple when sweeping swiftly in Luo River mode
  if (runtime.preset === 'luoshui' && speed > 620) {
    const now = performance.now()
    if (now - lastSweepRippleAt > 260) {
      lastSweepRippleAt = now
      spawnRipplePulse(runtime, localX, localY, false)
    }
  }

  setDotFieldPointerTarget(points, localX, localY, speed, radius)
  state.value = 'active'
  ensureFrame()
}

function onTierChange(event: Event) {
  const nextTier = (event as CustomEvent<{ tier?: MotionTier }>).detail?.tier
  if (nextTier === 'full' || nextTier === 'restrained' || nextTier === 'static') applicationTier.value = nextTier
}

function onThemeChange(event: Event) {
  darkTheme.value = (event as CustomEvent<'light' | 'dark'>).detail === 'dark'
}

function onPresetChange(event: Event) {
  const next = (event as CustomEvent<LightPresetId>).detail
  if (next) runtime.preset = next
  if (canRenderCanvas()) {
    runtime.trail = []
    drawPoints()
    if (pointerInside) ensureFrame()
  }
}

watch([intersecting, tier, applicationTier, reducedTransparency], refreshFieldMode)
watch([darkTheme, preset], () => {
  if (canRenderCanvas()) {
    drawPoints()
    if (pointerInside) ensureFrame()
  }
})
watch(() => pointer.visible, (visible) => { if (!visible) leaveField() })

onMounted(() => {
  mounted = true
  darkTheme.value = document.documentElement.dataset.theme === 'dark'
  host = canvas.value?.parentElement ?? null
  const rootTier = document.documentElement.dataset.motionTier
  if (rootTier === 'full' || rootTier === 'restrained' || rootTier === 'static') applicationTier.value = rootTier
  document.documentElement.addEventListener(POINTER_TIER_EVENT, onTierChange)
  window.addEventListener('heluo:theme-change', onThemeChange)
  window.addEventListener(LIGHT_PRESET_EVENT, onPresetChange)
  refreshFieldMode()
})

onBeforeUnmount(() => {
  mounted = false
  stopMotion()
  stopFieldRuntime()
  document.documentElement.removeEventListener(POINTER_TIER_EVENT, onTierChange)
  window.removeEventListener('heluo:theme-change', onThemeChange)
  window.removeEventListener(LIGHT_PRESET_EVENT, onPresetChange)
  releaseCanvasField('disabled')
})
</script>

<template>
  <canvas
    ref="canvas"
    width="0"
    height="0"
    class="pointer-dot-field"
    :data-state="state"
    :data-renderer="state === 'static' ? 'css' : state === 'disabled' ? 'none' : 'canvas'"
    :data-variant="variant"
    :data-preset="preset"
    :data-palette="reducedTransparency ? 'opaque' : variant"
    :data-wave="pointerInside ? 'tracking' : 'idle'"
    data-effect="luminous-point-wave"
    data-pointer-dot-field
    aria-hidden="true"
  ></canvas>
</template>

<style scoped>
.pointer-dot-field[data-renderer="css"][data-palette="opaque"] {
  background-image:
    radial-gradient(circle, rgb(86 151 133) 0 .72px, transparent .9px),
    radial-gradient(circle, rgb(238 187 47) 0 1.18px, transparent 1.36px);
  background-position: center, calc(50% + 27px) calc(50% + 27px);
  background-size: 27px 27px, 81px 81px;
  opacity: 1;
}
</style>
