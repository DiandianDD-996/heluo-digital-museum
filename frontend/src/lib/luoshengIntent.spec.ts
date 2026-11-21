import { describe, expect, it } from 'vitest'
import { parseIntent, type IntentContext } from './luoshengIntent'

const now = new Date('2026-11-20T17:00:00Z')
const home = { route: 'home', onArtifact: false, now } satisfies IntentContext
const artifact = { ...home, route: 'artifact-detail', onArtifact: true } satisfies IntentContext
const hall = { ...artifact, route: 'exhibit-detail', lookpoint: 'ear' } satisfies IntentContext
const booking = { ...home, route: 'appointment', savedLookpoint: 'ear' } satisfies IntentContext
const groups: [Partial<ReturnType<typeof parseIntent>>, IntentContext, string[]][] = [
  [{ kind: 'discovery-search', keyword: '青铜鼎', short: true }, home, ['我只有五分钟，带我看一件', '我就五分钟，想看个有意思的', '只有５分钟，带我看一件', '只看一件，不用讲太多']],
  [{ kind: 'discovery-search', keyword: '青铜鼎', exclusions: [] }, home, ['不想预约，只想看青铜鼎', '不想预约只想看青铜鼎', '　不想预约，只想看青铜鼎！　', '明天不预约，只想看鼎', '别错过鼎', '想看青铜鼎']],
  [{ kind: 'discovery-search', keyword: '玉器' }, booking, ['接着看玉器', '帮我找玉器', '不看鼎，找玉器', '想看看玉器吧']],
  [{ kind: 'discovery-search', keyword: '玉器', exclusions: ['鼎'] }, artifact, ['不看鼎，找玉器', '不想看鼎了，只想看玉器']],
  [{ kind: 'discovery-search', keyword: '玉璧' }, artifact, ['改看玉璧', '改看玉璧吧', '帮我找找玉璧']],
  [{ kind: 'discovery-search', keyword: '鸟' }, home, ['我想看和鸟有关的东西', '我想看看和鸟相关的藏品']],
  [{ kind: 'discovery-search', keyword: '青铜鼎', deferredSlot: { date: '2026-11-22', people: 1 } }, home, ['先看鼎再查明天', '先看鼎，再查明天', '先看鼎，然后查明天的时段']],
  [{ kind: 'discovery-clarify' }, home, ['我不想看鼎了', '不看鼎', '不要预约', '不用订票', '别看青铜鼎']],
  [{ kind: 'site-page', route: 'appointment' }, home, ['这里可以预约吗？', '怎么预约参观？', '怎么预约参观', '到馆在哪预约？']],
  [{ kind: 'site-page', route: 'artifact-detail' }, artifact, ['这里是什么？', '当前页是哪里', '我在哪', '这个页面做什么']],
  [{ kind: 'site-page', route: 'article-detail', article: true }, { ...home, route: 'article-detail' }, ['这篇专题说什么', '介绍一下本文', '这里讲的是什么？']],
  [{ kind: 'site-navigation', stops: ['exhibits'] }, home, ['在哪能看3D？', '在哪能看 ３Ｄ ？', '哪里能看三维', '怎么进数字展厅']],
  [{ kind: 'site-navigation', stops: ['exhibits'] }, artifact, ['在哪能看3D？', '怎么进展厅']],
  [{ kind: 'site-navigation', stops: ['explore'] }, artifact, ['去哪里看馆藏', '怎么搜索专题', '带我去探索馆藏']],
  [{ kind: 'site-navigation', stops: ['shop'] }, artifact, ['哪里可以买文创', '怎么去商城', '带我逛文创']],
  [{ kind: 'slot-query', date: '2026-11-22', people: 1 }, hall, ['明天还有名额吗？', '明天还有名额吗', '明天还能到馆吗', '明天还有时段吗', '明天还有票吗']],
  [{ kind: 'slot-query', date: '2026-11-22', people: 3 }, home, ['明天还有三个人的名额吗？', '明天还有３人名额吗？', '明天三位到馆', '11月22日还有三人的时段吗']],
  [{ kind: 'slot-query', date: '2026-11-23', people: 3 }, { ...booking, previousPeople: 3 }, ['那就后天吧', '１１ 月 ２３ 日呢？', '2026-11-23']],
  [{ kind: 'slot-clarify', people: 3 }, booking, ['明天或者后天三人有名额吗？', '还有三人名额吗？', '三个人还有余量吗']],
  [{ kind: 'slot-query', date: '2026-11-22', people: 0 }, home, ['明天三到五人还有名额吗', '明天还有2.5人的时段吗', '明天零人预约']],
  [{ kind: 'cancel-slot' }, { ...booking, pendingSlot: true }, ['别查时段', '不用再查名额了', '不想预约，只想看鼎', '不查看时段', '不查了']],
  [{ kind: 'resume-lookpoint', stop: 'ear' }, booking, ['回到刚才那只耳朵', '帮我回到原来的看点吧', '刚才的鼎耳', '回去', '返回', '继续看青铜鼎']],
  [{ kind: 'resume-lookpoint', stop: 'feet' }, { ...booking, savedLookpoint: 'feet' }, ['请带我回到刚才的三只脚', '继续看三足', '返回原来的图版']],
  [{ kind: 'object-evidence' }, hall, ['它是什么年代的？', '另一只在哪？', '另一只呢', '我说的是脚', '它以前断过吗', '我想看鼎耳', '继续看三足', '怎么知道的？', '有多大', '这些纹样象征什么？', '你能再指一下吗？']],
  [{ kind: 'object-evidence' }, artifact, ['另外一个呢？', '这个模型是实物照片吗', '它什么时候造的', '在哪里出土？', '这是实物吗？']],
  [{ kind: 'object-evidence' }, hall, ['脚', '三只脚怎么看', '我数来数去只有两条腿，是缺了一条吗？', '你怎么看出来的？', '怎么就这两条？', '它以前是不是断过？']],
  [{ kind: 'unknown' }, hall, ['asdf', '今天天气怎样', '订机票', '😀']],
  [{ kind: 'unknown' }, booking, ['回到刚才的三足', '不要回到刚才的看点', '明天']],
  [{ kind: 'unknown' }, { ...hall, composing: true }, ['另一只呢', '我说的是j', '明天还有名额吗', '回到刚才那只耳朵']],
]

const corpus = groups.flatMap(([expected, context, questions]) => questions.map(question => ({ expected, context, question })))

describe('洛笙金标意图：取消 → 时段 → 回看 → 当前页 → 取证 → 找物 → 导航 → 澄清', () => {
  it('冻结至少 80 条金标问法', () => expect(corpus.length).toBeGreaterThanOrEqual(80))
  it.each(corpus)('$question → $expected.kind', ({ question, context, expected }) => {
    expect(parseIntent(question, context)).toMatchObject(expected)
  })
})
