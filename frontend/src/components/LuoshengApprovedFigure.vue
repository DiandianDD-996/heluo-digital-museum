<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import top from '../assets/luosheng-ding-top.webp?inline'
import side from '../assets/luosheng-ding-side.webp?inline'
import back from '../assets/luosheng-ding-back.webp?inline'
import relief from '../assets/luosheng-ding-relief.webp?inline'
import type { GuidePartName } from '../lib/guideTypes'
import { useLocale } from '../stores/locale'

const props = defineProps<{ stop: GuidePartName; caption: string }>()
const alternate = defineModel<boolean>('compare', { default: false })
const { locale } = useLocale()
const failed = ref(false)

const image = computed(() =>
  props.stop === 'ear' ? top : props.stop === 'motif' ? relief : alternate.value ? back : side,
)

const viewLabel = computed(() => {
  const en = locale.value === 'en-US'
  if (props.stop === 'ear') return en ? 'Top view · Upright ears' : '俯视图 · 口沿双耳'
  if (props.stop === 'motif') return en ? 'Front close-up · Belly relief' : '正面局部 · 器腹纹样'
  if (alternate.value) return en ? 'Back view · Three tripod legs' : '背视图 · 三足全景'
  return en ? 'Side view · Two legs visible' : '侧视图 · 遮挡视角'
})

watch(image, () => {
  failed.value = false
})
</script>

<template>
  <figure class="approved-figure" :data-lookpoint="stop" :data-compare="String(alternate)">
    <img
      v-if="!failed"
      :src="image"
      :alt="viewLabel"
      decoding="async"
      loading="lazy"
      @error="failed = true"
    />
    <p v-else class="approved-figure__fallback">
      {{ locale === 'en-US' ? 'Plate image unavailable.' : '静态图版暂时无法加载。' }}
    </p>
    <figcaption data-observation-text>
      <span class="approved-figure__tag">{{ viewLabel }}</span>
      <p>{{ caption }}</p>
    </figcaption>
    <button
      v-if="stop === 'feet'"
      type="button"
      class="approved-figure__toggle"
      @click="alternate = !alternate"
    >
      {{ alternate
        ? (locale === 'en-US' ? 'Switch back to side view' : '切回侧视图对照')
        : (locale === 'en-US' ? 'Compare with back view (3 legs)' : '切换背视图对照三足') }}
    </button>
  </figure>
</template>

<style scoped>
.approved-figure {
  margin: 0;
  display: grid;
  gap: var(--space-3);
}
.approved-figure img {
  display: block;
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  border: 1px solid var(--border-hairline);
}
.approved-figure__fallback {
  padding: var(--space-6);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--ink-muted);
  font-size: var(--text-sm);
}
.approved-figure figcaption {
  display: grid;
  gap: 0.35rem;
}
.approved-figure__tag {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--accent-bronze);
}
.approved-figure figcaption p {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-secondary);
}
.approved-figure__toggle {
  justify-self: start;
  min-height: var(--control-min);
  padding: 0 1rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  color: var(--ink-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}
.approved-figure__toggle:hover {
  border-color: var(--accent-bronze);
}
</style>
