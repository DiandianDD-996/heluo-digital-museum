<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Picture, Right, TopRight } from '@element-plus/icons-vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { apiGet, type ContentPage } from '../lib/api'
import { mediaSrcset, mediaSizes } from '../lib/responsiveMedia'
import { localizedContent } from '../lib/contentLocale'
import type { ArticleCard, ArtifactCard, Category, SearchResult } from '../lib/content'
import { useLocale } from '../stores/locale'
import { createGsapContext, revealBatch, revealFigures, revealSequence, shouldRunGsapReveal } from '../lib/gsap'
import EditorialCard from '../components/EditorialCard.vue'
import InlineStatus from '../components/InlineStatus.vue'
import MuseumSearchField from '../components/MuseumSearchField.vue'

const categories = ref<Category[]>([])
const route = useRoute()
const router = useRouter()
const artifacts = ref<ArtifactCard[]>([])
const articles = ref<ArticleCard[]>([])
const searchResults = ref<SearchResult[]>([])
const selectedCategory = ref('')
const keyword = ref('')
const submittedQuery = ref('')
const loading = ref(true)
const searching = ref(false)
const contentError = ref('')
const searchError = ref('')
const collectionPage = ref(1)
const artifactTotalPages = ref(1)
const articleTotalPages = ref(1)
const artifactTotal = ref(0)
const articleTotal = ref(0)
const searchTotal = ref(0)
const searchTotalPages = ref(1)
const { locale } = useLocale()
const failedImages = ref(new Set<string>())

const copy = computed(() => locale.value === 'en-US' ? {
  eyebrow: 'COLLECTION CATALOGUE',
  title: 'Explore the collection',
  intro: 'Objects, rituals and life along the river.',
  searchLabel: 'Search artifacts or articles',
  placeholder: 'Search objects, motifs, or stories',
  hotLabel: 'Suggested:',
  hotTerms: ['Bronze', 'Jade', 'River', 'Pottery'],
  searching: 'Searching...',
  search: 'Search',
  results: 'Search results for',
  items: 'items',
  finding: 'Finding content...',
  none: 'No matching content',
  emptyHint: 'Try another keyword or return to the collection.',
  artifact: 'Artifact',
  article: 'Article',
  read: 'Read details',
  all: 'All objects',
  filters: 'Collection themes',
  loading: 'Loading collection content...',
  retry: 'Try again',
  board: 'Collection objects',
  pieces: 'pieces',
  featured: 'Featured object',
  emptyExhibits: 'No published objects in this theme yet.',
  view: 'View object',
  backToAll: 'View all objects',
  stories: 'Further reading',
  storiesEyebrow: 'CURATORIAL JOURNAL',
  articles: 'articles',
  emptyArticles: 'No published articles in this theme yet.',
  start: 'Read article',
  fallbackPeriod: 'Concept exhibit',
  fallbackAuthor: 'Heluo Digital Museum',
  previous: 'Previous page',
  next: 'Next page',
  pagination: 'Collection pages',
  clearSearch: 'Clear search',
  concept: 'Concept exhibit',
  imageUnavailable: 'Image unavailable',
  themes: 'Follow a theme',
  themesEyebrow: 'CURATED PATHWAYS',
  themesIntro: 'Ritual, nature and the memory of a place.',
  exhibitLink: 'Digital galleries',
  loadError: 'The collection could not be loaded. Try again.',
  searchFailed: 'Search could not be completed. Try again.',
} : {
  eyebrow: '数字馆藏图录',
  title: '探索馆藏',
  intro: '器物里的礼序，河流中的日常。',
  searchLabel: '搜索文物或文章',
  placeholder: '搜索器物、纹样、故事',
  hotLabel: '热门检索：',
  hotTerms: ['青铜', '玉璧', '河图', '彩陶'],
  searching: '搜索中...',
  search: '搜索',
  results: '的搜索结果',
  items: '项',
  finding: '正在查找内容...',
  none: '没有找到相关内容',
  emptyHint: '换一个关键词，或回到全部馆藏继续浏览。',
  artifact: '文物',
  article: '文章',
  read: '阅读详情',
  all: '全部馆藏',
  filters: '馆藏主题',
  loading: '正在加载馆藏内容...',
  retry: '重新加载',
  board: '馆藏器物',
  pieces: '件',
  featured: '重点馆藏',
  emptyExhibits: '这个主题暂时还没有已发布的器物。',
  view: '查看器物',
  backToAll: '查看全部馆藏',
  stories: '延伸阅读',
  storiesEyebrow: '河洛策展期刊',
  articles: '篇',
  emptyArticles: '这个主题暂时还没有已发布的文章。',
  start: '阅读文章',
  fallbackPeriod: '概念展品',
  fallbackAuthor: '河洛数字博物馆',
  previous: '上一页',
  next: '下一页',
  pagination: '馆藏分页',
  clearSearch: '清除搜索',
  concept: '概念展品',
  imageUnavailable: '图片暂不可用',
  themes: '循着主题，继续探索',
  themesEyebrow: '主题导览',
  themesIntro: '从礼器、自然，到一方水土的记忆。',
  exhibitLink: '进入数字展厅',
  loadError: '馆藏加载失败，请重试。',
  searchFailed: '搜索未能完成，请重试。',
})

