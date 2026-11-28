<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatShortDate } from './chartGeometry'

export interface UpcomingHorizonDay {
  visitDate: string
  weekdayLabel: string
  isClosedMonday: boolean
  capacity: number
  reservedPeople: number
  slotCount: number
  utilizationRate: number
}

const props = withDefaults(defineProps<{
  days: UpcomingHorizonDay[]
  title?: string
}>(), {
  title: '未来 14 天预约承载力',
})

const emit = defineEmits<{
  selectDay: [visitDate: string]
}>()

const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日']
const hoveredIndex = ref<number | null>(null)

const summaryStats = computed(() => {
  const openDays = props.days.filter(d => !d.isClosedMonday && d.capacity > 0)
  const totalCap = openDays.reduce((s, d) => s + d.capacity, 0)
  const totalRes = openDays.reduce((s, d) => s + d.reservedPeople, 0)
  const highLoadDays = openDays.filter(d => d.utilizationRate >= 80).length
  const overallRate = totalCap > 0 ? Math.round((totalRes / totalCap) * 1000) / 10 : 0
  return { totalCap, totalRes, highLoadDays, overallRate }
})

// Align first date onto true Monday-Sunday 7-column calendar grid
const leadingPadCount = computed(() => {
  const firstDate = props.days[0]?.visitDate
  if (!firstDate) return 0
  const parsed = new Date(`${firstDate}T12:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return 0
  return (parsed.getDay() + 6) % 7
})

function barStateClass(day: UpcomingHorizonDay): string {
  if (day.isClosedMonday || day.capacity === 0) return 'is-closed'
  if (day.utilizationRate >= 85) return 'is-critical'
  if (day.utilizationRate >= 65) return 'is-warm'
  if (day.utilizationRate >= 35) return 'is-normal'
  return 'is-calm'
}

const hoveredDay = computed(() => hoveredIndex.value === null ? null : (props.days[hoveredIndex.value] ?? null))
</script>

<template>
  <section class="admin-chart-card admin-chart-card--horizon" :aria-label="title">
    <header class="admin-chart-card__head">
      <div class="admin-chart-card__title-group">
        <h3>{{ title }}</h3>
        <p>
          两周满载率 <strong>{{ summaryStats.overallRate }}%</strong>
          <template v-if="summaryStats.highLoadDays > 0">
            · <em class="horizon-warn">{{ summaryStats.highLoadDays }} 天高负载（≥80%）</em>
          </template>
        </p>
      </div>
      <div class="horizon-scale-legend" aria-label="热力色阶说明">
        <span>充裕</span>
        <i class="horizon-scale-swatch is-calm" aria-hidden="true"></i>
        <i class="horizon-scale-swatch is-normal" aria-hidden="true"></i>
        <i class="horizon-scale-swatch is-warm" aria-hidden="true"></i>
        <i class="horizon-scale-swatch is-critical" aria-hidden="true"></i>
        <span>预警</span>
      </div>
    </header>

    <div class="horizon-calendar-wrap" role="region" aria-label="未来14天承载热力日历矩阵">
      <div class="horizon-weekdays" aria-hidden="true">
        <span v-for="w in WEEK_HEADERS" :key="w">周{{ w }}</span>
      </div>

      <div class="horizon-calendar-grid" role="list">
        <span
          v-for="pad in leadingPadCount"
          :key="`pad-${pad}`"
          class="horizon-cell-pad"
          aria-hidden="true"
        ></span>

        <button
          v-for="(day, index) in days"
          :key="day.visitDate"
          type="button"
          role="listitem"
          class="horizon-day"
          :class="barStateClass(day)"
          :disabled="day.isClosedMonday && day.capacity === 0"
          :aria-label="day.isClosedMonday && day.capacity === 0
            ? `${day.visitDate} ${day.weekdayLabel} 周一闭馆`
            : `${day.visitDate} ${day.weekdayLabel} 已预约 ${day.reservedPeople} / ${day.capacity} 人，点击管理时段`"
          @mouseenter="hoveredIndex = index"
          @focus="hoveredIndex = index"
          @mouseleave="hoveredIndex = null"
          @blur="hoveredIndex = null"
          @click="emit('selectDay', day.visitDate)"
        >
          <span class="horizon-day__top">
            <span class="horizon-day__date">{{ formatShortDate(day.visitDate).replace('-', '/') }}</span>
            <span v-if="index === 0" class="horizon-today-dot" title="今日" aria-hidden="true"></span>
          </span>
          <strong class="horizon-day__pct">
            {{ day.isClosedMonday && day.capacity === 0 ? '休馆' : `${Math.round(day.utilizationRate)}%` }}
          </strong>
          <span class="horizon-day__meter" aria-hidden="true">
            <i
              class="horizon-day__meter-fill"
              :style="{ width: day.capacity > 0 ? `${Math.max(8, Math.min(100, day.utilizationRate))}%` : '0%' }"
            ></i>
          </span>
        </button>
      </div>
    </div>

    <div class="horizon-inspector" aria-live="polite">
      <template v-if="hoveredDay">
        <strong>{{ hoveredDay.visitDate }}（{{ hoveredDay.weekdayLabel }}）</strong>
        <span v-if="hoveredDay.isClosedMonday && hoveredDay.capacity === 0">常规周一闭馆日 · 不开放公开时段</span>
        <span v-else>
          已约 <b>{{ hoveredDay.reservedPeople }}</b> / {{ hoveredDay.capacity }} 人
          · 剩余 {{ Math.max(0, hoveredDay.capacity - hoveredDay.reservedPeople) }} 名额 · 点击排班
        </span>
      </template>
      <template v-else>
        <span>开放名额 <b>{{ summaryStats.totalCap.toLocaleString('zh-CN') }}</b> 人 · 已约 <b>{{ summaryStats.totalRes.toLocaleString('zh-CN') }}</b> 人</span>
        <span class="admin-chart-hint">点击开放日直达排班</span>
      </template>
    </div>
  </section>
</template>
