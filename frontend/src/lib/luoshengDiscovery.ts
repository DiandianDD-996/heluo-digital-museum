import { apiGet, type ContentPage } from './api'
import type { SearchResult } from './content'
import ui from '../assets/guide/ui.zh-CN.json'
import { formatGuideCopy as copy } from './luoshengCopy'
export { discoveryIntent, requestsSavedLookpoint } from './luoshengIntent'

const dingExcluded = /^(?:(?:这件|那个|那件|河洛|青铜)*鼎(?:了|吧|啦)?|鼎耳)$/

export async function findGuideArtifacts(keyword: string, signal: AbortSignal, exclusions: readonly string[] = []) {
  const find = async (word: string) => {
    const result = await apiGet<ContentPage<SearchResult>>(
      `/search?keyword=${encodeURIComponent(word)}&type=artifact&page=1&size=8`,
      undefined,
      { signal },
    )
    return result.items.filter(item => item.type === 'artifact' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
      && !exclusions.some(term => (dingExcluded.test(term) && item.slug === 'heluo-bronze-ding') || item.title.includes(term)))
  }
  const items = await find(keyword)
  if (!items.length && keyword === '玉器') return { items: await find('玉璧'), keyword: '玉璧' }
  return { items, keyword }
}

export function guideArtifactReason(item: SearchResult, requested: string, matched: string) {
  const phrasing = ui.discovery
  const alias = requested !== matched ? copy(phrasing.alias, { requested, matched }) : ''
  const fields = ['title', 'summary', 'titleEn', 'summaryEn'] as const
  const term = matched.normalize('NFKC').toLowerCase()
  const field = fields.find(key => item[key]?.normalize('NFKC').toLowerCase().includes(term))
  return alias + (field ? copy(phrasing.match, { field: phrasing.fields[field], matched }) : copy(phrasing.result, { matched }))
}

export function guideArtifactCover(url: string) {
  // Only reuse public images hosted by the museum; never initiate a third-party request.
  return /^\/media\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|avif|png|jpe?g)$/i.test(url) ? url : undefined
}
