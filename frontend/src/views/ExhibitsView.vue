<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { gsap } from 'gsap'
import { apiGet } from '../lib/api'
import { readPrefetchCache, writePrefetchCache } from '../lib/prefetch'
import { mediaSizes, mediaSrcset } from '../lib/responsiveMedia'
import { createGsapContext, isConstrainedGsapReveal, shouldRunGsapReveal } from '../lib/gsap'
import { audioSystem } from '../lib/audioSystem'
import InlineStatus from '../components/InlineStatus.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import PointerDotField from '../components/PointerDotField.vue'
import { useLocale } from '../stores/locale'

interface ExhibitCard {
  slug: string
  title: string
  summary: string
  coverImageUrl: string
  displayNo: string
  sourceCredit: string
  licenseLabel: string
  collectionLocation: string
  artifactSlug: string
  artifactTitle: string
  titleEn?: string | null
  summaryEn?: string | null
  descriptionEn?: string | null
}

const items = ref<ExhibitCard[]>([])
const loading = ref(true)
const error = ref('')
const root = ref<HTMLElement | null>(null)
let gsapContext: gsap.Context | undefined
let discoveryCued = false
const { locale } = useLocale()

const copy = computed(() => locale.value === 'en-US' ? {
  eyebrow: '3D & OPTICAL DIGITAL EXHIBITION',
  title: 'Bring museum craft closer.',
  intro: 'Inspect ritual bronzes in 360° darkroom light and sweep low-angle raking shadows across incised stone reliefs.',
  interaction: 'Gallery specs',
  headerSpecs: ['02 Curated Interactive Stages', '3D PBR & WebGL Raking Light', 'Transparent Provenance'],
  capabilities: ['360° Free Orbit', 'Aged-Bronze PBR', 'Point-Cloud Mode'],
  stoneCapabilities: ['360° Raking Shadow', '2.4× Brass Loupe', 'Ink-Rubbing Relief'],
  retry: 'Try again',
  loading: 'Loading digital exhibits',
  emptyTitle: 'The gallery is being prepared',
  emptyText: 'There are no published digital exhibits yet. Explore the collection stories first.',
  explore: 'Explore the collection →',
  list: 'Digital exhibit list',
  related: 'Related artifact',
  start: 'Enter 3D Vitrine',
  startStone: 'Enter Raking Light',
  attributionPrefix: 'Model attribution:',
  attributionFallback: 'Reconstructed with reference to Cleveland Museum of Art CC0 public collection (1962.281).',
} : {
  eyebrow: '数字展厅',
  title: '把一件器物，拿到眼前。',
  intro: '在暗房顶光中 360° 旋观青铜礼器与粒子点云，或牵引低掠射光源检视石刻阴线与乌金墨拓。',
  interaction: '展厅信息',
  headerSpecs: ['双展柜交互精览', '3D 点云与斜射光学', '公开馆藏与概念溯源'],
  capabilities: ['360° 自由旋转', '古铜质感细观', '点云结构透视'],
  stoneCapabilities: ['360° 斜射光影', '2.4× 光学放大镜', '乌金墨拓显影'],
  retry: '重新加载',
  loading: '正在加载数字展项',
  emptyTitle: '展厅正在布展',
  emptyText: '当前没有已发布的数字展项，请先探索馆藏故事。',
  explore: '前往馆藏索引 →',
  list: '数字展项列表',
  related: '关联展品',
  start: '进入 3D 展柜',
  startStone: '开启斜射光检视',
  attributionPrefix: '展品数字溯源：',
  attributionFallback: '基于克利夫兰艺术博物馆 CC0 公开馆藏参考模型（1962.281）进行 PBR 材质重制。',
})

const englishExhibit = {
  title: 'Tripod Ding · Interactive Exhibit',
  summary: 'A digital exhibit preserving the ritual silhouette and taotie motifs with a recrafted aged-bronze PBR material.',
}

const englishArtifactTitles: Record<string, string> = {
  'heluo-bronze-ding': 'Heluo Bronze Ding (Digital Reconstruction)',
  'river-map-pattern-stone': 'River-Map Pattern Stone (Concept Exhibit)',
}

