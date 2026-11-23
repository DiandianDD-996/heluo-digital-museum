import type {
  GuideChatRequestPayload,
  GuideChatResponse,
  GuideStreamStatusPhase,
} from './guideTypes'

export interface GuideStreamCallbacks {
  onStatus?: (phase: GuideStreamStatusPhase) => void
  onDelta?: (text: string) => void
  onReplace?: (text: string) => void
  onDone?: (response: GuideChatResponse) => void
}

export class GuideClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'GuideClientError'
    this.status = status
    this.code = code
  }
}

interface ApiEnvelope<T> {
  data?: T
  message?: string
  code?: string
}

/**
 * Primary SSE streaming call to POST /api/v1/guide/chat/stream with automatic
 * fallback to non-streaming POST /api/v1/guide/chat (same idempotent requestId).
 */
export async function streamGuideChat(
  payload: GuideChatRequestPayload,
  callbacks: GuideStreamCallbacks,
  signal?: AbortSignal,
): Promise<GuideChatResponse> {
  try {
    return await executeSseRequest(payload, callbacks, signal)
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err
    }
    if (err instanceof GuideClientError && (err.status === 403 || err.status === 422 || err.status === 429)) {
      throw err
    }
    // Automatic JSON fallback on transport/SSE stream interruption
    const fallbackResponse = await executeJsonFallback(payload, signal)
    callbacks.onReplace?.(fallbackResponse.text)
    callbacks.onDone?.(fallbackResponse)
    return fallbackResponse
  }
}

async function executeSseRequest(
  payload: GuideChatRequestPayload,
  callbacks: GuideStreamCallbacks,
  signal?: AbortSignal,
): Promise<GuideChatResponse> {
  const response = await fetch('/api/v1/guide/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errBody = await safeReadJson<ApiEnvelope<unknown>>(response)
    throw new GuideClientError(
      errBody?.message || `Guide stream failed (${response.status})`,
      response.status,
      errBody?.code || 'GUIDE_HTTP_ERROR',
    )
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const envelope = (await response.json()) as ApiEnvelope<GuideChatResponse>
    if (!envelope.data) throw new GuideClientError('Empty guide JSON payload', 502, 'EMPTY_PAYLOAD')
    callbacks.onDelta?.(envelope.data.text)
    callbacks.onDone?.(envelope.data)
    return envelope.data
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new GuideClientError('ReadableStream unsupported', 0, 'NO_STREAM_READER')
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let donePayload: GuideChatResponse | null = null

  const dispatchFrame = (rawFrame: string) => {
    const lines = rawFrame.split(/\r?\n/)
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
    if (!dataLines.length) return
    const dataStr = dataLines.join('\n')
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(dataStr) as Record<string, unknown>
    } catch {
      return
    }
    if (eventName === 'status' && typeof parsed.phase === 'string') {
      callbacks.onStatus?.(parsed.phase as GuideStreamStatusPhase)
    } else if (eventName === 'delta' && typeof parsed.text === 'string') {
      callbacks.onDelta?.(parsed.text)
    } else if (eventName === 'replace' && typeof parsed.text === 'string') {
      callbacks.onReplace?.(parsed.text)
    } else if (eventName === 'done') {
      donePayload = parsed as unknown as GuideChatResponse
      callbacks.onDone?.(donePayload)
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        if (frame.trim()) dispatchFrame(frame)
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) {
      for (const frame of buffer.split(/\r?\n\r?\n/)) {
        if (frame.trim()) dispatchFrame(frame)
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!donePayload) {
    throw new GuideClientError('SSE stream ended before done event', 502, 'INCOMPLETE_STREAM')
  }
  return donePayload
}

export async function executeJsonFallback(
  payload: GuideChatRequestPayload,
  signal?: AbortSignal,
): Promise<GuideChatResponse> {
  const response = await fetch('/api/v1/guide/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })
  const envelope = await safeReadJson<ApiEnvelope<GuideChatResponse>>(response)
  if (!response.ok || !envelope?.data) {
    throw new GuideClientError(
      envelope?.message || `Guide request failed (${response.status})`,
      response.status,
      envelope?.code || 'GUIDE_HTTP_ERROR',
    )
  }
  return envelope.data
}

async function safeReadJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}
