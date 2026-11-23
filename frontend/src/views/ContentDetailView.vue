<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { apiGet } from '../lib/api'
import { mediaSrcset } from '../lib/responsiveMedia'
import { createGsapContext, ensureScrollTrigger, isConstrainedGsapReveal, shouldRunGsapReveal } from '../lib/gsap'
import { audioSystem } from '../lib/audioSystem'
import { localizedContent } from '../lib/contentLocale'
import type { ArticleDetail, ArtifactDetail } from '../lib/content'
import InlineStatus from '../components/InlineStatus.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import PlainTextLinks from '../components/PlainTextLinks.vue'
import { GUIDE_ARTIFACT_SLUG, GUIDE_EXHIBIT_SLUG } from '../lib/guideTypes'
import { useLocale } from '../stores/locale'
import { guideEnabled, useLuoshengStore } from '../stores/luoshengStore'

const route = useRoute()
const LuoshengPreset = guideEnabled
  ? defineAsyncComponent(() => import('../components/LuoshengPreset.vue')) : null
const router = useRouter()
const { locale } = useLocale()
const imageFailed = ref(false)
const isEnglish = computed(() => locale.value === 'en-US')

const copy = computed(() => isEnglish.value ? {
  back: 'Back to collection',
  loading: 'Loading content',
  failure: 'This content is unavailable',
  failureDetail: 'It may be unpublished or temporarily unavailable.',
  retry: 'Try again',
  plaqueTitle: 'Object Specification',
  category: 'Category',
  period: 'Period inspiration',
  material: 'Material',
  dimensions: 'Dimensions',
  location: 'Location',
  contents: 'On this page',
  reading: 'Reading progress',
  note: 'Follow the object through its materials and story.',
  related: 'Related digital exhibits',
  next: 'Take a closer look',
  enter: 'Open 3D exhibit',
  visitEyebrow: 'OFFLINE VISIT',
  visit: 'Continue your exploration with a visit.',
  booking: 'Book a visit',
  image: 'Image unavailable',
  conceptBadge: 'Concept Exhibit',
  source: 'An original concept exhibit created for this project. It is not a historical collection record.',
} : {
  back: '返回探索馆藏',
  loading: '正在加载文物内容',
  failure: '暂时无法打开这页内容',
  failureDetail: '内容可能尚未发布，或者服务暂时不可用。',
  retry: '重新加载',
  plaqueTitle: '展品档案铭牌',
  category: '馆藏分类',
  period: '时代意象',
  material: '材质',
  dimensions: '尺寸',
  location: '馆藏位置',
  contents: '本文目录',
  reading: '阅读进度',
  note: '沿着器物的时代、材料与故事继续阅读。',
  related: '关联数字展项',
  next: '继续在线近观',
  enter: '进入 3D 展项',
  visitEyebrow: '预约线下参观',
  visit: '在线感受过展品后，欢迎安排一次线下相见。',
  booking: '预约线下参观',
  image: '图片暂时无法显示',
  conceptBadge: '概念展品',
  source: '本项目自主创作的概念展品，不代表历史馆藏实物档案。',
})

const loading = ref(true)
const error = ref('')
const artifact = ref<ArtifactDetail | null>(null)
const article = ref<ArticleDetail | null>(null)
const readingProgress = ref(0)
const activeSectionId = ref('')
const root = ref<HTMLElement | null>(null)
let gsapContext: gsap.Context | undefined
let narrativeCue: 'idle' | 'opened' | 'ended' = 'idle'

const isArtifact = computed(() => route.name === 'artifact-detail')
const guideStore = guideEnabled ? useLuoshengStore() : null

watch([artifact, loading], ([item, pending]) => {
  if (!guideStore || pending || !item || route.name !== 'artifact-detail' || route.params.slug !== item.slug) return
  guideStore.setPageContext({
    route: 'artifact-detail',
    path: route.path,
    title: item.title,
    artifactSlug: item.slug,
    exhibitSlug: item.exhibits[0]?.slug ?? null,
    articleSlug: null,
  })
})