const displayItem = (item: ExhibitCard) => {
  if (locale.value === 'en-US') {
    const title = item.titleEn?.trim() || (item.slug === 'heluo-bronze-ding-3d' ? englishExhibit.title : item.title)
    const summary = item.summaryEn?.trim() || (item.slug === 'heluo-bronze-ding-3d' ? englishExhibit.summary : item.summary)
    const artifactTitle = englishArtifactTitles[item.artifactSlug] || item.artifactTitle
    return { ...item, title, summary, artifactTitle }
  }
  if (item.slug === 'heluo-bronze-ding-3d' && item.summary.includes('GLB')) {
    return {
      ...item,
      summary: '以数字重塑青铜礼器的立耳、兽面纹与三足轮廓，在暗房聚光灯下自由旋转近观，或一键切换粒子点云解构。',
    }
  }
  return item
}

const formatSourceCredit = (credit: string | undefined) => {
  if (!credit) return copy.value.attributionFallback
  if (locale.value === 'zh-CN' && credit.includes('Cleveland Museum of Art')) {
    return '克利夫兰艺术博物馆 · 1962.281 CC0 公开馆藏参考'
  }
  if (locale.value === 'en-US' && /河洛数字博物馆/.test(credit)) {
    return 'Heluo Digital Museum · Original Concept Optical Exhibit'
  }
  return credit
}

const coverFor = (item: ExhibitCard) => {
  if (item.slug.includes('bronze-ding')) return '/media/editorial/explore-bronze-ding-user-v2.webp'
  if (item.slug === 'river-map-stone-raking') return '/media/editorial/explore-river-map-stone-user-v2.webp'
  return item.coverImageUrl
}

const isFeatureShowcase = computed(() => items.value.length > 0 && items.value.length <= 2)

function revealExhibits(instant = false) {
  if (instant || !shouldRunGsapReveal() || !root.value || items.value.length === 0) return
  gsapContext?.revert()
  gsapContext = createGsapContext(root.value, () => {
    if (!discoveryCued) {
      discoveryCued = true
      void audioSystem.playNarrative('discovery', { volume: 0.24 })
    }
    const cards = gsap.utils.toArray<HTMLElement>('[data-motion="item"]', root.value).slice(0, 12)
    if (!cards.length) return
    const constrained = isConstrainedGsapReveal()
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    timeline
      .from('[data-motion="archive-copy"] > *', { autoAlpha: 0, y: constrained ? 4 : 8, duration: constrained ? 0.14 : 0.2, stagger: 0.03, clearProps: 'transform' }, 0)
      .from(cards, { autoAlpha: 0, y: constrained ? 5 : 10, duration: constrained ? 0.14 : 0.22, stagger: 0.04, clearProps: 'transform' }, 0.04)
  })
}

async function loadExhibits() {
  const cached = readPrefetchCache<ExhibitCard[]>('/exhibits')
  error.value = ''
  if (cached) {
    items.value = cached
    loading.value = false
  } else {
    loading.value = true
  }

  try {
    const fresh = await apiGet<ExhibitCard[]>('/exhibits')
    writePrefetchCache('/exhibits', fresh)
    items.value = fresh
  } catch (reason) {
    if (!cached) {
      error.value = reason instanceof Error ? reason.message : (locale.value === 'en-US' ? 'Digital exhibits could not be loaded.' : '数字展项加载失败。')
    }
  } finally {
    loading.value = false
    await nextTick()
    revealExhibits(Boolean(cached))
  }
}

function openExhibit() {
  void audioSystem.playInteraction('awaken-bronze', { volume: 0.22 })
}

onMounted(loadExhibits)
onBeforeUnmount(() => {
  discoveryCued = false
  gsapContext?.revert()
})
</script>

