import { ApiRequestError, apiRequest } from './api'
import type { GuideStop } from './luoshengPreview'

type PublicTurn = {
  question: string; requestId: string; visitId: string; contextVersion: number
  locale: string; artifact: string; exhibit: string; lookpoint: string | null
}
type Citation = { reference: { cardId: string; revision: number }; publicSource: string | null }
type PublicReply = { kind: string; text: string | null; citations: Citation[]; generated: boolean; plate?: string }

const fallback: Record<string, string> = {
  CLARIFY: '你想看鼎耳、鼎足，还是器身上的纹样？',
  INSUFFICIENT_EVIDENCE: '我手头的已审资料还回答不了这个问题。可以继续阅读这件展品的公开资料。',
  DISPUTED_EVIDENCE: '现有资料的说法不一致，暂时不能确认。',
}

const readingFallback: Record<string, string> = {
  QUESTIONING_DISABLED: '自由问答已暂停。你仍可阅读公开展签。',
  SESSION_RATE_LIMITED: '问得有点快。可以先看看展签，稍后再问。',
  GENERATION_TIMEOUT: '这次回答超时了。你仍可阅读公开展签。',
  GENERATION_UNAVAILABLE: '自由问答暂不可用。你仍可阅读公开展签。',
  GENERATION_BUSY: '洛笙正在回答其他游客的问题。可以先看看展签。',
  GENERATION_LIMIT_REACHED: '今天的自由问答额度已用完。你仍可阅读公开展签。',
}

export async function askPublicGuide(input: PublicTurn, signal: AbortSignal) {
  let result: PublicReply
  try {
    result = await apiRequest<PublicReply>('/guide/turns', 'POST', input, undefined, undefined, { signal, timeoutMs: 8_000 })
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof ApiRequestError && error.code === 'REQUEST_TIMEOUT') {
      return { text: readingFallback.GENERATION_TIMEOUT!, readingFallback: true as const }
    }
    throw error
  }
  if (Object.hasOwn(readingFallback, result.kind)) {
    return { text: readingFallback[result.kind]!, readingFallback: true as const }
  }
  const citations = result.citations.map(citation => {
    let source: string | undefined
    try {
      const candidate = new URL(citation.publicSource ?? '')
      if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) source = candidate.href
    } catch {
      // A card can identify a guide plate without an external record.
    }
    return { label: `${citation.reference.cardId} · 修订 ${citation.reference.revision}`, source }
  })
  const plate: GuideStop | undefined = result.plate === 'ear' || result.plate === 'feet' || result.plate === 'motif'
    ? result.plate : undefined
  return {
    text: result.text ?? fallback[result.kind] ?? '自由问答暂不可用，可以继续阅读公开展签。',
    citations, plate, generated: result.generated, clarification: result.kind === 'CLARIFY',
  }
}