const categoryEnglish: Record<string, string> = { BRONZE: 'Bronze Rituals', JADE: 'Jade Imagery', RIVER: 'Heluo Stories', POTTERY: 'Pottery & Life', STONE: 'Stone Inscriptions' }
const artifactEnglish: Record<string, { period: string; material: string; category: string }> = {
  'water-bird-bronze': { period: 'Animal motif concept', material: 'Bronze', category: 'Bronze Rituals' },
  'heluo-bronze-jue': { period: 'Bronze Age concept', material: 'Bronze', category: 'Bronze Rituals' },
  'river-map-jade-bi': { period: 'Traditional jade ritual concept', material: 'Jade', category: 'Jade Imagery' },
  'painted-pottery-water-jar': { period: 'Prehistoric life concept', material: 'Pottery', category: 'Heluo Stories' },
  'river-map-pattern-stone': { period: 'Heluo symbol concept', material: 'Stone', category: 'Heluo Stories' },
}
const articleEnglish: Record<string, { category: string }> = {
  'why-negative-space-matters': { category: 'Jade Imagery' },
  'river-as-timeline': { category: 'Heluo Stories' },
  'how-to-read-bronze': { category: 'Bronze Rituals' },
}
const themeDescriptions = computed<Record<string, string>>(() => locale.value === 'en-US' ? {
  BRONZE: 'Form and pattern, cast into ritual.', JADE: 'A circle of stone, a world of meaning.', RIVER: 'Water, settlements and shared memory.',
} : {
  BRONZE: '以器形与纹样，读礼制之美。', JADE: '温润之间，见古人的天地观。', RIVER: '沿水而行，寻一方文明的来处。',
})

const conceptSuffix = /\s*(?:（概念展品）|\(Concept\))$/
const objectTitle = (artifact: ArtifactCard) => artifactCopy(artifact).title.replace(conceptSuffix, '')
const isConcept = (artifact: ArtifactCard) => conceptSuffix.test(artifactCopy(artifact).title)
const categoryName = (category: Pick<Category, 'code' | 'name'>) => locale.value === 'en-US' ? (categoryEnglish[category.code] ?? category.name) : category.name
const artifactCopy = (artifact: ArtifactCard) => ({ ...localizedContent(artifact, locale.value), ...(locale.value === 'en-US' && artifactEnglish[artifact.slug] ? { period: artifactEnglish[artifact.slug].period, material: artifactEnglish[artifact.slug].material, categoryName: artifactEnglish[artifact.slug].category } : {}) })
const artifactMaterial = (artifact: ArtifactCard): 'bronze' | 'jade' | 'ink' => (artifact.categoryCode === 'BRONZE' ? 'bronze' : artifact.categoryCode === 'JADE' ? 'jade' : 'ink')
const articleCopy = (article: ArticleCard) => ({ ...localizedContent(article, locale.value), ...(locale.value === 'en-US' && articleEnglish[article.slug] ? { categoryName: articleEnglish[article.slug].category, authorDisplay: 'Heluo Digital Museum' } : {}) })
const searchCopy = (item: SearchResult) => {
  const localized = localizedContent(item, locale.value)
  if (locale.value !== 'en-US') return localized
  const category = item.type === 'artifact' ? artifactEnglish[item.slug]?.category : articleEnglish[item.slug]?.category
  return { ...localized, categoryName: category ?? item.categoryName }
}

const hasSubmittedSearch = computed(() => submittedQuery.value.length > 0)
const preferredOrder = ['water-bird-bronze', 'heluo-bronze-jue', 'river-map-jade-bi', 'painted-pottery-water-jar', 'river-map-pattern-stone']
const editorialArtifactMedia: Record<string, string> = {
  'heluo-bronze-ding': '/media/editorial/explore-bronze-ding-user-v2.webp',
  'water-bird-bronze': '/media/editorial/explore-water-bird-bronze-user-v2.webp',
  'heluo-bronze-jue': '/media/editorial/explore-bronze-jue-user-v2.webp',
  'river-map-jade-bi': '/media/editorial/explore-jade-bi-user-v2.webp',
  'painted-pottery-water-jar': '/media/editorial/explore-painted-pottery-jar-user-v2.webp',
  'river-map-pattern-stone': '/media/editorial/explore-river-map-stone-user-v2.webp',
}

const artifactCountLabel = (count: number) => locale.value === 'en-US'
  ? `${count} ${count === 1 ? 'piece' : 'pieces'}`
  : `${count} ${copy.value.pieces}`
const articleCountLabel = (count: number) => locale.value === 'en-US'
  ? `${count} ${count === 1 ? 'article' : 'articles'}`
  : `${count} ${copy.value.articles}`
