<script setup lang="ts">
import { computed, useId } from 'vue'
import { buildAreaPath, buildMonotoneSplinePath, calcDeltaPercent, type ChartPoint } from './chartGeometry'

const props = withDefaults(defineProps<{
  kicker?: string
  label: string
  value: string
  subtext: string
  currentTotal?: number
  previousTotal?: number
  series?: number[]
  tone?: 'jade' | 'bronze' | 'patina' | 'slate'
  variant?: 'line' | 'gauge' | 'bars' | 'dots'
  gaugeValue?: number
  compareLabel?: string
}>(), {
  kicker: '',
  tone: 'jade',
  variant: 'line',
  gaugeValue: 0,
  compareLabel: '较上周期',
})

const uid = useId()
const gradId = `kpi-grad-${uid}`

const delta = computed(() => {
  if (props.currentTotal === undefined || props.previousTotal === undefined) return null
  return calcDeltaPercent(props.currentTotal, props.previousTotal)
})

// 1. Variant "line": monotone spline + peak halo
const points = computed<ChartPoint[]>(() => {
  const data = (props.series ?? []).filter(v => Number.isFinite(v))
  if (data.length === 0) return [{ x: 2, y: 26 }, { x: 118, y: 26 }]
  if (data.length === 1) return [{ x: 2, y: 18 }, { x: 118, y: 18 }]
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min
  return data.map((val, idx) => {
    const x = 4 + (idx / (data.length - 1)) * 112
    const norm = span === 0 ? 0.35 : (val - min) / span
    const y = 30 - norm * 23
    return { x, y }
  })
})

const linePath = computed(() => buildMonotoneSplinePath(points.value))
const areaPath = computed(() => buildAreaPath(points.value, 35))
const lastPoint = computed(() => points.value[points.value.length - 1] ?? { x: 116, y: 22 })
const peakPoint = computed(() => {
  const data = (props.series ?? []).filter(v => Number.isFinite(v))
  if (data.length < 3) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  if (max <= min) return null
  let bestIdx = 0
  for (let i = 1; i < data.length; i++) {
    if ((data[i] ?? 0) > (data[bestIdx] ?? 0)) bestIdx = i
  }
  if (bestIdx === data.length - 1) return null
  return points.value[bestIdx] ?? null
})

// 2. Variant "gauge": 180-deg precision vernier semi-circle
const GAUGE_R = 31
const GAUGE_ARC_LEN = Math.PI * GAUGE_R
const clampedGauge = computed(() => {
  const v = Number(props.gaugeValue ?? 0)
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0
})
const gaugeDashArray = computed(() => {
  const filled = (clampedGauge.value / 100) * GAUGE_ARC_LEN
  return `${filled.toFixed(2)} ${GAUGE_ARC_LEN.toFixed(2)}`
})
const gaugeTicks = computed(() => {
  return Array.from({ length: 9 }, (_, i) => {
    const deg = -180 + (i / 8) * 180
    const rad = (deg * Math.PI) / 180
    return {
      x1: (44 + 23 * Math.cos(rad)).toFixed(2),
      y1: (40 + 23 * Math.sin(rad)).toFixed(2),
      x2: (44 + 26.5 * Math.cos(rad)).toFixed(2),
      y2: (40 + 26.5 * Math.sin(rad)).toFixed(2),
    }
  })
})

// 3. Variant "bars": trailing 10-bar capsule strip
const miniBars = computed(() => {
  const slice = (props.series ?? []).filter(v => Number.isFinite(v)).slice(-10)
  const arr = slice.length ? slice : [0, 0, 0, 0, 0, 0, 0, 0]
  const max = Math.max(0, ...arr)
  const count = arr.length
  const step = 88 / Math.max(1, count)
  const barW = Math.min(5.6, step * 0.62)
  return arr.map((val, idx) => {
    const h = max > 0 ? Math.max(val > 0 ? 4 : 2.5, (val / max) * 28) : 2.5
    const x = 2 + idx * step + (step - barW) / 2
    const y = 34 - h
    return {
      x: x.toFixed(2),
      y: y.toFixed(2),
      w: barW.toFixed(2),
      h: h.toFixed(2),
      r: (barW / 2).toFixed(2),
      isPeak: max > 0 && val === max,
      isZero: val <= 0,
    }
  })
})

