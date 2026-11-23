import type { Directive } from 'vue'
import { audioSystem } from '../lib/audioSystem'
import { MATERIAL_PARTICLE_PRESETS, type ParticleSystem } from '../lib/particleSystem'

/**
 * v-artifact-awaken
 * 器物苏醒 — artifact card hover directive
 *
 * Attach to a link/card that contains an <img>. Pass a material hint —
 * `v-artifact-awaken="{ material: 'bronze' }"` — so the glow color, the
 * particle plume, and the awakening chime all match what the object is
 * actually made of (bronze / jade / ink for everything else). On hover it:
 * - glows the media container in the material's own color (CSS)
 * - sweeps a soft specular highlight across it once, like light catching
 *   a vitrine surface (CSS, one-shot, replays on each new hover)
 * - lifts + tilts the artifact image slightly (GSAP, lazy-loaded)
 * - emits a curling plume of drifting particles (canvas, lazy-loaded)
 * - plays a material-tuned chime (Web Audio, lazy-loaded)
 *
 * Fully skipped under prefers-reduced-motion or a constrained device tier —
 * CSS alone still provides a subtle `:hover` scale as a baseline fallback.
 */

export type AwakenMaterial = 'bronze' | 'jade' | 'ink'

export interface AwakenOptions {
  material?: AwakenMaterial
}

const MATERIAL_GLOW: Record<AwakenMaterial, string> = {
  bronze: 'oklch(64% .1 73)',
  jade: 'oklch(70% .09 165)',
  ink: 'oklch(45% .05 250)',
}

const MATERIAL_SOUND: Record<AwakenMaterial, 'awaken-bronze' | 'awaken-jade' | 'awaken-ink'> = {
  bronze: 'awaken-bronze',
  jade: 'awaken-jade',
  ink: 'awaken-ink',
}

interface AwakenState {
  element: HTMLElement
  img: HTMLImageElement
  container: HTMLElement
  material: AwakenMaterial
  canvas: HTMLCanvasElement | null
  particleSystem: ParticleSystem | null
  gsapModule: typeof import('gsap') | null
  lastEmitAt: number
  onEnter: (event: PointerEvent) => void
  onMove: (event: PointerEvent) => void
  onLeave: () => void
  onSweepEnd: (event: AnimationEvent) => void
  onClick: () => void
}

const states = new WeakMap<HTMLElement, AwakenState>()

function shouldAnimate(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  return document.documentElement.dataset.motionTier === 'full'
}

function particleBudget(): number {
  const tier = document.documentElement.dataset.performanceTier
  if (tier === 'full') return 5
  if (tier === 'balanced') return 3
  return 0
}

function ensureCanvas(state: AwakenState): HTMLCanvasElement {
  if (state.canvas) return state.canvas
  const canvas = document.createElement('canvas')
  canvas.className = 'artifact-awaken-particles'
  canvas.setAttribute('aria-hidden', 'true')
  state.container.appendChild(canvas)
  state.canvas = canvas
  return canvas
}

function triggerSweep(state: AwakenState) {
  // Restart the CSS sweep animation on every hover-enter by forcing a
  // reflow between removing and re-adding the class.
  state.container.classList.remove('is-sweeping')
  void state.container.offsetWidth
  state.container.classList.add('is-sweeping')
}

function syncAwakenPointer(state: AwakenState, event: PointerEvent) {
  const rect = state.container.getBoundingClientRect()
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
  const pctX = rect.width > 0 ? (x / rect.width) * 100 : 50
  const pctY = rect.height > 0 ? (y / rect.height) * 100 : 50
  state.container.style.setProperty('--awaken-x', `${pctX.toFixed(1)}%`)
  state.container.style.setProperty('--awaken-y', `${pctY.toFixed(1)}%`)
  return { x, y }
}