const editorialArticleMedia: Record<string, string> = {
  'why-negative-space-matters': editorialArtifactMedia['river-map-jade-bi'],
  'river-as-timeline': editorialArtifactMedia['river-map-pattern-stone'],
  'how-to-read-bronze': editorialArtifactMedia['heluo-bronze-jue'],
}
const themeMedia: Record<string, string> = {
  BRONZE: editorialArtifactMedia['heluo-bronze-jue']!,
  JADE: editorialArtifactMedia['river-map-jade-bi']!,
  RIVER: editorialArtifactMedia['river-map-pattern-stone']!,
}
const displayArtifacts = computed(() => [...artifacts.value].sort((a, b) => {
  const ai = preferredOrder.indexOf(a.slug)
  const bi = preferredOrder.indexOf(b.slug)
  return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
}))
function artifactVisual(artifact: ArtifactCard) {
  return editorialArtifactMedia[artifact.slug] ?? artifact.coverImageUrl
}
function artifactMediaSizes() {
  const mobileWidth = locale.value === 'en-US' ? 'calc(100vw - 40px)' : 'calc(50vw - 28px)'
  return `(max-width: 520px) ${mobileWidth}, (max-width: 760px) calc(50vw - 28px), (max-width: 1100px) calc(50vw - 48px), (max-width: 1296px) calc((100vw - 160px) / 3), 379px`
}
function articleVisual(article: ArticleCard) {
  return editorialArticleMedia[article.slug] ?? article.coverImageUrl
}
function searchVisual(item: SearchResult) {
  if (item.type === 'artifact') return editorialArtifactMedia[item.slug] ?? item.coverImageUrl
  return editorialArticleMedia[item.slug] ?? item.coverImageUrl
}

let contentRequestId = 0
let searchRequestId = 0
const root = ref<HTMLElement | null>(null)
let gsapContext: ReturnType<typeof createGsapContext>

function applyEntrance(selectors: string[], stagger = 0.055) {
  if (!shouldRunGsapReveal()) return
  gsapContext?.revert()
  gsapContext = createGsapContext(root.value, () => {
    revealSequence(selectors[0] ?? '', { stagger })
    for (const selector of selectors.slice(1)) revealBatch(selector)
  })
}

onMounted(() => applyEntrance(['[data-motion="explore-intro"] > *', '[data-motion="explore-toolbar"]', '[data-motion="explore-theme"]', '[data-motion="explore-story"]']))

watch([displayArtifacts, articles, searchResults], async () => {
  if (!shouldRunGsapReveal()) return
  await nextTick()
  const targets = root.value?.querySelectorAll<HTMLElement>('[data-motion="explore-object"], [data-motion="explore-result"]')
  if (!targets?.length) return
  const { offset, duration } = revealFigures()
  gsap.fromTo(targets, { autoAlpha: 0, y: offset }, {
    autoAlpha: 1,
    y: 0,
    duration,
    stagger: 0.045,
    ease: 'power3.out',
    overwrite: 'auto',
    clearProps: 'opacity,visibility,transform',
  })
}, { flush: 'post' })

const collectionTotalPages = computed(() => Math.max(artifactTotalPages.value, articleTotalPages.value))

async function loadContent(page = collectionPage.value) {
  const requestId = ++contentRequestId
  collectionPage.value = Math.max(1, page)
  loading.value = true
  contentError.value = ''
  try {
    const categoryQuery = selectedCategory.value ? `&categoryCode=${encodeURIComponent(selectedCategory.value)}` : ''
    const [categoryData, artifactData, articleData] = await Promise.all([
      apiGet<Category[]>('/categories'),
      apiGet<ContentPage<ArtifactCard>>(`/artifacts?page=${collectionPage.value}&size=12${categoryQuery}`),
      apiGet<ContentPage<ArticleCard>>(`/articles?page=${collectionPage.value}&size=12${categoryQuery}`),
    ])
    if (requestId === contentRequestId) {
      categories.value = categoryData
      artifacts.value = artifactData.items
      articles.value = articleData.items
      artifactTotalPages.value = Math.max(1, artifactData.totalPages)
      articleTotalPages.value = Math.max(1, articleData.totalPages)
      artifactTotal.value = artifactData.total
      articleTotal.value = articleData.total
      if (collectionPage.value > collectionTotalPages.value) {
        void router.replace({ query: { ...route.query, page: String(collectionTotalPages.value) } })
      }
    }
  } catch (reason) {
    if (requestId === contentRequestId) contentError.value = reason instanceof Error ? reason.message : copy.value.loadError
  } finally {
    if (requestId === contentRequestId) loading.value = false
  }
}

async function loadSearch() {
  const query = submittedQuery.value
  const requestId = ++searchRequestId
  submittedQuery.value = query
  searchResults.value = []
  searching.value = true
  searchError.value = ''
  try {
    const result = await apiGet<ContentPage<SearchResult>>(`/search?keyword=${encodeURIComponent(query)}&type=all&page=${collectionPage.value}&size=24`)
    if (requestId === searchRequestId) {
      searchResults.value = result.items
      searchTotal.value = result.total
      searchTotalPages.value = Math.max(1, result.totalPages)
      if (collectionPage.value > searchTotalPages.value) void router.replace({ query: { ...route.query, page: String(searchTotalPages.value) } })
    }
  } catch (reason) {
    if (requestId === searchRequestId) searchError.value = reason instanceof Error ? reason.message : copy.value.searchFailed
  } finally {
    if (requestId === searchRequestId) searching.value = false
  }
}

