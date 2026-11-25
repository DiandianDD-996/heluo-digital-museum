/// <reference types="node" />

import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = readFileSync(resolve(root, 'src/views/AppointmentView.vue'), 'utf8')
const editorialMedia = (name: string) => resolve(root, 'public/media/editorial', name)
const responsiveMedia = (name: string) => resolve(root, 'public/media/responsive', name)

describe('appointment mobile media contract', () => {
  it('serves versioned responsive candidates without promoting the below-fold image', () => {
    expect(source).toContain('login-pavilion-light-v3-640w.webp 640w')
    expect(source).toContain('login-pavilion-light-v3-960w.webp 960w')
    expect(source).toContain('login-pavilion-dark-v3-640w.webp 640w')
    expect(source).toContain('login-pavilion-dark-v3-960w.webp 960w')
    expect(source).toContain('sizes="(max-width: 760px) calc(100vw - 2rem), 360px"')
    expect(source).toContain('loading="lazy"')
    expect(source).toContain('decoding="async"')
    expect(source).toContain('fetchpriority="low"')
  })

  it('keeps every generated candidate smaller than the original asset', () => {
    for (const variant of ['light', 'dark']) {
      const originalBytes = statSync(editorialMedia(`login-pavilion-${variant}-v3.webp`)).size
      for (const width of [640, 960]) {
        const candidateBytes = statSync(responsiveMedia(`login-pavilion-${variant}-v3-${width}w.webp`)).size
        expect(candidateBytes).toBeGreaterThan(0)
        expect(candidateBytes).toBeLessThan(originalBytes)
      }
    }
  })

  it('keeps the shared pointer fallback and omits desktop-only artwork on mobile', () => {
    expect(source).toContain('<PointerDotField variant="heading" />')
    expect(source).not.toContain('booking-site-plan')
    expect(source).toContain('<form v-if="!mobileDatePicker" class="appointment-details"')
    expect(source).toContain('<BottomSheet v-if="mobileSummaryOpen"')
  })

  it('keeps below-fold appointment details concise and icon led', () => {
    expect(source).toContain('<Location aria-hidden="true" />')
    expect(source).toContain('<Timer aria-hidden="true" />')
    expect(source).toContain('<Clock aria-hidden="true" />')
    expect(source).not.toContain("address: '⌖")
    expect(source).not.toContain("duration: '◷")
    expect(source).not.toContain("arrival: '♙")
  })
})
