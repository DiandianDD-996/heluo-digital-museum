import { describe, expect, it, vi } from 'vitest'
import { apiGet } from './api'
import { discoveryIntent, findGuideArtifacts, guideArtifactCover, guideArtifactReason, requestsSavedLookpoint } from './luoshengDiscovery'
import type { SearchResult } from './content'

vi.mock('./api', () => ({ apiGet: vi.fn() }))

describe('洛笙公开找物', () => {
  it('从公开字段说明匹配来源，区分别名、英文及无法定位的检索命中', () => {
    const item: SearchResult = {
      type: 'artifact', slug: 'water-bird-bronze', title: '青铜雕塑（概念展品）', summary: '灵感来自水鸟',
      titleEn: 'Water-bird bronze', coverImageUrl: '', categoryName: '青铜',
    }
    expect(guideArtifactReason(item, '鸟', '鸟')).toContain('公开摘要提到了「鸟」')
    expect(guideArtifactReason(item, 'BIRD', 'BIRD')).toContain('英文标题提到了「BIRD」')
    expect(guideArtifactReason(item, '水岸', '水岸')).toBe('这是馆藏检索「水岸」返回的公开条目。')
    expect(guideArtifactReason({ ...item, title: '河图玉璧' }, '玉器', '玉璧'))
      .toBe('按馆内检索别名，把「玉器」换成「玉璧」。这件展品的公开标题提到了「玉璧」。')
  })

  it('将检索关键词原样代入文案，不把其中的符号当成模板', () => {
    const item: SearchResult = {
      type: 'artifact', slug: 'test-artifact', title: '展品 {field} $&', summary: '', coverImageUrl: '', categoryName: '',
    }
    expect(guideArtifactReason(item, '$`', '{field} $&'))
      .toBe('按馆内检索别名，把「$`」换成「{field} $&」。这件展品的公开标题提到了「{field} $&」。')
  })

  it('只接受本站公开图片路径', () => {
    expect(guideArtifactCover('/media/exhibits/water-bird-bronze-cover.webp')).toBe('/media/exhibits/water-bird-bronze-cover.webp')
    for (const url of ['', '//other.test/media/bird.webp', 'https://other.test/bird.webp', '/media/../bird.png', '/media/a.svg', '/media/a.png?b=1']) {
      expect(guideArtifactCover(url)).toBeUndefined()
    }
  })

  it('区分否定预约、否定展品、别错过和展品追问', () => {
    expect(discoveryIntent('我不想预约只想看青铜鼎', false)).toEqual({ kind: 'search', keyword: '青铜鼎', short: false, exclusions: [] })
    expect(discoveryIntent('别错过鼎', false)).toMatchObject({ kind: 'search', keyword: '青铜鼎' })
    expect(discoveryIntent('不想看青铜鼎', false)).toEqual({ kind: 'clarify-discovery' })
    expect(discoveryIntent('不看鼎，找玉器', true)).toEqual({ kind: 'search', keyword: '玉器', short: false, exclusions: ['鼎'] })
    expect(discoveryIntent('它是什么年代的？', true)).toEqual({ kind: 'object' })
    expect(discoveryIntent('我想看鼎耳', true)).toEqual({ kind: 'object' })
    expect(discoveryIntent('这里可以预约吗？', false)).toEqual({ kind: 'appointment' })
  })

  it('把明确主题和五分钟随便逛区分开', () => {
    expect(discoveryIntent('我就五分钟，想看个有意思的', false)).toMatchObject({ kind: 'search', keyword: '青铜鼎', short: true })
    expect(discoveryIntent('我想看和鸟有关的东西', false)).toMatchObject({ kind: 'search', keyword: '鸟', short: false })
    expect(discoveryIntent('我想看看和鸟相关的藏品', false)).toMatchObject({ kind: 'search', keyword: '鸟', short: false })
    expect(discoveryIntent('帮我找找瓷器', true)).toMatchObject({ kind: 'search', keyword: '瓷器' })
  })

  it('返回只匹配原看点，不抢占新展品、否定或复合提问', () => {
    for (const phrase of ['回到刚才那只耳朵', '帮我回到原来的看点吧', '刚才的鼎耳', '回去', '继续看青铜鼎']) {
      expect(requestsSavedLookpoint(phrase, 'ear'), phrase).toBe(true)
    }
    for (const phrase of ['接着看玉器', '回到刚才的三足', '不要回到刚才的看点', '回到刚才结果再查明天的时段']) {
      expect(requestsSavedLookpoint(phrase, 'ear'), phrase).toBe(false)
    }
    expect(requestsSavedLookpoint('请带我回到刚才的三只脚', 'feet')).toBe(true)
    expect(discoveryIntent('接着看玉器', false)).toMatchObject({ kind: 'search', keyword: '玉器' })
    expect(discoveryIntent('改看玉璧', true)).toMatchObject({ kind: 'search', keyword: '玉璧' })
    expect(discoveryIntent('继续看三足', true)).toEqual({ kind: 'object' })
  })

  it('仅发送正向词并从公开结果里筛掉排除项，保留玉璧别名', async () => {
    const ding = { slug: 'heluo-bronze-ding', title: '河洛青铜鼎', type: 'artifact' }
    const jade = { slug: 'river-map-jade-bi', title: '河图玉璧（概念）', type: 'artifact' }
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockReset().mockResolvedValueOnce({ items: [ding] }).mockResolvedValueOnce({ items: [jade] })
    expect(await findGuideArtifacts('玉器', signal, ['鼎'])).toEqual({ items: [jade], keyword: '玉璧' })
    expect(vi.mocked(apiGet).mock.calls.map(([path]) => new URL(path, 'https://local.test').searchParams.get('keyword'))).toEqual(['玉器', '玉璧'])
  })
})
