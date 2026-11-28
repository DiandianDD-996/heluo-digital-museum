<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  buildMonotoneSplinePath,
  buildMovingAverage,
  formatCurrency,
  formatShortDate,
  formatWeekdayZh,
  niceTicks,
  pickTickIndices,
  type ChartPoint,
} from './chartGeometry'

export interface SalesSeriesPoint {
  date: string
  salesAmount: string
  orderCount: number
}

const props = withDefaults(defineProps<{
  data: SalesSeriesPoint[]
  title?: string
}>(), {
  title: '每日文创营收走势',
})

const uid = useId()
const barGradId = `sales-bar-grad-${uid}`
const dotGridId = `sales-dot-grid-${uid}`
const activeIndex = ref<number | null>(null)

const W = 520
const H = 198
const PAD = { top: 22, right: 50, bottom: 26, left: 8 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom
const baselineY = PAD.top + innerH

const numericData = computed(() => props.data.map(item => ({
  ...item,
  amount: Number.parseFloat(item.salesAmount) || 0,
})))

const totals = computed(() => {
  const sum = numericData.value.reduce((s, d) => s + d.amount, 0)
  const orders = numericData.value.reduce((s, d) => s + d.orderCount, 0)
  const avgTicket = orders > 0 ? sum / orders : 0
  return { sum, orders, avgTicket }
})

const yMax = computed(() => Math.max(0, ...numericData.value.map(d => d.amount)))
const ticks = computed(() => niceTicks(yMax.value * 1.12, 4))
const topTick = computed(() => Math.max(1, ticks.value[ticks.value.length - 1] ?? 40))

const slotWidth = computed(() => innerW / Math.max(1, numericData.value.length))
const barWidth = computed(() => Math.max(3.5, Math.min(13, slotWidth.value * 0.54)))

function xCenter(index: number): number {
  return PAD.left + (index + 0.5) * slotWidth.value
}

function yAt(value: number): number {
  const ratio = Math.max(0, Math.min(1, value / topTick.value))
  return baselineY - ratio * innerH
}

const maPoints = computed<ChartPoint[]>(() => {
  const maValues = buildMovingAverage(numericData.value.map(d => d.amount), 3)
  return maValues.map((val, idx) => ({ x: xCenter(idx), y: yAt(val) }))
})
const maLinePath = computed(() => buildMonotoneSplinePath(maPoints.value))

const peakBadge = computed(() => {
  if (!numericData.value.length || yMax.value <= 0) return null
  let bestIdx = 0
  for (let i = 1; i < numericData.value.length; i++) {
    if ((numericData.value[i]?.amount ?? 0) > (numericData.value[bestIdx]?.amount ?? 0)) bestIdx = i
  }
  const best = numericData.value[bestIdx]!
  const x = xCenter(bestIdx)
  const y = yAt(best.amount)
  const text = `峰值 ¥${Math.round(best.amount).toLocaleString('zh-CN')}`
  const pillW = Math.max(66, text.length * 6.5 + 16)
  const pillX = Math.max(PAD.left, Math.min(PAD.left + innerW - pillW, x - pillW / 2))
  const pillY = Math.max(2, y - 22)
  return { x, y, text, pillW, pillX, pillY }
})

const xTickIndices = computed(() => pickTickIndices(numericData.value.length, numericData.value.length <= 7 ? 7 : 5))
const activeItem = computed(() => activeIndex.value === null ? null : (numericData.value[activeIndex.value] ?? null))

const tooltipStyle = computed(() => {
  if (activeIndex.value === null || !numericData.value.length) return {}
  const x = xCenter(activeIndex.value)
  const flip = activeIndex.value / Math.max(1, numericData.value.length - 1) > 0.62
  return {
    left: `${(x / W) * 100}%`,
    transform: flip ? 'translate(-105%, -6px)' : 'translate(12px, -6px)',
  }
})

function onPointerMove(event: PointerEvent) {
  const target = event.currentTarget as SVGSVGElement | null
  if (!target || !numericData.value.length) return
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0) return
  const svgX = ((event.clientX - rect.left) / rect.width) * W
  const clamped = Math.max(PAD.left, Math.min(PAD.left + innerW - 1, svgX))
  const idx = Math.floor((clamped - PAD.left) / slotWidth.value)
  activeIndex.value = Math.max(0, Math.min(numericData.value.length - 1, idx))
}
</script>

