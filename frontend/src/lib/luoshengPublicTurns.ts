import { ApiRequestError, apiRequest } from './api'
import type { GuideStop } from './luoshengPreview'
import ui from '../assets/guide/ui.zh-CN.json'

type PublicTurn = {
  question: string; requestId: string; visitId: string; contextVersion: number
  locale: string; artifact: string; exhibit: string; lookpoint: string | null
}
type Citation = { reference: { cardId: string; revision: number }; publicSource: string | null }
type PublicReply = { kind: string; text: string | null; citations: Citation[]; generated: boolean; plate?: string }

const fallback: Record<string, string> = {
  CLARIFY: ui.site.choosePoint,
  INSUFFICIENT_EVIDENCE: ui.insufficient.title,
  DISPUTED_EVIDENCE: ui.site.disputed,
}

const readingFallback: Record<string, string> = {
  QUESTIONING_DISABLED: ui.errors.paused,
  SESSION_RATE_LIMITED: ui.site.rateLimited,
  GENERATION_TIMEOUT: ui.errors.timeout,
  GENERATION_UNAVAILABLE: ui.errors.generation,
  GENERATION_BUSY: ui.errors.busy,
  GENERATION_LIMIT_REACHED: ui.errors.limit,
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
    return { label: ui.site.revision.replace('{revision}', String(citation.reference.revision))
      .replace('{cardId}', () => citation.reference.cardId), source }
  })
  const plate: GuideStop | undefined = result.plate === 'ear' || result.plate === 'feet' || result.plate === 'motif'
    ? result.plate : undefined
  return {
    text: result.text ?? fallback[result.kind] ?? ui.errors.generation,
    citations, plate, generated: result.generated, clarification: result.kind === 'CLARIFY',
    // Keep the fallback presentation separate from the API's evidence decision.
    insufficient: result.kind === 'INSUFFICIENT_EVIDENCE' || result.kind === 'DISPUTED_EVIDENCE',
  }
}
