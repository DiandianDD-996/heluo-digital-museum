import { describe, expect, it } from 'vitest'
import {
  localizeCategoryName,
  localizeDimensions,
  localizeLocation,
  localizeProductName,
  localizeProductSummary,
  localizedContent,
  productArchiveCode,
} from './contentLocale'

describe('database-backed content translations', () => {
  it('selects English fields independently and preserves identity and source', () => {
    const item = { slug: 'test', title: '中文标题', summary: '中文摘要', titleEn: ' English title ', summaryEn: null }
    expect(localizedContent(item, 'en-US')).toEqual({ ...item, title: 'English title' })
    expect(localizedContent(item, 'zh-CN')).toBe(item)
    expect(item.title).toBe('中文标题')
  })

  it('supports old responses and blank translations without empty cards', () => {
    const item = { title: '标题', summary: '摘要' }
    expect(localizedContent(item, 'en-US')).toEqual(item)
    expect(localizedContent({ ...item, titleEn: ' ', summaryEn: 'English summary' }, 'en-US'))
      .toMatchObject({ title: '标题', summary: 'English summary' })
  })

  it('localizes categories, dimensions, locations, and products with zero CJK residue in en-US', () => {
    expect(localizeCategoryName({ code: 'BRONZE', name: '青铜礼器' }, 'en-US')).toBe('Bronze Rituals')
    expect(localizeCategoryName('玉石意象', 'en-US')).toBe('Jade Imagery')
    expect(localizeCategoryName('青铜礼器', 'zh-CN')).toBe('青铜礼器')

    const dims = localizeDimensions('参考实物整体约 24.5 × 20 厘米（克利夫兰艺术博物馆 1962.281 公开记录）', 'en-US')
    expect(dims).toContain('24.5 × 20 cm')
    expect(dims).not.toMatch(/[\u4e00-\u9fff]/)

    const genericDims = localizeDimensions('通高约 18.2 厘米，直径约 14 厘米', 'en-US')
    expect(genericDims).toBe('Height approx. 18.2 cm, Diameter approx. 14 cm')
    expect(genericDims).not.toMatch(/[\u4e00-\u9fff]/)

    const loc = localizeLocation('河洛数字博物馆 · 深墨青铜厅', 'en-US')
    expect(loc).toBe('Heluo Digital Museum · Obsidian Bronze Hall')
    expect(loc).not.toMatch(/[\u4e00-\u9fff]/)

    expect(localizeProductName({ name: '河流纹茶杯套装' }, 'en-US')).toBe('River-Wave Teacup Set')
    expect(localizeProductName({ slug: 'heluo-silk-scarf', name: '河洛水系丝巾' }, 'en-US')).toBe('Heluo River-Lines Scarf')
    expect(localizeProductSummary({ slug: 'river-map-notebook', summary: '中文' }, 'en-US')).toContain('Heluo')
    expect(productArchiveCode({ name: '河图纹笔记本' })).toContain('HL-STORE-03')

    const fullArtifact = localizedContent({
      slug: 'heluo-bronze-ding',
      title: '河洛青铜方鼎',
      titleEn: 'Heluo Bronze Ding',
      summary: '中文摘要',
      summaryEn: 'English summary',
      period: '商代',
      material: '青铜',
      dimensions: '通高约 24.5 厘米',
      collectionLocation: '河洛数字博物馆 · 概念数字展厅',
      categoryName: '青铜礼器',
    }, 'en-US')

    expect(fullArtifact.categoryName).toBe('Bronze Rituals')
    expect(fullArtifact.dimensions).toBe('Height approx. 24.5 cm')
    expect(fullArtifact.collectionLocation).toBe('Heluo Digital Museum · Concept Digital Hall')
    expect(fullArtifact.period).not.toMatch(/[\u4e00-\u9fff]/)
    expect(fullArtifact.material).not.toMatch(/[\u4e00-\u9fff]/)
  })
})
