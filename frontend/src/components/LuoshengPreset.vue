<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '../assets/luosheng-palette.css'
import { apiGet } from '../lib/api'
import { GUIDE_EXHIBIT_SLUG, type GuidePartName } from '../lib/guideTypes'
import { useLocale } from '../stores/locale'
import { useLuoshengStore } from '../stores/luoshengStore'
import LuoshengApprovedFigure from './LuoshengApprovedFigure.vue'

interface PresetEntry {
  cardId: string
  revision: number
  text: string
  publicSource: string | null
}

const props = defineProps<{ exhibitSlug: string }>()
const route = useRoute()
const router = useRouter()
const { locale } = useLocale()
const guideStore = useLuoshengStore()

const isEnglish = computed(() => locale.value === 'en-US')
const entries = ref<PresetEntry[]>([])
const selectedStop = ref<GuidePartName>('ear')
const compareFeet = ref(false)
let controller: AbortController | undefined

const CARD_BY_STOP: Record<GuidePartName, string> = {
  ear: 'LS-DING-EARS',
  feet: 'LS-DING-FEET',
  motif: 'LS-DING-MOTIF',
}

const FALLBACK_COPY: Record<GuidePartName, { zh: string; en: string; askZh: string; askEn: string }> = {
  ear: {
    zh: '从上往下看，鼎口两边各立起一只像把手的结构，展签里称它为鼎耳。可以切到俯视图对比口沿两侧这对立耳的轮廓。',
    en: 'Viewed from above, two upright handle-like loops rise symmetrically from the rim (referred to as ding ears). Switch to the top view to compare their silhouette.',
    askZh: '顶上那对立耳能用来提吗？为什么长在口沿上？',
    askEn: 'Can those upright ears on top be used for lifting?',
  },
  feet: {
    zh: '侧面看只有两条腿，是因为第三只足正好被鼎身挡住了。换到背面，中间和两边一共三只足都能清楚看见。',
    en: 'Only two legs appear from a side angle because the third leg is occluded by the vessel body. Switch to the back view to see all three tripod legs clearly.',
    askZh: '为什么侧面看只有两条腿，背面就能看到三条？',
    askEn: 'Why are only two legs visible from the side view?',
  },
  motif: {
    zh: '看正面局部图，鼎口下方器腹一圈有凸出的宽线，可以顺着它看清向内转折的轮廓。',
    en: 'In the front close-up, a raised band of broad lines encircles the upper belly below the rim, guiding your eye along the inward curve.',
    askZh: '器腹那一圈凸起的宽线纹样应该怎么观察？',
    askEn: 'How should I inspect the raised relief band around the belly?',
  },
}

const stops = computed(() => [
  { key: 'ear' as GuidePartName, label: isEnglish.value ? 'Upright Ears' : '口沿双耳' },
  { key: 'feet' as GuidePartName, label: isEnglish.value ? 'Three Tripod Legs' : '器底三足' },
  { key: 'motif' as GuidePartName, label: isEnglish.value ? 'Belly Relief Motif' : '器腹纹样' },
])

const activeCaption = computed(() => {
  const matched = entries.value.find(item => item.cardId === CARD_BY_STOP[selectedStop.value])
  if (matched?.text) return matched.text
  return isEnglish.value ? FALLBACK_COPY[selectedStop.value].en : FALLBACK_COPY[selectedStop.value].zh
})

async function loadPresetEntries() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  entries.value = []
  const targetLocale = isEnglish.value ? 'en-US' : 'zh-CN'
  try {
    const data = await apiGet<{ available: boolean; entries: PresetEntry[] }>(
      `/guide/exhibits/${encodeURIComponent(props.exhibitSlug)}?locale=${encodeURIComponent(targetLocale)}`,
      undefined,
      { signal: request.signal, timeoutMs: 5000 },
    )
    if (controller === request && !request.signal.aborted && data.available) {
      entries.value = data.entries
    }
  } catch {
    // The current request already cleared stale captions before loading.
  } finally {
    if (controller === request) controller = undefined
  }
}

watch([locale, () => props.exhibitSlug], () => {
  void loadPresetEntries()
})

watch(
  () => guideStore.pendingPlateAction,
  (action) => {
    if (!action) return
    const consumed = guideStore.consumePlateAction()
    if (!consumed) return
    selectedStop.value = consumed.stop
    compareFeet.value = Boolean(consumed.compare)
  },
  { immediate: true },
)

function askLuoshengAboutStop(event: MouseEvent) {
  const prompt = isEnglish.value
    ? FALLBACK_COPY[selectedStop.value].askEn
    : FALLBACK_COPY[selectedStop.value].askZh
  guideStore.openGuide(event.currentTarget as HTMLElement, prompt)
}