watch([article, loading], ([item, pending]) => {
  if (!guideStore || pending || !item || route.name !== 'article-detail' || route.params.slug !== item.slug) return
  guideStore.setPageContext({
    route: 'article-detail',
    path: route.path,
    title: item.title,
    artifactSlug: null,
    exhibitSlug: null,
    articleSlug: item.slug,
  })
})

const detail = computed(() => {
  const source = artifact.value ?? article.value
  return source ? localizedContent(source, locale.value) : null
})

const contentBlocks = computed(() => (detail.value?.content.split(/\n\s*\n/).filter(Boolean) ?? []).map((text) => ({
  text,
  heading: text.length <= 30 && (text.includes('｜') || text === '留给观众的问题'),
})))

const contents = computed(() => contentBlocks.value.flatMap((block, index) => block.heading ? [{ title: block.text, id: `reading-section-${index}` }] : []))
const isConcept = computed(() => (artifact.value ?? article.value)?.title.includes('概念展品') ?? false)

function returnToCollection() {
  const previous = window.history.state?.back
  if (typeof previous === 'string' && (previous === '/explore' || previous.startsWith('/explore?'))) router.back()
  else void router.push('/explore')
}

watch([detail, locale], () => {
  if (!detail.value) return
  document.title = `${detail.value.title} | ${isEnglish.value ? 'Heluo Digital Museum' : '河洛数字博物馆'}`
  document.querySelector('meta[name="description"]')?.setAttribute('content', detail.value.summary)
}, { flush: 'post' })

function setupScrollNarrative() {
  if (!shouldRunGsapReveal() || !root.value || !detail.value) return
  const ScrollTrigger = ensureScrollTrigger()
  gsapContext?.revert()
  narrativeCue = 'idle'
  gsapContext = createGsapContext(root.value, () => {
    const constrained = isConstrainedGsapReveal()
    const duration = constrained ? 0.18 : 0.42
    const offset = constrained ? 7 : 14
    const stagger = constrained ? 0.04 : 0.056
    const headerTimeline = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onStart: () => {
        if (narrativeCue !== 'idle') return
        narrativeCue = 'opened'
        void audioSystem.playNarrative('opening', { volume: 0.26 })
      },
    })
    headerTimeline
      .from('[data-motion="detail-header"] > *', { autoAlpha: 0, y: constrained ? 5 : 12, duration: constrained ? 0.18 : 0.34, stagger: constrained ? 0.025 : 0.055, clearProps: 'transform' }, 0.04)
      .fromTo('[data-motion="detail-cover"]', {
        autoAlpha: constrained ? 0 : 0.45,
        scale: constrained ? 1 : 1.03,
      }, {
        autoAlpha: 1,
        scale: 1,
        duration: constrained ? 0.18 : 0.5,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      }, 0.08)

    const facts = gsap.utils.toArray<HTMLElement>('[data-motion="facts"]', root.value)
    if (facts.length) {
      ScrollTrigger.batch('[data-motion-page="content-detail"] [data-motion="facts"]', {
        start: 'top 86%',
        once: true,
        onEnter: (elements) => gsap.fromTo(elements, { autoAlpha: 0, y: offset }, { autoAlpha: 1, y: 0, duration, stagger, ease: 'power3.out', overwrite: 'auto', clearProps: 'opacity,visibility,transform' }),
      })
    }

    const paragraphs = gsap.utils.toArray<HTMLElement>('[data-motion="paragraph"]', root.value)
    if (paragraphs.length) {
      ScrollTrigger.batch('[data-motion-page="content-detail"] [data-motion="paragraph"]', {
        start: 'top 88%',
        once: true,
        onEnter: (elements) => gsap.fromTo(elements, { autoAlpha: 0, y: offset }, { autoAlpha: 1, y: 0, duration, stagger, ease: 'power3.out', overwrite: 'auto', clearProps: 'opacity,visibility,transform' }),
      })
    }

    const related = gsap.utils.toArray<HTMLElement>('[data-motion="related"]', root.value)
    if (related.length) {
      ScrollTrigger.batch('[data-motion-page="content-detail"] [data-motion="related"]', {
        start: 'top 88%',
        once: true,
        onEnter: (elements) => {
          if (narrativeCue !== 'ended') {
            narrativeCue = 'ended'
            void audioSystem.playNarrative('ending', { volume: 0.28 })
          }
          gsap.fromTo(elements, { autoAlpha: 0, y: offset }, { autoAlpha: 1, y: 0, duration, stagger, ease: 'power3.out', overwrite: 'auto', clearProps: 'opacity,visibility,transform' })
        },
      })
    }
    ScrollTrigger.refresh()
  })
}

