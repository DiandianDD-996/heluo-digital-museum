export interface ProductPresentationSource {
  slug?: string
  name?: string
  summary?: string | null
  coverImageUrl?: string | null
}

interface ProductFallback {
  summary: string
  coverImageUrl: string
  detailImageUrl?: string
  inspirationArtifactThumb?: string
  inspirationLabelZh?: string
  inspirationLabelEn?: string
}

const defaultProductFallback: ProductFallback = {
  summary: '河洛纹样的日常概念文创，等待被带入下一段生活。',
  coverImageUrl: '/media/editorial/shop-object-studio.webp',
}

const productFallbacks: Record<string, ProductFallback> = {
  'river-line-teacup-set': {
    summary: '让日常饮茶也保留一段关于河流的想象。',
    coverImageUrl: '/media/products/river-line-teacup-set.webp',
    detailImageUrl: '/media/products/river-line-teacup-set-detail.webp',
    inspirationArtifactThumb: '/media/editorial/explore-painted-pottery-jar-user-v2.webp',
    inspirationLabelZh: '灵感源自 · 彩陶水纹壶',
    inspirationLabelEn: 'Inspired by · Painted Pottery Jar',
  },
  'heluo-silk-scarf': {
    summary: '以河流的流线和深墨绿为灵感的原创概念丝巾。',
    coverImageUrl: '/media/products/heluo-silk-scarf.webp',
    detailImageUrl: '/media/products/heluo-silk-scarf-detail.webp',
    inspirationArtifactThumb: '/media/editorial/explore-water-bird-bronze-user-v2.webp',
    inspirationLabelZh: '灵感源自 · 河洛水鸟纹铜器',
    inspirationLabelEn: 'Inspired by · Water-bird Bronze',
  },
  'river-map-notebook': {
    summary: '把河洛图纹带进每天的记录与灵感。',
    coverImageUrl: '/media/products/river-map-notebook.webp',
    detailImageUrl: '/media/products/river-map-notebook-detail.webp',
    inspirationArtifactThumb: '/media/editorial/explore-river-map-stone-user-v2.webp',
    inspirationLabelZh: '灵感源自 · 河洛图纹石板',
    inspirationLabelEn: 'Inspired by · River Map Stone',
  },
}

const productSlugByName: Record<string, string> = {
  '河流纹茶杯套装': 'river-line-teacup-set',
  '河洛水系丝巾': 'heluo-silk-scarf',
  '河图纹笔记本': 'river-map-notebook',
}

function productFallback(source: ProductPresentationSource): ProductFallback | undefined {
  const slug = source.slug?.trim() || (source.name ? productSlugByName[source.name] : undefined)
  return (slug ? productFallbacks[slug] : undefined) ?? defaultProductFallback
}

export function fallbackProductCover(source: ProductPresentationSource): string {
  return productFallback(source)?.coverImageUrl ?? ''
}

export function resolveProductPresentation<T extends ProductPresentationSource>(source: T): T & {
  summary: string
  coverImageUrl: string
  detailImageUrl: string
  inspirationArtifactThumb: string
  inspirationLabelZh: string
  inspirationLabelEn: string
} {
  const fallback = productFallback(source)
  return {
    ...source,
    summary: source.summary?.trim() || fallback?.summary || '',
    coverImageUrl: source.coverImageUrl?.trim() || fallback?.coverImageUrl || '',
    detailImageUrl: fallback?.detailImageUrl || '',
    inspirationArtifactThumb: fallback?.inspirationArtifactThumb || '',
    inspirationLabelZh: fallback?.inspirationLabelZh || '',
    inspirationLabelEn: fallback?.inspirationLabelEn || '',
  }
}
