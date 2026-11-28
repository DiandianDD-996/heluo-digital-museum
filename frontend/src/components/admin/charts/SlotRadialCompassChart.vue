<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import { buildRosePetalPath, formatCompactNumber } from './chartGeometry'

export interface SlotDistItem {
  timeLabel: string
  visitors: number
  share: number
}

const props = withDefaults(defineProps<{
  items: SlotDistItem[]
  rangeDays?: number
  title?: string
}>(), {
  rangeDays: 30,
  title: '入馆时段人气分布',
})

const uid = useId()
const activeTime = ref<string | null>(null)

const POETIC_LABELS: Record<string, string> = {
  '09:00': '晨光首场',
  '10:30': '午间主峰',
  '13:30': '午后雅赏',
  '15:15': '暮色终场',
}

const TONE_KEYS = ['celadon', 'gilt', 'jade', 'slate'] as const

const totalVisitors = computed(() => props.items.reduce((s, d) => s + Math.max(0, d.visitors), 0))
const maxVisitors = computed(() => Math.max(1, ...props.items.map(d => d.visitors)))

const peakTimeLabel = computed(() => {
  if (!props.items.length) return ''
  let best = props.items[0]!
  for (const it of props.items) {
    if (it.visitors > best.visitors) best = it
  }
  return best.timeLabel
})

const compassTicks = computed(() => {
  return Array.from({ length: 36 }, (_, i) => {
    const deg = i * 10
    const rad = ((deg - 90) * Math.PI) / 180
    const major = i % 3 === 0
    const r1 = 102
    const r2 = major ? 110 : 106
    return {
      x1: (120 + r1 * Math.cos(rad)).toFixed(2),
      y1: (120 + r1 * Math.sin(rad)).toFixed(2),
      x2: (120 + r2 * Math.cos(rad)).toFixed(2),
      y2: (120 + r2 * Math.sin(rad)).toFixed(2),
      major,
    }
  })
})

const petals = computed(() => {
  const list = props.items
  if (!list.length) return []
  const count = list.length
  const span = 360 / count
  const gap = Math.min(10, span * 0.14)

  return list.map((item, idx) => {
    const startDeg = idx * span + gap / 2
    const endDeg = (idx + 1) * span - gap / 2
    const ratio = item.visitors / maxVisitors.value
    const outerR = item.visitors > 0 ? 52 + ratio * 46 : 44
    const activeOuterR = outerR + 4
    const isHovered = activeTime.value === item.timeLabel
    const path = buildRosePetalPath(120, 120, 38, isHovered ? activeOuterR : outerR, startDeg, endDeg)
    const pct = totalVisitors.value > 0 ? Math.round((item.visitors / totalVisitors.value) * 1000) / 10 : 0
    const midDeg = (startDeg + endDeg) / 2
    const midRad = ((midDeg - 90) * Math.PI) / 180
    const labelR = (isHovered ? activeOuterR : outerR) - 13
    return {
      ...item,
      tone: TONE_KEYS[idx % TONE_KEYS.length]!,
      gradId: `petal-grad-${uid}-${idx}`,
      poetic: POETIC_LABELS[item.timeLabel] ?? `${item.timeLabel} 场次`,
      isPeak: item.timeLabel === peakTimeLabel.value && item.visitors > 0,
      pct,
      path,
      lx: (120 + labelR * Math.cos(midRad)).toFixed(2),
      ly: (120 + labelR * Math.sin(midRad)).toFixed(2),
    }
  })
})

const activePetal = computed(() => {
  if (!activeTime.value) return null
  return petals.value.find(p => p.timeLabel === activeTime.value) ?? null
})
</script>

