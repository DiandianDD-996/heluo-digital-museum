import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamGuideChat } from './guideClient'
import type { GuideChatRequestPayload } from './guideTypes'

const samplePayload: GuideChatRequestPayload = {
  conversationId: 'conv-1',
  requestId: 'req-1',
  message: '侧面看为什么只有两条腿？',
  locale: 'zh-CN',
  context: {
    route: 'exhibit-detail',
    artifactSlug: 'heluo-bronze-ding',
    exhibitSlug: 'heluo-bronze-ding-3d',
    articleSlug: null,
  },
  history: [],
}

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe('guideClient SSE streaming & JSON fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses incremental SSE status, delta, replace, and done frames across chunk boundaries', async () => {
    const frames = [
      'event:status\ndata:{"phase":"reading_archive"}\n\n',
      'event:delta\ndata:{"text":"侧面看只有"}\n\nevent:del',
      'ta\ndata:{"text":"两条腿。"}\n\n',
      'event:done\ndata:{"requestId":"req-1","text":"侧面看只有两条腿。","citations":[],"actions":[],"followUps":["下一步看哪里？"],"boundaryNote":"","mode":"ai","degraded":false}\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(makeSseStream(frames), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    })))

    const statuses: string[] = []
    const deltas: string[] = []
    const doneResult = await streamGuideChat(samplePayload, {
      onStatus: phase => statuses.push(phase),
      onDelta: text => deltas.push(text),
    })

    expect(statuses).toEqual(['reading_archive'])
    expect(deltas).toEqual(['侧面看只有', '两条腿。'])
    expect(doneResult.mode).toBe('ai')
    expect(doneResult.followUps).toEqual(['下一步看哪里？'])
  })

  it('automatically falls back to POST /api/v1/guide/chat JSON when SSE stream drops prematurely', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(makeSseStream(['event:delta\ndata:{"text":"中断"}\n\n']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          requestId: 'req-1',
          text: '已通过 JSON 兜底返回完整讲解。',
          citations: [],
          actions: [],
          followUps: [],
          boundaryNote: '',
          mode: 'deterministic',
          degraded: true,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const replaced: string[] = []
    const res = await streamGuideChat(samplePayload, {
      onReplace: text => replaced.push(text),
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/guide/chat')
    expect(replaced).toEqual(['已通过 JSON 兜底返回完整讲解。'])
    expect(res.mode).toBe('deterministic')
  })

  it('does not trigger fallback when aborted by user', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(streamGuideChat(samplePayload, {}, controller.signal)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