function focusStopIn3D() {
  const viewByStop: Record<GuidePartName, 'top' | 'back' | 'front'> = {
    ear: 'top',
    feet: 'back',
    motif: 'front',
  }
  guideStore.queueViewerAction({
    exhibitSlug: GUIDE_EXHIBIT_SLUG,
    part: selectedStop.value,
    view: viewByStop[selectedStop.value],
    mode: 'solid',
    label: selectedStop.value,
  })
  if (route.path !== `/exhibits/${GUIDE_EXHIBIT_SLUG}`) {
    void router.push({ path: `/exhibits/${GUIDE_EXHIBIT_SLUG}`, query: { from: route.path } })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  void loadPresetEntries()
})

onBeforeUnmount(() => {
  controller?.abort()
})
</script>

<template>
  <section id="luosheng-static-plates" class="preset-plate-card luosheng-palette" aria-labelledby="luosheng-plates-heading">
    <header class="preset-plate-card__header">
      <div class="preset-plate-card__title">
        <span class="preset-plate-card__seal" aria-hidden="true">笙</span>
        <div>
          <h2 id="luosheng-plates-heading">{{ isEnglish ? '3 Key Lookpoints · Static Plates' : '青铜鼎 3 处看点图版' }}</h2>
          <p>{{ isEnglish ? 'Read-only static reference plates (also available without WebGL).' : '只读静态对照图版，无 WebGL 设备也可清晰观察细节。' }}</p>
        </div>
      </div>
      <div class="preset-plate-card__tabs" role="tablist" :aria-label="isEnglish ? 'Observation lookpoints' : '观察看点切换'">
        <button
          v-for="item in stops"
          :key="item.key"
          type="button"
          role="tab"
          :aria-selected="selectedStop === item.key"
          :class="{ 'is-active': selectedStop === item.key }"
          @click="selectedStop = item.key; compareFeet = false"
        >
          {{ item.label }}
        </button>
      </div>
    </header>

    <div class="preset-plate-card__body">
      <LuoshengApprovedFigure v-model:compare="compareFeet" :stop="selectedStop" :caption="activeCaption" />
    </div>

    <footer class="preset-plate-card__footer">
      <button type="button" class="preset-plate-btn preset-plate-btn--primary" @click="askLuoshengAboutStop">
        {{ isEnglish ? 'Ask Luosheng about this detail' : '向洛笙追问这处细节' }}
      </button>
      <button type="button" class="preset-plate-btn preset-plate-btn--secondary" @click="focusStopIn3D">
        {{ isEnglish ? 'Focus in 3D Showcase' : '在 3D 展柜定位查看' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.preset-plate-card {
  width: min(calc(100% - 2rem), 68rem);
  margin: var(--space-8) auto;
  padding: clamp(1.25rem, 3vw, 2rem);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--guide-paper);
  color: var(--guide-ink);
  display: grid;
  gap: var(--space-5);
}
.preset-plate-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-hairline);
}
.preset-plate-card__title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.preset-plate-card__seal {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--guide-metal);
  border-radius: var(--radius-xs);
  color: var(--guide-metal);
  font-family: var(--guide-head);
  font-weight: 600;
  flex-shrink: 0;
}
.preset-plate-card__title h2 {
  margin: 0;
  font-family: var(--guide-head);
  font-size: var(--text-lg);
  line-height: 1.3;
}
.preset-plate-card__title p {
  margin: 0.2rem 0 0;
  font-size: var(--text-xs);
  color: var(--guide-muted);
}
.preset-plate-card__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.preset-plate-card__tabs button {
  min-height: var(--control-min);
  padding: 0 0.9rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  color: var(--ink-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial), background var(--duration-fast) var(--ease-curatorial);
}
.preset-plate-card__tabs button.is-active {
  border-color: var(--guide-signal);
  background: var(--guide-signal);
  color: var(--guide-action-ink);
}
.preset-plate-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-hairline);
}
.preset-plate-btn {
  min-height: var(--control-min);
  padding: 0 1.15rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial), opacity var(--duration-fast) var(--ease-curatorial);
}
.preset-plate-btn--primary {
  border: 1px solid var(--guide-action);
  background: var(--guide-action);
  color: var(--guide-action-ink);
}
.preset-plate-btn--secondary {
  border: 1px solid var(--border-strong);
  background: var(--surface-subtle);
  color: var(--ink-primary);
}
.preset-plate-btn:hover {
  opacity: 0.92;
  border-color: var(--guide-metal);
}
</style>
