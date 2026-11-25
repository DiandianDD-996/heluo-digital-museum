export interface BilingualCategoryLike {
  code?: string | null
  name: string
  nameEn?: string | null
}

export interface BilingualContent {
  slug?: string
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
  dimensions?: string | null
  collectionLocation?: string | null
  description?: string
  descriptionEn?: string | null
  category?: BilingualCategoryLike
  categoryCode?: string
  categoryName?: string
  authorDisplay?: string
}

const CATEGORY_EN_BY_CODE: Record<string, string> = {
  BRONZE: 'Bronze Rituals',
  JADE: 'Jade Imagery',
  RIVER: 'Heluo Stories',
  POTTERY: 'Pottery & Life',
  STONE: 'Stone Inscriptions',
}

const CATEGORY_EN_BY_NAME: Record<string, string> = {
  青铜礼器: 'Bronze Rituals',
  玉石意象: 'Jade Imagery',
  河洛故事: 'Heluo Stories',
  彩陶生活: 'Pottery & Life',
  石刻铭文: 'Stone Inscriptions',
  数字展厅: '3D Gallery',
  文创器物: 'Museum Store',
}

const ARTIFACT_EN_FALLBACKS: Record<string, { period: string; material: string; category: string; contentEn?: string }> = {
  'heluo-bronze-ding': {
    period: 'Shang Dynasty (Anyang period reference)',
    material: 'Bronze (Digital PBR reconstruction)',
    category: 'Bronze Rituals',
    contentEn: [
      'Observation Entry | Approaching the Ding from Three Legs',
      'Trace the vessel upward from its three solid legs to the rounded belly, then let your gaze rest along the rim and upright handles. Support, containment, and edge work together to shape the tripod silhouette.',
      'Inside the 3D gallery, rotate the vessel to compare front and profile leg spacing, follow how the belly narrows toward the base, and watch the relief bands wrap continuously across the curved wall. These three prompts come directly from visual form rather than archaeological claims about original provenance.',
      'Digital Reconstruction | What You Are Viewing',
      'This exhibit is an original digital PBR reconstruction rather than an excavated object in a physical collection. Its base mesh is adapted from the Cleveland Museum of Art CC0 public-domain model (1962.281 Tripod Ding). Surface bronze patina, normal relief, lighting, and central frontal ornament have been calibrated for darkroom viewing and should not be read as conservation data of the physical vessel.',
      'Source Record | Original Object and Open Mesh',
      'Original reference: Cleveland Museum of Art, 1962.281 Tripod (Ding), Anyang period, Shang Dynasty, approx. 24.5 × 20 cm. https://www.clevelandart.org/art/1962.281',
      'Base mesh publisher: Cleveland Museum of Art (Sketchfab @clevelandart), CC0 Public Domain. https://sketchfab.com/3d-models/1962281-tripod-ding-af15e7980f9b4f718094fc2e16205d89',
      'A Question for the Viewer',
      'What shifts in the seemingly symmetrical front silhouette once you orbit to a three-quarter angle? Pick one detail among the legs, belly, or taotie band, then step into the 3D exhibit to test your eye.',
    ].join('\n\n'),
  },
  'water-bird-bronze': { period: 'Heluo bronze motif concept', material: 'Cast bronze (Concept)', category: 'Bronze Rituals' },
  'heluo-bronze-jue': { period: 'Shang–Zhou ritual concept', material: 'Cast bronze (Concept)', category: 'Bronze Rituals' },
  'river-map-jade-bi': { period: 'Ritual jade concept', material: 'Nephrite jade (Concept)', category: 'Jade Imagery' },
  'painted-pottery-water-jar': { period: 'Neolithic river-settlement concept', material: 'Painted earthenware (Concept)', category: 'Heluo Stories' },
  'river-map-pattern-stone': { period: 'Heluo spatial motif concept', material: 'Carved limestone (Concept)', category: 'Heluo Stories' },
}

const EXHIBIT_EN_FALLBACKS: Record<string, { title: string; summary: string }> = {
  'heluo-bronze-ding-3d': {
    title: 'Heluo Bronze Ding · 3D Digital Reconstruction',
    summary: 'An interactive 3D exhibit rebuilt from Cleveland Museum of Art 1962.281 with aged bronze patina PBR shaders, supporting free orbit, macro focus, and solid/point-cloud switching.',
  },
  'river-map-stone-raking': {
    title: 'River-Map Pattern Stone · Raking-Light Study',
    summary: 'Explore carved limestone relief under interactive directional raking light to reveal subtle recessed water contours and surface tool marks.',
  },
}