<template>
  <section ref="root" class="curation-page exhibits-page" data-motion-page="exhibits">
    <section class="exhibits-intro">
      <PointerDotField />
      <div class="exhibits-intro__copy" data-motion="archive-copy">
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.title }}</h1>
        <p class="exhibits-intro__lead">{{ copy.intro }}</p>
      </div>
      <div class="exhibit-stats" data-motion="archive-stats">
        <span class="exhibit-stats__label">{{ copy.interaction }}</span>
        <div class="exhibit-stats__tags">
          <span v-for="tag in copy.headerSpecs" :key="tag">{{ tag }}</span>
        </div>
      </div>
    </section>

    <div v-if="error" class="exhibits-error">
      <InlineStatus kind="error" :message="error" />
      <button class="fluid-button fluid-button--secondary state-panel__action" type="button" @click="loadExhibits">{{ copy.retry }}</button>
    </div>

    <LoadingSkeleton v-if="loading" :lines="4" :label="copy.loading" />

    <section v-else-if="!error && items.length===0" class="state-panel state-panel--action">
      <h2>{{ copy.emptyTitle }}</h2>
      <p>{{ copy.emptyText }}</p>
      <RouterLink class="fluid-button fluid-button--primary" to="/explore">{{ copy.explore }}</RouterLink>
    </section>

    <section
      v-else-if="!error"
      class="exhibit-grid"
      :class="{ 'exhibit-grid--featured': isFeatureShowcase }"
      :aria-label="copy.list"
    >
      <RouterLink
        v-for="(item, index) in items"
        :key="item.slug"
        class="exhibit-showcase"
        data-motion="item"
        v-pointer-surface="{ kind: 'exhibit', maxTilt: 1.0 }"
        :to="`/exhibits/${item.slug}`"
        @click="openExhibit"
      >
        <div
          class="exhibit-showcase__media"
          :class="{ 'exhibit-showcase__media--panoramic': item.slug === 'river-map-stone-raking' }"
          data-motion="card-media"
        >
          <img
            :src="coverFor(item)"
            :srcset="mediaSrcset(coverFor(item))"
            :sizes="mediaSizes"
            :alt="displayItem(item).title"
            loading="eager"
            decoding="async"
          />
          <span class="exhibit-showcase__badge font-mono" data-motion="card-index">
            EXHIBIT {{ String(index + 1).padStart(2, '0') }}
          </span>
        </div>

        <div class="exhibit-showcase__body" data-motion="card-copy">
          <p class="eyebrow">{{ copy.related }} · {{ displayItem(item).artifactTitle }}</p>
          <h2>{{ displayItem(item).title }}</h2>
          <p class="exhibit-showcase__summary">{{ displayItem(item).summary }}</p>

          <ul class="exhibit-showcase__features" aria-label="交互特性">
            <li
              v-for="tag in (item.slug === 'river-map-stone-raking' ? copy.stoneCapabilities : copy.capabilities)"
              :key="tag"
            >
              {{ tag }}
            </li>
          </ul>

          <div class="exhibit-showcase__footer">
            <span class="exhibit-showcase__cta">
              {{ item.slug === 'river-map-stone-raking' ? copy.startStone : copy.start }} <b aria-hidden="true">→</b>
            </span>
            <p class="exhibit-showcase__credit">
              {{ copy.attributionPrefix }} {{ formatSourceCredit(item.sourceCredit) }}
            </p>
          </div>
        </div>
      </RouterLink>
    </section>
  </section>
</template>

<style scoped>
.exhibits-page {
  width: min(calc(100% - 4rem), var(--container-max));
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(4rem, 7vw, 6rem);
  color: var(--ink-secondary);
}

/* ── Editorial Header ── */
.exhibits-intro {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-8);
  padding-bottom: var(--space-8);
  margin-bottom: var(--space-8);
  border-bottom: 1px solid var(--border-hairline);
}

.exhibits-intro__copy {
  position: relative;
  z-index: 1;
  max-width: 60ch;
}

.exhibits-intro__copy h1 {
  margin: var(--space-2) 0 var(--space-3);
  font-size: clamp(2.125rem, 3.6vw, 3rem);
  line-height: 1.18;
}

.exhibits-intro__lead {
  font-size: var(--text-md);
  line-height: 1.8;
  color: var(--ink-secondary);
}

.exhibit-stats {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--space-2);
  justify-items: end;
}

.exhibit-stats__label {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent-bronze);
}

.exhibit-stats__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.exhibit-stats__tags span {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-pill);
  background: var(--surface-elevated);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-secondary);
}

.exhibits-error {
  display: grid;
  justify-items: start;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

/* ── Feature Exhibition Showcase Layout (1–2 exhibits) ── */
.exhibit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6);
}

.exhibit-grid--featured {
  grid-template-columns: 1fr;
}

