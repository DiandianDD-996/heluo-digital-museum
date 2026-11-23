<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  buildLogBandTable,
  createRulerBars,
  drawAcousticRuler,
  isRulerSettled,
  normalizeChamberSpectrum,
  sampleBandEnergies,
  stepRulerBars,
  triggerRulerRipple,
  type AcousticRulerPaletteKey,
  type LogBand,
  type RulerBar,
  type RulerRipple,
} from '../lib/acousticRulerEngine'
import type { MusicTrack } from '../lib/audioScenes'
import { audioSystem } from '../lib/audioSystem'
import { trackTitle } from '../lib/musicCatalog'
import { useAudio } from '../stores/audio'
import { useLocale } from '../stores/locale'
import { useTheme } from '../stores/theme'

const props = withDefaults(defineProps<{
  variant?: 'hero' | 'darkroom'
  visualMode?: 'solid' | 'points'
  showPlacard?: boolean
  defaultTrack?: MusicTrack
}>(), {
  variant: 'hero',
  visualMode: 'solid',
  showPlacard: true,
  defaultTrack: 'home',
})

const audio = useAudio()
const { locale, t } = useLocale()
const { isDark } = useTheme()

const rootEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const inViewport = ref(true)
const pageVisible = ref(typeof document === 'undefined' ? true : document.visibilityState !== 'hidden')
const reducedMotion = ref(false)
const hoverRatio = ref<number | null>(null)
const rulerState = ref<'idle' | 'active' | 'settling' | 'reduced'>('idle')
const rafActive = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let analyser: AnalyserNode | null = null
let analyserAcquired = false
let spectrumData: Uint8Array<ArrayBuffer> | null = null
let bands: LogBand[] = []
let energyBuffer: Float32Array | undefined
let normBuffer: Float32Array | undefined
let bars: RulerBar[] = createRulerBars(48)
const ripples: RulerRipple[] = []
let rollingPeak = 0.18
let rafId = 0
let lastTime = 0
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let motionQuery: MediaQueryList | undefined

const palette = computed<AcousticRulerPaletteKey>(() => {
  if (props.variant === 'darkroom') {
    return props.visualMode === 'points' ? 'darkroom-pointcloud' : 'darkroom-bronze'
  }
  return isDark.value ? 'hero-dark' : 'hero-light'
})

const isInteractive = computed(() => props.variant === 'hero' && props.showPlacard)

const placardText = computed(() => {
  const copy = t.value.audio
  const defaultName = trackTitle(props.defaultTrack, locale.value)
  const wrappedDefault = locale.value === 'en-US' ? defaultName : `《${defaultName}》`
  if (!audio.enabled.value) return `${copy.rulerEnable} · ${wrappedDefault}`
  if (audio.isPaused.value) return copy.rulerResume
  if (audio.isMusicAudible.value) {
    const id = audio.currentTrack.value ?? props.defaultTrack
    const title = trackTitle(id, locale.value)
    const wrapped = locale.value === 'en-US' ? title : `《${title}》`
    return `${copy.rulerListen} · ${wrapped}`
  }
  return `${copy.rulerEnable} · ${wrappedDefault}`
})

const compactPlacardText = computed(() => {
  if (!audio.enabled.value) return locale.value === 'en-US' ? 'Soundscape' : '开启声景'
  if (audio.isPaused.value) return locale.value === 'en-US' ? 'Resume' : '恢复声景'
  if (audio.isMusicAudible.value) return locale.value === 'en-US' ? 'Listening' : '正在聆听'
  return locale.value === 'en-US' ? 'Soundscape' : '开启声景'
})

const buttonAriaLabel = computed(() => {
  const copy = t.value.audio
  const action = !audio.enabled.value
    ? copy.rulerEnable
    : audio.isPaused.value
      ? copy.rulerResume
      : audio.isMusicAudible.value
        ? `${copy.rulerPause} · ${placardText.value}`
        : copy.rulerEnable
  return `${copy.rulerAria}: ${action}`
})

