import { computed, ref } from 'vue'

export type BookmarkKind = 'artifact' | 'article' | 'exhibit' | 'product'

export interface CuratorialBookmark {
  kind: BookmarkKind
  slug: string
  title: string
  titleEn?: string | null
  subtitle?: string | null
  subtitleEn?: string | null
  imageUrl?: string | null
  path: string
  savedAt: string
  note?: string
}

const STORAGE_KEY = 'heluo.curatorial.bookmarks.v1'
const MAX_BOOKMARKS = 60

function readInitialBookmarks(): CuratorialBookmark[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CuratorialBookmark => (
      Boolean(item)
      && typeof item.kind === 'string'
      && typeof item.slug === 'string'
      && typeof item.title === 'string'
      && typeof item.path === 'string'
    )).slice(0, MAX_BOOKMARKS)
  } catch {
    return []
  }
}

const bookmarks = ref<CuratorialBookmark[]>(readInitialBookmarks())
const sheetOpen = ref(false)

function persistBookmarks(list: CuratorialBookmark[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    }
  } catch {
    // Non-fatal in private browsing or restricted storage environments.
  }
}

export function useCuratorialBookmarks() {
  const count = computed(() => bookmarks.value.length)

  function isBookmarked(kind: BookmarkKind, slug: string): boolean {
    return bookmarks.value.some((entry) => entry.kind === kind && entry.slug === slug)
  }

  function toggleBookmark(input: Omit<CuratorialBookmark, 'savedAt'>): boolean {
    const existingIndex = bookmarks.value.findIndex(
      (entry) => entry.kind === input.kind && entry.slug === input.slug,
    )
    if (existingIndex >= 0) {
      const next = bookmarks.value.filter((_, idx) => idx !== existingIndex)
      bookmarks.value = next
      persistBookmarks(next)
      return false
    }
    const added: CuratorialBookmark = {
      ...input,
      savedAt: new Date().toISOString(),
    }
    const next = [added, ...bookmarks.value].slice(0, MAX_BOOKMARKS)
    bookmarks.value = next
    persistBookmarks(next)
    return true
  }

  function updateBookmarkNote(kind: BookmarkKind, slug: string, note: string) {
    const trimmed = note.slice(0, 140)
    const next = bookmarks.value.map((entry) => (
      entry.kind === kind && entry.slug === slug
        ? { ...entry, note: trimmed }
        : entry
    ))
    bookmarks.value = next
    persistBookmarks(next)
  }

  function removeBookmark(kind: BookmarkKind, slug: string) {
    const next = bookmarks.value.filter((entry) => !(entry.kind === kind && entry.slug === slug))
    bookmarks.value = next
    persistBookmarks(next)
  }

  function clearBookmarks() {
    bookmarks.value = []
    persistBookmarks([])
  }

  function openSheet() {
    sheetOpen.value = true
  }

  function closeSheet() {
    sheetOpen.value = false
  }

  function reloadFromStorage() {
    bookmarks.value = readInitialBookmarks()
  }

  return {
    items: bookmarks,
    count,
    sheetOpen,
    isBookmarked,
    toggleBookmark,
    updateBookmarkNote,
    removeBookmark,
    clearBookmarks,
    openSheet,
    closeSheet,
    reloadFromStorage,
  }
}
