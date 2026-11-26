import { apiGet, type ContentPage } from './api'
import { prefetchOnce, warmImageUrl } from './prefetch'
import type { ArticleCard, ArtifactCard, Category } from './content'

const preloadedChunks = new Set<string>()
let idleWarmed = false

const chunkLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('../views/HomeView.vue'),
  '/explore': () => import('../views/ExploreView.vue'),
  '/exhibits': () => import('../views/ExhibitsView.vue'),
  '/shop': () => import('../views/ShopView.vue'),
  '/appointment': () => import('../views/AppointmentView.vue'),
  '/login': () => import('../views/LoginView.vue'),
  '/profile': () => import('../views/ProfileView.vue'),
}

function normalizePath(rawPath: string): string {
  const clean = rawPath.split('?')[0]?.split('#')[0] ?? '/'
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1)
  return clean || '/'
}

function isDataConstrained(): boolean {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (!conn) return false
  return Boolean(conn.saveData || /^(slow-)?2g$/i.test(conn.effectiveType ?? ''))
}

function preloadChunk(path: string): void {
  const loader = chunkLoaders[path]
  if (!loader || preloadedChunks.has(path)) return
  preloadedChunks.add(path)
  void loader().catch(() => {
    preloadedChunks.delete(path)
  })
}

export function prefetchRouteData(path: string): void {
  const normalized = normalizePath(path)
  if (normalized === '/explore') {
    void prefetchOnce('/categories', () => apiGet<Category[]>('/categories'))
    void prefetchOnce('/artifacts?page=1&size=12', () => apiGet<ContentPage<ArtifactCard>>('/artifacts?page=1&size=12'))
    void prefetchOnce('/articles?page=1&size=12', () => apiGet<ContentPage<ArticleCard>>('/articles?page=1&size=12'))
    warmImageUrl('/media/responsive/explore-bronze-ding-user-v2-640w.webp')
    return
  }
  if (normalized === '/exhibits') {
    void prefetchOnce('/exhibits', () => apiGet('/exhibits'))
    warmImageUrl('/media/responsive/explore-bronze-ding-user-v2-640w.webp')
    warmImageUrl('/media/responsive/explore-river-map-stone-user-v2-640w.webp')
    return
  }
  if (normalized === '/shop') {
    void prefetchOnce('/products', () => apiGet('/products'))
    warmImageUrl('/media/responsive/river-line-teacup-set-640w.webp')
    warmImageUrl('/media/responsive/heluo-silk-scarf-640w.webp')
    warmImageUrl('/media/responsive/river-map-notebook-640w.webp')
    return
  }
  if (normalized === '/appointment') {
    void prefetchOnce('/appointment-slots', () => apiGet('/appointment-slots'))
  }
}

export function prefetchRoute(rawPath: string): void {
  if (typeof window === 'undefined') return
  const path = normalizePath(rawPath)
  preloadChunk(path)
  if (!isDataConstrained()) {
    prefetchRouteData(path)
  }
}

export function warmPublicRoutesOnIdle(): void {
  // Touch navigation still uses on-intent prefetch without competing with first paint.
  if (idleWarmed || typeof window === 'undefined' || isDataConstrained()
    || window.matchMedia?.('(pointer: coarse)').matches) return
  idleWarmed = true

  const warm = () => {
    for (const path of ['/explore', '/exhibits', '/shop', '/appointment']) {
      preloadChunk(path)
    }
    void prefetchOnce('/categories', () => apiGet<Category[]>('/categories'))
    void prefetchOnce('/exhibits', () => apiGet('/exhibits'))
    void prefetchOnce('/products', () => apiGet('/products'))
  }

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(warm, { timeout: 2000 })
  } else {
    window.setTimeout(warm, 900)
  }
}
