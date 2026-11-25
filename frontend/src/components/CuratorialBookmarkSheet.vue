<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { downloadCuratorialNotebookPng, plateNumeral } from '../lib/curatorialNotebookExport'
import { useLocale } from '../stores/locale'
import { useCuratorialBookmarks, type BookmarkKind, type CuratorialBookmark } from '../stores/curatorialBookmarks'

const { locale } = useLocale()
const bookmarks = useCuratorialBookmarks()
const activeFilter = ref<'all' | BookmarkKind>('all')
const exportingPng = ref(false)

const KIND_ORDER: BookmarkKind[] = ['artifact', 'exhibit', 'article', 'product']

const copy = computed(() => locale.value === 'en-US' ? {
  seal: ['HE', 'LUO'],
  title: 'Curatorial Folio',
  folioMeta: (n: number) => `${n} ${n === 1 ? 'plate' : 'plates'} · Kept locally on this device`,
  closeAria: 'Close viewing notebook',
  filterAll: 'All',
  platePrefix: 'PLATE',
  notePlaceholder: 'Write a personal viewing note…',
  noteAria: 'Personal viewing note',
  emptyVertical: 'Curatorial Folio',
  emptyBody: 'Bookmark bronze vessels, raking-light stone reliefs, essays, or store editions while exploring to bind your private monograph.',
  quickHeading: 'BEGIN WITH THESE GALLERIES',
  quickLinks: [
    { to: '/exhibits/heluo-bronze-ding-3d', no: '01', label: 'Heluo Bronze Ding · 3D & Point Cloud' },
    { to: '/exhibits/river-map-stone-raking', no: '02', label: 'River-Map Stone · Raking Light & Rubbing' },
    { to: '/explore', no: '03', label: 'Explore the Full Collection' },
  ],
  emptyFilter: 'No plates collected in this section yet.',
  removeLabel: 'Remove',
  removeAria: 'Remove from folio',
  exportPng: 'Export Illustrated Folio (.png)',
  exportingPng: 'Composing scroll…',
  clearAll: 'Clear all',
  kinds: {
    artifact: 'Object',
    exhibit: 'Exhibit',
    article: 'Essay',
    product: 'Store',
  } as Record<BookmarkKind, string>,
} : {
  seal: ['河洛', '私藏'],
  title: '河洛观展手账',
  folioMeta: (n: number) => `共录藏目 ${n} 帧 · 仅存于当前设备`,
  closeAria: '关闭观展手账',
  filterAll: '全部',
  platePrefix: '图版',
  notePlaceholder: '此刻所见 · 写下一行观展随笔…',
  noteAria: '观展随笔批注',
  emptyVertical: '笺纸尚素',
  emptyBody: '在浏览馆藏器物、斜射光石板、文化专题或河洛文创时点击「收入手账」，即可装帧成册，并一键导出专属观展长图。',
  quickHeading: '策展人推荐起手展柜',
  quickLinks: [
    { to: '/exhibits/heluo-bronze-ding-3d', no: '01', label: '河洛青铜鼎 · 三维与点云漫游' },
    { to: '/exhibits/river-map-stone-raking', no: '02', label: '河洛图纹石板 · 暗房斜射光与乌金拓' },
    { to: '/explore', no: '03', label: '前往探索全部馆藏' },
  ],
  emptyFilter: '此门类暂未收录藏目。',
  removeLabel: '移出',
  removeAria: '从手账移出',
  exportPng: '导出观展手账长图 (.png)',
  exportingPng: '正在装帧长图…',
  clearAll: '清空',
  kinds: {
    artifact: '器物',
    exhibit: '展项',
    article: '专题',
    product: '文创',
  } as Record<BookmarkKind, string>,
})

const filterTabs = computed(() => {
  const counts: Record<BookmarkKind, number> = { artifact: 0, exhibit: 0, article: 0, product: 0 }
  for (const item of bookmarks.items.value) {
    if (item.kind in counts) counts[item.kind] += 1
  }
  return [
    { id: 'all' as const, label: copy.value.filterAll, count: bookmarks.items.value.length },
    ...KIND_ORDER.map((kind) => ({
      id: kind,
      label: copy.value.kinds[kind],
      count: counts[kind],
    })),
  ]
})

const filteredItems = computed(() => {
  if (activeFilter.value === 'all') return bookmarks.items.value
  return bookmarks.items.value.filter((item) => item.kind === activeFilter.value)
})