function retryContent() { void loadContent(collectionPage.value) }

function resetSearchState() {
  searchRequestId += 1
  submittedQuery.value = ''
  searchResults.value = []
  searching.value = false
  searchError.value = ''
}

function runSearch() {
  const query = keyword.value.trim()
  if (!query) return
  if (query === submittedQuery.value && collectionPage.value === 1) { void loadSearch(); return }
  void router.push({ query: { q: query } })
}

function quickSearch(term: string) {
  keyword.value = term
  runSearch()
}

function clearSearch() {
  keyword.value = ''
  resetSearchState()
  void router.push({ query: selectedCategory.value ? { category: selectedCategory.value } : {} })
}

function selectCategory(category: string) {
  void router.push({ query: category ? { category } : {} })
}

function showAllCollection() {
  void router.push({ query: {} })
}

function goToCollectionPage(page: number) {
  const lastPage = hasSubmittedSearch.value ? searchTotalPages.value : collectionTotalPages.value
  if (page < 1 || page > lastPage || page === collectionPage.value) return
  void router.push({ query: { ...route.query, page: page === 1 ? undefined : String(page) } })
}

function syncQuery() {
  contentRequestId += 1
  resetSearchState()
  const q = typeof route.query.q === 'string' ? route.query.q.trim() : ''
  const page = Number(route.query.page)
  keyword.value = q
  submittedQuery.value = q
  selectedCategory.value = typeof route.query.category === 'string' ? route.query.category : ''
  collectionPage.value = Number.isSafeInteger(page) && page > 0 ? page : 1
  if (q) void loadSearch()
  else void loadContent()
}

watch(() => route.query, syncQuery, { immediate: true })
onBeforeUnmount(() => {
  contentRequestId += 1
  searchRequestId += 1
  gsapContext?.revert()
})
</script>

