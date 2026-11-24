export interface BilingualContent {
  title: string
  summary: string
  titleEn?: string | null
  summaryEn?: string | null
  content?: string
  contentEn?: string | null
  period?: string
  periodEn?: string | null
  material?: string
  materialEn?: string | null
  description?: string
  descriptionEn?: string | null
}

export function localizedContent<T extends BilingualContent>(item: T, locale: string): T {
  if (locale !== 'en-US') return item
  const next: T = {
    ...item,
    title: item.titleEn?.trim() || item.title,
    summary: item.summaryEn?.trim() || item.summary,
  }
  if (typeof item.content === 'string' && item.contentEn?.trim()) {
    next.content = item.contentEn.trim()
  }
  if (typeof item.period === 'string' && item.periodEn?.trim()) {
    next.period = item.periodEn.trim()
  }
  if (typeof item.material === 'string' && item.materialEn?.trim()) {
    next.material = item.materialEn.trim()
  }
  if (typeof item.description === 'string' && item.descriptionEn?.trim()) {
    next.description = item.descriptionEn.trim()
  }
  return next
}
