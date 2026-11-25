interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number
}

const MAX_ENTRIES = 18
const DEFAULT_TTL_MS = 45_000

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<unknown>>()
const warmedImages = new Set<string>()

export function readPrefetchCache<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  // Refresh LRU recency
  cache.delete(key)
  cache.set(key, entry)
  return entry.value as T
}

export function writePrefetchCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

export function clearPrefetchCache(): void {
  cache.clear()
  inFlight.clear()
}

export function warmImageUrl(url?: string | null): void {
  if (!url || typeof window === 'undefined' || warmedImages.has(url)) return
  warmedImages.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

export function prefetchOnce<T>(key: string, fetcher: () => Promise<T>): Promise<T | undefined> {
  const cached = readPrefetchCache<T>(key)
  if (cached !== undefined) return Promise.resolve(cached)
  const existing = inFlight.get(key) as Promise<T | undefined> | undefined
  if (existing) return existing

  const task = fetcher()
    .then((data) => {
      writePrefetchCache(key, data)
      return data
    })
    .catch(() => undefined)
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, task)
  return task
}

export function schedulePrefetch(
  key: string,
  fetcher: () => Promise<unknown>,
  options: { delayMs?: number; imageUrl?: string | null } = {},
): () => void {
  if (typeof window === 'undefined') return () => undefined
  const delayMs = options.delayMs ?? 120
  const timer = window.setTimeout(() => {
    warmImageUrl(options.imageUrl)
    void prefetchOnce(key, fetcher)
  }, delayMs)
  return () => window.clearTimeout(timer)
}
