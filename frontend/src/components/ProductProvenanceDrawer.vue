<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { apiGet } from '../lib/api'
import { resolveProductPresentation } from '../lib/productPresentation'
import { useLocale } from '../stores/locale'
import { useCuratorialBookmarks } from '../stores/curatorialBookmarks'
import FluidButton from './FluidButton.vue'

export interface ProvenanceProductSummary {
  id: number
  slug: string
  name: string
  nameEn?: string | null
  summary: string
  summaryEn?: string | null
  price: string
  availableStock: number
  coverImageUrl: string
  categoryCode?: string | null
  inspirationArtifactSlug?: string | null
}

interface ProductDetailDto extends ProvenanceProductSummary {
  description?: string | null
  descriptionEn?: string | null
}

interface ArtifactOriginDto {
  slug: string
  title: string
  titleEn?: string | null
  summary: string
  summaryEn?: string | null
  period?: string | null
  periodEn?: string | null
  material?: string | null
  materialEn?: string | null
  coverImageUrl?: string | null
  imageUrl?: string | null
}

const ARTIFACT_EDITORIAL_COVERS: Record<string, string> = {
  'heluo-bronze-ding': '/media/editorial/explore-bronze-ding-user-v2.webp',
  'water-bird-bronze': '/media/editorial/explore-water-bird-bronze-user-v2.webp',
  'heluo-bronze-jue': '/media/editorial/explore-bronze-jue-user-v2.webp',
  'river-map-jade-bi': '/media/editorial/explore-jade-bi-user-v2.webp',
  'painted-pottery-water-jar': '/media/editorial/explore-painted-pottery-jar-user-v2.webp',
  'river-map-pattern-stone': '/media/editorial/explore-river-map-stone-user-v2.webp',
}

const props = defineProps<{
  open: boolean
  product: ProvenanceProductSummary | null
  adding?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  close: []
  add: [product: ProvenanceProductSummary]
}>()

const { locale } = useLocale()
const bookmarks = useCuratorialBookmarks()

const detailCache = new Map<string, ProductDetailDto>()
const artifactCache = new Map<string, ArtifactOriginDto>()

const productDetail = ref<ProductDetailDto | null>(null)
const originArtifact = ref<ArtifactOriginDto | null>(null)
const loadingDetail = ref(false)
const dialogRef = ref<HTMLDialogElement | null>(null)

const FALLBACK_INSPIRATION_SLUGS: Record<string, string> = {
  'river-line-teacup-set': 'painted-pottery-water-jar',
  'heluo-silk-scarf': 'water-bird-bronze',
  'river-map-notebook': 'river-map-pattern-stone',
}

const copy = computed(() => locale.value === 'en-US' ? {
  eyebrow: 'CURATORIAL PROVENANCE · MOTIF LINEAGE',
  closeAria: 'Close curatorial provenance drawer',
  objectFrame: 'MUSEUM SOURCE OBJECT',
  editionFrame: 'STORE EDITION',
  bridgeTag: 'MOTIF TRANSLATION',
  designNotes: 'Curatorial Design Notes',
  contentRegion: 'Provenance details',
  boundaryTitle: 'Transparent Edition Boundary',
  boundaryBody: 'Original museum concept merchandise created for curatorial demonstration. Checkout uses simulated payment only.',
  inspectArtifact: 'Read Source Object Archive →',
  addToBag: 'Add to Shopping Bag',
  adding: 'Adding…',
  soldOut: 'Sold Out',
  bookmarkAdd: 'Save to Journal',
  bookmarkSaved: 'Saved in Journal',
  loading: 'Loading curatorial provenance…',
  stockPrefix: 'Available:',
} : {
  eyebrow: '文创器物溯源 · 纹样母本对照',
  closeAria: '关闭器物纹样溯源抽屉',
  objectFrame: '馆藏灵感母本',
  editionFrame: '当代文创转译',
  bridgeTag: '纹样转译',
  designNotes: '策展设计手记',
  contentRegion: '器物溯源正文',
  boundaryTitle: '概念文创说明',
  boundaryBody: '本品为河洛数字博物馆原创概念文创，材质规格仅作策展设计呈现，当前商城流程采用模拟支付演示。',
  inspectArtifact: '阅读灵感母本档案 →',
  addToBag: '加入购物袋',
  adding: '正在加入…',
  soldOut: '暂时售罄',
  bookmarkAdd: '收入观展手账',
  bookmarkSaved: '已收入手账',
  loading: '正在调取馆藏纹样档案…',
  stockPrefix: '当前余量',
})