// 4. Variant "dots": 3x7 micro matrix showing momentum density
const matrixDots = computed(() => {
  const raw = (props.series ?? []).filter(v => Number.isFinite(v))
  const total = 21
  let ratio = 0.68
  if (raw.length > 0) {
    const max = Math.max(...raw)
    const avg = raw.reduce((s, n) => s + n, 0) / raw.length
    ratio = max > 0 ? Math.max(0.28, Math.min(0.95, avg / max)) : 0.24
  }
  const lit = Math.round(ratio * total)
  return Array.from({ length: total }, (_, idx) => {
    const col = Math.floor(idx / 3)
    const row = 2 - (idx % 3)
    return {
      cx: 7 + col * 11.5,
      cy: 6 + row * 10.5,
      active: idx < lit,
      highlight: idx >= Math.max(0, lit - 3) && idx < lit,
    }
  })
})
</script>

<template>
  <article class="admin-kpi-card" :class="`admin-kpi-card--${tone}`">
    <div class="admin-kpi-card__head">
      <h2>{{ label }}</h2>
      <span
        v-if="delta"
        class="admin-kpi-delta"
        :class="`is-${delta.direction}`"
        :title="`${compareLabel} ${delta.text}`"
      >
        <svg v-if="delta.direction === 'up'" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
        <svg v-else-if="delta.direction === 'down'" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
        <span>{{ delta.text }}</span>
      </span>
    </div>

    <div class="admin-kpi-card__body">
      <div class="admin-kpi-card__metric">
        <strong>{{ value }}</strong>
        <p>{{ subtext }}</p>
      </div>

      <!-- Variant 1: Trend Spline -->
      <svg v-if="variant === 'line'" class="admin-kpi-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.18" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="areaPath" :fill="`url(#${gradId})`" />
        <path :d="linePath" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
        <circle v-if="peakPoint" :cx="peakPoint.x" :cy="peakPoint.y" r="2.2" fill="var(--surface-elevated)" stroke="currentColor" stroke-width="1.4" />
        <circle :cx="lastPoint.x" :cy="lastPoint.y" r="4.4" fill="currentColor" fill-opacity="0.16" />
        <circle :cx="lastPoint.x" :cy="lastPoint.y" r="2.2" fill="currentColor" />
      </svg>

      <!-- Variant 2: Vernier Semi-Circle Gauge -->
      <svg v-else-if="variant === 'gauge'" class="admin-kpi-gauge" viewBox="0 0 88 48" aria-hidden="true">
        <path d="M 13 40 A 31 31 0 0 1 75 40" fill="none" stroke="currentColor" stroke-opacity="0.16" stroke-width="5" stroke-linecap="round" />
        <line
          v-for="(tk, idx) in gaugeTicks"
          :key="idx"
          :x1="tk.x1"
          :y1="tk.y1"
          :x2="tk.x2"
          :y2="tk.y2"
          stroke="currentColor"
          stroke-opacity="0.34"
          stroke-width="1"
          stroke-linecap="round"
        />
        <path
          d="M 13 40 A 31 31 0 0 1 75 40"
          fill="none"
          stroke="currentColor"
          stroke-width="5"
          stroke-linecap="round"
          :stroke-dasharray="gaugeDashArray"
        />
        <text x="44" y="38" text-anchor="middle" class="admin-kpi-gauge__val">{{ Math.round(clampedGauge) }}%</text>
      </svg>

      <!-- Variant 3: Micro Vertical Bars -->
      <svg v-else-if="variant === 'bars'" class="admin-kpi-bars" viewBox="0 0 92 38" aria-hidden="true">
        <rect
          v-for="(bar, idx) in miniBars"
          :key="idx"
          :x="bar.x"
          :y="bar.y"
          :width="bar.w"
          :height="bar.h"
          :rx="bar.r"
          fill="currentColor"
          :fill-opacity="bar.isZero ? 0.14 : (bar.isPeak ? 1 : 0.42)"
        />
      </svg>

      <!-- Variant 4: Density Dot Matrix -->
      <svg v-else class="admin-kpi-dots" viewBox="0 0 84 34" aria-hidden="true">
        <circle
          v-for="(dot, idx) in matrixDots"
          :key="idx"
          :cx="dot.cx"
          :cy="dot.cy"
          :r="dot.highlight ? 2.8 : 2.35"
          fill="currentColor"
          :fill-opacity="dot.active ? (dot.highlight ? 1 : 0.62) : 0.15"
        />
      </svg>
    </div>
  </article>
</template>
