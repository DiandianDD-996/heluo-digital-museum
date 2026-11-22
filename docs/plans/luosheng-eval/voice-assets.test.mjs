import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../../../', import.meta.url)
const read = path => readFileSync(new URL(path, root))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const source = 'docs/plans/luosheng-copy/'
const java = 'backend/src/main/java/com/heluo/museum/guide/'

test('copy review candidate pins exactly the five source files by raw SHA-256', () => {
  const contents = read('docs/plans/luosheng-eval/copy-review-candidate.sha256').toString()
  const expected = [
    'COPY-GUIDE.md', 'PROMPT-v6.md', 'suggested-questions.zh-CN.json', 'ui.zh-CN.json', 'voice.zh-CN.json',
  ]
  assert.deepEqual(readdirSync(new URL(source, root)).sort(), expected.slice().sort())
  const entries = expected.map(name => `${hash(read(source + name))}  ${name}`)
  assert.deepEqual(contents.trimEnd().split(/\r?\n/), entries)
})

for (const [name, runtime] of [
  ['voice.zh-CN.json', 'backend/src/main/resources/guide/'],
  ['ui.zh-CN.json', 'frontend/src/assets/guide/'],
  ['ui.zh-CN.json', 'backend/src/main/resources/guide/'],
]) {
  test(`${name}: runtime bytes match the reviewed source`, () => {
    assert.equal(hash(read(runtime + name)), hash(read(source + name)))
  })
}

test('former visitor-facing Java constants are not present', () => {
  for (const file of readdirSync(new URL(java, root)).filter(name => name.endsWith('.java'))) {
    assert.doesNotMatch(read(java + file).toString(), /现有资料不足|洛笙的图版来自/, file)
  }
})

test('approved preset, figure and appointment handoff source their labels from UI copy', () => {
  for (const name of ['LuoshengPreset.vue', 'LuoshengApprovedFigure.vue']) {
    const component = read(`frontend/src/components/${name}`).toString()
    assert.match(component, /ui\.zh-CN\.json/, name)
    assert.doesNotMatch(component, /\p{Script=Han}/u, name)
  }
  const appointment = read('frontend/src/views/AppointmentView.vue').toString()
  assert.match(appointment, /ui\.zh-CN\.json/)
  assert.doesNotMatch(appointment, /问时段|回到青铜鼎/)
})

test('public navigation, search and slot replies source their wording from UI copy', () => {
  for (const [name, oldWording] of [
    ['luoshengSiteGuide.ts', /\p{Script=Han}/u],
    ['luoshengDiscovery.ts', /检索别名|公开标题|公开摘要|英文标题|英文摘要|返回的公开条目/],
    ['luoshengSlots.ts', /请换个日期|请确认参观人数|查询时余|空位不足|没有公开可约时段|公开时段暂时查不到/],
  ]) {
    const module = read(`frontend/src/lib/${name}`).toString()
    assert.match(module, /ui\.zh-CN\.json/, name)
    assert.doesNotMatch(module, oldWording, name)
  }
})

test('the runtime lexicon merges the exact source suggestions, including editorial metadata', () => {
  const { exhibits } = JSON.parse(read(source + 'suggested-questions.zh-CN.json'))
  const { exhibits: runtime } = JSON.parse(read('frontend/src/assets/guide/lexicon.zh-CN.json'))
  const runtimeWithSuggestions = Object.keys(runtime).filter(slug =>
    Object.values(runtime[slug].suggestedQuestions ?? {}).some(group => group.length > 0))
  assert.deepEqual(runtimeWithSuggestions.sort(), Object.keys(exhibits).sort())
  for (const [slug, authored] of Object.entries(exhibits)) {
    assert.equal(runtime[slug]?.artifactSlug, authored.artifactSlug, slug)
    assert.deepEqual(runtime[slug].suggestedQuestions, { ...authored.points, global: authored.global }, slug)
  }
})

test('v6 Java instructions exactly match the reviewed prompt block', () => {
  const prompt = read(source + 'PROMPT-v6.md').toString().replaceAll('\r\n', '\n')
  const block = prompt.match(/```text\n([\s\S]+?)\n```/)[1]
  const generator = read(java + 'GuideStructuredGenerator.java').toString().replaceAll('\r\n', '\n')
  assert.match(generator, /PROMPT_VERSION = "luosheng-structured-v6"/)
  assert.equal(generator.match(/INSTRUCTIONS = """\n([\s\S]+?)\n\s*""";/)[1].replace(/^ {12}/gm, ''), block)
})
