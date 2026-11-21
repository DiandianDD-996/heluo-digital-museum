import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../../../', import.meta.url)
const read = path => readFileSync(new URL(path, root))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const source = 'docs/plans/luosheng-copy/'
const java = 'backend/src/main/java/com/heluo/museum/guide/'

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

test('v6 Java instructions exactly match the reviewed prompt block', () => {
  const prompt = read(source + 'PROMPT-v6.md').toString().replaceAll('\r\n', '\n')
  const block = prompt.match(/```text\n([\s\S]+?)\n```/)[1]
  const generator = read(java + 'GuideStructuredGenerator.java').toString().replaceAll('\r\n', '\n')
  assert.match(generator, /PROMPT_VERSION = "luosheng-structured-v6"/)
  assert.equal(generator.match(/INSTRUCTIONS = """\n([\s\S]+?)\n\s*""";/)[1].replace(/^ {12}/gm, ''), block)
})