<template>
  <section id="explore-gallery" ref="root" class="collection-page collection-gallery" data-motion-page="explore">
    <header class="gallery-intro" data-motion="explore-intro" aria-labelledby="collection-title">
      <div class="gallery-intro__copy">
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1 id="collection-title">{{ copy.title }}</h1>
        <p class="gallery-intro__description">{{ copy.intro }}</p>
      </div>
      <div class="gallery-intro__search-wrap">
        <MuseumSearchField
          v-model="keyword"
          class="gallery-search"
          :label="copy.searchLabel"
          :placeholder="copy.placeholder"
          :submit-label="copy.search"
          :loading-label="copy.searching"
          :clear-label="copy.clearSearch"
          :loading="searching"
          :error="searchError"
          @submit="runSearch"
          @clear="clearSearch"
        />
        <div class="gallery-hot-terms">
          <span>{{ copy.hotLabel }}</span>
          <button v-for="term in copy.hotTerms" :key="term" type="button" @click="quickSearch(term)">
            {{ term }}
          </button>
        </div>
      </div>
    </header>

    <section v-if="hasSubmittedSearch" id="collection-search-results" class="collection-results gallery-results" aria-live="polite" :aria-busy="searching">
      <header class="gallery-section-head">
        <div>
          <h2>{{ locale === 'en-US' ? `${copy.results} “${submittedQuery}”` : `“${submittedQuery}”${copy.results}` }}</h2>
          <p v-if="!searching && !searchError" class="gallery-count">{{ searchTotal }} {{ copy.items }}</p>
        </div>
        <button class="text-action gallery-text-link" type="button" @click="clearSearch">{{ copy.clearSearch }}<Right aria-hidden="true" /></button>
      </header>
      <div v-if="searching" class="collection-loading gallery-skeleton" role="status">
        <span class="sr-only">{{ copy.finding }}</span>
        <div v-for="index in 3" :key="index" class="gallery-skeleton__item" aria-hidden="true"><span /><span /><span /></div>
      </div>
      <div v-else-if="searchError" class="collection-state collection-state--error gallery-state">
        <InlineStatus kind="error" :message="searchError" />
        <button class="gallery-text-link" type="button" @click="runSearch">{{ copy.retry }}<Right aria-hidden="true" /></button>
      </div>
      <div v-else-if="searchResults.length === 0" class="collection-state collection-state--empty gallery-state">
        <h3>{{ copy.none }}</h3>
        <p>{{ copy.emptyHint }}</p>
        <button class="gallery-text-link" type="button" @click="clearSearch">{{ copy.backToAll }}<Right aria-hidden="true" /></button>
      </div>
      <div v-else class="gallery-result-grid">
        <EditorialCard
          v-for="item in searchResults"
          :key="`${item.type}-${item.slug}`"
          class="search-result-card gallery-result-card"
          data-motion="explore-result"
          :class="{ 'gallery-result-card--artifact': item.type === 'artifact' }"
          :variant="item.type"
          :to="`/${item.type === 'artifact' ? 'artifacts' : 'articles'}/${item.slug}`"
          :media-src="searchVisual(item)"
          media-alt=""
        >
          <template #media>
            <img v-if="searchVisual(item) && !failedImages.has(searchVisual(item))" :src="searchVisual(item)" :srcset="mediaSrcset(searchVisual(item))" :sizes="mediaSizes" alt="" loading="lazy" decoding="async" @error="failedImages.add(searchVisual(item))" />
            <span v-else class="gallery-image-fallback"><Picture aria-hidden="true" />{{ copy.imageUnavailable }}</span>
          </template>
          <template #meta>{{ item.type === 'artifact' ? copy.artifact : copy.article }} · {{ searchCopy(item).categoryName }}<span v-if="item.type === 'artifact' && item.slug === 'heluo-bronze-ding'"> · {{ locale === 'en-US' ? 'AI editorial image' : 'AI策展配图' }}</span></template>
          <template #title>{{ searchCopy(item).title }}</template>
          <template #summary><p>{{ searchCopy(item).summary }}</p></template>
          <template #action>{{ copy.read }}<Right aria-hidden="true" /></template>
        </EditorialCard>
      </div>
      <nav v-if="!searching && !searchError && searchTotalPages > 1" class="collection-pagination gallery-pagination" :aria-label="copy.pagination">
        <button type="button" :aria-label="copy.previous" :disabled="collectionPage === 1" @click="goToCollectionPage(collectionPage - 1)"><ArrowLeft aria-hidden="true" /></button>
        <span class="font-mono">{{ collectionPage }} / {{ searchTotalPages }}</span>
        <button type="button" :aria-label="copy.next" :disabled="collectionPage === searchTotalPages" @click="goToCollectionPage(collectionPage + 1)"><ArrowRight aria-hidden="true" /></button>
      </nav>
    </section>

    <template v-else>
      <div class="gallery-toolbar" data-motion="explore-toolbar">
        <nav class="collection-filters gallery-filters" :aria-label="copy.filters">
          <button :class="{ active: selectedCategory === '' }" type="button" :aria-pressed="selectedCategory === ''" @click="selectCategory('')">
            <span>{{ copy.all }}</span>
            <em v-if="!loading && selectedCategory === ''" class="font-mono">{{ artifactTotal }}</em>
          </button>
          <button
            v-for="category in categories"
            :key="category.code"
            :class="{ active: selectedCategory === category.code }"
            type="button"
            :aria-pressed="selectedCategory === category.code"
            @click="selectCategory(category.code)"
          >
            <span>{{ categoryName(category) }}</span>
            <em v-if="!loading && selectedCategory === category.code" class="font-mono">{{ artifactTotal }}</em>
          </button>
        </nav>
        <RouterLink class="gallery-text-link gallery-exhibit-link" to="/exhibits">
          <span>{{ copy.exhibitLink }}</span>
          <TopRight aria-hidden="true" />
        </RouterLink>
      </div>

      <section v-if="loading" class="collection-loading gallery-skeleton" role="status" :aria-label="copy.loading">
        <span class="sr-only">{{ copy.loading }}</span>
        <div v-for="index in 6" :key="index" class="gallery-skeleton__item" aria-hidden="true"><span /><span /><span /></div>
      </section>
      <section v-else-if="contentError" class="collection-state collection-state--error gallery-state">
        <InlineStatus kind="error" :message="contentError" />
        <button class="gallery-text-link" type="button" @click="retryContent">{{ copy.retry }}<Right aria-hidden="true" /></button>
      </section>
      <template v-else>
        <section class="collection-browse gallery-browse" aria-labelledby="collection-objects-title">
          <header class="gallery-section-head gallery-section-head--compact">
            <h2 id="collection-objects-title">{{ copy.board }}</h2>
            <span class="gallery-count font-mono">{{ artifactCountLabel(artifactTotal) }}</span>
          </header>

          <div v-if="displayArtifacts.length" class="gallery-objects" :class="{ 'gallery-objects--filtered': selectedCategory || collectionPage > 1 }">
            <RouterLink
              v-for="(artifact, index) in displayArtifacts"
              :key="artifact.slug"
              v-artifact-awaken="{ material: artifactMaterial(artifact) }"
              class="gallery-object"
              data-motion="explore-object"
              :class="{ 'gallery-object--featured': index === 0 && !selectedCategory && collectionPage === 1 }"
              :to="`/artifacts/${artifact.slug}`"
              :aria-label="`${copy.view}：${artifactCopy(artifact).title}`"
            >
              <div class="gallery-object__media">
                <img
                  v-if="artifactVisual(artifact) && !failedImages.has(artifactVisual(artifact))"
                  :src="artifactVisual(artifact)"
                  :srcset="mediaSrcset(artifactVisual(artifact))"
                  :sizes="artifactMediaSizes()"
                  alt=""
                  :loading="index < 3 ? 'eager' : 'lazy'"
                  :fetchpriority="index === 0 ? 'high' : undefined"
                  decoding="async"
                  @error="failedImages.add(artifactVisual(artifact))"
                />
                <span v-else class="gallery-image-fallback"><Picture aria-hidden="true" />{{ copy.imageUnavailable }}</span>
              </div>
              <div class="gallery-object__caption">
                <p class="gallery-object__meta">
                  {{ artifactCopy(artifact).categoryName }}
                  <span v-if="isConcept(artifact)"> · {{ copy.concept }}</span>
                  <span v-if="artifact.slug === 'heluo-bronze-ding'"> · {{ locale === 'en-US' ? 'AI editorial image' : 'AI策展配图' }}</span>
                </p>
                <div class="gallery-object__title-row">
                  <h3>{{ objectTitle(artifact) }}</h3>
                  <TopRight class="gallery-object__arrow" aria-hidden="true" />
                </div>
                <p v-if="index === 0 && !selectedCategory && collectionPage === 1 && artifactCopy(artifact).summary" class="gallery-object__summary">
                  {{ artifactCopy(artifact).summary }}
                </p>
                <p class="gallery-object__period">
                  {{ artifactCopy(artifact).period || copy.fallbackPeriod }} · {{ artifactCopy(artifact).material }}
                </p>
              </div>
            </RouterLink>
          </div>
          <div v-else class="collection-state collection-state--empty gallery-state">
            <h3>{{ copy.emptyExhibits }}</h3>
            <button v-if="selectedCategory" class="gallery-text-link" type="button" @click="showAllCollection">{{ copy.backToAll }}<Right aria-hidden="true" /></button>
          </div>
        </section>

        <nav v-if="collectionTotalPages > 1" class="collection-pagination gallery-pagination" :aria-label="copy.pagination">
          <button type="button" :aria-label="copy.previous" :disabled="collectionPage === 1" @click="goToCollectionPage(collectionPage - 1)"><ArrowLeft aria-hidden="true" /></button>
          <span class="font-mono">{{ collectionPage }} / {{ collectionTotalPages }}</span>
          <button type="button" :aria-label="copy.next" :disabled="collectionPage === collectionTotalPages" @click="goToCollectionPage(collectionPage + 1)"><ArrowRight aria-hidden="true" /></button>
        </nav>

        <!-- Theme Pathways -->
        <section v-if="categories.length" class="gallery-themes" aria-labelledby="gallery-themes-title">
          <div class="gallery-themes__intro">
            <p class="eyebrow">{{ copy.themesEyebrow }}</p>
            <h2 id="gallery-themes-title">{{ copy.themes }}</h2>
            <p>{{ copy.themesIntro }}</p>
          </div>
          <nav class="gallery-themes__links" data-motion="explore-theme" :aria-label="copy.filters">
            <RouterLink
              v-for="category in categories"
              :key="category.code"
              :to="{ path: '/explore', query: { category: category.code }, hash: '#collection-title' }"
            >
              <img
                v-if="themeMedia[category.code] && !failedImages.has(themeMedia[category.code])"
                :src="themeMedia[category.code]"
                :srcset="mediaSrcset(themeMedia[category.code])"
                sizes="80px"
                alt=""
                width="80"
                height="80"
                loading="lazy"
                decoding="async"
                @error="failedImages.add(themeMedia[category.code])"
              />
              <span class="gallery-themes__copy">
                <strong>{{ categoryName(category) }}</strong>
                <small v-if="themeDescriptions[category.code]">{{ themeDescriptions[category.code] }}</small>
              </span>
              <Right class="gallery-themes__arrow" aria-hidden="true" />
            </RouterLink>
          </nav>
        </section>

        <!-- Curatorial Journal Reading List (Distinct Periodical Layout) -->
        <section v-if="articles.length" class="collection-reading gallery-reading" aria-labelledby="collection-reading-title">
          <header class="gallery-section-head">
            <div>
              <p class="eyebrow">{{ copy.storiesEyebrow }}</p>
              <h2 id="collection-reading-title">{{ copy.stories }}</h2>
            </div>
            <span class="gallery-count font-mono">{{ articleCountLabel(articleTotal) }}</span>
          </header>
          <div class="gallery-reading-list">
            <RouterLink
              v-for="article in articles"
              :key="article.slug"
              class="gallery-story"
              data-motion="explore-story"
              :to="`/articles/${article.slug}`"
            >
              <div class="gallery-story__media">
                <img
                  v-if="articleVisual(article) && !failedImages.has(articleVisual(article))"
                  :src="articleVisual(article)"
                  :srcset="mediaSrcset(articleVisual(article))"
                  sizes="(max-width: 520px) 96px, 220px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  @error="failedImages.add(articleVisual(article))"
                />
                <span v-else class="gallery-image-fallback"><Picture aria-hidden="true" /><span class="sr-only">{{ copy.imageUnavailable }}</span></span>
              </div>
              <div class="gallery-story__body">
                <p class="gallery-story__meta">{{ articleCopy(article).categoryName }} · {{ articleCopy(article).authorDisplay || copy.fallbackAuthor }}</p>
                <h3>{{ articleCopy(article).title }}</h3>
                <p class="gallery-story__summary">{{ articleCopy(article).summary }}</p>
              </div>
              <Right class="gallery-story__arrow" aria-hidden="true" />
            </RouterLink>
          </div>
        </section>
        <section v-else class="collection-state collection-state--empty gallery-state">
          <h2>{{ copy.stories }}</h2>
          <p>{{ copy.emptyArticles }}</p>
        </section>
      </template>
    </template>
  </section>
