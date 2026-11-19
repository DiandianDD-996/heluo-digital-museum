import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The delegated sound layer is invisible by design — no view imports it,
 * so nothing else in the suite would notice if it stopped working. These
 * tests hold the three behaviours that are easy to break silently: which
 * controls make a sound, that a disabled control does not, and that the
 * feedback observer fires once per status rather than once per mutation.
 */

const playInteraction = vi.fn(async (_sound: string, _options?: Record<string, unknown>) => {})
vi.mock('../lib/audioSystem', () => ({
  audioSystem: (() => {
    const system = { playInteraction: (sound: string, options?: Record<string, unknown>) => playInteraction(sound, options) }
    return system
  })(),
}))

const { installInteractionSounds, removeInteractionSounds } = await import('./interactionSound')

function pointerDown(element: Element) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
}

function pointerOver(element: Element) {
  element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
}

/** MutationObserver callbacks are queued as microtasks; one tick is enough
 *  for jsdom to deliver them. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  playInteraction.mockClear()
  document.body.innerHTML = ''
  installInteractionSounds()
})

afterEach(() => {
  removeInteractionSounds()
})

describe('interaction sounds', () => {
  it('plays a click when a plain button is pressed', () => {
    const button = document.createElement('button')
    document.body.append(button)

    pointerDown(button)

    expect(playInteraction).toHaveBeenCalledWith('click', { volume: 0.28 })
  })

  it('plays the click when the press lands on the label inside the button', () => {
    // Every FluidButton wraps its text in a span, so the event target is
    // almost never the button itself.
    const button = document.createElement('button')
    const label = document.createElement('span')
    button.append(label)
    document.body.append(button)

    pointerDown(label)

    expect(playInteraction).toHaveBeenCalledTimes(1)
  })

  it('gives a destructive button its own cue', () => {
    const button = document.createElement('button')
    button.setAttribute('data-tactile-variant', 'danger')
    document.body.append(button)

    pointerDown(button)

    expect(playInteraction).toHaveBeenCalledWith('error', { volume: 0.28 })
  })

  it('stays silent for a disabled control', () => {
    // A dead button that still chimes teaches visitors the sound means
    // nothing.
    const button = document.createElement('button')
    button.disabled = true
    document.body.append(button)

    pointerDown(button)

    expect(playInteraction).not.toHaveBeenCalled()
  })

  it('coalesces a rapid double press into one sound', () => {
    const button = document.createElement('button')
    document.body.append(button)

    pointerDown(button)
    pointerDown(button)

    expect(playInteraction).toHaveBeenCalledTimes(1)
  })

  it('does not play a hover cue unless the control opted in', () => {
    // The default matters: hover sound on everything is the fastest route
    // to a visitor muting the site.
    const plain = document.createElement('button')
    const opted = document.createElement('button')
    opted.setAttribute('data-sound-hover', '')
    document.body.append(plain, opted)

    pointerOver(plain)
    expect(playInteraction).not.toHaveBeenCalled()

    pointerOver(opted)
    expect(playInteraction).toHaveBeenCalledWith('hover', { volume: 0.16 })
  })

  it('announces a success state that appears later', async () => {
    // The realistic path: a form submits, the request resolves, and the
    // button's data-state flips. Nothing calls into this module.
    const button = document.createElement('button')
    document.body.append(button)

    button.setAttribute('data-state', 'success')
    await flush()

    expect(playInteraction).toHaveBeenCalledWith('success', { volume: 0.3 })
  })

  it('announces an inline error rendered as an alert', async () => {
    const status = document.createElement('p')
    status.setAttribute('role', 'alert')
    document.body.append(status)

    await flush()

    expect(playInteraction).toHaveBeenCalledWith('error', { volume: 0.32 })
  })

  it('does not double-fire when a status node is inserted inside a wrapper', async () => {
    // Vue usually mounts a fresh subtree rather than mutating in place, so
    // the observer sees both the wrapper and the status inside it.
    const wrapper = document.createElement('div')
    const status = document.createElement('p')
    status.setAttribute('role', 'status')
    wrapper.append(status)

    document.body.append(wrapper)
    await flush()

    expect(playInteraction).toHaveBeenCalledTimes(1)
  })

  it('ignores an idle state', async () => {
    const button = document.createElement('button')
    button.setAttribute('data-state', 'idle')
    document.body.append(button)

    await flush()

    expect(playInteraction).not.toHaveBeenCalled()
  })

  it('is idempotent across repeated installs', () => {
    installInteractionSounds()
    installInteractionSounds()

    const button = document.createElement('button')
    document.body.append(button)
    pointerDown(button)

    expect(playInteraction).toHaveBeenCalledTimes(1)
  })

  it('stops listening after removal', () => {
    removeInteractionSounds()

    const button = document.createElement('button')
    document.body.append(button)
    pointerDown(button)

    expect(playInteraction).not.toHaveBeenCalled()
  })
})
