import { describe, expect, it } from 'vitest'
import { lexicon } from './luoshengLexicon'
import { clarifyOptionsFor, nextGlanceFor, suggestionsFor } from './luoshengSuggestions'

const EXHIBIT = 'heluo-bronze-ding-3d'

describe('洛笙建议问题', () => {
  it('空态给出三条，全部来自已审词表', () => {
    const { primary, more } = suggestionsFor({ exhibit: EXHIBIT, lookpoint: null, route: 'home', mode: 'empty' })
    expect(primary).toHaveLength(3)
    const reviewed = new Set(Object.values(lexicon.exhibits[EXHIBIT]!.suggestedQuestions).flat().map(entry => entry.q))
    for (const question of [...primary, ...more]) expect(reviewed.has(question)).toBe(true)
  })

  it('已确认看点的问题排在最前', () => {
    const feet = lexicon.exhibits[EXHIBIT]!.suggestedQuestions.feet!.map(entry => entry.q)
    const { primary } = suggestionsFor({ exhibit: EXHIBIT, lookpoint: 'feet', route: 'artifact-detail', mode: 'empty' })
    expect(primary[0]).toBe(feet[0])
  })

  it('回答之后只给两条，其余折进「更多」', () => {
    const { primary, more } = suggestionsFor({ exhibit: EXHIBIT, lookpoint: 'ear', route: 'artifact-detail', mode: 'after-answer' })
    expect(primary).toHaveLength(2)
    expect(more.length).toBeGreaterThan(0)
  })

  it('同一句建议不会重复出现', () => {
    const { primary, more } = suggestionsFor({ exhibit: EXHIBIT, lookpoint: 'motif', route: 'artifact-detail', mode: 'empty' })
    expect(new Set([...primary, ...more]).size).toBe(primary.length + more.length)
  })

  it('没有档案的展品不给建议，也不猜测', () => {
    expect(suggestionsFor({ exhibit: 'unknown-3d', lookpoint: null, route: 'home', mode: 'empty' }))
      .toEqual({ primary: [], more: [] })
    expect(suggestionsFor({ exhibit: undefined, lookpoint: null, route: 'home', mode: 'empty' }))
      .toEqual({ primary: [], more: [] })
  })

  it('澄清选项只来自档案声明的看点', () => {
    expect(clarifyOptionsFor(EXHIBIT)).toEqual(['ear', 'feet', 'motif'])
    expect(clarifyOptionsFor('unknown-3d')).toEqual([])
    expect(clarifyOptionsFor(undefined)).toEqual([])
  })

  it('下一步看点来自词表映射', () => {
    expect(nextGlanceFor(EXHIBIT, 'ear')).toBe('feet')
    expect(nextGlanceFor(EXHIBIT, 'feet')).toBe('motif')
    expect(nextGlanceFor(EXHIBIT, 'motif')).toBe('ear')
    expect(nextGlanceFor(EXHIBIT, null)).toBeNull()
    expect(nextGlanceFor('unknown-3d', 'ear')).toBeNull()
  })
})