</template>

<style scoped>
.collection-gallery {
  width: min(calc(100% - 4rem), var(--container-max));
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(4rem, 7vw, 6rem);
  color: var(--ink-secondary);
}

.collection-gallery svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ── Editorial Search Header ── */
.gallery-intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 440px);
  align-items: end;
  gap: var(--space-8);
  padding-bottom: var(--space-8);
}

.gallery-intro__copy h1 {
  margin: var(--space-2) 0 var(--space-3);
  font-size: clamp(2.25rem, 3.6vw, 3rem);
  line-height: 1.15;
}

.gallery-intro__description {
  max-width: 44ch;
  font-size: var(--text-md);
  line-height: 1.7;
  color: var(--ink-muted);
}

.gallery-intro__search-wrap {
  display: grid;
  gap: 0.625rem;
}

.gallery-hot-terms {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.5rem;
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.gallery-hot-terms button {
  min-height: 28px;
  padding: 0 0.625rem;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial);
}

.gallery-hot-terms button:hover {
  border-color: var(--accent-bronze);
  background: var(--accent-bronze-soft);
  color: var(--ink-primary);
}

/* ── Underline Category Tabs ── */
.gallery-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
  border-bottom: 1px solid var(--border-hairline);
}

.gallery-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-6);
}

.gallery-filters button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: var(--control-min);
  padding: 0 0.125rem;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--duration-ui) var(--ease-curatorial);
}

