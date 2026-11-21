import type { GuideStop } from './luoshengPreview'

export type GuidePlate = GuideStop
const museumReference = 'https://www.clevelandart.org/art/1962.281'
const reviewedPreview = import.meta.env.DEV && import.meta.env.VITE_GUIDE_REVIEWED_PREVIEW === 'true'
type FixtureReply = { text: string; sources?: string[]; plate?: GuidePlate; readingFallback?: true;
  generated?: boolean; observations?: GuidePlate[] }

async function post(path: 'context' | 'turns', data: object, signal: AbortSignal, modelMode: boolean) {
  const response = await fetch(`/api/v1/__guide-test/${path}`, {
    method: 'POST',
    headers: modelMode
      ? { 'Content-Type': 'application/json', 'X-Guide-Mode': 'model' }
      : { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error('Guide fixture unavailable')
  const result = await response.json()
  if (result?.code !== 'OK' || result.data?.synthetic !== !modelMode) {
    throw new Error('Unexpected guide fixture response')
  }
  return result.data
}

export async function askLuoshengHttpFixture(
  question: string,
  lookpoint: string | null,
  contextId: string,
  signal: AbortSignal,
  modelMode = false,
): Promise<FixtureReply> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(modelMode ? 15_000 : 8_000)])
  await post('context', { lookpoint, contextId }, requestSignal, modelMode)
  const answer = await post('turns', { question, requestId: crypto.randomUUID() }, requestSignal, modelMode)
  if (modelMode && answer.kind === 'GUIDE_INFO' && typeof answer.text === 'string' && answer.text.trim()) {
    return { text: answer.text }
  }
  if (answer.kind === 'CLARIFY') return { text: '你想看鼎耳、鼎足，还是器身上的纹样？' }
  if (modelMode && answer.kind === 'INSUFFICIENT_EVIDENCE') return {
    text: '我手边的展品资料还回答不了这个问题。要不要一起看看鼎耳、三足或纹样？', readingFallback: true,
  }
  if (modelMode && ['GENERATION_TIMEOUT', 'GENERATION_BUSY', 'GENERATION_LIMIT_REACHED'].includes(answer.kind)) {
    return { text: '实时问答暂时不可用，仍可阅读当前看点的讲解。', readingFallback: true }
  }
  if (answer.kind === 'INSUFFICIENT_EVIDENCE') return { text: '测试资料不足，暂时无法回答。', readingFallback: true }
  if (answer.kind === 'DISPUTED_EVIDENCE') return { text: '现有测试资料的说法不一致，暂时不能确认。', readingFallback: true }
  if (answer.kind === 'GENERATION_TIMEOUT') return { text: '这次模拟问答超时了，仍可阅读当前看点的讲解。', readingFallback: true }
  if (answer.kind === 'GENERATION_BUSY') return { text: '模拟问答正忙，仍可阅读当前看点的讲解。', readingFallback: true }
  if (answer.kind === 'GENERATION_LIMIT_REACHED') return { text: '今天的模拟问答次数已用完，仍可阅读当前看点的讲解。', readingFallback: true }
  if (answer.kind === 'SESSION_RATE_LIMITED') return { text: '问得有点快，稍后可以再问。也可以先看当前讲解。', readingFallback: true }
  if (answer.kind === 'QUESTIONING_DISABLED') return { text: '自由问答已暂停，图版和展签讲解仍可查看。', readingFallback: true }
  if (answer.kind === 'GENERATION_UNAVAILABLE') throw new Error('Guide fixture generation unavailable')
  if ((answer.kind !== 'EVIDENCE' && answer.kind !== 'FIND_SPOT_UNKNOWN'
      && answer.kind !== 'PLATE_PROVENANCE' && answer.kind !== 'LOOKPOINT_SOURCE')
      || typeof answer.text !== 'string' || !answer.text.trim()) {
    throw new Error('Unexpected guide fixture answer')
  }
  const citations = Array.isArray(answer.citations)
    ? answer.citations.slice(0, 3) as { publicSource?: string; reference?: { cardId?: string } }[]
    : []
  const reply: FixtureReply = {
    text: modelMode && answer.kind === 'LOOKPOINT_SOURCE'
      && !citations.some(citation => citation?.publicSource === museumReference)
      ? '刚才的回答依据下方数字模型图版。你可以打开图版，对照刚提到的细节。'
      : answer.text,
  }
  if (modelMode) {
    reply.generated = answer.generated === true
    const observations: Record<string, GuidePlate> = { EAR: 'ear', FEET: 'feet', MOTIF: 'motif' }
    reply.observations = Array.isArray(answer.observations)
      ? Object.keys(observations).filter(id => answer.observations.includes(id)).map(id => observations[id])
      : []
  }
  if (reviewedPreview) {
    const plates: Record<string, GuidePlate> = { EAR: 'ear', FEET: 'feet', MOTIF: 'motif' }
    reply.observations = citations.flatMap(({ reference }) => {
      const id = reference?.cardId
      const plate = id && Object.hasOwn(plates, id) ? plates[id] : undefined
      return plate ? [plate] : []
    })
  }
  if (answer.kind === 'EVIDENCE' && (answer.plate === 'ear' || answer.plate === 'feet' || answer.plate === 'motif')) {
    reply.plate = answer.plate
  }
  if (citations.length) {
    const sources = new Set<string>()
    for (const citation of citations) {
      if (typeof citation?.publicSource !== 'string') continue
      try {
        const source = new URL(citation.publicSource)
        if (modelMode || reviewedPreview ? source.href === museumReference
          : source.origin === 'https://museum.example.test' && !source.username && !source.password) {
          sources.add(source.href)
        }
      } catch {
        // One malformed link must not suppress other verified sources.
      }
    }
    if (sources.size) reply.sources = [...sources]
  }
  return reply
}
