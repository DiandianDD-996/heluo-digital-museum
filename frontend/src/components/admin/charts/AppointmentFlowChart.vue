<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  buildMonotoneSplinePath,
  formatCompactNumber,
  formatShortDate,
  formatWeekdayZh,
  niceTicks,
  pickTickIndices,
  type ChartPoint,
} from './chartGeometry'

export interface AppointmentSeriesPoint {
  date: string
  bookedPeople: number
  checkedInPeople: number
  cancelledPeople: number
  bookingCount: number
}

const props = withDefaults(defineProps<{
  data: AppointmentSeriesPoint[]
  title?: string
  subtitle?: string
}>(), {
  title: '预约客流与入馆核销趋势',
  subtitle: '每日预约量、核销落差与当日履约率曲线',
})

const uid = useId()
const barGradId = `appt-bar-grad-${uid}`
const dotGridId = `appt-dot-grid-${uid}`
const rateShadowId = `appt-rate-shadow-${uid}`

const showBooked = ref(true)
const showGap = ref(true)
const showRate = ref(true)
const activeIndex = ref<number | null>(null)

const W = 720
const H = 250
const PAD = { top: 20, right: 42, bottom: 32, left: 32 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom
const baselineY = PAD.top + innerH

const yMax = computed(() => {
  let m = 0
  for (const item of props.data) {
    m = Math.max(m, item.bookedPeople, item.checkedInPeople, item.cancelledPeople)
  }
  return m
})

const ticks = computed(() => niceTicks(yMax.value * 1.08, 4))
const topTick = computed(() => Math.max(1, ticks.value[ticks.value.length - 1] ?? 40))

const slotWidth = computed(() => innerW / Math.max(1, props.data.length))
const barWidth = computed(() => Math.max(5, Math.min(18, slotWidth.value * 0.56)))

function xCenter(index: number): number {
  return PAD.left + (index + 0.5) * slotWidth.value
}

function yAt(value: number): number {
  const ratio = Math.max(0, Math.min(1, value / topTick.value))
  return baselineY - ratio * innerH
}

function yAtRate(ratePct: number): number {
  const clamped = Math.max(0, Math.min(100, ratePct))
  return baselineY - (clamped / 100) * innerH
}

const xTickIndices = computed(() => pickTickIndices(props.data.length, props.data.length <= 7 ? 7 : 6))

const totals = computed(() => {
  const booked = props.data.reduce((s, d) => s + d.bookedPeople, 0)
  const checked = props.data.reduce((s, d) => s + d.checkedInPeople, 0)
  const rate = booked > 0 ? Math.round((checked / booked) * 1000) / 10 : 0
  return { booked, checked, rate }
})

const enrichedPoints = computed(() => {
  return props.data.map((item, idx) => {
    const ratePct = item.bookedPeople > 0 ? Math.min(100, Math.round((item.checkedInPeople / item.bookedPeople) * 1000) / 10) : null
    return {
      ...item,
      idx,
      cx: xCenter(idx),
      bookedY: yAt(item.bookedPeople),
      checkedY: yAt(item.checkedInPeople),
      ratePct,
      rateY: ratePct !== null ? yAtRate(ratePct) : null,
    }
  })
})

const rateSplinePath = computed(() => {
  const pts: ChartPoint[] = enrichedPoints.value
    .filter(p => p.rateY !== null)
    .map(p => ({ x: p.cx, y: p.rateY! }))
  return buildMonotoneSplinePath(pts)
})

const activePoint = computed(() => activeIndex.value === null ? null : (enrichedPoints.value[activeIndex.value] ?? null))

const tooltipStyle = computed(() => {
  if (activeIndex.value === null || !props.data.length) return {}
  const x = xCenter(activeIndex.value)
  const flip = activeIndex.value / Math.max(1, props.data.length - 1) > 0.64
  return {
    left: `${(x / W) * 100}%`,
    transform: flip ? 'translate(-105%, -6px)' : 'translate(12px, -6px)',
  }
})

function toggleLayer(layer: 'booked' | 'gap' | 'rate') {
  const activeCount = [showBooked.value, showGap.value, showRate.value].filter(Boolean).length
  if (layer === 'booked') {
    if (showBooked.value && activeCount <= 1) return
    showBooked.value = !showBooked.value
  } else if (layer === 'gap') {
    if (showGap.value && activeCount <= 1) return
    showGap.value = !showGap.value
  } else {
    if (showRate.value && activeCount <= 1) return
    showRate.value = !showRate.value
  }
}

function onPointerMove(event: PointerEvent) {
  const target = event.currentTarget as SVGSVGElement | null
  if (!target || !props.data.length) return
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0) return
  const svgX = ((event.clientX - rect.left) / rect.width) * W
  const clamped = Math.max(PAD.left, Math.min(PAD.left + innerW - 1, svgX))
  const index = Math.floor((clamped - PAD.left) / slotWidth.value)
  activeIndex.value = Math.max(0, Math.min(props.data.length - 1, index))
}
</script>