<template>
  <div class="admin-sales-trend" :aria-label="title">
    <div class="sales-hero-mini" aria-live="polite">
      <template v-if="activeItem">
        <span class="sales-hero-mini__date">{{ activeItem.date }} {{ formatWeekdayZh(activeItem.date) }}</span>
        <strong>{{ formatCurrency(activeItem.amount) }}</strong>
        <span class="sales-hero-mini__meta">成交 {{ activeItem.orderCount }} 笔</span>
      </template>
      <template v-else>
        <span class="sales-hero-mini__date">周期累计营收</span>
        <strong>{{ formatCurrency(totals.sum) }}</strong>
        <span class="sales-hero-mini__meta">{{ totals.orders }} 笔 · 客单 {{ formatCurrency(totals.avgTicket) }}</span>
      </template>
      <span class="sales-hero-mini__legend"><i class="swatch swatch--series-1" aria-hidden="true"></i>3 日均线</span>
    </div>

    <div class="admin-chart-stage" @mouseleave="activeIndex = null">
      <svg
        class="admin-chart-svg"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="`${title}柱线复合图`"
        @pointermove="onPointerMove"
      >
        <defs>
          <linearGradient :id="barGradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-series-4)" stop-opacity="0.96" />
            <stop offset="100%" stop-color="var(--chart-series-4)" stop-opacity="0.32" />
          </linearGradient>
          <pattern :id="dotGridId" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="9" cy="9" r="0.75" class="chart-dot-matrix" />
          </pattern>
        </defs>

        <rect :x="PAD.left" :y="PAD.top" :width="innerW" :height="innerH" :fill="`url(#${dotGridId})`" aria-hidden="true" />

        <g v-for="(tick, tIdx) in ticks" :key="tick">
          <line
            :x1="PAD.left"
            :x2="PAD.left + innerW"
            :y1="yAt(tick)"
            :y2="yAt(tick)"
            :class="tIdx === 0 ? 'chart-baseline' : 'chart-grid-line'"
          />
          <text :x="PAD.left + innerW + 8" :y="yAt(tick) + 3.5" text-anchor="start" class="chart-axis-text">
            ¥{{ tick }}
          </text>
        </g>

        <g v-for="idx in xTickIndices" :key="`sx-${idx}`">
          <line :x1="xCenter(idx)" :x2="xCenter(idx)" :y1="baselineY" :y2="baselineY + 3.5" class="chart-baseline" />
          <text
            :x="xCenter(idx)"
            :y="H - 6"
            :text-anchor="idx === 0 ? 'start' : idx === numericData.length - 1 ? 'end' : 'middle'"
            class="chart-axis-text"
          >
            {{ formatShortDate(numericData[idx]?.date ?? '') }}
          </text>
        </g>

        <line
          v-if="activeIndex !== null"
          :x1="xCenter(activeIndex)"
          :x2="xCenter(activeIndex)"
          :y1="PAD.top - 4"
          :y2="baselineY"
          class="chart-crosshair"
        />

        <g v-for="(item, idx) in numericData" :key="item.date">
          <rect
            v-if="item.amount > 0"
            :x="xCenter(idx) - barWidth / 2"
            :y="yAt(item.amount)"
            :width="barWidth"
            :height="Math.max(4, baselineY - yAt(item.amount))"
            rx="3"
            :fill="`url(#${barGradId})`"
            class="chart-bar-sales"
            :class="{ 'is-active': activeIndex === idx, 'is-dimmed': activeIndex !== null && activeIndex !== idx }"
          />
          <rect
            v-else
            :x="xCenter(idx) - barWidth / 2"
            :y="baselineY - 2"
            :width="barWidth"
            height="2"
            rx="1"
            class="chart-bar-zero"
          />
        </g>

        <!-- Moving average trend overlay -->
        <path
          v-if="maLinePath && yMax > 0"
          :d="maLinePath"
          fill="none"
          class="sales-ma-line"
          stroke-width="1.65"
          stroke-linecap="round"
        />

        <!-- Peak badge when idle -->
        <g v-if="activeIndex === null && peakBadge">
          <rect :x="peakBadge.pillX" :y="peakBadge.pillY" :width="peakBadge.pillW" height="17" rx="8.5" class="chart-peak-pill-bg chart-peak-pill-bg--gold" />
          <text :x="peakBadge.pillX + peakBadge.pillW / 2" :y="peakBadge.pillY + 11.8" text-anchor="middle" class="chart-peak-pill-text chart-peak-pill-text--gold">
            {{ peakBadge.text }}
          </text>
        </g>
      </svg>

      <div v-if="activeItem" class="admin-chart-tooltip" :style="tooltipStyle" role="status">
        <div class="admin-chart-tooltip__date">
          {{ activeItem.date }} · {{ formatWeekdayZh(activeItem.date) }}
        </div>
        <div class="admin-chart-tooltip__rows">
          <div>
            <span><i class="swatch swatch--series-4"></i>模拟销售额</span>
            <strong>{{ formatCurrency(activeItem.amount) }}</strong>
          </div>
          <div>
            <span>成交订单</span>
            <strong>{{ activeItem.orderCount }} 笔</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