function formatSavedStamp(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  return `${mm}·${dd}`
}

function isPanoramic(item: CuratorialBookmark): boolean {
  return Boolean(item.imageUrl?.includes('river-map-stone') || item.slug.includes('river-map-stone'))
}

const displayEntry = (item: CuratorialBookmark, idx: number) => {
  const en = locale.value === 'en-US'
  return {
    ...item,
    plateNo: plateNumeral(idx, locale.value),
    displayTitle: en ? (item.titleEn?.trim() || item.title) : item.title,
    displaySubtitle: en ? (item.subtitleEn?.trim() || item.subtitle || '') : (item.subtitle || ''),
    kindLabel: copy.value.kinds[item.kind] || item.kind,
    dateStamp: formatSavedStamp(item.savedAt),
  }
}

function onNoteInput(item: CuratorialBookmark, event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  bookmarks.updateBookmarkNote(item.kind, item.slug, target.value)
}

async function onExportPng() {
  if (exportingPng.value || bookmarks.items.value.length === 0) return
  exportingPng.value = true
  try {
    await downloadCuratorialNotebookPng(bookmarks.items.value, locale.value)
  } finally {
    exportingPng.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && bookmarks.sheetOpen.value) {
    bookmarks.closeSheet()
  }
}

watch(
  () => bookmarks.sheetOpen.value,
  (isOpen) => {
    if (isOpen && activeFilter.value !== 'all' && filteredItems.value.length === 0) {
      activeFilter.value = 'all'
    }
    if (typeof window === 'undefined') return
    if (isOpen) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="folio-fade">
      <div
        v-if="bookmarks.sheetOpen.value"
        class="folio-backdrop"
        data-testid="curatorial-bookmark-sheet"
        @click.self="bookmarks.closeSheet()"
      >
        <aside class="folio-book" role="dialog" aria-modal="true" :aria-label="copy.title">
          <!-- Traditional Four-Eye Thread-Bound Spine (线装书脊) -->
          <div class="folio-spine" aria-hidden="true">
            <span class="folio-stitch"></span>
            <span class="folio-stitch"></span>
            <span class="folio-stitch"></span>
            <span class="folio-stitch"></span>
          </div>

          <!-- Inner Bound Pages -->
          <div class="folio-pages">
            <header class="folio-head">
              <div class="folio-head__title">
                <div class="folio-head__lockup">
                  <h2>{{ copy.title }}</h2>
                  <span class="folio-chop" aria-hidden="true">
                    <i>{{ copy.seal[0] }}</i>
                    <i>{{ copy.seal[1] }}</i>
                  </span>
                </div>
                <p class="folio-head__meta">{{ copy.folioMeta(bookmarks.count.value) }}</p>
              </div>
              <button
                type="button"
                class="folio-close"
                :aria-label="copy.closeAria"
                @click="bookmarks.closeSheet()"
              >
                ×
              </button>
            </header>

            <!-- Minimalist Editorial Index Bar (Zero Pill Chips) -->
            <nav
              v-if="bookmarks.items.value.length > 0"
              class="folio-index"
              :aria-label="copy.title"
            >
              <button
                v-for="tab in filterTabs"
                :key="tab.id"
                type="button"
                class="folio-index__tab"
                :class="{ 'is-active': activeFilter === tab.id }"
                :aria-pressed="activeFilter === tab.id"
                @click="activeFilter = tab.id"
              >
                <span>{{ tab.label }}</span>
                <sup v-if="tab.count > 0" class="font-mono">{{ tab.count }}</sup>
              </button>
            </nav>

            <!-- Bound Monograph Body -->
            <div class="folio-body">
              <!-- Art-Book Opening Empty Page -->
              <div v-if="bookmarks.items.value.length === 0" class="folio-blank">
                <div class="folio-blank__hero">
                  <strong class="folio-blank__vertical" :class="{ 'is-latin': locale === 'en-US' }">
                    {{ copy.emptyVertical }}
                  </strong>
                  <span class="folio-chop folio-chop--lg" aria-hidden="true">
                    <i>{{ copy.seal[0] }}</i>
                    <i>{{ copy.seal[1] }}</i>
                  </span>
                </div>
                <p class="folio-blank__body">{{ copy.emptyBody }}</p>

                <div class="folio-blank__routes">
                  <p class="folio-blank__heading">{{ copy.quickHeading }}</p>
                  <RouterLink
                    v-for="link in copy.quickLinks"
                    :key="link.to"
                    class="folio-blank__link"
                    :to="link.to"
                    @click="bookmarks.closeSheet()"
                  >
                    <span class="font-mono">{{ link.no }}</span>
                    <strong>{{ link.label }}</strong>
                    <i aria-hidden="true">→</i>
                  </RouterLink>
                </div>
              </div>

              <p v-else-if="filteredItems.length === 0" class="folio-filter-empty">
                {{ copy.emptyFilter }}
              </p>

              <!-- Numbered Monograph Gallery Plates (Unboxed Editorial Flow) -->
              <ol v-else class="folio-plates">
                <li
                  v-for="(raw, idx) in filteredItems"
                  :key="`${raw.kind}:${raw.slug}`"
                  class="folio-plate"
                >
                  <div class="folio-plate__bar">
                    <span class="folio-plate__num">
                      {{ copy.platePrefix }} {{ displayEntry(raw, idx).plateNo }} · {{ displayEntry(raw, idx).kindLabel }}
                    </span>
                    <div class="folio-plate__bar-right">
                      <span v-if="displayEntry(raw, idx).dateStamp" class="folio-plate__date font-mono">
                        {{ displayEntry(raw, idx).dateStamp }}
                      </span>
                      <button
                        type="button"
                        class="folio-plate__remove"
                        :aria-label="`${copy.removeAria}: ${displayEntry(raw, idx).displayTitle}`"
                        @click="bookmarks.removeBookmark(raw.kind, raw.slug)"
                      >
                        {{ copy.removeLabel }}
                      </button>
                    </div>
                  </div>

                  <RouterLink
                    class="folio-plate__figure-link"
                    :to="raw.path"
                    @click="bookmarks.closeSheet()"
                  >
                    <div
                      class="folio-plate__mat"
                      :class="{ 'is-panoramic': isPanoramic(raw) }"
                    >
                      <img
                        v-if="raw.imageUrl"
                        :src="raw.imageUrl"
                        :alt="displayEntry(raw, idx).displayTitle"
                        loading="lazy"
                        decoding="async"
                      />
                      <span v-else class="folio-plate__monogram">
                        {{ displayEntry(raw, idx).displayTitle.slice(0, 2) }}
                      </span>
                    </div>

                    <div class="folio-plate__caption">
                      <h3>{{ displayEntry(raw, idx).displayTitle }}</h3>
                      <p v-if="displayEntry(raw, idx).displaySubtitle">{{ displayEntry(raw, idx).displaySubtitle }}</p>
                    </div>
                  </RouterLink>

                  <!-- Ruled Manuscript Margin Note (朱丝栏批注) -->
                  <label class="folio-note">
                    <span class="folio-note__bar" aria-hidden="true"></span>
                    <input
                      type="text"
                      maxlength="140"
                      data-testid="bookmark-note-input"
                      :value="raw.note ?? ''"
                      :placeholder="copy.notePlaceholder"
                      :aria-label="`${copy.noteAria}: ${displayEntry(raw, idx).displayTitle}`"
                      @input="onNoteInput(raw, $event)"
                    />
                  </label>
                </li>
              </ol>
            </div>

            <!-- Colophon Footer with Illustrated Scroll Export -->
            <footer v-if="bookmarks.items.value.length > 0" class="folio-foot">
              <button
                type="button"
                class="folio-export-btn"
                data-testid="notebook-export-png"
                :disabled="exportingPng"
                @click="onExportPng"
              >
                {{ exportingPng ? copy.exportingPng : copy.exportPng }}
              </button>
              <button
                type="button"
                class="folio-clear-btn"
                @click="bookmarks.clearBookmarks()"
              >
                {{ copy.clearAll }}
              </button>
            </footer>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.folio-backdrop {
  position: fixed;
  inset: 0;
  z-index: 96;
  display: flex;
  justify-content: flex-end;
  background: oklch(9% 0.006 238 / 0.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* ── Physical Thread-Bound Monograph Book ── */
.folio-book {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  width: min(100vw, 500px);
  height: 100dvh;
  background: var(--surface-canvas);
  box-shadow: -28px 0 72px -18px oklch(6% 0.006 238 / 0.56);
  color: var(--ink-primary);
}

/* Four-Eye Traditional Stitched Spine (线装四眼书脊) */
.folio-spine {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
  background: color-mix(in oklch, var(--accent-bronze) 6%, var(--surface-subtle));
  border-right: 1px solid color-mix(in oklch, var(--accent-bronze) 22%, var(--border-strong));
}

.folio-spine::after {
  content: '';
  position: absolute;
  top: 6%;
  bottom: 6%;
  right: 5px;
  width: 1px;
  background: color-mix(in oklch, var(--accent-bronze) 26%, transparent);
}

.folio-stitch {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 2px;
  background: color-mix(in oklch, var(--accent-bronze) 64%, var(--ink-muted));
}

.folio-stitch::before {
  content: '';
  position: absolute;
  right: -2px;
  top: -2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  border: 1px solid color-mix(in oklch, var(--accent-bronze) 70%, var(--ink-muted));
  background: var(--surface-canvas);
}

.folio-pages {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background:
    linear-gradient(90deg, oklch(12% 0.01 72 / 0.04) 0%, transparent 18px),
    var(--surface-canvas);
}

/* ── Book Header ── */
.folio-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 1.75rem 1.75rem 1.2rem;
  border-bottom: 1px solid var(--border-hairline);
}

.folio-head__title {
  display: grid;
  gap: 0.35rem;
}

.folio-head__lockup {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.folio-head__lockup h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.3rem, 2.4vw, 1.55rem);
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--ink-primary);
}

.folio-chop {
  display: grid;
  grid-template-rows: 1fr 1fr;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1.4px solid var(--accent-seal);
  background: color-mix(in oklch, var(--accent-seal) 8%, transparent);
  color: var(--accent-seal);
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  transform: rotate(-3deg);
}

.folio-chop i {
  font-style: normal;
}

.folio-chop--lg {
  width: 38px;
  height: 38px;
  font-size: 12px;
}

.folio-head__meta {
  margin: 0;
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}

.folio-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -0.35rem -0.5rem 0 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: 1.5rem;
  cursor: pointer;
  transition: color 180ms var(--ease-curatorial);
}

