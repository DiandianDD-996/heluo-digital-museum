import { describe, expect, it } from 'vitest'
import raw from '../assets/guide/lexicon.zh-CN.json'
import {
  aliasFor, anchoredPattern, discoveryTermPattern, lexicon, parseLexicon, peopleValue,
  pointLabelPattern, pointPattern, relativeDatePattern, siteStopsMatching, unionPattern, vocabularyPattern,
} from './luoshengLexicon'

describe('洛笙词表', () => {
  it('内置词表通过校验并保留已知事实', () => {
    expect(lexicon.version).toBe(1)
    expect(lexicon.locale).toBe('zh-CN')
    expect(lexicon.exhibits['heluo-bronze-ding-3d'].points.map(point => point.stop)).toEqual(['ear', 'feet', 'motif'])
  })

  it('拒绝未知 stop', () => {
    const broken = JSON.parse(JSON.stringify(raw))
    broken.exhibits['heluo-bronze-ding-3d'].points[0].stop = 'spout'
    expect(() => parseLexicon(broken)).toThrow(/not a known guide stop/)
  })

  it('拒绝同一展品内重复 stop', () => {
    const broken = JSON.parse(JSON.stringify(raw))
    broken.exhibits['heluo-bronze-ding-3d'].points[1].stop = 'ear'
    expect(() => parseLexicon(broken)).toThrow(/duplicate stops/)
  })

  it('拒绝空白或首尾带空格的标签', () => {
    const broken = JSON.parse(JSON.stringify(raw))
    broken.exhibits['heluo-bronze-ding-3d'].points[0].labels = ['鼎耳', ' 耳朵']
    expect(() => parseLexicon(broken)).toThrow(/blank or padded entry/)
  })

  it('拒绝为不存在的标签写审阅说明', () => {
    const broken = JSON.parse(JSON.stringify(raw))
    broken.exhibits['heluo-bronze-ding-3d'].points[0].reviewedAdditions = { 不存在的词: '理由' }
    expect(() => parseLexicon(broken)).toThrow(/is not one of the labels/)
  })

  it('拒绝 nextGlance 指向不存在的看点', () => {
    const broken = JSON.parse(JSON.stringify(raw))
    broken.exhibits['heluo-bronze-ding-3d'].nextGlance = { ear: 'tail' }
    expect(() => parseLexicon(broken)).toThrow(/nextGlance must map known stops/)
  })

  it('拒绝澄清选项引用没有看点的 stop', () => {
    const broken = JSON.parse(JSON.stringify(raw))
    broken.exhibits['heluo-bronze-ding-3d'].points = broken.exhibits['heluo-bronze-ding-3d'].points
      .filter((point: { stop: string }) => point.stop !== 'motif')
    broken.exhibits['heluo-bronze-ding-3d'].nextGlance = {}
    expect(() => parseLexicon(broken)).toThrow(/clarifyOptions references a stop without a point/)
  })

  it('同一看点的标签可以锚定匹配口语说法', () => {
    for (const word of ['鼎耳', '耳朵', '双耳', '耳']) expect(pointPattern('ear').test(word)).toBe(true)
    for (const word of ['三足', '鼎足', '脚', '腿', '三只脚']) expect(pointPattern('feet').test(word)).toBe(true)
    expect(pointPattern('feet').test('两足')).toBe(false)
  })

  it('新增展品的别名无需改代码即可识别', () => {
    const extended = parseLexicon({
      ...JSON.parse(JSON.stringify(raw)),
      exhibits: {
        'river-map-jade-bi-3d': {
          artifactSlug: 'river-map-jade-bi',
          points: [{ stop: 'motif', cardId: 'FIXTURE-JADE-RIM', revision: 1, labels: ['内缘纹样', '圆孔', '外缘'] }],
          clarifyOptions: ['motif'],
          suggestedQuestions: {},
          nextGlance: {},
        },
      },
    })
    const labels = extended.exhibits['river-map-jade-bi-3d'].points[0].labels
    expect(anchoredPattern(labels).test('圆孔')).toBe(true)
    expect(anchoredPattern(labels).test('外缘')).toBe(true)
    expect(anchoredPattern(labels).test('鼎耳')).toBe(false)
  })

  it('并集匹配里较长的词优先', () => {
    const pattern = unionPattern(['鼎', '青铜鼎'])
    expect('看青铜鼎'.match(pattern)?.[0]).toBe('青铜鼎')
    expect(vocabularyPattern().test('想看玉器')).toBe(true)
    expect(discoveryTermPattern().test('接着看水鸟')).toBe(true)
  })

  it('相对日期与人数词来自词表', () => {
    expect([...('今天和明天'.matchAll(relativeDatePattern()))].map(match => match[0])).toEqual(['今天', '明天'])
    expect(peopleValue('两')).toBe(2)
    expect(peopleValue('仨')).toBe(3)
    expect(peopleValue('十')).toBeUndefined()
  })

  it('站点关键词按词表归类，且顺序稳定', () => {
    expect(siteStopsMatching('怎么进数字展厅')).toEqual(['exhibits'])
    expect(siteStopsMatching('哪里买文创')).toEqual(['shop'])
    expect(siteStopsMatching('今天天气怎样')).toEqual([])
  })

  it('检索别名只把单字鼎补全为检索词', () => {
    expect(aliasFor('鼎')).toBe('青铜鼎')
    expect(aliasFor('玉璧')).toBe('玉璧')
  })

  it('看点并集包含所有已声明标签', () => {
    const pattern = pointLabelPattern()
    for (const label of ['鼎耳', '三足', '纹样', '器腹', '三只脚']) expect(pattern.test(label)).toBe(true)
  })
})