let detailRequestId = 0
async function loadDetail() {
  const requestId = ++detailRequestId
  const path = route.path
  loading.value = true
  error.value = ''
  artifact.value = null
  article.value = null
  imageFailed.value = false
  activeSectionId.value = ''
  narrativeCue = 'idle'
  const slug = String(route.params.slug)
  try {
    if (isArtifact.value) {
      const data = await apiGet<ArtifactDetail>(`/artifacts/${encodeURIComponent(slug)}`)
      if (requestId === detailRequestId) artifact.value = data
    } else {
      const data = await apiGet<ArticleDetail>(`/articles/${encodeURIComponent(slug)}`)
      if (requestId === detailRequestId) article.value = data
    }
  } catch (reason) {
    if (requestId === detailRequestId && path === route.path) {
      error.value = reason instanceof Error ? reason.message : '内容加载失败，请稍后重试。'
    }
  } finally {
    if (requestId !== detailRequestId) return
    loading.value = false
    await nextTick()
    if (contents.value.length) activeSectionId.value = contents.value[0]!.id
    setupScrollNarrative()
  }
}

function updateReadingProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  readingProgress.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
  if (contents.value.length) {
    let current = contents.value[0]!.id
    for (const item of contents.value) {
      const el = document.getElementById(item.id)
      if (el && el.getBoundingClientRect().top <= 160) current = item.id
    }
    activeSectionId.value = current
  }
}

watch(() => route.path, loadDetail)
onMounted(() => {
  void loadDetail()
  window.addEventListener('scroll', updateReadingProgress, { passive: true })
  updateReadingProgress()
})
onBeforeUnmount(() => {
  detailRequestId += 1
  gsapContext?.revert()
  window.removeEventListener('scroll', updateReadingProgress)
})
</script>