const ARTICLE_CATEGORY_EN_BY_SLUG: Record<string, string> = {
  'why-negative-space-matters': 'Jade Imagery',
  'river-as-timeline': 'Heluo Stories',
  'how-to-read-bronze': 'Bronze Rituals',
  'visit-and-digital-guide': 'Heluo Stories',
}

const PRODUCT_EN_BY_SLUG: Record<string, { name: string; summary: string; archiveCode: string }> = {
  'river-line-teacup-set': {
    name: 'River-Wave Teacup Set',
    summary: 'Keep a quiet rhythm of flowing water in everyday tea rituals.',
    archiveCode: 'HL-STORE-01 · REF. NO.05',
  },
  'heluo-silk-scarf': {
    name: 'Heluo River-Lines Scarf',
    summary: 'An original concept scarf inspired by flowing river contours and deep patina tones.',
    archiveCode: 'HL-STORE-02 · REF. NO.02',
  },
  'river-map-notebook': {
    name: 'River-Map Pattern Notebook',
    summary: 'Bring Heluo geometric river motifs into daily notes and sketches.',
    archiveCode: 'HL-STORE-03 · REF. NO.06',
  },
}

const PRODUCT_SLUG_BY_ZH_NAME: Record<string, string> = {
  河流纹茶杯套装: 'river-line-teacup-set',
  河洛水系丝巾: 'heluo-silk-scarf',
  河图纹笔记本: 'river-map-notebook',
}

const LOCATION_EXACT_EN: Record<string, string> = {
  '河洛数字博物馆 · 深墨青铜厅': 'Heluo Digital Museum · Obsidian Bronze Hall',
  '河洛数字博物馆 · 概念数字展厅': 'Heluo Digital Museum · Concept Digital Hall',
  '河洛数字博物馆 · 玉石意象厅': 'Heluo Digital Museum · Jade Imagery Hall',
  '河洛数字博物馆 · 河洛水系厅': 'Heluo Digital Museum · River Heritage Hall',
  '河洛数字博物馆 · 石刻拓影厅': 'Heluo Digital Museum · Stone Inscription Hall',
  '深墨青铜厅': 'Obsidian Bronze Hall',
  '数字展厅': 'Digital Exhibition Hall',
  '概念数字展厅': 'Concept Digital Gallery',
  '线上数字展厅': 'Online Digital Gallery',
}

const DIMENSIONS_EXACT_EN: Record<string, string> = {
  '参考实物整体约 24.5 × 20 厘米（克利夫兰艺术博物馆 1962.281 公开记录）':
    'Reference object approx. 24.5 × 20 cm (Cleveland Museum of Art 1962.281 public record)',
}

export function localizeCategoryName(
  category: Pick<BilingualCategoryLike, 'code' | 'name' | 'nameEn'> | string | null | undefined,
  locale: string,
  code?: string | null,
): string {
  if (!category) return ''
  if (typeof category === 'string') {
    if (locale !== 'en-US') return category
    return (code ? CATEGORY_EN_BY_CODE[code] : undefined) || CATEGORY_EN_BY_NAME[category.trim()] || category
  }
  if (locale !== 'en-US') return category.name
  return (
    category.nameEn?.trim()
    || (category.code ? CATEGORY_EN_BY_CODE[category.code] : undefined)
    || (code ? CATEGORY_EN_BY_CODE[code] : undefined)
    || CATEGORY_EN_BY_NAME[category.name.trim()]
    || category.name
  )
}

export function localizeDimensions(raw: string | null | undefined, locale: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (locale !== 'en-US') return trimmed
  if (DIMENSIONS_EXACT_EN[trimmed]) return DIMENSIONS_EXACT_EN[trimmed]
  if (!/[\u4e00-\u9fff]/.test(trimmed)) return trimmed

  return trimmed
    .replace(/参考实物整体约\s*/g, 'Ref. overall approx. ')
    .replace(/（克利夫兰艺术博物馆\s*1962\.281\s*公开记录）/g, ' (Cleveland Museum of Art 1962.281)')
    .replace(/概念尺寸约\s*|概念尺度[:：]?\s*/g, 'Concept scale approx. ')
    .replace(/通高约\s*|高约\s*/g, 'Height approx. ')
    .replace(/通宽约\s*|宽约\s*/g, 'Width approx. ')
    .replace(/通长约\s*|长约\s*/g, 'Length approx. ')
    .replace(/直径约\s*|外径约\s*/g, 'Diameter approx. ')
    .replace(/厚约\s*/g, 'Thickness approx. ')
    .replace(/约\s*/g, 'Approx. ')
    .replace(/\s*厘米/g, ' cm')
    .replace(/\s*毫米/g, ' mm')
    .replace(/，/g, ', ')
    .replace(/（/g, ' (')
    .replace(/）/g, ')')
    .trim()
}