const displayProduct = computed(() => {
  if (!props.product) return null
  const base = resolveProductPresentation(props.product)
  const en = locale.value === 'en-US'
  const detail = productDetail.value
  return {
    ...base,
    name: en ? (detail?.nameEn?.trim() || props.product.nameEn?.trim() || base.name) : base.name,
    summary: en ? (detail?.summaryEn?.trim() || props.product.summaryEn?.trim() || base.summary) : base.summary,
    description: en
      ? (detail?.descriptionEn?.trim() || detail?.summaryEn?.trim() || base.summary)
      : (detail?.description?.trim() || base.summary),
  }
})

const displayOrigin = computed(() => {
  const art = originArtifact.value
  if (!art) return null
  const en = locale.value === 'en-US'
  return {
    slug: art.slug,
    title: en ? (art.titleEn?.trim() || art.title) : art.title,
    summary: en ? (art.summaryEn?.trim() || art.summary) : art.summary,
    period: en ? (art.periodEn?.trim() || art.period || '') : (art.period || ''),
    material: en ? (art.materialEn?.trim() || art.material || '') : (art.material || ''),
    imageUrl: ARTIFACT_EDITORIAL_COVERS[art.slug] || art.coverImageUrl || art.imageUrl || '/media/editorial/explore-river-map-stone-user-v2.webp',
  }
})

const savedInJournal = computed(() => (
  props.product ? bookmarks.isBookmarked('product', props.product.slug) : false
))

function toggleProductBookmark() {
  if (!props.product || !displayProduct.value) return
  bookmarks.toggleBookmark({
    kind: 'product',
    slug: props.product.slug,
    title: props.product.name,
    titleEn: props.product.nameEn || productDetail.value?.nameEn || props.product.name,
    subtitle: `¥ ${props.product.price}`,
    subtitleEn: `CNY ${props.product.price}`,
    imageUrl: displayProduct.value.coverImageUrl,
    path: `/shop?item=${encodeURIComponent(props.product.slug)}`,
  })
}

let activeFetchToken = 0

async function fetchProvenance(item: ProvenanceProductSummary) {
  const token = ++activeFetchToken
  loadingDetail.value = true
  productDetail.value = detailCache.get(item.slug) ?? null
  const initialArtifactSlug = item.inspirationArtifactSlug || FALLBACK_INSPIRATION_SLUGS[item.slug] || ''
  originArtifact.value = initialArtifactSlug ? (artifactCache.get(initialArtifactSlug) ?? null) : null

  try {
    let detail = detailCache.get(item.slug)
    if (!detail) {
      detail = await apiGet<ProductDetailDto>(`/products/${encodeURIComponent(item.slug)}`)
      detailCache.set(item.slug, detail)
    }
    if (token !== activeFetchToken) return
    productDetail.value = detail

    const artifactSlug = detail.inspirationArtifactSlug || initialArtifactSlug
    if (artifactSlug) {
      let art = artifactCache.get(artifactSlug)
      if (!art) {
        art = await apiGet<ArtifactOriginDto>(`/artifacts/${encodeURIComponent(artifactSlug)}`)
        artifactCache.set(artifactSlug, art)
      }
      if (token !== activeFetchToken) return
      originArtifact.value = art
    }
  } catch {
    // Keep graceful summary fallback if detail or artifact request fails
  } finally {
    if (token === activeFetchToken) {
      loadingDetail.value = false
    }
  }
}

function closeDialog(element: Element) {
  const dialog = element as HTMLDialogElement
  dialog.inert = true
  if (dialog.open) dialog.close()
}

function containTab(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialogRef.value) return
  const controls = dialogRef.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (document.activeElement === (event.shiftKey ? first : last)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first)?.focus()
  }
}

watch(dialogRef, (dialog) => {
  if (dialog && !dialog.open) {
    dialog.inert = false
    dialog.showModal()
  }
}, { flush: 'post' })

