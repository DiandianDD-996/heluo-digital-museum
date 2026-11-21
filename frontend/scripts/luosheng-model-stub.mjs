import assert from 'node:assert/strict'
import { createServer } from 'node:http'

const port = Number(process.argv[2])
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535)
const server = createServer(async (request, response) => {
  try {
    assert.equal(request.method, 'POST')
    assert.equal(request.url, '/v1/chat/completions')
    assert.equal(request.headers.authorization, 'Bearer loopback-test')
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    assert.equal(body.model, 'stub')
    assert.equal(body.response_format.type, 'json_object')
    assert.deepEqual(body.messages.map(message => message.role), ['system', 'user'])
    const { question, evidence } = JSON.parse(body.messages[1].content)
    assert.equal(evidence.length, 1)
    let answer
    if (process.env.LUOSHENG_UNIFIED_CHECK === '1' && /^(?:另一只呢|还有一个在哪儿？|我只数出两条腿[。？]?)$/.test(question)) {
      const isEar = /鼎耳/.test(evidence[0].text)
      assert.match(evidence[0].text, /鼎耳|鼎足/)
      answer = { text: isEar ? '从上方看向鼎口另一边，就能找到另一只耳。' : '侧面有一足被挡住，背视图可以数齐三足。', references: [1] }
    } else if (question === '换个角度会更好辨认吗？') {
      assert.match(evidence[0].text, /鼎耳/)
      answer = { text: '协议测试：承接鼎耳', references: [1] }
    } else if (question === '另一只呢？') {
      assert.match(evidence[0].text, /鼎足/)
      answer = { text: '协议测试：承接三足', references: [1] }
    } else if (question === '介绍一下这件鼎') {
      assert.match(evidence[0].text, /1962\.281/)
      answer = { text: '协议测试：展项展示的是青铜鼎数字模型。', references: [1] }
    } else if (question === '材质和尺寸是什么？') {
      assert.match(evidence[0].text, /24\.5 × 20/)
      answer = { text: '协议测试：参考藏品为青铜，整体尺寸 24.5 × 20 厘米。', references: [1] }
    } else {
      assert.equal(question, '是谁铸造它的？')
      answer = { text: null, references: [] }
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }] }))
  } catch {
    response.writeHead(422).end()
  }
})
server.listen(port, '127.0.0.1', () => console.log('Luosheng local protocol stub ready'))
