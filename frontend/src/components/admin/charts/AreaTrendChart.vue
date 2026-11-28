<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  buildAreaPath,
  buildMonotoneSplinePath,
  calcDeltaPercent,
  formatCompactNumber,
  formatShortDate,
  formatWeekdayZh,
  isWeekendDate,
  niceTicks,
  pickTickIndices,
  type ChartPoint,
} from './chartGeometry'

export interface TrafficSeriesPoint {
  date: string
  pv: number
  uv: number
}

const props = withDefaults(defineProps<{
  data: TrafficSeriesPoint[]
  title?: string
  subtitle?: string
}>(), {
  title: '网站人流变化趋势',
  subtitle: '全馆页面浏览量与独立访客',
})

const uid = useId()
const pvAreaGradId = `area-pv-fill-${uid}`
const pvStrokeGradId = `area-pv-line-${uid}`
const pvShadowId = `area-pv-shadow-${uid}`
const uvAreaGradId = `area-uv-fill-${uid}`
const crosshairGradId = `area-crosshair-${uid}`
const dotPatternId = `area-dot-matrix-${uid}`

const showPv = ref(true)
const showUv = ref(true)
const activeIndex = ref<number | null>(null)
const scrubbing = ref(false)

const W = 720
const H = 292
const PAD = { top: 28, right: 46, bottom: 34, left: 8 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom
const baselineY = PAD.top + innerH

const yMax = computed(() => {
  if (!props.data.length) return 40
  let m = 0
  for (const item of props.data) {
    if (showPv.value && item.pv > m) m = item.pv
    if (showUv.value && item.uv > m) m = item.uv
  }
  return m
})

// Add ~12% headroom so peak labels breathe without artificially compressing the curve
const ticks = computed(() => niceTicks(yMax.value > 0 ? yMax.value * 1.12 : 0, 5))
const topTick = computed(() => Math.max(1, ticks.value[ticks.value.length - 1] ?? 40))

function xAt(index: number): number {
  const len = props.data.length
  if (len <= 1) return PAD.left + innerW / 2
  return PAD.left + (index / (len - 1)) * innerW
}

function yAt(value: number): number {
  const ratio = Math.max(0, Math.min(1, value / topTick.value))
  return baselineY - ratio * innerH
}

const pvPoints = computed<ChartPoint[]>(() => props.data.map((d, i) => ({ x: xAt(i), y: yAt(d.pv) })))
const uvPoints = computed<ChartPoint[]>(() => props.data.map((d, i) => ({ x: xAt(i), y: yAt(d.uv) })))

const pvLinePath = computed(() => buildMonotoneSplinePath(pvPoints.value))
const pvAreaPath = computed(() => buildAreaPath(pvPoints.value, baselineY))
const uvLinePath = computed(() => buildMonotoneSplinePath(uvPoints.value))
const uvAreaPath = computed(() => buildAreaPath(uvPoints.value, baselineY))

const xTickIndices = computed(() => pickTickIndices(props.data.length, props.data.length <= 7 ? 7 : 6))

const totalPv = computed(() => props.data.reduce((sum, item) => sum + item.pv, 0))
const totalUv = computed(() => props.data.reduce((sum, item) => sum + item.uv, 0))
const avgPv = computed(() => props.data.length ? Math.round(totalPv.value / props.data.length) : 0)
const avgUv = computed(() => props.data.length ? Math.round(totalUv.value / props.data.length) : 0)
const avgLineY = computed(() => yAt(avgPv.value))

const avgPillLayout = computed(() => {
  const text = `日均 ${formatCompactNumber(avgPv.value)}`
  const width = Math.max(54, text.length * 7 + 16)
  const yCenter = Math.max(PAD.top + 11, Math.min(baselineY - 12, avgLineY.value))
  return {
    text,
    x: PAD.left + 6,
    y: yCenter - 9,
    width,
    textX: PAD.left + 6 + width / 2,
    textY: yCenter + 3.5,
  }
})

const peakSummary = computed(() => {
  if (!props.data.length) return null
  let bestIdx = 0
  let lowIdx = 0
  for (let i = 1; i < props.data.length; i++) {
    if ((props.data[i]?.pv ?? 0) > (props.data[bestIdx]?.pv ?? 0)) bestIdx = i
    if ((props.data[i]?.pv ?? 0) < (props.data[lowIdx]?.pv ?? 0)) lowIdx = i
  }
  const best = props.data[bestIdx]!
  const low = props.data[lowIdx]!
  const point = pvPoints.value[bestIdx] ?? { x: PAD.left, y: baselineY }
  const badgeText = `峰值 ${best.pv.toLocaleString('zh-CN')}`
  const pillW = Math.max(66, badgeText.length * 6.8 + 18)
  const pillX = Math.max(PAD.left + 2, Math.min(PAD.left + innerW - pillW - 2, point.x - pillW / 2))
  const placeBelow = point.y - 26 < PAD.top
  const pillY = placeBelow ? point.y + 10 : point.y - 25
  return {
    bestIdx,
    best,
    low,
    point,
    badgeText,
    pillW,
    pillX,
    pillY,
  }
})

const lastPvPoint = computed(() => pvPoints.value[pvPoints.value.length - 1] ?? null)

interface WeekendBand {
  x: number
  width: number
}

const weekendBands = computed<WeekendBand[]>(() => {
  const len = props.data.length
  if (len <= 1) return []
  const step = innerW / (len - 1)
  const halfStep = step * 0.48
  const bands: WeekendBand[] = []
  let start = -1

  for (let i = 0; i <= len; i++) {
    const isWknd = i < len && isWeekendDate(props.data[i]?.date ?? '')
    if (isWknd && start === -1) {
      start = i
    } else if (!isWknd && start !== -1) {
      const end = i - 1
      const x1 = Math.max(PAD.left, xAt(start) - halfStep)
      const x2 = Math.min(PAD.left + innerW, xAt(end) + halfStep)
      if (x2 > x1) {
        bands.push({ x: x1, width: x2 - x1 })
      }
      start = -1
    }
  }
  return bands
})

const activeItem = computed(() => {
  if (activeIndex.value === null) return null
  return props.data[activeIndex.value] ?? null
})

const activeVsAvg = computed(() => {
  if (!activeItem.value || avgPv.value <= 0) return null
  return calcDeltaPercent(activeItem.value.pv, avgPv.value)
})

const activeX = computed(() => activeIndex.value === null ? 0 : xAt(activeIndex.value))
const scrubDatePill = computed(() => {
  if (!activeItem.value) return null
  const label = `${formatShortDate(activeItem.value.date)} ${formatWeekdayZh(activeItem.value.date)}`
  const width = 76
  const x = Math.max(PAD.left, Math.min(PAD.left + innerW - width, activeX.value - width / 2))
  return { label, x, width }
})

const tooltipStyle = computed(() => {
  if (activeIndex.value === null || !props.data.length) return {}
  const ratio = props.data.length <= 1 ? 0.5 : activeIndex.value / (props.data.length - 1)
  const flipLeft = ratio > 0.62
  return {
    left: `${(activeX.value / W) * 100}%`,
    transform: flipLeft ? 'translate(-104%, 0)' : 'translate(14px, 0)',
  }
})

function toggleSeries(series: 'pv' | 'uv') {
  if (series === 'pv') {
    if (showPv.value && !showUv.value) return
    showPv.value = !showPv.value
  } else {
    if (showUv.value && !showPv.value) return
    showUv.value = !showUv.value
  }
}

function updatePointerIndex(clientX: number, target: SVGSVGElement | null) {
  if (!target || !props.data.length) return
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0) return
  const svgX = ((clientX - rect.left) / rect.width) * W
  const clamped = Math.max(PAD.left, Math.min(PAD.left + innerW, svgX))
  const ratio = (clamped - PAD.left) / innerW
  const index = props.data.length <= 1 ? 0 : Math.round(ratio * (props.data.length - 1))
  activeIndex.value = Math.max(0, Math.min(props.data.length - 1, index))
}

