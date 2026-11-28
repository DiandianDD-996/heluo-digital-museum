<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DonutSegment } from './DonutStatusChart.vue'

const props = withDefaults(defineProps<{
  segments: DonutSegment[]
  title?: string
}>(), {
  title: '订单生命周期占比',
})

const activeKey = ref<string | null>(null)
const total = computed(() => props.segments.reduce((s, d) => s + Math.max(0, d.value), 0))

const computedSegments = computed(() => {
  const sum = total.value
  return props.segments.map(seg => {
    const safeVal = Math.max(0, seg.value)
    const pct = sum > 0 ? Math.round((safeVal / sum) * 1000) / 10 : 0
    return {
      ...seg,
      safeVal,
      pct,
    }
  })
})
</script>

<template>
  <div class="order-ratio-block" :aria-label="title">
    <div class="order-ratio-block__head">
      <span>{{ title }}</span>
      <strong>共 {{ total.toLocaleString('zh-CN') }} 笔</strong>
    </div>

    <div class="order-ratio-bar" role="img" :aria-label="`${title}分段比例条`">
      <template v-for="seg in computedSegments" :key="`bar-${seg.key}`">
        <div
          v-if="seg.safeVal > 0"
          class="order-ratio-seg"
          :class="[
            `tone--${seg.tone}`,
            { 'is-active': activeKey === seg.key, 'is-dimmed': activeKey !== null && activeKey !== seg.key },
          ]"
          :style="{ width: `${Math.max(4, seg.pct)}%` }"
          :title="`${seg.label}：${seg.safeVal} 笔 (${seg.pct}%)`"
          @mouseenter="activeKey = seg.key"
          @mouseleave="activeKey = null"
        ></div>
      </template>
      <div v-if="total === 0" class="order-ratio-empty"></div>
    </div>

    <div class="order-ratio-grid">
      <div
        v-for="seg in computedSegments"
        :key="`cell-${seg.key}`"
        class="order-ratio-cell"
        :class="{ 'is-active': activeKey === seg.key }"
        @mouseenter="activeKey = seg.key"
        @mouseleave="activeKey = null"
      >
        <div class="order-ratio-cell__label">
          <span class="admin-donut__dot" :class="`tone--${seg.tone}`" aria-hidden="true"></span>
          <span>{{ seg.label }}</span>
        </div>
        <div class="order-ratio-cell__val">
          <strong>{{ seg.safeVal.toLocaleString('zh-CN') }}</strong>
          <em>{{ seg.pct }}%</em>
        </div>
      </div>
    </div>
  </div>
</template>
