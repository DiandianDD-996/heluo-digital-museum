import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPrefetchCache, readPrefetchCache } from './prefetch'
import { prefetchRoute, prefetchRouteData } from './routePrefetch'

describe('routePrefetch', () => {
  afterEach(() => {
    clearPrefetchCache()
    vi.restoreAllMocks()
  })

  it('prefetches public catalog endpoints for /exhibits and /shop into prefetch cache', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('/exhibits')
        ? [{ slug: 'heluo-bronze-ding-3d', title: 'Bronze Ding' }]
        : [{ id: 1, slug: 'river-line-teacup-set', name: 'Teacup Set' }]
      return new Response(JSON.stringify({ code: 'OK', message: 'ok', data, requestId: 'req-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    prefetchRouteData('/exhibits')
    prefetchRouteData('/shop')
    await vi.waitFor(() => {
      expect(readPrefetchCache('/exhibits')).toEqual([{ slug: 'heluo-bronze-ding-3d', title: 'Bronze Ding' }])
      expect(readPrefetchCache('/products')).toEqual([{ id: 1, slug: 'river-line-teacup-set', name: 'Teacup Set' }])
    })
  })

  it('normalizes query strings and trailing slashes when prefetching a route', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      code: 'OK',
      message: 'ok',
      data: [{ id: 10, visitDate: '2026-12-01', startTime: '09:00', endTime: '11:00', remainingPeople: 20 }],
      requestId: 'req-2',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    prefetchRoute('/appointment/?date=2026-12-01')
    await vi.waitFor(() => {
      expect(readPrefetchCache('/appointment-slots')).toHaveLength(1)
    })
  })
})
