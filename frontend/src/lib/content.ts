import type { BilingualContent } from './contentLocale'

export interface Category {
  id: number
  code: string
  name: string
  description: string
  sortOrder: number
  nameEn?: string | null
  descriptionZh?: string | null
  descriptionEn?: string | null
}

export interface ArtifactCard extends BilingualContent {
  slug: string
  title: string
  summary: string
  period: string
  material: string
  periodEn?: string | null
  materialEn?: string | null
  coverImageUrl: string
  categoryCode: string
  categoryName: string
}

export interface ArticleCard extends BilingualContent {
  slug: string
  title: string
  summary: string
  coverImageUrl: string
  authorDisplay: string
  categoryCode: string
  categoryName: string
}

export interface ExhibitSummary extends BilingualContent {
  slug: string
  title: string
  summary: string
  coverImageUrl: string
  descriptionEn?: string | null
}

export interface ArtifactDetail extends ArtifactCard {
  id: number
  content: string
  contentEn?: string | null
  dimensions: string
  collectionLocation: string
  category: { code: string; name: string; nameEn?: string | null }
  exhibits: ExhibitSummary[]
}

export interface ArticleDetail extends ArticleCard {
  content: string
  contentEn?: string | null
  category: { code: string; name: string; nameEn?: string | null }
}

export interface SearchResult extends BilingualContent {
  type: 'artifact' | 'article' | 'exhibit' | 'product'
  slug: string
  title: string
  summary: string
  coverImageUrl: string
  categoryName: string
  path?: string | null
  price?: string | null
}