function toggleAudioFromRuler() {
  if (!audio.enabled.value) {
    audio.enable()
    return
  }
  if (audio.isPaused.value) {
    audio.resumePlayback()
    return
  }
  if (!audio.isMusicOn.value) {
    audio.setMusicEnabled(true)
    return
  }
  if (audio.volumeTier.value === 'silent') {
    audio.setVolumeTier('normal')
    return
  }
  audio.setMusicEnabled(false)
}

function releaseAnalyser() {
  if (analyserAcquired) {
    audioSystem.releaseMusicAnalyser()
    analyserAcquired = false
  }
  analyser = null
}

function ensureAnalyser(): AnalyserNode | null {
  if (analyser) return analyser
  const node = audioSystem.acquireMusicAnalyser()
  analyserAcquired = true
  if (node) {
    analyser = node
    const binCount = node.frequencyBinCount || 1024
    if (!spectrumData || spectrumData.length !== binCount) {
      spectrumData = new Uint8Array(new ArrayBuffer(binCount))
    }
    const barCount = bars.length
    const sampleRate = audioSystem.getContext()?.sampleRate ?? 44100
    bands = buildLogBandTable({ sampleRate, fftSize: node.fftSize || 2048, barCount })
  }
  return analyser
}

function drawStaticFrame() {
  if (!ctx || width <= 0 || height <= 0) return
  drawAcousticRuler(ctx, {
    width,
    height,
    palette: palette.value,
    active: false,
    bars,
    hoverRatio: hoverRatio.value,
  })
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  rafActive.value = false
  lastTime = 0
}

function shouldRunLoop(): boolean {
  if (reducedMotion.value || !inViewport.value || !pageVisible.value) return false
  if (width <= 0 || height <= 0) return false
  return audio.isMusicAudible.value || !isRulerSettled(bars, ripples)
}

function scheduleFrame() {
  if (rafId || !shouldRunLoop()) return
  lastTime = 0
  rafActive.value = true
  rafId = requestAnimationFrame(tick)
}

function tick(now: number) {
  rafId = 0
  if (!shouldRunLoop() || !ctx) {
    rafActive.value = false
    rulerState.value = reducedMotion.value ? 'reduced' : 'idle'
    drawStaticFrame()
    return
  }

  const dtMs = lastTime > 0 ? Math.min(48, Math.max(1, now - lastTime)) : 16.67
  lastTime = now

  let targets: Float32Array | null = null
  if (audio.isMusicAudible.value) {
    const node = ensureAnalyser()
    if (node && spectrumData && typeof node.getByteFrequencyData === 'function') {
      node.getByteFrequencyData(spectrumData)
      energyBuffer = sampleBandEnergies(spectrumData, bands, energyBuffer)
      const norm = normalizeChamberSpectrum(energyBuffer, rollingPeak, dtMs * 0.001, bands, normBuffer)
      normBuffer = norm.values
      rollingPeak = norm.rollingPeak
      targets = norm.values
    }
    rulerState.value = 'active'
  } else {
    rulerState.value = 'settling'
  }

  stepRulerBars(bars, targets, ripples, dtMs)
  drawAcousticRuler(ctx, {
    width,
    height,
    palette: palette.value,
    active: audio.isMusicAudible.value || ripples.length > 0,
    bars,
    hoverRatio: hoverRatio.value,
  })

  if (shouldRunLoop()) {
    rafActive.value = true
    rafId = requestAnimationFrame(tick)
  } else {
    rafActive.value = false
    rulerState.value = reducedMotion.value ? 'reduced' : 'idle'
  }
}

function resizeCanvas() {
  if (!rootEl.value || !canvasEl.value) return
  const rect = canvasEl.value.getBoundingClientRect()
  const nextWidth = Math.round(rect.width)
  const nextHeight = Math.round(rect.height)
  if (nextWidth <= 0 || nextHeight <= 0) return

  width = nextWidth
  height = nextHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvasEl.value.width = Math.round(width * dpr)
  canvasEl.value.height = Math.round(height * dpr)
  ctx = canvasEl.value.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const targetBars = width < 640 ? 36 : 60
  if (bars.length !== targetBars) {
    bars = createRulerBars(targetBars)
    energyBuffer = undefined
    normBuffer = undefined
    const sampleRate = audioSystem.getContext()?.sampleRate ?? 44100
    bands = buildLogBandTable({ sampleRate, fftSize: analyser?.fftSize ?? 2048, barCount: targetBars })
  } else if (bands.length === 0) {
    bands = buildLogBandTable({ barCount: targetBars })
  }

  drawStaticFrame()
  scheduleFrame()
}