<template>
  <section class="admin-chart-card" :aria-label="title">
    <header class="admin-chart-card__head">
      <div class="admin-chart-card__title-group">
        <h3>{{ title }}</h3>
        <div class="chart-live-readout" aria-live="polite">
          <template v-if="activePoint">
            <span class="chart-live-readout__date">{{ activePoint.date }} {{ formatWeekdayZh(activePoint.date) }}</span>
            <strong class="chart-live-readout__val">{{ activePoint.checkedInPeople }} / {{ activePoint.bookedPeople }} <small>人</small></strong>
            <span class="chart-live-readout__sub">
              {{ activePoint.ratePct !== null ? `核销率 ${activePoint.ratePct}%` : '休馆日' }}
              · 取消 {{ activePoint.cancelledPeople }} 人
            </span>
          </template>
          <template v-else>
            <span>{{ subtitle }}</span>
            <span class="chart-live-readout__sub">· 周期综合核销率 <strong>{{ totals.rate }}%</strong></span>
          </template>
        </div>
      </div>

      <div class="admin-chart-legend" role="group" aria-label="图表图层筛选">
        <button
          type="button"
          class="admin-chart-legend__item"
          :class="{ 'is-muted': !showBooked }"
          :aria-pressed="showBooked"
          @click="toggleLayer('booked')"
        >
          <i class="swatch swatch--series-1-soft" aria-hidden="true"></i>
          <span>预约底柱</span>
        </button>
        <button
          type="button"
          class="admin-chart-legend__item"
          :class="{ 'is-muted': !showGap }"
          :aria-pressed="showGap"
          @click="toggleLayer('gap')"
        >
          <i class="swatch swatch--series-3" aria-hidden="true"></i>
          <span>核销落差</span>
        </button>
        <button
          type="button"
          class="admin-chart-legend__item"
          :class="{ 'is-muted': !showRate }"
          :aria-pressed="showRate"
          @click="toggleLayer('rate')"
        >
          <i class="swatch swatch--series-4" aria-hidden="true"></i>
          <span>核销率 %</span>
        </button>
      </div>
    </header>

    <div class="admin-chart-stage" @mouseleave="activeIndex = null">
      <svg
        class="admin-chart-svg"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="`${title}复合图`"
        @pointermove="onPointerMove"
      >
        <defs>
          <linearGradient :id="barGradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-series-1)" stop-opacity="0.34" />
            <stop offset="100%" stop-color="var(--chart-series-1)" stop-opacity="0.06" />
          </linearGradient>
          <pattern :id="dotGridId" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="9" cy="9" r="0.8" class="chart-dot-matrix" />
          </pattern>
          <filter :id="rateShadowId" x="-6%" y="-14%" width="112%" height="135%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="var(--chart-series-4)" flood-opacity="0.22" />
          </filter>
        </defs>

        <rect :x="PAD.left" :y="PAD.top" :width="innerW" :height="innerH" :fill="`url(#${dotGridId})`" aria-hidden="true" />

        <!-- Horizontal gridlines & right people axis -->
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

        <!-- Left percentage hints for rate curve -->
        <g v-if="showRate" aria-hidden="true">
          <text :x="PAD.left - 6" :y="yAtRate(100) + 3.5" text-anchor="end" class="chart-axis-text chart-axis-text--rate">100%</text>
          <text :x="PAD.left - 6" :y="yAtRate(50) + 3.5" text-anchor="end" class="chart-axis-text chart-axis-text--rate">50%</text>
        </g>

        <!-- X axis date ticks + vernier notch -->
        <g v-for="idx in xTickIndices" :key="`x-${idx}`">
          <line :x1="xCenter(idx)" :x2="xCenter(idx)" :y1="baselineY" :y2="baselineY + 4" class="chart-baseline" />
          <text
            :x="xCenter(idx)"
            :y="H - 7"
            :text-anchor="idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'"
            class="chart-axis-text"
          >
            {{ formatShortDate(data[idx]?.date ?? '') }}
          </text>
        </g>

        <!-- Hover column guide -->
        <line
          v-if="activePoint"
          :x1="activePoint.cx"
          :x2="activePoint.cx"
          :y1="PAD.top - 4"
          :y2="baselineY"
          class="chart-crosshair"
        />

        <!-- Booked gradient bars & dumbbell check-in gap -->
        <g
          v-for="pt in enrichedPoints"
          :key="pt.date"
          class="chart-bar-group"
          :class="{ 'is-dimmed': activeIndex !== null && activeIndex !== pt.idx, 'is-active': activeIndex === pt.idx }"
        >
          <template v-if="pt.bookedPeople > 0">
            <rect
              v-if="showBooked"
              :x="pt.cx - barWidth / 2"
              :y="pt.bookedY"
              :width="barWidth"
              :height="Math.max(4, baselineY - pt.bookedY)"
              rx="3"
              :fill="`url(#${barGradId})`"
              class="chart-bar-booked-grad"
            />
            <line
              v-if="showBooked"
              :x1="pt.cx - barWidth / 2 + 1"
              :x2="pt.cx + barWidth / 2 - 1"
              :y1="pt.bookedY + 0.5"
              :y2="pt.bookedY + 0.5"
              class="chart-bar-booked-cap"
            />

            <!-- Dumbbell stem showing un-checked gap between booked and checked-in -->
            <template v-if="showGap">
              <line
                v-if="pt.bookedPeople > pt.checkedInPeople"
                :x1="pt.cx"
                :x2="pt.cx"
                :y1="pt.bookedY + 2"
                :y2="pt.checkedY"
                class="chart-dumbbell-stem"
              />
              <circle
                :cx="pt.cx"
                :cy="pt.checkedY"
                :r="activeIndex === pt.idx ? 4 : 3"
                class="chart-dumbbell-dot"
              />
            </template>

            <rect
              v-if="pt.cancelledPeople > 0"
              :x="pt.cx - 3.5"
              :y="baselineY - 2.5"
              width="7"
              height="2.5"
              rx="1.25"
              class="chart-cancel-dot"
            />
          </template>
          <rect
            v-else
            :x="pt.cx - barWidth / 2"
            :y="baselineY - 2"
            :width="barWidth"
            height="2"
            rx="1"
            class="chart-bar-zero"
          />
        </g>

        <!-- Check-in rate smooth curve overlay -->
        <path
          v-if="showRate && rateSplinePath"
          :d="rateSplinePath"
          fill="none"
          class="chart-rate-line"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :filter="`url(#${rateShadowId})`"
        />

        <!-- Active rate halo point -->
        <g v-if="showRate && activePoint && activePoint.rateY !== null">
          <circle :cx="activePoint.cx" :cy="activePoint.rateY" r="6" class="chart-rate-halo" />
          <circle :cx="activePoint.cx" :cy="activePoint.rateY" r="3.2" class="chart-rate-dot" />
        </g>
      </svg>

      <div v-if="activePoint" class="admin-chart-tooltip" :style="tooltipStyle" role="status">
        <div class="admin-chart-tooltip__date">
          {{ activePoint.date }} · {{ formatWeekdayZh(activePoint.date) }}
        </div>
        <div class="admin-chart-tooltip__rows">
          <div>
            <span><i class="swatch swatch--series-1-soft"></i>预约人次</span>
            <strong>{{ activePoint.bookedPeople }} 人（{{ activePoint.bookingCount }} 单）</strong>
          </div>
          <div>
            <span><i class="swatch swatch--series-3"></i>实际核销</span>
            <strong>{{ activePoint.checkedInPeople }} 人</strong>
          </div>
          <div v-if="activePoint.ratePct !== null">
            <span><i class="swatch swatch--series-4"></i>当日核销率</span>
            <strong>{{ activePoint.ratePct }}%</strong>
          </div>
          <div>
            <span><i class="swatch swatch--danger"></i>取消人次</span>
            <strong>{{ activePoint.cancelledPeople }} 人</strong>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