export function localizeLocation(raw: string | null | undefined, locale: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (locale !== 'en-US') return trimmed
  if (LOCATION_EXACT_EN[trimmed]) return LOCATION_EXACT_EN[trimmed]
  if (!/[\u4e00-\u9fff]/.test(trimmed)) return trimmed

  return trimmed
    .replace(/河洛数字博物馆/g, 'Heluo Digital Museum')
    .replace(/深墨青铜厅/g, 'Obsidian Bronze Hall')
    .replace(/概念数字展厅/g, 'Concept Digital Hall')
    .replace(/数字展厅/g, 'Digital Hall')
    .replace(/青铜礼器厅|青铜厅/g, 'Bronze Ritual Hall')
    .replace(/玉石意象厅|玉石厅/g, 'Jade Imagery Hall')
    .replace(/彩陶生活厅|彩陶厅/g, 'Painted Pottery Hall')
    .replace(/河洛水系厅|河洛故事厅|河洛厅/g, 'Heluo Heritage Hall')
    .replace(/石刻厅|石刻铭文厅/g, 'Stone Inscription Hall')
    .replace(/线上概念藏品/g, 'Online Concept Archive')
    .replace(/线上展柜/g, 'Digital Vitrine')
    .replace(/主展厅/g, 'Main Gallery')
    .replace(/展厅/g, 'Gallery')
    .trim()
}

export function localizeProductName(
  source: { slug?: string | null; name: string; nameEn?: string | null },
  locale: string,
): string {
  if (locale !== 'en-US') return source.name
  if (source.nameEn?.trim()) return source.nameEn.trim()
  const slug = source.slug?.trim() || PRODUCT_SLUG_BY_ZH_NAME[source.name.trim()]
  if (slug && PRODUCT_EN_BY_SLUG[slug]) return PRODUCT_EN_BY_SLUG[slug].name
  return source.name
}

export function localizeProductSummary(
  source: { slug?: string | null; name?: string; summary: string; summaryEn?: string | null },
  locale: string,
): string {
  if (locale !== 'en-US') return source.summary
  if (source.summaryEn?.trim()) return source.summaryEn.trim()
  const slug = source.slug?.trim() || (source.name ? PRODUCT_SLUG_BY_ZH_NAME[source.name.trim()] : undefined)
  if (slug && PRODUCT_EN_BY_SLUG[slug]) return PRODUCT_EN_BY_SLUG[slug].summary
  return source.summary
}

export function productArchiveCode(source: { slug?: string | null; name?: string }): string {
  const slug = source.slug?.trim() || (source.name ? PRODUCT_SLUG_BY_ZH_NAME[source.name.trim()] : undefined)
  return (slug && PRODUCT_EN_BY_SLUG[slug]?.archiveCode) || 'HL-STORE · CONCEPT ARCHIVE'
}

export function localizedContent<T extends BilingualContent>(item: T, locale: string): T {
  if (locale !== 'en-US') return item
  const fallback = item.slug ? ARTIFACT_EN_FALLBACKS[item.slug] : undefined
  const exhibitFallback = item.slug ? EXHIBIT_EN_FALLBACKS[item.slug] : undefined
  const next: T = {
    ...item,
    title: item.titleEn?.trim() || exhibitFallback?.title || item.title,
    summary: item.summaryEn?.trim() || exhibitFallback?.summary || item.summary,
  }
  if (typeof item.content === 'string') {
    const translatedBody = item.contentEn?.trim() || fallback?.contentEn
    if (translatedBody) next.content = translatedBody
  }
  if (typeof item.period === 'string') {
    next.period = item.periodEn?.trim() || fallback?.period || item.period
  }
  if (typeof item.material === 'string') {
    next.material = item.materialEn?.trim() || fallback?.material || item.material
  }
  if (typeof item.dimensions === 'string') {
    next.dimensions = localizeDimensions(item.dimensions, locale)
  }
  if (typeof item.collectionLocation === 'string') {
    next.collectionLocation = localizeLocation(item.collectionLocation, locale)
  }
  if (typeof item.description === 'string' && item.descriptionEn?.trim()) {
    next.description = item.descriptionEn.trim()
  }
  if (item.category) {
    next.category = {
      ...item.category,
      name: localizeCategoryName(item.category, locale),
    }
  }
  if (typeof item.categoryName === 'string') {
    next.categoryName =
      localizeCategoryName(item.categoryName, locale, item.categoryCode)
      || (item.slug ? ARTICLE_CATEGORY_EN_BY_SLUG[item.slug] : undefined)
      || fallback?.category
      || item.categoryName
  }
  if (typeof item.authorDisplay === 'string' && /河洛数字博物馆/.test(item.authorDisplay)) {
    next.authorDisplay = 'Heluo Digital Museum'
  }
  return next
}