.folio-close:hover {
  color: var(--ink-primary);
}

/* ── Minimalist Typographic Index (Zero Pills) ── */
.folio-index {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0 1.75rem;
  border-bottom: 1px solid var(--border-hairline);
  overflow-x: auto;
  scrollbar-width: none;
}

.folio-index::-webkit-scrollbar {
  display: none;
}

.folio-index__tab {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 180ms var(--ease-curatorial);
}

.folio-index__tab sup {
  font-size: 11px;
  opacity: 0.72;
}

.folio-index__tab:hover {
  color: var(--ink-primary);
}

.folio-index__tab.is-active {
  color: var(--ink-primary);
  font-weight: 600;
}

.folio-index__tab.is-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--accent-seal);
}

/* ── Scrollable Monograph Body ── */
.folio-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem 1.75rem 2rem;
}

/* ── Art-Book Opening Empty Page ── */
.folio-blank {
  display: grid;
  gap: 2rem;
  padding-top: 1.25rem;
}

.folio-blank__hero {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.85rem;
  padding: 2rem 0 0.75rem;
}

.folio-blank__vertical {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: 0.28em;
  color: var(--ink-primary);
}

.folio-blank__vertical.is-latin {
  writing-mode: horizontal-tb;
  letter-spacing: 0.04em;
}

