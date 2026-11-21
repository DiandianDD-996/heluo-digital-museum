import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export type GsapScope = HTMLElement | null

/**
 * Registers ScrollTrigger and returns it, for views that drive it directly
 * (`ScrollTrigger.create`, `refresh`) rather than through the helpers below.
 *
 * Registration happens lazily rather than at module load for two reasons.
 * `gsap.registerPlugin` runs the plugin's own `enable()`, which reads
 * `window.matchMedia` immediately — so a top-level call made this module
 * throw on import wherever `matchMedia` is missing, and it is now the shared
 * entry point for page motion and therefore has to survive being imported by
 * a test. Lazily also means a page that only uses plain GSAP never pulls
 * ScrollTrigger's scroll listeners in.
 */
let scrollTriggerRegistered = false
export function ensureScrollTrigger(): typeof ScrollTrigger {
  if (!scrollTriggerRegistered) {
    gsap.registerPlugin(ScrollTrigger)
    scrollTriggerRegistered = true
  }
  return ScrollTrigger
}

/** True once `matchMedia` is usable, which every scroll trigger needs. */
function canMeasureViewport(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/** Creates a scoped GSAP context so route/component teardown can revert all work. */
export function createGsapContext(root: GsapScope, setup: () => void): gsap.Context | undefined {
  if (!root) return undefined
  return gsap.context(setup, root)
}

/** Public animation tier gate shared by GSAP page effects. */
export function shouldRunGsapReveal(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  if (document.documentElement.dataset.motionTier === 'static') return false
  if (typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isConstrainedGsapReveal(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return document.documentElement.dataset.motionTier === 'restrained'
    || window.matchMedia('(max-width: 767px)').matches
    || window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches
}

/** Distance and duration figures scaled for the device tier, so a phone
 *  gets a shorter, smaller move rather than a slowed-down desktop one. */
export function revealFigures(constrained = isConstrainedGsapReveal()) {
  return constrained
    ? { offset: 14, duration: 0.34, stagger: 0.035 }
    : { offset: 26, duration: 0.62, stagger: 0.07 }
}

export interface RevealOptions {
  /** `once` leaves the element in its final state after the first pass,
   *  which is what content should do — a heading that fades back out on
   *  scroll-up makes re-reading feel unstable. */
  once?: boolean
  /** Extra delay before the batch animates, for sequencing one group
   *  after another. */
  delay?: number
  /** Elements revealed together within one batch. */
  stagger?: number
}

/**
 * Reveals every `[data-motion]` element of `selector` as it scrolls in.
 *
 * This is the shared form of what each view previously hand-rolled: a
 * `ScrollTrigger.batch` that fades and lifts a group, with `clearProps`
 * so the transform does not linger as a compositing layer on content that
 * is now static. `ScrollTrigger.batch` (rather than one trigger per
 * element) is what keeps a long listing to a single observer.
 *
 * Returns a stop function; callers hand it to `onBeforeUnmount`, or rely
 * on the surrounding `createGsapContext` revert.
 */
export function revealBatch(selector: string, options: RevealOptions = {}): () => void {
  if (!shouldRunGsapReveal() || !canMeasureViewport()) return () => {}
  ensureScrollTrigger()

  const { offset, duration, stagger } = revealFigures()
  const trigger = ScrollTrigger.batch(selector, {
    start: 'top 88%',
    once: options.once ?? true,
    onEnter: (elements) => {
      gsap.fromTo(
        elements,
        { autoAlpha: 0, y: offset },
        {
          autoAlpha: 1,
          y: 0,
          duration,
          delay: options.delay ?? 0,
          stagger: options.stagger ?? stagger,
          ease: 'power3.out',
          overwrite: 'auto',
          clearProps: 'opacity,visibility,transform',
        },
      )
    },
  })

  return () => trigger.forEach((instance) => instance.kill())
}

/**
 * Reveals a group on a timeline rather than on scroll — for a page's
 * first screen, which is already in view and would otherwise sit still
 * until the visitor scrolls.
 */
export function revealSequence(
  selector: string,
  options: RevealOptions & { start?: number } = {},
): gsap.core.Timeline | undefined {
  if (!shouldRunGsapReveal()) return undefined

  const { offset, duration, stagger } = revealFigures()
  const targets = gsap.utils.toArray<HTMLElement>(selector)
  if (targets.length === 0) return undefined

  return gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from(targets, {
      autoAlpha: 0,
      y: offset,
      duration,
      stagger: options.stagger ?? stagger,
      delay: options.delay ?? 0,
      clearProps: 'transform',
    }, options.start ?? 0)
}
