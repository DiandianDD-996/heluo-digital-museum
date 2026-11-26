/**
 * Curatorial View Transitions & Shared-Element Artifact Plate — 一镜到底策展过渡
 *
 * Coordinates View Transitions API route transitions with precision single-element
 * `view-transition-name: active-artifact-plate` tagging so an artifact smoothly scales
 * and flies from Explore grid -> 60% Detail stage -> 3D poster frame.
 * Automatically skipped on unsupported browsers, `prefers-reduced-motion: reduce`,
 * or constrained performance tiers.
 */
import { nextTick, ref } from 'vue'
import type { Router } from 'vue-router'
import { audioSystem } from './audioSystem'

let lastClickX = '50%'
let lastClickY = '50%'

const activeArtifactSlug = ref<string | null>(null)
let plateClearTimer: number | undefined

export function markActiveArtifactPlate(slug: string | null): void {
  activeArtifactSlug.value = slug
  if (typeof window === 'undefined') return
  if (plateClearTimer) window.clearTimeout(plateClearTimer)
  if (slug) {
    // Safety cleanup in case navigation is aborted or unsupported
    plateClearTimer = window.setTimeout(() => {
      activeArtifactSlug.value = null
      plateClearTimer = undefined
    }, 900)
  }
}

export function isActiveArtifactPlate(slug?: string | null): boolean {
  return Boolean(slug && activeArtifactSlug.value === slug)
}

export function artifactPlateTransitionStyle(slug?: string | null): Record<string, string> | undefined {
  return isActiveArtifactPlate(slug) ? { viewTransitionName: 'active-artifact-plate' } : undefined
}

function recordClickOrigin(event: MouseEvent | PointerEvent): void {
  lastClickX = `${event.clientX}px`
  lastClickY = `${event.clientY}px`
}

function shouldTransition(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  if (!document.startViewTransition) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  return document.documentElement.dataset.motionTier === 'full'
}

export function installInkTransitions(router: Router): void {
  if (typeof document === 'undefined') return

  document.addEventListener('pointerdown', recordClickOrigin, { passive: true, capture: true })

  let finishDomUpdate: (() => void) | undefined
  let domTimeout: number | undefined

  router.beforeResolve((to, from) => {
    if (to.path === from.path || !activeArtifactSlug.value || !shouldTransition()) return true

    document.documentElement.style.setProperty('--ink-x', lastClickX)
    document.documentElement.style.setProperty('--ink-y', lastClickY)
    if (audioSystem.isSfxEnabled()) {
      void audioSystem.playTransition('pageChange', { volume: 0.12 })
    }

    return new Promise((resolve) => {
      const transition = document.startViewTransition!(() => {
        resolve(true)
        return new Promise<void>((r) => {
          finishDomUpdate = r
          // 180ms safety ceiling so slow async chunks never stall the transition snapshot
          domTimeout = window.setTimeout(() => {
            if (finishDomUpdate === r) {
              finishDomUpdate = undefined
              r()
            }
          }, 180)
        })
      })
      transition.finished
        .catch(() => {})
        .finally(() => {
          activeArtifactSlug.value = null
        })
    })
  })

  router.afterEach(() => {
    if (!finishDomUpdate) return
    const done = finishDomUpdate
    finishDomUpdate = undefined
    if (domTimeout) {
      window.clearTimeout(domTimeout)
      domTimeout = undefined
    }
    void nextTick(() => {
      done()
    })
  })
}
