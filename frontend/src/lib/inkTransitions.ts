/**
 * Ink Wash page transitions — 水墨过渡
 *
 * Wraps route changes in the View Transitions API so the outgoing view
 * dissolves like ink spreading from the click point, and the incoming
 * view resolves from that same point. Fully skipped when the browser
 * lacks support, the user prefers reduced motion, or the device is
 * running on a constrained performance tier.
 */
import { nextTick } from 'vue'
import type { Router } from 'vue-router'
import { audioSystem } from './audioSystem'

let lastClickX = '50%'
let lastClickY = '50%'

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

  router.beforeResolve((to, from) => {
    if (to.path === from.path || !shouldTransition()) return true

    document.documentElement.style.setProperty('--ink-x', lastClickX)
    document.documentElement.style.setProperty('--ink-y', lastClickY)
    void audioSystem.playTransition('pageChange', { volume: 0.12 })

    return new Promise((resolve) => {
      const transition = document.startViewTransition!(() => {
        resolve(true)
        return new Promise<void>((r) => { finishDomUpdate = r })
      })
      transition.finished.catch(() => {})
    })
  })

  router.afterEach(() => {
    if (!finishDomUpdate) return
    const done = finishDomUpdate
    finishDomUpdate = undefined
    void nextTick(() => {
      done()
    })
  })
}
