<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { formatCompactNumber } from './chartGeometry'

export interface RankedContentItem {
  routeType: string
  slug: string
  title: string
  pv: number
  uv: number
}

const props = withDefaults(defineProps<{
  items: RankedContentItem[]
  title?: string
  subtitle?: string
}>(), {
  title: '热门馆藏与 3D 展项访问榜',
  subtitle: '双层进度条对比总浏览（PV）与独立访客（UV）复访粘性',
})

const THUMB_MAP: Record<string, string> = {
  'heluo-bronze-ding-3d': '/media/responsive/heluo-bronze-ding-v5.4-cover-320w.webp',
  'heluo-bronze-ding': '/media/responsive/heluo-bronze-ding-v5.4-cover-320w.webp',
  'river-map-stone-raking': '/media/responsive/river-map-stone-cover-320w.webp',
  'river-map-pattern-stone': '/media/responsive/river-map-stone-cover-320w.webp',
  'river-map-jade-bi': '/media/responsive/jade-bi-cover-320w.webp',
  'heluo-bronze-jue': '/media/editorial/bronze-jue-home-480w-v1.webp',
  'painted-pottery-water-jar': '/media/responsive/painted-pottery-jar-cover-320w.webp',
  'water-bird-bronze': '/media/responsive/water-bird-bronze-cover-320w.webp',
}

const failedThumbs = ref<Record<string, boolean>>({})
const maxPv = computed(() => Math.max(1, ...props.items.map(i => i.pv)))

function thumbUrl(item: RankedContentItem): string | null {
  if (failedThumbs.value[item.slug]) return null
  return THUMB_MAP[item.slug] ?? null
}

function markThumbError(slug: string) {
  failedThumbs.value = { ...failedThumbs.value, [slug]: true }
}

function sealGlyph(routeType: string): string {
  if (routeType === 'EXHIBIT') return '展'
  if (routeType === 'ARTIFACT') return '器'
  if (routeType === 'ARTICLE') return '文'
  return '馆'
}

function typeLabel(routeType: string): string {
  if (routeType === 'EXHIBIT') return '3D 展项'
  if (routeType === 'ARTIFACT') return '馆藏文物'
  if (routeType === 'ARTICLE') return '文化专题'
  return '馆内页面'
}

function publicLink(item: RankedContentItem): string {
  if (item.routeType === 'EXHIBIT') return `/exhibits/${item.slug}`
  if (item.routeType === 'ARTIFACT') return `/artifacts/${item.slug}`
  if (item.routeType === 'ARTICLE') return `/articles/${item.slug}`
  return '/'
}
</script>

<template>
  <section class="admin-chart-card" :aria-label="title">
    <header class="admin-chart-card__head">
      <div class="admin-chart-card__title-group">
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <div class="admin-chart-legend" aria-hidden="true">
        <span class="admin-chart-legend__static"><i class="swatch swatch--series-1-soft"></i>浏览 PV</span>
        <span class="admin-chart-legend__static"><i class="swatch swatch--series-1"></i>访客 UV</span>
      </div>
    </header>

    <div v-if="items.length === 0" class="admin-chart-empty">
      <p>当前周期暂无单品页面访问记录，浏览前台馆藏或 3D 展厅后将自动生成热度排行。</p>
    </div>

    <ol v-else class="ranked-list">
      <li v-for="(item, idx) in items" :key="`${item.routeType}:${item.slug}`" class="ranked-row">
        <div class="ranked-row__content">
          <span
            class="ranked-row__rank"
            :class="{
              'is-rank-1': idx === 0,
              'is-rank-2': idx === 1,
              'is-rank-3': idx === 2,
            }"
          >
            {{ idx + 1 }}
          </span>

          <img
            v-if="thumbUrl(item)"
            :src="thumbUrl(item)!"
            :alt="item.title"
            class="ranked-row__thumb"
            loading="lazy"
            @error="markThumbError(item.slug)"
          />
          <span v-else class="ranked-row__seal" aria-hidden="true">{{ sealGlyph(item.routeType) }}</span>

          <div class="ranked-row__main">
            <div class="ranked-row__meta">
              <RouterLink :to="publicLink(item)" target="_blank" class="ranked-row__title">
                {{ item.title }}
              </RouterLink>
              <span class="ranked-row__type">{{ typeLabel(item.routeType) }}</span>
              <span class="ranked-row__nums">
                <b>{{ formatCompactNumber(item.pv) }}</b>
                <small>PV · {{ formatCompactNumber(item.uv) }} UV</small>
              </span>
            </div>
            <div class="ranked-row__track" aria-hidden="true">
              <i
                class="ranked-row__bar ranked-row__bar--pv"
                :style="{ width: `${Math.max(8, Math.round((item.pv / maxPv) * 100))}%` }"
              ></i>
              <i
                class="ranked-row__bar ranked-row__bar--uv"
                :style="{ width: `${Math.max(4, Math.round((Math.min(item.uv, item.pv) / maxPv) * 100))}%` }"
              ></i>
            </div>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>