async function handleEnter(state: AwakenState, event: PointerEvent) {
  if (!shouldAnimate()) return

  const { x, y } = syncAwakenPointer(state, event)
  state.container.classList.add('is-awakened')
  triggerSweep(state)
  void audioSystem.playInteraction(MATERIAL_SOUND[state.material], { volume: 0.22 })

  const gsapModule = state.gsapModule ?? await import('gsap').catch(() => null)
  state.gsapModule = gsapModule
  if (gsapModule && state.container.classList.contains('is-awakened')) {
    gsapModule.gsap.to(state.img, {
      scale: 1.03,
      rotation: -0.4,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  const budget = particleBudget()
  if (budget > 0 && state.container.classList.contains('is-awakened')) {
    const canvas = ensureCanvas(state)
    if (!state.particleSystem) {
      const { createParticleSystem } = await import('../lib/particleSystem')
      if (!state.element.isConnected || !state.container.classList.contains('is-awakened')) return
      state.particleSystem ??= createParticleSystem(canvas, MATERIAL_PARTICLE_PRESETS[state.material])
    }
    if (state.container.classList.contains('is-awakened')) {
      state.lastEmitAt = performance.now()
      state.particleSystem.emit(budget, x, y)
    }
  }
}

function handleMove(state: AwakenState, event: PointerEvent) {
  if (!shouldAnimate() || !state.container.classList.contains('is-awakened')) return
  const { x, y } = syncAwakenPointer(state, event)
  const now = performance.now()
  if (state.particleSystem && now - state.lastEmitAt > 240) {
    state.lastEmitAt = now
    state.particleSystem.emit(1, x, y)
  }
}

function handleLeave(state: AwakenState) {
  state.container.classList.remove('is-awakened')
  state.gsapModule?.gsap.to(state.img, {
    scale: 1,
    rotation: 0,
    duration: 0.4,
    ease: 'power2.out',
    overwrite: 'auto',
  })
}

export const artifactAwaken: Directive<HTMLElement, AwakenOptions | undefined> = {
  mounted(element, binding) {
    const img = element.querySelector('img')
    if (!(img instanceof HTMLImageElement)) return
    const container = img.parentElement
    if (!(container instanceof HTMLElement)) return

    const material = binding.value?.material ?? 'ink'
    container.classList.add('artifact-awaken-surface')
    container.style.setProperty('--awaken-glow', MATERIAL_GLOW[material])

    const state: AwakenState = {
      element,
      img,
      container,
      material,
      canvas: null,
      particleSystem: null,
      gsapModule: null,
      lastEmitAt: 0,
      onEnter: (event: PointerEvent) => void handleEnter(state, event),
      onMove: (event: PointerEvent) => handleMove(state, event),
      onLeave: () => handleLeave(state),
      onSweepEnd: () => state.container.classList.remove('is-sweeping'),
      onClick: () => void audioSystem.adaptivePlay('click'),
    }

    element.addEventListener('pointerenter', state.onEnter, { passive: true })
    element.addEventListener('pointermove', state.onMove, { passive: true })
    element.addEventListener('pointerleave', state.onLeave, { passive: true })
    container.addEventListener('animationend', state.onSweepEnd)
    element.addEventListener('click', state.onClick, { passive: true })

    states.set(element, state)
  },
  updated(element, binding) {
    const state = states.get(element)
    if (!state) return
    const material = binding.value?.material ?? 'ink'
    if (material === state.material) return
    state.material = material
    state.container.style.setProperty('--awaken-glow', MATERIAL_GLOW[material])
    state.particleSystem?.destroy()
    state.particleSystem = null
  },
  unmounted(element) {
    const state = states.get(element)
    if (!state) return
    element.removeEventListener('pointerenter', state.onEnter)
    element.removeEventListener('pointermove', state.onMove)
    element.removeEventListener('pointerleave', state.onLeave)
    element.removeEventListener('click', state.onClick)
    state.container.removeEventListener('animationend', state.onSweepEnd)
    state.particleSystem?.destroy()
    state.canvas?.remove()
    state.gsapModule?.gsap.killTweensOf(state.img)
    state.container.classList.remove('artifact-awaken-surface', 'is-awakened', 'is-sweeping')
    state.container.style.removeProperty('--awaken-glow')
    state.container.style.removeProperty('--awaken-x')
    state.container.style.removeProperty('--awaken-y')
    states.delete(element)
  },
}