.gallery-filters button::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent-bronze);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--duration-ui) var(--ease-curatorial);
}

.gallery-filters button:hover {
  color: var(--ink-primary);
}

.gallery-filters button.active {
  color: var(--ink-primary);
  font-weight: 600;
}

.gallery-filters button.active::after {
  transform: scaleX(1);
}

.gallery-filters button em {
  font-style: normal;
  font-size: var(--text-xs);
  color: var(--accent-bronze);
}

.gallery-text-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--control-min);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent-jade);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.gallery-text-link:hover {
  text-decoration: underline;
  text-underline-offset: 5px;
}

/* ── Section Heads ── */
.gallery-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.gallery-section-head--compact {
  align-items: baseline;
  margin-bottom: var(--space-5);
}

.gallery-section-head h2 {
  font-size: clamp(1.375rem, 2.2vw, 1.75rem);
  line-height: 1.25;
}

.gallery-count {
  font-size: var(--text-xs);
  color: var(--ink-muted);
  letter-spacing: 0.06em;
}

/* ── Object Catalogue Wall (3-col breathable grid + Span-2 Featured Hero Card) ── */
.gallery-objects {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}

.gallery-object {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
  overflow: hidden;
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              box-shadow var(--duration-ui) var(--ease-curatorial);
}

.gallery-object:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.gallery-object__media {
  position: relative;
  aspect-ratio: 4 / 3;
  display: grid;
  place-items: center;
  padding: var(--space-3);
  background: var(--surface-spotlight), var(--surface-plinth);
  overflow: hidden;
}

.gallery-object__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 460ms var(--ease-curatorial);
}

.gallery-object:hover .gallery-object__media img {
  transform: scale(1.03);
}

.gallery-object__caption {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 0.375rem;
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.gallery-object__meta {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent-bronze);
  letter-spacing: 0.04em;
}

.gallery-object__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.gallery-object__title-row h3 {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  line-height: 1.35;
  color: var(--ink-primary);
}

.gallery-object__arrow {
  margin-top: 4px;
  color: var(--ink-muted);
  transition: color var(--duration-fast) var(--ease-curatorial),
              transform var(--duration-fast) var(--ease-curatorial);
}

.gallery-object:hover .gallery-object__arrow {
  color: var(--accent-jade);
  transform: translate(2px, -2px);
}

.gallery-object__summary {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.gallery-object__period {
  margin-top: auto;
  padding-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

/* Featured Span-2 Hero Object Card on Page 1 All View */
.gallery-object--featured {
  grid-column: span 2;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
}

.gallery-object--featured .gallery-object__media {
  aspect-ratio: auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 320px;
}

.gallery-object--featured .gallery-object__caption {
  min-width: 0;
  padding: var(--space-6) var(--space-6);
  justify-content: center;
  gap: var(--space-3);
}

.gallery-object--featured .gallery-object__title-row h3 {
  font-size: clamp(1.375rem, 2vw, 1.75rem);
}

/* ── Search Results Grid ── */
.gallery-result-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}

/* ── Image Fallback & States ── */
.gallery-image-fallback {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--ink-muted);
  font-size: var(--text-xs);
}