function triggerRipple(centerRatio = 0.5, strength = 0.85) {
  if (reducedMotion.value) return
  triggerRulerRipple(ripples, centerRatio, strength)
  scheduleFrame()
}

function onPointerMove(event: PointerEvent) {
  if (props.variant !== 'hero' || event.pointerType === 'touch' || !canvasEl.value) return
  const rect = canvasEl.value.getBoundingClientRect()
  if (rect.width <= 0) return
  hoverRatio.value = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  if (!rafId) drawStaticFrame()
}

function onPointerLeave() {
  hoverRatio.value = null
  if (!rafId) drawStaticFrame()
}

function onVisibilityChange() {
  pageVisible.value = document.visibilityState !== 'hidden'
  if (!pageVisible.value) {
    stopLoop()
    rulerState.value = reducedMotion.value ? 'reduced' : 'idle'
  } else {
    scheduleFrame()
  }
}

function onMotionChange(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches
  if (event.matches) {
    stopLoop()
    rulerState.value = 'reduced'
    drawStaticFrame()
  } else {
    rulerState.value = 'idle'
    scheduleFrame()
  }
}

watch(
  () => audio.isMusicAudible.value,
  (audible) => {
    if (audible) {
      ensureAnalyser()
      scheduleFrame()
    } else if (!reducedMotion.value && !isRulerSettled(bars, ripples)) {
      scheduleFrame()
    }
  },
)

watch(palette, () => {
  if (!rafId) drawStaticFrame()
})

watch([inViewport, pageVisible], ([visible, fg]) => {
  if (!visible || !fg) {
    stopLoop()
    rulerState.value = reducedMotion.value ? 'reduced' : 'idle'
  } else {
    scheduleFrame()
  }
})

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.value = motionQuery.matches
    motionQuery.addEventListener?.('change', onMotionChange)
  }
  if (reducedMotion.value) rulerState.value = 'reduced'

  if (typeof ResizeObserver !== 'undefined' && canvasEl.value) {
    resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(canvasEl.value)
  }
  if (typeof IntersectionObserver !== 'undefined' && rootEl.value) {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      inViewport.value = entry?.isIntersecting ?? true
    })
    intersectionObserver.observe(rootEl.value)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  resizeCanvas()
  if (audio.isMusicAudible.value) {
    ensureAnalyser()
    scheduleFrame()
  }
})

onBeforeUnmount(() => {
  stopLoop()
  releaseAnalyser()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  motionQuery?.removeEventListener?.('change', onMotionChange)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
})

defineExpose({ triggerRipple })
</script>

<template>
  <div
    ref="rootEl"
    class="acoustic-ruler"
    :class="[`acoustic-ruler--${variant}`, { 'is-active': audio.isMusicAudible.value }]"
    :data-ruler-state="rulerState"
    :data-palette="palette"
    :data-raf-active="rafActive ? 'true' : 'false'"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <span v-if="variant === 'hero'" class="acoustic-ruler__tag font-mono" aria-hidden="true">
      {{ t.audio.rulerTag }}
    </span>

    <div class="acoustic-ruler__stage">
      <canvas
        ref="canvasEl"
        class="acoustic-ruler__canvas"
        aria-hidden="true"
      ></canvas>
    </div>

    <button
      v-if="isInteractive"
      type="button"
      class="acoustic-ruler__trigger"
      data-testid="acoustic-ruler-trigger"
      :aria-label="buttonAriaLabel"
      :aria-pressed="audio.isMusicAudible.value"
      @click="toggleAudioFromRuler"
    >
      <span class="acoustic-ruler__dot" aria-hidden="true"></span>
      <span class="acoustic-ruler__label--full">{{ placardText }}</span>
      <span class="acoustic-ruler__label--compact" aria-hidden="true">{{ compactPlacardText }}</span>
    </button>
  </div>
</template>