<template>
  <section class="admin-chart-card admin-chart-card--darkroom" :aria-label="title">
    <header class="admin-chart-card__head">
      <div class="admin-chart-card__title-group">
        <h3>{{ title }}</h3>
        <p>近 {{ rangeDays }} 天各开放场次昼时韵律</p>
      </div>
      <RouterLink to="/admin/slots" class="admin-chart-hint">调整时段容量 →</RouterLink>
    </header>

    <div class="radial-compass-layout">
      <div class="radial-compass-stage">
        <svg viewBox="0 0 240 240" class="radial-compass-svg" role="img" :aria-label="`${title}昼时极坐标花瓣罗盘`">
          <defs>
            <radialGradient id="compass-bg-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="var(--darkroom-glow)" stop-opacity="0.22" />
              <stop offset="100%" stop-color="var(--darkroom-glow)" stop-opacity="0" />
            </radialGradient>
            <radialGradient v-for="p in petals" :id="p.gradId" :key="`g-${p.timeLabel}`" cx="50%" cy="50%" r="58%">
              <stop offset="28%" :stop-color="`var(--darkroom-${p.tone}-inner)`" stop-opacity="0.72" />
              <stop offset="100%" :stop-color="`var(--darkroom-${p.tone})`" stop-opacity="0.96" />
            </radialGradient>
          </defs>

          <circle cx="120" cy="120" r="108" fill="url(#compass-bg-glow)" />

          <!-- Concentric hairline astrolabe tracks -->
          <circle cx="120" cy="120" r="46" class="compass-ring" />
          <circle cx="120" cy="120" r="72" class="compass-ring" />
          <circle cx="120" cy="120" r="98" class="compass-ring" />
          <line x1="18" y1="120" x2="222" y2="120" class="compass-axis" />
          <line x1="120" y1="18" x2="120" y2="222" class="compass-axis" />

          <!-- Outer 36 vernier ticks -->
          <line
            v-for="(t, i) in compassTicks"
            :key="`tk-${i}`"
            :x1="t.x1"
            :y1="t.y1"
            :x2="t.x2"
            :y2="t.y2"
            class="compass-tick"
            :class="{ 'is-major': t.major }"
          />

          <!-- Polar rose petals -->
          <g v-for="p in petals" :key="p.timeLabel">
            <path
              v-if="p.path"
              :d="p.path"
              :fill="`url(#${p.gradId})`"
              class="radial-compass-petal"
              :class="{
                'is-active': activeTime === p.timeLabel,
                'is-dimmed': activeTime !== null && activeTime !== p.timeLabel,
              }"
              tabindex="0"
              role="button"
              :aria-label="`${p.timeLabel} ${p.poetic} ${p.visitors} 人，占比 ${p.pct}%`"
              @mouseenter="activeTime = p.timeLabel"
              @focus="activeTime = p.timeLabel"
              @mouseleave="activeTime = null"
              @blur="activeTime = null"
            />
          </g>

          <!-- Center astrolabe dial -->
          <circle cx="120" cy="120" r="35" class="compass-center-disk" />
        </svg>

        <div class="radial-compass-center" aria-live="polite">
          <strong>{{ formatCompactNumber(activePetal ? activePetal.visitors : totalVisitors) }}</strong>
          <span>{{ activePetal ? `${activePetal.timeLabel} (${activePetal.pct}%)` : '预约人次' }}</span>
        </div>
      </div>

      <ul class="radial-compass-list">
        <li
          v-for="p in petals"
          :key="`row-${p.timeLabel}`"
          class="radial-compass-item"
          :class="{ 'is-active': activeTime === p.timeLabel, 'is-dimmed': activeTime !== null && activeTime !== p.timeLabel }"
          @mouseenter="activeTime = p.timeLabel"
          @mouseleave="activeTime = null"
        >
          <div class="radial-compass-item__top">
            <span class="radial-compass-dot" :class="`tone--${p.tone}`" aria-hidden="true"></span>
            <span class="radial-compass-time">{{ p.timeLabel }}</span>
            <span class="radial-compass-poetic">{{ p.poetic }}</span>
            <em v-if="p.isPeak" class="radial-peak-tag">主峰</em>
            <strong class="radial-compass-val">{{ formatCompactNumber(p.visitors) }} <small>({{ p.pct }}%)</small></strong>
          </div>
          <div class="radial-compass-track" aria-hidden="true">
            <i
              class="radial-compass-bar"
              :class="`tone--${p.tone}`"
              :style="{ width: `${Math.max(8, Math.round((p.visitors / maxVisitors) * 100))}%` }"
            ></i>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