watch(
  () => [props.open, props.product?.slug] as const,
  ([isOpen, slug]) => {
    if (isOpen && props.product && slug) {
      void fetchProvenance(props.product)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (dialogRef.value?.open) dialogRef.value.close()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="provenance-fade" @before-leave="closeDialog">
      <dialog
        v-if="open && product && displayProduct"
        ref="dialogRef"
        class="provenance-backdrop"
        data-testid="product-provenance-drawer"
        :aria-label="displayProduct.name"
        @cancel.prevent="emit('close')"
        @keydown="containTab"
        @click.self="emit('close')"
      >
        <div class="provenance-drawer">
          <header class="provenance-drawer__head">
            <div>
              <p class="eyebrow">{{ copy.eyebrow }}</p>
              <h2>{{ displayProduct.name }}</h2>
            </div>
            <button
              type="button"
              class="provenance-drawer__close"
              data-testid="provenance-close"
              :aria-label="copy.closeAria"
              autofocus
              @click="emit('close')"
            >
              ×
            </button>
          </header>

          <div class="provenance-drawer__body" role="region" :aria-label="copy.contentRegion" tabindex="0">
            <!-- 1:1 Side-by-Side Motif Provenance Diptych -->
            <section class="provenance-diptych" :aria-label="copy.bridgeTag">
              <article v-if="displayOrigin" class="provenance-frame provenance-frame--source">
                <span class="provenance-frame__tag font-mono">{{ copy.objectFrame }}</span>
                <div class="provenance-frame__media">
                  <img :src="displayOrigin.imageUrl" :alt="displayOrigin.title" loading="lazy" decoding="async" />
                </div>
                <div class="provenance-frame__caption">
                  <strong>{{ displayOrigin.title }}</strong>
                  <small v-if="displayOrigin.period || displayOrigin.material">
                    {{ [displayOrigin.period, displayOrigin.material].filter(Boolean).join(' · ') }}
                  </small>
                </div>
              </article>

              <div v-if="displayOrigin" class="provenance-bridge" aria-hidden="true">
                <span class="provenance-bridge__line"></span>
                <em class="font-mono">{{ copy.bridgeTag }}</em>
                <span class="provenance-bridge__line"></span>
              </div>

              <article class="provenance-frame provenance-frame--edition">
                <span class="provenance-frame__tag font-mono">{{ copy.editionFrame }}</span>
                <div class="provenance-frame__media">
                  <img :src="displayProduct.coverImageUrl" :alt="displayProduct.name" loading="lazy" decoding="async" />
                </div>
                <div class="provenance-frame__caption">
                  <strong>{{ displayProduct.name }}</strong>
                  <small class="font-mono">¥ {{ product.price }} · {{ copy.stockPrefix }} {{ product.availableStock }}</small>
                </div>
              </article>
            </section>

            <p v-if="loadingDetail && !productDetail" class="provenance-loading" role="status">
              {{ copy.loading }}
            </p>

            <section class="provenance-notes">
              <h3>{{ copy.designNotes }}</h3>
              <p>{{ displayProduct.description }}</p>
              <RouterLink
                v-if="displayOrigin"
                class="provenance-artifact-link"
                :to="`/artifacts/${displayOrigin.slug}`"
                @click="emit('close')"
              >
                {{ copy.inspectArtifact }}
              </RouterLink>
            </section>

            <section class="provenance-boundary">
              <strong>{{ copy.boundaryTitle }}</strong>
              <p>{{ copy.boundaryBody }}</p>
            </section>
          </div>

          <footer class="provenance-drawer__foot">
            <button
              type="button"
              class="provenance-bookmark-btn"
              :class="{ 'is-saved': savedInJournal }"
              data-testid="provenance-bookmark-btn"
              :aria-pressed="savedInJournal"
              @click="toggleProductBookmark"
            >
              <span aria-hidden="true">{{ savedInJournal ? '★' : '☆' }}</span>
              <span>{{ savedInJournal ? copy.bookmarkSaved : copy.bookmarkAdd }}</span>
            </button>
            <FluidButton
              class="provenance-add-btn"
              :disabled="disabled || product.availableStock === 0"
              :loading="adding"
              @click="emit('add', product)"
            >
              {{ product.availableStock === 0 ? copy.soldOut : adding ? copy.adding : `${copy.addToBag} · ¥ ${product.price}` }}
            </FluidButton>
          </footer>
        </div>
      </dialog>
    </Transition>
  </Teleport>
</template>

<style scoped>
.provenance-backdrop {
  position: fixed;
  inset: 0;
  z-index: 95;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  justify-content: flex-end;
  background: oklch(11% 0.006 238 / 0.56);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.provenance-backdrop[open],
.provenance-backdrop.provenance-fade-leave-active {
  display: flex;
}

.provenance-backdrop::backdrop {
  background: transparent;
}

:global(html:has(.provenance-backdrop[open])) {
  overflow: hidden;
}

.provenance-drawer {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(100vw, 560px);
  height: 100dvh;
  background: var(--surface-canvas);
  border-left: 1px solid var(--border-hairline);
  box-shadow: var(--shadow-lg);
  color: var(--ink-primary);
}

.provenance-drawer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-6) var(--space-4);
  border-bottom: 1px solid var(--border-hairline);
}

.provenance-drawer__head h2 {
  margin: 0.25rem 0 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.25;
}

.provenance-drawer__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: transparent;
  color: var(--ink-secondary);
  font-size: var(--text-xl);
  cursor: pointer;
}

.provenance-drawer__close:hover {
  border-color: var(--accent-bronze);
  color: var(--ink-primary);
}

.provenance-drawer__body {
  overflow-y: auto;
  overscroll-behavior-y: contain;
  display: grid;
  align-content: start;
  gap: var(--space-5);
  padding: var(--space-5) var(--space-6);
}

.provenance-drawer__body:focus-visible {
  outline-offset: -2px;
}

.provenance-diptych {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: stretch;
  gap: var(--space-3);
}

.provenance-frame {
  display: grid;
  grid-template-rows: auto 156px auto;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
}

.provenance-frame--edition {
  border-color: color-mix(in oklab, var(--accent-bronze) 42%, var(--border-hairline));
}

.provenance-frame__tag {
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  color: var(--accent-bronze);
}

.provenance-frame__media {
  width: 100%;
  height: 156px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface-subtle);
}