.folio-blank__body {
  margin: 0 auto;
  max-width: 34ch;
  text-align: center;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  line-height: 1.85;
  color: var(--ink-secondary);
}

.folio-blank__routes {
  display: grid;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-hairline);
}

.folio-blank__heading {
  margin: 0 0 0.5rem;
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: var(--accent-bronze);
}

.folio-blank__link {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  min-height: 48px;
  border-bottom: 1px solid var(--border-hairline);
  color: var(--ink-primary);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  transition: color 180ms var(--ease-curatorial);
}

.folio-blank__link span {
  font-size: var(--text-xs);
  color: var(--accent-bronze);
}

.folio-blank__link i {
  font-style: normal;
  color: var(--ink-muted);
  transition: transform 180ms var(--ease-curatorial);
}

.folio-blank__link:hover {
  color: var(--accent-bronze);
}

.folio-blank__link:hover i {
  transform: translateX(3px);
}

.folio-filter-empty {
  margin: 3rem 0;
  text-align: center;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}

/* ── Numbered Monograph Plates (Unboxed Editorial Flow) ── */
.folio-plates {
  display: grid;
  gap: 2.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.folio-plate {
  display: grid;
  gap: 0.85rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border-hairline);
}

.folio-plate:last-child {
  padding-bottom: 0.5rem;
  border-bottom: 0;
}

