<script setup lang="ts">
import { computed, ref } from 'vue'

export interface DonutSegment {
  key: string
  label: string
  value: number
  tone: 'series1' | 'series2' | 'series3' | 'series4' | 'danger' | 'muted'
}

const props = withDefaults(defineProps<{
  segments: DonutSegment[]
  centerLabel?: string
  title?: string
}>(), {
  centerLabel: '总计',
  title: '分布占比',
})

const activeKey = ref<string | null>(null)

const R = 53
const CIRCUMFERENCE = 2 * Math.PI * R

const total = computed(() => props.segments.reduce((sum, s) => sum + Math.max(0, s.value), 0))

const computedArcs = computed(() => {
  const sum = total.value
  if (sum <= 0) return []
  const positiveCount = props.segments.filter(s => s.value > 0).length
  let offset = 0
  return props.segments
    .filter(s => s.value > 0)
    .map((seg) => {
      const fraction = seg.value / sum
      const rawLength = fraction * CIRCUMFERENCE
      const gap = positiveCount > 1 ? Math.min(12, Math.max(4, rawLength * 0.2)) : 0
      const dashLength = Math.max(2, rawLength - gap)
      const dashOffset = -(offset + gap / 2)
      offset += rawLength
      return {
        ...seg,
        pct: Math.round(fraction * 1000) / 10,
        dashArray: `${dashLength.toFixed(2)} ${(CIRCUMFERENCE - dashLength).toFixed(2)}`,
        dashOffset: dashOffset.toFixed(2),
      }
    })
})

const activeSegment = computed(() => {
  if (!activeKey.value) return null
  return computedArcs.value.find(a => a.key === activeKey.value) ?? null
})
</script>

<template>
  <div class="admin-donut" :aria-label="title">
    <div class="admin-donut__ring">
      <svg viewBox="0 0 140 140" role="img" :aria-label="`${title}环形图`">
        <circle cx="70" cy="70" :r="R" fill="none" stroke="var(--border-hairline)" stroke-width="10" />
        <g transform="rotate(-90 70 70)">
          <circle
            v-for="arc in computedArcs"
            :key="arc.key"
            cx="70"
            cy="70"
            :r="R"
            fill="none"
            stroke-linecap="round"
            class="admin-donut__arc"
            :class="[
              `tone--${arc.tone}`,
              {
                'is-active': activeKey === arc.key,
                'is-dimmed': activeKey !== null && activeKey !== arc.key,
              },
            ]"
            :stroke-width="activeKey === arc.key ? 12.5 : 10"
            :stroke-dasharray="arc.dashArray"
            :stroke-dashoffset="arc.dashOffset"
            @mouseenter="activeKey = arc.key"
            @mouseleave="activeKey = null"
          />
        </g>
      </svg>
      <div class="admin-donut__center">
        <strong>{{ (activeSegment ? activeSegment.value : total).toLocaleString('zh-CN') }}</strong>
        <span>{{ activeSegment ? `${activeSegment.label} (${activeSegment.pct}%)` : centerLabel }}</span>
      </div>
    </div>

    <ul class="admin-donut__legend">
      <li
        v-for="seg in segments"
        :key="seg.key"
        :class="{ 'is-active': activeKey === seg.key }"
        @mouseenter="activeKey = seg.key"
        @mouseleave="activeKey = null"
      >
        <span class="admin-donut__dot" :class="`tone--${seg.tone}`" aria-hidden="true"></span>
        <span class="admin-donut__name">{{ seg.label }}</span>
        <strong>{{ seg.value.toLocaleString('zh-CN') }}</strong>
        <em class="font-mono">{{ total > 0 ? `${Math.round((seg.value / total) * 100)}%` : '0%' }}</em>
      </li>
    </ul>
  </div>
</template>