<template>
  <LoadingSkeleton v-if="loading" class="detail-state" :lines="6" :label="copy.loading" />
  <section v-else-if="error" class="state-panel detail-state state-panel--action">
    <InlineStatus kind="error" :message="error" />
    <h1>{{ copy.failure }}</h1>
    <p>{{ copy.failureDetail }}</p>
    <div class="detail-state__actions">
      <button type="button" class="fluid-button fluid-button--primary" @click="loadDetail">{{ copy.retry }}</button>
      <RouterLink class="fluid-button fluid-button--secondary" to="/explore">{{ copy.back }}</RouterLink>
    </div>
  </section>

  <div v-else-if="detail" ref="root" class="detail-page-shell" data-motion-page="content-detail">
    <div
      class="reading-progress"
      :style="{ '--progress': readingProgress }"
      role="progressbar"
      :aria-label="copy.reading"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(readingProgress * 100)"
    ></div>

    <article class="detail-page curatorial-enter">
      <RouterLink class="back-link" to="/explore" @click.prevent="returnToCollection">← {{ copy.back }}</RouterLink>

      <!-- Editorial Spread Header: 60% Object Plinth + 40% Museum Plaque -->
      <header class="detail-header" :class="{ 'detail-header--article': !artifact }">
        <div class="detail-media surface-plinth" data-motion="detail-cover">
          <img
            v-if="detail.coverImageUrl && !imageFailed"
            :src="detail.coverImageUrl"
            :srcset="mediaSrcset(detail.coverImageUrl)"
            sizes="(max-width: 760px) calc(100vw - 32px), 720px"
            :alt="detail.title"
            decoding="async"
            @error="imageFailed = true"
          />
          <p v-else class="detail-image-fallback" role="status">{{ copy.image }}</p>
        </div>

        <div class="detail-header__body" data-motion="detail-header">
          <div class="detail-header__meta">
            <p class="eyebrow">{{ detail.category.name }} · {{ isArtifact ? 'OBJECT ARCHIVE' : 'CURATORIAL JOURNAL' }}</p>
            <span v-if="isConcept" class="detail-concept-tag">{{ copy.conceptBadge }}</span>
          </div>
          <h1>{{ detail.title }}</h1>
          <p class="detail-summary">{{ detail.summary }}</p>

          <!-- Specimen Plaque Card -->
          <dl v-if="artifact" class="object-facts" :aria-label="copy.plaqueTitle">
            <div v-if="artifact.period" data-motion="facts"><dt>{{ copy.period }}</dt><dd>{{ artifact.period }}</dd></div>
            <div v-if="artifact.material" data-motion="facts"><dt>{{ copy.material }}</dt><dd>{{ artifact.material }}</dd></div>
            <div v-if="artifact.dimensions" data-motion="facts"><dt>{{ copy.dimensions }}</dt><dd>{{ artifact.dimensions }}</dd></div>
            <div v-if="artifact.collectionLocation" data-motion="facts"><dt>{{ copy.location }}</dt><dd>{{ artifact.collectionLocation }}</dd></div>
          </dl>

          <div class="detail-header__actions">
            <RouterLink
              v-if="artifact && artifact.exhibits.length"
              class="fluid-button fluid-button--primary"
              :to="`/exhibits/${artifact.exhibits[0]!.slug}`"
            >
              {{ copy.enter }} →
            </RouterLink>
            <button
              v-if="guideStore"
              type="button"
              class="fluid-button fluid-button--secondary museum-button"
              @click="guideStore.openGuide($event.currentTarget as HTMLElement)"
            >
              {{ isEnglish ? 'Ask Luosheng' : '问洛笙' }}
            </button>
          </div>
        </div>
      </header>

      <LuoshengPreset
        v-if="LuoshengPreset && artifact?.slug === GUIDE_ARTIFACT_SLUG && artifact.exhibits.some(item => item.slug === GUIDE_EXHIBIT_SLUG)"
        :exhibit-slug="GUIDE_EXHIBIT_SLUG"
      />

      <!-- Long-form Curatorial Reading Layout (68ch + Sticky TOC) -->
      <section class="detail-reading">
        <aside class="detail-aside" data-motion="reading-note">
          <span class="detail-aside__title">{{ copy.contents }}</span>
          <nav v-if="contents.length > 1" class="detail-toc" :aria-label="copy.contents">
            <a
              v-for="item in contents"
              :key="item.id"
              :href="`#${item.id}`"
              :class="{ 'is-active': activeSectionId === item.id }"
            >
              {{ item.title }}
            </a>
          </nav>
          <p v-else class="detail-aside__note">{{ copy.note }}</p>
          <p v-if="isConcept" class="detail-source">{{ copy.source }}</p>
        </aside>

        <div class="detail-content">
          <template v-for="(block, index) in contentBlocks" :key="`${index}-${block.text}`">
            <h2 v-if="block.heading" :id="`reading-section-${index}`" data-motion="paragraph">{{ block.text }}</h2>
            <p v-else data-motion="paragraph"><PlainTextLinks :text="block.text" /></p>
          </template>
        </div>
      </section>

      <!-- Dual Closing Cards: Related 3D Exhibit + Visit Booking -->
      <div class="detail-closing" :class="{ 'detail-closing--single': !(artifact && artifact.exhibits.length) }">
        <section v-if="artifact && artifact.exhibits.length" class="related-exhibits">
          <p class="eyebrow" data-motion="related-heading">{{ copy.related }}</p>
          <h2 data-motion="related-heading">{{ copy.next }}</h2>
          <RouterLink
            v-for="exhibit in artifact.exhibits"
            :key="exhibit.slug"
            class="related-exhibit"
            data-motion="related"
            :to="`/exhibits/${exhibit.slug}`"
          >
            <img
              v-if="exhibit.coverImageUrl"
              data-motion="related-media"
              :src="exhibit.coverImageUrl"
              :alt="exhibit.title"
              decoding="async"
            />
            <div data-motion="related-copy">
              <h3>{{ exhibit.title }}</h3>
              <p>{{ exhibit.summary }}</p>
              <span class="related-exhibit__cta">{{ copy.enter }} →</span>
            </div>
          </RouterLink>
        </section>

        <section class="detail-cta" data-motion="cta">
          <p class="eyebrow">{{ copy.visitEyebrow }}</p>
          <h2>{{ copy.booking }}</h2>
          <p>{{ copy.visit }}</p>
          <RouterLink class="fluid-button fluid-button--primary" to="/appointment">{{ copy.booking }} →</RouterLink>
        </section>
      </div>
    </article>
  </div>