.exhibit-showcase {
  display: grid;
  grid-template-columns: minmax(0, 1.38fr) minmax(0, 1fr);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
  box-shadow: var(--card-frame-sheen), var(--shadow-sm);
  overflow: hidden;
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              box-shadow var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-ui) var(--ease-curatorial);
}

.exhibit-showcase:hover {
  border-color: color-mix(in oklch, var(--accent-bronze) 56%, var(--border-strong));
  box-shadow: var(--card-frame-sheen), var(--shadow-md);
  transform: translateY(-2px);
}

.exhibit-showcase__media {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  min-height: 440px;
  padding: clamp(2rem, 3.8vw, 3.25rem);
  background-color: var(--surface-vitrine);
  background-image: var(--surface-vitrine-spotlight);
  background-size: 100% 100%;
  background-repeat: no-repeat;
  overflow: hidden;
}

.exhibit-showcase__media::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 10%;
  width: 56%;
  height: 14%;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse at center, var(--plinth-contact-shadow) 0%, transparent 72%);
  pointer-events: none;
}

.exhibit-showcase__media img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  max-height: 360px;
  object-fit: contain;
  object-position: center;
  filter: drop-shadow(0 16px 32px oklch(5% 0.006 238 / 0.55));
  transition: transform 520ms var(--ease-curatorial);
}

.exhibit-showcase:hover .exhibit-showcase__media img {
  transform: scale(1.03);
}

.exhibit-showcase__media--panoramic {
  padding: clamp(2.25rem, 4vw, 3.25rem) clamp(1.5rem, 3vw, 2.5rem);
}

.exhibit-showcase__media--panoramic::after {
  bottom: 18%;
  width: 74%;
  height: 10%;
}

.exhibit-showcase__media--panoramic img {
  max-height: 310px;
}

.exhibit-showcase:hover .exhibit-showcase__media--panoramic img {
  transform: scale(1.025);
}

.exhibit-showcase__badge {
  position: absolute;
  top: var(--space-5);
  left: var(--space-5);
  z-index: 2;
  padding: 0.32rem 0.75rem;
  border: 1px solid var(--glass-dark-border);
  border-radius: var(--radius-xs);
  background: var(--glass-dark-bg);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
}

.exhibit-showcase__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-4);
  padding: clamp(1.75rem, 4vw, 3.25rem);
}

.exhibit-showcase__body h2 {
  font-size: clamp(1.75rem, 2.8vw, 2.35rem);
  line-height: 1.24;
  color: var(--ink-primary);
}

.exhibit-showcase__summary {
  font-size: var(--text-md);
  line-height: 1.85;
  color: var(--ink-secondary);
}

.exhibit-showcase__features {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.exhibit-showcase__features li {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-xs);
  background: var(--surface-subtle);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-primary);
}

.exhibit-showcase__footer {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-3);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-hairline);
}

.exhibit-showcase__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: start;
  gap: 0.5rem;
  min-height: 48px;
  padding: 0 1.5rem;
  border-radius: var(--radius-sm);
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.03em;
  box-shadow: var(--button-tactile-sheen);
  transition: background-color var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-fast) var(--ease-curatorial);
}

.exhibit-showcase:hover .exhibit-showcase__cta {
  background: var(--accent-jade-hover);
  transform: translateY(-1px);
}

.exhibit-showcase__credit {
  font-size: var(--text-xs);
  line-height: 1.6;
  color: var(--ink-muted);
}

/* ── Responsive ── */
@media (max-width: 960px) {
  .exhibit-showcase {
    grid-template-columns: 1fr;
  }

  .exhibit-showcase__media {
    width: 100%;
    min-width: 0;
    min-height: 0;
    aspect-ratio: 4 / 3.4;
    padding: 3.75rem var(--space-5) var(--space-5);
  }

  .exhibit-stats {
    justify-items: start;
  }
}

@media (max-width: 760px) {
  .exhibits-page {
    width: calc(100% - 2rem);
    padding-top: var(--space-6);
  }

  .exhibits-intro {
    gap: var(--space-5);
    padding-bottom: var(--space-5);
    margin-bottom: var(--space-6);
  }

  .exhibit-showcase__cta {
    width: 100%;
  }
}
</style>