.gallery-state {
  display: grid;
  justify-items: start;
  gap: var(--space-3);
  padding: var(--space-8);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
}

.gallery-state h3,
.gallery-state h2 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.gallery-skeleton {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}

.gallery-skeleton__item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
}

.gallery-skeleton__item span {
  display: block;
  border-radius: var(--radius-xs);
  background: var(--surface-subtle);
}

.gallery-skeleton__item span:first-child {
  aspect-ratio: 4 / 3;
}

.gallery-skeleton__item span:nth-child(2) {
  height: 1.25rem;
  width: 68%;
}

.gallery-skeleton__item span:nth-child(3) {
  height: 0.875rem;
  width: 45%;
}

/* ── Pagination ── */
.gallery-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-8);
}

.gallery-pagination button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-min);
  height: var(--control-min);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial);
}

.gallery-pagination button:hover:not(:disabled) {
  border-color: var(--accent-jade);
  background: var(--surface-subtle);
}

.gallery-pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.gallery-pagination span {
  font-size: var(--text-sm);
  color: var(--ink-secondary);
}

/* ── Theme Pathways Band ── */
.gallery-themes {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 2fr);
  gap: var(--space-8);
  align-items: start;
  margin-top: clamp(4rem, 7vw, 5.5rem);
  padding-top: clamp(3rem, 5vw, 4rem);
  border-top: 1px solid var(--border-hairline);
}

.gallery-themes__intro h2 {
  margin: var(--space-2) 0 var(--space-3);
  font-size: clamp(1.5rem, 2.4vw, 2rem);
}

.gallery-themes__intro p:last-child {
  font-size: var(--text-sm);
  line-height: 1.75;
  color: var(--ink-muted);
}

.gallery-themes__links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.gallery-themes__links > a {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 84px;
  padding: var(--space-3);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              box-shadow var(--duration-ui) var(--ease-curatorial);
}

.gallery-themes__links > a:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-xs);
}

.gallery-themes__links img {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--surface-plinth);
}

.gallery-themes__copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.gallery-themes__copy strong {
  font-family: var(--font-display);
  font-size: var(--text-md);
  color: var(--ink-primary);
}

.gallery-themes__copy small {
  font-size: var(--text-xs);
  color: var(--ink-muted);
  line-height: 1.45;
}

.gallery-themes__arrow {
  color: var(--accent-bronze);
}

/* ── Journal Reading List (Periodical Layout — Distinct from Object Grid) ── */
.gallery-reading {
  margin-top: clamp(4rem, 7vw, 5.5rem);
  padding-top: clamp(3rem, 5vw, 4rem);
  border-top: 1px solid var(--border-hairline);
}

.gallery-reading-list {
  display: grid;
  border-top: 1px solid var(--border-hairline);
}

.gallery-story {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--border-hairline);
  transition: background-color var(--duration-ui) var(--ease-curatorial);
}

.gallery-story:hover .gallery-story__media img {
  transform: scale(1.03);
}

.gallery-story:hover .gallery-story__arrow {
  color: var(--accent-jade);
  transform: translateX(4px);
}

.gallery-story__media {
  aspect-ratio: 16 / 10;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface-plinth);
}

.gallery-story__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 420ms var(--ease-curatorial);
}

.gallery-story__body {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.gallery-story__meta {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent-bronze);
  letter-spacing: 0.04em;
}

.gallery-story__body h3 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  line-height: 1.35;
  color: var(--ink-primary);
}

.gallery-story__summary {
  font-size: var(--text-sm);
  line-height: 1.65;
  color: var(--ink-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.gallery-story__arrow {
  color: var(--ink-muted);
  transition: color var(--duration-fast) var(--ease-curatorial),
              transform var(--duration-fast) var(--ease-curatorial);
}

/* ── Responsive ── */
@media (max-width: 1080px) {
  .gallery-objects,
  .gallery-result-grid,
  .gallery-skeleton {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gallery-themes {
    grid-template-columns: 1fr;
  }

  .gallery-themes__links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .collection-gallery {
    width: calc(100% - 2rem);
    padding-top: var(--space-6);
  }

  .gallery-intro {
    grid-template-columns: 1fr;
    gap: var(--space-5);
    padding-bottom: var(--space-5);
  }

  .gallery-objects,
  .gallery-result-grid,
  .gallery-skeleton {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  .gallery-object--featured {
    grid-column: auto;
    display: flex;
    flex-direction: column;
  }

  .gallery-themes__links {
    grid-template-columns: 1fr;
  }

  .gallery-themes__links > a {
    min-height: 76px;
  }

  .gallery-story {
    grid-template-columns: 96px minmax(0, 1fr) 16px;
    gap: var(--space-4);
    padding: var(--space-4) 0;
  }

  .gallery-story__media {
    aspect-ratio: 4 / 3;
  }

  .gallery-story__body h3 {
    font-size: var(--text-md);
  }
}
</style>