</template>

<style scoped>
.detail-state {
  width: min(calc(100% - 4rem), 760px);
  margin: var(--space-10) auto;
}

.detail-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.detail-page-shell {
  background: var(--surface-canvas);
  color: var(--ink-secondary);
}

/* Fixed 2px Bronze Reading Progress Hairline */
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  height: 2px;
  pointer-events: none;
  background: transparent;
}

.reading-progress::before {
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  background: var(--accent-bronze);
  transform-origin: left;
  transform: scaleX(var(--progress, 0));
  transition: transform 160ms linear;
}

.detail-page {
  width: min(calc(100% - 4rem), var(--container-max));
  margin: 0 auto;
  padding: clamp(2rem, 4vw, 3rem) 0 clamp(4rem, 7vw, 6rem);
}

.back-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-min);
  margin-bottom: var(--space-6);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-muted);
  transition: color var(--duration-fast) var(--ease-curatorial);
}

.back-link:hover {
  color: var(--ink-primary);
}

/* ── Spread Header (60% Plinth / 40% Plaque) ── */
.detail-header {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: clamp(2rem, 5vw, 4rem);
  align-items: start;
  padding-bottom: clamp(2.5rem, 5vw, 4rem);
  border-bottom: 1px solid var(--border-hairline);
}

.detail-media {
  position: relative;
  min-height: 360px;
  max-height: 540px;
  display: grid;
  place-items: center;
  padding: var(--space-5);
}

.detail-media img {
  width: 100%;
  height: 100%;
  max-height: 492px;
  object-fit: contain;
  border-radius: var(--radius-xs);
}

.detail-header__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.detail-concept-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.625rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-secondary);
}

.detail-image-fallback {
  padding: var(--space-8);
  color: var(--ink-muted);
  font-size: var(--text-sm);
}

.detail-header__body {
  display: grid;
  gap: var(--space-4);
}

.detail-header__body h1 {
  font-size: clamp(1.875rem, 3vw, 2.5rem);
  line-height: 1.2;
}

.detail-summary {
  font-size: var(--text-md);
  line-height: 1.8;
  color: var(--ink-secondary);
}

/* Specimen Plaque Grid */
.object-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: var(--space-2) 0;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--border-hairline);
  overflow: hidden;
}

.object-facts > div {
  display: grid;
  gap: 0.2rem;
  padding: var(--space-3) var(--space-4);
  background: var(--surface-elevated);
}

.object-facts dt {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}

.object-facts dd {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--ink-primary);
}

