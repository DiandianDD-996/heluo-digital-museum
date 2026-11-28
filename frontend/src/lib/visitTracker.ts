const VISITOR_STORAGE_KEY = 'heluo.vid'
const DEDUPE_WINDOW_MS = 5_000

const ROUTE_TYPE_MAP: Record<string, string> = {
  home: 'HOME',
  explore: 'EXPLORE',
  'artifact-detail': 'ARTIFACT',
  'article-detail': 'ARTICLE',
  exhibits: 'EXHIBITS',
  'exhibit-detail': 'EXHIBIT',
  appointment: 'APPOINTMENT',
  shop: 'SHOP',
}

let lastTrackedPath = ''
let lastTrackedAt = 0

function resolveVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY)
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
      return existing
    }
    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(VISITOR_STORAGE_KEY, generated)
    return generated
  } catch {
    return ''
  }
}

export interface TrackableRoute {
  name?: string | symbol | null
  path: string
  params?: Record<string, unknown>
}

/**
 * Sends a lightweight, non-blocking page view ping for public museum routes.
 * Fails silently so visitor experience and navigation are never affected.
 */
export function trackPageView(route: TrackableRoute): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  const routeName = String(route.name ?? '')
  const routeType = ROUTE_TYPE_MAP[routeName]
  if (!routeType) return

  const now = Date.now()
  if (route.path === lastTrackedPath && now - lastTrackedAt < DEDUPE_WINDOW_MS) {
    return
  }
  lastTrackedPath = route.path
  lastTrackedAt = now

  const slug = typeof route.params?.slug === 'string' ? route.params.slug : ''
  const rawTitle = typeof document !== 'undefined' ? document.title.split('|')[0]?.trim() ?? '' : ''
  const payload = JSON.stringify({
    routeType,
    targetSlug: slug,
    targetTitle: rawTitle.slice(0, 200),
    visitorId: resolveVisitorId(),
  })

  void fetch('/api/v1/analytics/page-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}