function onPointerDown(event: PointerEvent) {
  const el = event.currentTarget as SVGSVGElement | null
  scrubbing.value = true
  el?.setPointerCapture?.(event.pointerId)
  updatePointerIndex(event.clientX, el)
}

function onPointerMove(event: PointerEvent) {
  updatePointerIndex(event.clientX, event.currentTarget as SVGSVGElement)
}

function onPointerUp(event: PointerEvent) {
  const el = event.currentTarget as SVGSVGElement | null
  scrubbing.value = false
  el?.releasePointerCapture?.(event.pointerId)
}

function onStageLeave() {
  if (!scrubbing.value) activeIndex.value = null
}

function onKeydown(event: KeyboardEvent) {
  if (!props.data.length) return
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    activeIndex.value = activeIndex.value === null ? 0 : Math.min(props.data.length - 1, activeIndex.value + 1)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    activeIndex.value = activeIndex.value === null ? props.data.length - 1 : Math.max(0, activeIndex.value - 1)
  } else if (event.key === 'Escape') {
    activeIndex.value = null
  }
}
</script>

<template>
  <section class="admin-chart-card area-trend-card" :aria-label="title">
    <header class="admin-chart-card__head">
      <div class="admin-chart-card__title-group">
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>

      <div class="admin-chart-legend" role="group" aria-label="图例筛选">
        <button
          type="button"
          class="admin-chart-legend__item"
          :class="{ 'is-muted': !showPv }"
          :aria-pressed="showPv"
          @click="toggleSeries('pv')"
        >
          <i class="swatch swatch--series-1" aria-hidden="true"></i>
          <span>浏览量 PV</span>
        </button>
        <button
          type="button"
          class="admin-chart-legend__item"
          :class="{ 'is-muted': !showUv }"
          :aria-pressed="showUv"
          @click="toggleSeries('uv')"
        >
          <i class="swatch swatch--series-2" aria-hidden="true"></i>
          <span>独立访客 UV</span>
        </button>
      </div>
    </header>

    <!-- Editorial live readout hero bar -->
    <div class="area-hero-strip" aria-live="polite">
      <div class="area-hero-metric">
        <span class="area-hero-metric__label">
          {{ activeItem ? `${activeItem.date} ${formatWeekdayZh(activeItem.date)} · 浏览量 PV` : '周期累计浏览量 PV' }}
        </span>
        <div class="area-hero-metric__row">
          <strong class="area-hero-metric__value">
            {{ (activeItem ? activeItem.pv : totalPv).toLocaleString('zh-CN') }}
          </strong>
          <span
            v-if="activeItem && activeVsAvg"
            class="admin-kpi-delta"
            :class="`is-${activeVsAvg.direction}`"
          >
            较日均 {{ activeVsAvg.text }}
          </span>
          <span v-else-if="avgPv > 0" class="area-hero-metric__hint">
            日均 {{ avgPv.toLocaleString('zh-CN') }}
          </span>
        </div>
      </div>

      <div class="area-hero-divider" aria-hidden="true"></div>

      <div class="area-hero-metric area-hero-metric--secondary">
        <span class="area-hero-metric__label">
          {{ activeItem ? '当日独立访客 UV' : '周期累计独立访客 UV' }}
        </span>
        <div class="area-hero-metric__row">
          <strong class="area-hero-metric__value area-hero-metric__value--sub">
            {{ (activeItem ? activeItem.uv : totalUv).toLocaleString('zh-CN') }}
          </strong>
          <span class="area-hero-metric__hint">
            <template v-if="activeItem">
              人均 {{ activeItem.uv > 0 ? (activeItem.pv / activeItem.uv).toFixed(2) : '0.00' }} 页
            </template>
            <template v-else>
              日均 {{ avgUv.toLocaleString('zh-CN') }} · 人均 {{ totalUv > 0 ? (totalPv / totalUv).toFixed(2) : '0.00' }} 页
            </template>
          </span>
        </div>
      </div>
    </div>

    <div class="admin-chart-stage" @mouseleave="onStageLeave">
      <svg
        class="admin-chart-svg"
        :class="{ 'is-scrubbing': scrubbing }"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="`${title}折线面积图`"
        tabindex="0"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeydown"
      >
        <defs>
          <linearGradient :id="pvStrokeGradId" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="var(--chart-series-1-start)" />
            <stop offset="100%" stop-color="var(--chart-series-1-end)" />
          </linearGradient>
          <linearGradient :id="pvAreaGradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-series-1)" stop-opacity="0.20" />
            <stop offset="45%" stop-color="var(--chart-series-1)" stop-opacity="0.09" />
            <stop offset="80%" stop-color="var(--chart-series-1)" stop-opacity="0.025" />
            <stop offset="100%" stop-color="var(--chart-series-1)" stop-opacity="0" />
          </linearGradient>
          <linearGradient :id="uvAreaGradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-series-2)" stop-opacity="0.06" />
            <stop offset="100%" stop-color="var(--chart-series-2)" stop-opacity="0" />
          </linearGradient>
          <linearGradient :id="crosshairGradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--border-strong)" stop-opacity="0" />
            <stop offset="16%" stop-color="var(--border-strong)" stop-opacity="0.95" />
            <stop offset="85%" stop-color="var(--border-strong)" stop-opacity="0.95" />
            <stop offset="100%" stop-color="var(--border-strong)" stop-opacity="0" />
          </linearGradient>
          <filter :id="pvShadowId" x="-4%" y="-10%" width="108%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="var(--chart-series-1)" flood-opacity="0.16" />
          </filter>
          <pattern :id="dotPatternId" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="9" cy="9" r="0.85" class="chart-dot-matrix" />
          </pattern>
        </defs>

        <!-- Layer 0: Precision dot-matrix paper grid -->
        <rect :x="PAD.left" :y="PAD.top" :width="innerW" :height="innerH" :fill="`url(#${dotPatternId})`" aria-hidden="true" />

        <!-- Layer 1: Weekend rhythm ambient bands -->
        <g aria-hidden="true">
          <rect
            v-for="(band, idx) in weekendBands"
            :key="`wknd-${idx}`"
            :x="band.x"
            :y="PAD.top"
            :width="band.width"
            :height="innerH"
            rx="4"
            class="chart-weekend-band"
          />
        </g>

        <!-- Layer 2: Hairline grid + solid baseline + right Y ticks -->
        <g v-for="(tick, tIdx) in ticks" :key="tick">
          <line
            :x1="PAD.left"
            :x2="PAD.left + innerW"
            :y1="yAt(tick)"
            :y2="yAt(tick)"
            :class="tIdx === 0 ? 'chart-baseline' : 'chart-grid-line'"
          />
          <text :x="PAD.left + innerW + 8" :y="yAt(tick) + 3.5" text-anchor="start" class="chart-axis-text">
            {{ formatCompactNumber(tick) }}
          </text>
        </g>

        <!-- Layer 3: Average reference line & inline pill -->
        <g v-if="showPv && avgPv > 0">
          <line
            :x1="PAD.left"
            :x2="PAD.left + innerW"
            :y1="avgLineY"
            :y2="avgLineY"
            class="chart-avg-line"
          />
          <rect
            :x="avgPillLayout.x"
            :y="avgPillLayout.y"
            :width="avgPillLayout.width"
            height="18"
            rx="9"
            class="chart-avg-pill-bg"
          />
          <text :x="avgPillLayout.textX" :y="avgPillLayout.textY" text-anchor="middle" class="chart-avg-pill-text">
            {{ avgPillLayout.text }}
          </text>
        </g>

        <!-- X axis date ticks + vernier notch -->
        <g v-for="idx in xTickIndices" :key="`x-${idx}`">
          <line :x1="xAt(idx)" :x2="xAt(idx)" :y1="baselineY" :y2="baselineY + 4" class="chart-baseline" />
          <text
            :x="xAt(idx)"
            :y="H - 9"
            :text-anchor="idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'"
            class="chart-axis-text"
          >
            {{ formatShortDate(data[idx]?.date ?? '') }}
          </text>
        </g>

        <!-- Layer 4: UV secondary curve + whisper gradient -->
        <g v-if="showUv && uvPoints.length">
          <path :d="uvAreaPath" :fill="`url(#${uvAreaGradId})`" />
          <path
            :d="uvLinePath"
            class="chart-line-uv"
            fill="none"
            stroke="var(--chart-series-2)"
            stroke-width="1.65"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>

        <!-- Layer 4: PV hero curve + silk gradient area -->
        <g v-if="showPv && pvPoints.length">
          <path :d="pvAreaPath" :fill="`url(#${pvAreaGradId})`" />
          <path
            :d="pvLinePath"
            class="chart-line-pv"
            fill="none"
            :stroke="`url(#${pvStrokeGradId})`"
            stroke-width="2.35"
            stroke-linecap="round"
            stroke-linejoin="round"
            :filter="`url(#${pvShadowId})`"
          />
        </g>

        <!-- Layer 5A: Quiet static peak callout & latest point pulse -->
        <g v-if="activeIndex === null && showPv && peakSummary && peakSummary.best.pv > 0">
          <circle
            :cx="peakSummary.point.x"
            :cy="peakSummary.point.y"
            r="5.5"
            fill="var(--chart-series-1)"
            fill-opacity="0.16"
          />
          <circle
            :cx="peakSummary.point.x"
            :cy="peakSummary.point.y"
            r="3"
            fill="var(--surface-elevated)"
            stroke="var(--chart-series-1)"
            stroke-width="1.8"
          />
          <rect
            :x="peakSummary.pillX"
            :y="peakSummary.pillY"
            :width="peakSummary.pillW"
            height="18"
            rx="9"
            class="chart-peak-pill-bg"
          />
          <text
            :x="peakSummary.pillX + peakSummary.pillW / 2"
            :y="peakSummary.pillY + 12.5"
            text-anchor="middle"
            class="chart-peak-pill-text"
          >
            {{ peakSummary.badgeText }}
          </text>

          <g v-if="lastPvPoint && peakSummary.bestIdx !== pvPoints.length - 1">
            <circle :cx="lastPvPoint.x" :cy="lastPvPoint.y" r="5" fill="var(--chart-series-1)" fill-opacity="0.18" />
            <circle :cx="lastPvPoint.x" :cy="lastPvPoint.y" r="2.6" fill="var(--chart-series-1)" />
          </g>
        </g>

        <!-- Layer 5B: Interactive faded optical crosshair, X-axis scrub pill & 3-ring targets -->
        <g v-if="activeIndex !== null && activeItem">
          <line
            :x1="activeX"
            :x2="activeX"
            :y1="PAD.top - 6"
            :y2="baselineY"
            :stroke="`url(#${crosshairGradId})`"
            stroke-width="1.2"
          />
          <g v-if="scrubDatePill">
            <rect
              :x="scrubDatePill.x"
              :y="baselineY + 6"
              :width="scrubDatePill.width"
              height="18"
              rx="9"
              class="chart-scrub-pill-bg"
            />
            <text
              :x="scrubDatePill.x + scrubDatePill.width / 2"
              :y="baselineY + 18.5"
              text-anchor="middle"
              class="chart-scrub-pill-text"
            >
              {{ scrubDatePill.label }}
            </text>
          </g>
          <circle
            v-if="showUv"
            :cx="uvPoints[activeIndex]?.x"
            :cy="uvPoints[activeIndex]?.y"
            r="3.4"
            fill="var(--surface-elevated)"
            stroke="var(--chart-series-2)"
            stroke-width="1.8"
          />
          <template v-if="showPv">
            <circle
              :cx="pvPoints[activeIndex]?.x"
              :cy="pvPoints[activeIndex]?.y"
              r="8.5"
              fill="var(--chart-series-1)"
              fill-opacity="0.14"
            />
            <circle
              :cx="pvPoints[activeIndex]?.x"
              :cy="pvPoints[activeIndex]?.y"
              r="4.2"
              fill="var(--surface-elevated)"
              stroke="var(--chart-series-1)"
              stroke-width="2.2"
            />
          </template>
        </g>
      </svg>

      <div v-if="activeItem" class="admin-chart-tooltip" :style="tooltipStyle" role="status">
        <div class="admin-chart-tooltip__date font-mono">
          {{ activeItem.date }} · {{ formatWeekdayZh(activeItem.date) }}
        </div>
        <div class="admin-chart-tooltip__rows">
          <div v-if="showPv">
            <span><i class="swatch swatch--series-1"></i>浏览量 PV</span>
            <strong>{{ activeItem.pv.toLocaleString('zh-CN') }}</strong>
          </div>
          <div v-if="showUv">
            <span><i class="swatch swatch--series-2"></i>独立访客 UV</span>
            <strong>{{ activeItem.uv.toLocaleString('zh-CN') }}</strong>
          </div>
          <div v-if="activeVsAvg" class="admin-chart-tooltip__ratio">
            <span>较日均 PV</span>
            <strong>{{ activeVsAvg.text }}</strong>
          </div>
          <div>
            <span>人均浏览页数</span>
            <strong>{{ activeItem.uv > 0 ? (activeItem.pv / activeItem.uv).toFixed(2) : '0.00' }}</strong>
          </div>
        </div>
      </div>
    </div>

    <footer class="area-chart-footer">
      <span class="area-chart-footer__legend">
        <i class="area-weekend-swatch" aria-hidden="true"></i>
        淡影带为周末开放日 · 支持左右拖拽滑扫
      </span>
      <span v-if="peakSummary && peakSummary.best.pv > 0" class="area-chart-footer__stats">
        峰值 <b>{{ formatShortDate(peakSummary.best.date) }}</b>（{{ peakSummary.best.pv.toLocaleString('zh-CN') }}）
        · 谷值 <b>{{ formatShortDate(peakSummary.low.date) }}</b>（{{ peakSummary.low.pv.toLocaleString('zh-CN') }}）
      </span>
    </footer>
  </section>
</template>