.detail-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

/* ── Long-form Reading Body (68ch + Sticky TOC) ── */
.detail-reading {
  display: grid;
  grid-template-columns: 240px minmax(0, var(--reading-max));
  justify-content: space-between;
  gap: clamp(2.5rem, 5vw, 5rem);
  padding-block: clamp(3rem, 6vw, 4.5rem);
}

.detail-aside {
  position: sticky;
  top: calc(var(--header-height) + var(--space-6));
  align-self: start;
  display: grid;
  gap: var(--space-4);
}

.detail-aside__title {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-bronze);
}

.detail-toc {
  display: grid;
  gap: 0.25rem;
  border-left: 1px solid var(--border-hairline);
}

.detail-toc a {
  display: block;
  padding: 0.375rem 0 0.375rem var(--space-4);
  margin-left: -1px;
  border-left: 2px solid transparent;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--ink-muted);
  transition: color var(--duration-fast) var(--ease-curatorial),
              border-color var(--duration-fast) var(--ease-curatorial);
}

.detail-toc a:hover,
.detail-toc a.is-active {
  color: var(--ink-primary);
  border-left-color: var(--accent-bronze);
  font-weight: 600;
}

.detail-aside__note,
.detail-source {
  font-size: var(--text-xs);
  line-height: 1.7;
  color: var(--ink-muted);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-hairline);
}

.detail-content {
  display: grid;
  gap: var(--space-5);
  max-width: var(--reading-max);
  font-size: var(--text-md);
  line-height: 1.9;
  color: var(--ink-secondary);
}

.detail-content h2 {
  position: relative;
  margin-top: var(--space-6);
  padding-left: var(--space-4);
  font-size: var(--text-xl);
  line-height: 1.35;
  color: var(--ink-primary);
  scroll-margin-top: 96px;
}

.detail-content h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.2em;
  bottom: 0.2em;
  width: 3px;
  border-radius: 2px;
  background: var(--accent-bronze);
}

.detail-content p:first-of-type {
  font-size: 1.0625rem;
  color: var(--ink-primary);
}

/* ── Bottom Closing Cards ── */
.detail-closing {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: var(--space-6);
  padding-top: var(--space-8);
  border-top: 1px solid var(--border-hairline);
}

.detail-closing--single {
  grid-template-columns: 1fr;
}

.related-exhibits,
.detail-cta {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
}

.related-exhibits h2,
.detail-cta h2 {
  font-size: var(--text-xl);
}

.related-exhibit {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  transition: border-color var(--duration-ui) var(--ease-curatorial);
}

.related-exhibit:hover {
  border-color: var(--accent-bronze);
}

.related-exhibit img {
  width: 132px;
  height: 96px;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.related-exhibit h3 {
  font-family: var(--font-display);
  font-size: var(--text-md);
  margin-bottom: 0.25rem;
}

.related-exhibit p {
  font-size: var(--text-xs);
  line-height: 1.6;
  color: var(--ink-muted);
  margin-bottom: var(--space-2);
}

.related-exhibit__cta {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent-jade);
}

.detail-cta p:not(.eyebrow) {
  font-size: var(--text-sm);
  line-height: 1.75;
  color: var(--ink-secondary);
}

.detail-cta a {
  justify-self: start;
}

/* ── Responsive ── */
@media (max-width: 960px) {
  .detail-header,
  .detail-reading,
  .detail-closing {
    grid-template-columns: 1fr;
  }

  .detail-aside {
    position: static;
    padding-bottom: var(--space-5);
    border-bottom: 1px solid var(--border-hairline);
  }
}

@media (max-width: 760px) {
  .detail-page,
  .detail-state {
    width: calc(100% - 2rem);
  }

  .object-facts {
    grid-template-columns: 1fr;
  }

  .related-exhibit {
    grid-template-columns: 1fr;
  }

  .related-exhibit img {
    width: 100%;
    height: 160px;
  }
}
</style>
