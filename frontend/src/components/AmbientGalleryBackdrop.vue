<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const root = ref<HTMLElement | null>(null)
let rafId = 0

function isMotionSuppressed(): boolean {
  if (typeof window === 'undefined') return true
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const constrained = document.documentElement.dataset.performanceTier === 'constrained'
  return reduced || constrained
}

function scheduleParallax() {
  if (rafId || isMotionSuppressed()) return
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    const el = root.value
    if (!el) return
    const shift = Math.max(-72, Math.min(72, -window.scrollY * 0.045))
    el.style.setProperty('--backdrop-shift', `${shift.toFixed(1)}px`)
  })
}

onMounted(() => {
  if (isMotionSuppressed()) return
  scheduleParallax()
  window.addEventListener('scroll', scheduleParallax, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleParallax)
  if (rafId) {
    window.cancelAnimationFrame(rafId)
    rafId = 0
  }
})
</script>

<template>
  <div ref="root" class="ambient-backdrop" aria-hidden="true">
    <div class="ambient-backdrop__wash ambient-backdrop__wash--luo"></div>
    <div class="ambient-backdrop__wash ambient-backdrop__wash--gold"></div>
    <svg class="ambient-backdrop__armillary" viewBox="0 0 800 800" fill="none">
      <g class="ambient-backdrop__ring ambient-backdrop__ring--outer" stroke="currentColor" stroke-width="0.65">
        <circle cx="400" cy="400" r="356" stroke-dasharray="6 10" />
        <circle cx="400" cy="400" r="312" />
        <line x1="400" y1="24" x2="400" y2="62" />
        <line x1="400" y1="738" x2="400" y2="776" />
        <line x1="24" y1="400" x2="62" y2="400" />
        <line x1="738" y1="400" x2="776" y2="400" />
        <circle cx="400" cy="88" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="712" cy="400" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="400" cy="712" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="88" cy="400" r="2.2" fill="currentColor" stroke="none" />
      </g>
      <g class="ambient-backdrop__ring ambient-backdrop__ring--inner" stroke="currentColor" stroke-width="0.55">
        <circle cx="400" cy="400" r="244" stroke-dasharray="2 12" />
        <circle cx="400" cy="400" r="176" />
        <ellipse cx="400" cy="400" rx="244" ry="96" transform="rotate(-24 400 400)" />
        <ellipse cx="400" cy="400" rx="244" ry="96" transform="rotate(66 400 400)" />
      </g>
    </svg>
  </div>
</template>