.provenance-frame__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.provenance-frame--source .provenance-frame__media {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background-color: var(--surface-vitrine);
  background-image: var(--surface-vitrine-spotlight);
}

.provenance-frame--source .provenance-frame__media img {
  object-fit: contain;
  filter: drop-shadow(0 8px 16px oklch(5% 0.006 238 / 0.55));
}

.provenance-frame__caption {
  display: grid;
  gap: 0.15rem;
}

.provenance-frame__caption strong {
  font-size: var(--text-sm);
  color: var(--ink-primary);
}

.provenance-frame__caption small {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.provenance-bridge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.provenance-bridge__line {
  width: 1px;
  height: 36px;
  background: var(--border-strong);
}

.provenance-bridge em {
  writing-mode: vertical-rl;
  font-style: normal;
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--accent-bronze);
}

.provenance-loading {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.provenance-notes {
  display: grid;
  gap: var(--space-2);
}

.provenance-notes h3 {
  margin: 0;
  font-size: var(--text-md);
  font-family: var(--font-display);
  color: var(--ink-primary);
}

.provenance-notes p {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.78;
  color: var(--ink-secondary);
}

.provenance-artifact-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  width: fit-content;
  color: var(--accent-jade);
  font-size: var(--text-sm);
  font-weight: 600;
}

.provenance-boundary {
  padding: var(--space-4);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
}

.provenance-boundary strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: var(--text-xs);
  color: var(--ink-primary);
}

.provenance-boundary p {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.65;
  color: var(--ink-muted);
}

.provenance-drawer__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border-hairline);
  background: var(--surface-elevated);
}

.provenance-bookmark-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.provenance-bookmark-btn.is-saved {
  border-color: var(--accent-bronze);
  color: var(--accent-bronze);
}

.provenance-add-btn {
  flex: 1 1 200px;
}

.provenance-fade-enter-active,
.provenance-fade-leave-active {
  transition: opacity var(--duration-ui) var(--ease-curatorial);
}

.provenance-fade-enter-from,
.provenance-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .provenance-drawer__head,
  .provenance-drawer__body,
  .provenance-drawer__foot {
    padding-inline: var(--space-4);
  }

  .provenance-diptych {
    grid-template-columns: 1fr;
  }

  .provenance-bridge {
    flex-direction: row;
  }

  .provenance-bridge__line {
    width: 36px;
    height: 1px;
  }

  .provenance-bridge em {
    writing-mode: horizontal-tb;
  }
}
</style>