.folio-plate__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.folio-plate__num {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--accent-bronze);
}

.folio-plate__bar-right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.folio-plate__date {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.folio-plate__remove {
  min-height: 36px;
  padding: 0 0.25rem;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: color 180ms var(--ease-curatorial);
}

.folio-plate__remove:hover {
  color: var(--accent-seal);
}

.folio-plate__figure-link {
  display: grid;
  gap: 0.75rem;
}

/* Generous Full-Width Gallery Photograph Mat (Zero Artifact Cropping) */
.folio-plate__mat {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 10;
  padding: 0.75rem;
  border: 1px solid color-mix(in oklch, var(--accent-bronze) 28%, var(--border-hairline));
  background-color: var(--surface-vitrine);
  background-image: var(--surface-vitrine-spotlight);
  overflow: hidden;
}

.folio-plate__mat img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  object-position: center;
  filter: drop-shadow(0 10px 22px oklch(5% 0.006 238 / 0.55));
  transition: transform 520ms var(--ease-curatorial);
}

.folio-plate__mat.is-panoramic {
  padding: 0.85rem 1rem;
}

.folio-plate__mat.is-panoramic img {
  width: 100%;
  height: auto;
  max-height: 100%;
}

.folio-plate__figure-link:hover .folio-plate__mat img {
  transform: scale(1.03);
}

.folio-plate__monogram {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: var(--surface-subtle);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  letter-spacing: 0.2em;
  color: var(--accent-bronze);
}

.folio-plate__caption {
  display: grid;
  gap: 0.18rem;
}

.folio-plate__caption h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ink-primary);
}

.folio-plate__caption p {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.6;
  color: var(--ink-muted);
}

/* Ruled Xuan-Paper Manuscript Margin Note (朱丝栏批注) */
.folio-note {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.35rem 0;
}

.folio-note__bar {
  flex-shrink: 0;
  width: 2px;
  height: 18px;
  background: color-mix(in oklch, var(--accent-seal) 68%, transparent);
}

.folio-note input {
  width: 100%;
  min-height: 36px;
  padding: 0.2rem 0;
  border: 0;
  border-bottom: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--ink-secondary);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  line-height: 1.5;
  outline: none;
  transition: border-color 180ms var(--ease-curatorial), color 180ms var(--ease-curatorial);
}

.folio-note input::placeholder {
  color: var(--ink-muted);
  opacity: 0.72;
}

.folio-note input:focus {
  border-bottom-style: solid;
  border-bottom-color: var(--accent-seal);
  color: var(--ink-primary);
}

/* ── Colophon Footer ── */
.folio-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 1rem 1.75rem 1.25rem;
  border-top: 1px solid var(--border-hairline);
}

.folio-export-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1.25rem;
  border: 1px solid var(--accent-jade);
  border-radius: var(--radius-xs);
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background-color 180ms var(--ease-curatorial), opacity 180ms var(--ease-curatorial);
}

.folio-export-btn:hover:not(:disabled) {
  background: var(--accent-jade-hover);
}

.folio-clear-btn {
  min-height: 44px;
  padding: 0 0.5rem;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-xs);
  letter-spacing: 0.06em;
  cursor: pointer;
}

.folio-clear-btn:hover {
  color: var(--accent-seal);
}

/* ── Book Drawer Transition ── */
.folio-fade-enter-active,
.folio-fade-leave-active {
  transition: opacity 240ms var(--ease-curatorial);
}

.folio-fade-enter-active .folio-book,
.folio-fade-leave-active .folio-book {
  transition: transform 320ms var(--ease-curatorial);
}

.folio-fade-enter-from,
.folio-fade-leave-to {
  opacity: 0;
}

.folio-fade-enter-from .folio-book,
.folio-fade-leave-to .folio-book {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .folio-fade-enter-active,
  .folio-fade-leave-active,
  .folio-fade-enter-active .folio-book,
  .folio-fade-leave-active .folio-book,
  .folio-plate__mat img {
    transition: none;
  }
}
</style>
