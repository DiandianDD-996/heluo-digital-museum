/**
 * 全站交互音效接线 — delegated interaction sound wiring.
 *
 * Why delegation rather than a call per control: the app has well over a
 * hundred pressable elements across a dozen views and half a dozen shared
 * components. Importing `audioSystem` into each of them would mean the
 * sound layer grows a new import site every time a button is added, and
 * the ones that get forgotten are exactly the new ones — so coverage
 * would silently decay. One capture-phase listener on `document` covers
 * markup that does not exist yet.
 *
 * Three cues live here, in the order a visitor meets them:
 *
 *   - `press`  — pointerdown on a tactile button. Fires before the
 *                control's own handler, so the click reads as cause and
 *                the sound as effect rather than the two racing.
 *   - `switch` — the control's `data-state` flipped to success/error, or
 *                an `InlineStatus` appeared. Observed rather than called:
 *                the async work behind a form is what decides the
 *                outcome, and no single call site knows when it resolves.
 *   - `hover`  — opt-in only, via `data-sound-hover`. Deliberately not
 *                the default: a room tone under every mouse movement is
 *                noise, and it is the fastest way to make a visitor turn
 *                the whole system off.
 *
 * Everything routes through `audioSystem.playInteraction`, which is
 * already a no-op when the system is disabled or the AudioContext has not
 * been unlocked by a gesture yet. This module therefore needs no enabled
 * check of its own — and must not add one, because reading the flag at
 * listen time would drop the very first press, which is the gesture that
 * unlocks audio in the first place.
 */
import { audioSystem, type InteractionSound } from './audioSystem'

/** Repeated presses on one control inside this window play once. A held
 *  button repeats `pointerdown` on some platforms, and a doubled bell is
 *  more distracting than a missing one. */
const PRESS_COOLDOWN_MS = 90

const PRESSABLE = '[data-tactile-button], [data-galaxy-button], button, [role="button"]'

const pressTimes = new WeakMap<Element, number>()
let teardown: (() => void) | undefined

function isInert(element: Element): boolean {
  if (element.matches(':disabled')) return true
  return element.getAttribute('aria-disabled') === 'true'
}

/** The variant decides the cue: a destructive action should not sound
 *  identical to a confirming one. */
function pressSoundFor(element: Element): InteractionSound {
  if (element.getAttribute('data-tactile-variant') === 'danger') return 'error'
  return 'click'
}

function handlePointerDown(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) return

  const control = target.closest(PRESSABLE)
  // `HTMLButtonElement` is not available to a non-DOM test run, so the
  // disabled check goes through the attribute rather than the property.
  if (!control || isInert(control)) return

  const now = Date.now()
  const previous = pressTimes.get(control)
  if (previous !== undefined && now - previous < PRESS_COOLDOWN_MS) return
  pressTimes.set(control, now)

  void audioSystem.playInteraction(pressSoundFor(control), { volume: 0.28 })
}

function handlePointerOver(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) return

  const control = target.closest('[data-sound-hover]')
  if (!control || isInert(control)) return

  const now = Date.now()
  const previous = pressTimes.get(control)
  if (previous !== undefined && now - previous < PRESS_COOLDOWN_MS) return
  pressTimes.set(control, now)

  void audioSystem.playInteraction('hover', { volume: 0.16 })
}

/**
 * Watches for feedback appearing anywhere in the document.
 *
 * `data-state` is the contract `FluidButton` already exposes, and
 * `InlineStatus` renders as `role="status"` / `role="alert"`. Both are
 * observed instead of called because the outcome is decided asynchronously
 * by a request, and the component that renders the outcome is usually not
 * the one that made the call.
 */
function feedbackSoundFor(node: Element): { sound: InteractionSound; volume: number } | undefined {
  const state = node.getAttribute('data-state')
  if (state === 'success') return { sound: 'success', volume: 0.3 }
  if (state === 'error') return { sound: 'error', volume: 0.34 }

  const role = node.getAttribute('role')
  if (role === 'alert') return { sound: 'error', volume: 0.32 }
  if (role === 'status') return { sound: 'success', volume: 0.26 }
  return undefined
}

function announceFeedback(node: Element): void {
  const cue = feedbackSoundFor(node)
  if (!cue) return
  void audioSystem.playInteraction(cue.sound, { volume: cue.volume })
}

function observeFeedback(): () => void {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        announceFeedback(record.target as Element)
        continue
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        announceFeedback(node)
        // An added wrapper may carry the status element inside it.
        for (const nested of node.querySelectorAll('[data-state], [role="status"], [role="alert"]')) {
          // Only the outermost match is announced, so a status nested in a
          // status does not double-fire.
          if (!node.matches('[data-state], [role="status"], [role="alert"]')) announceFeedback(nested)
        }
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-state', 'role'],
  })
  return () => observer.disconnect()
}

/**
 * Starts listening. Idempotent, so a second call from a remounted shell
 * does not double every sound.
 */
export function installInteractionSounds(): void {
  if (typeof document === 'undefined' || teardown) return

  document.addEventListener('pointerdown', handlePointerDown, { passive: true, capture: true })
  document.addEventListener('pointerover', handlePointerOver, { passive: true, capture: true })
  const stopObserving = observeFeedback()

  teardown = () => {
    document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
    document.removeEventListener('pointerover', handlePointerOver, { capture: true })
    stopObserving()
    teardown = undefined
  }
}

/** Exposed for the shell's unmount and for tests. */
export function removeInteractionSounds(): void {
  teardown?.()
}
