import { afterEach, expect, it, vi } from 'vitest'
import { askLuoshengHttpFixture } from './luoshengHttpFixture'

afterEach(() => vi.unstubAllGlobals())

it('offers the current reading without retrying a session-limited question', async () => {
  const response = (kind: string) => new Response(JSON.stringify({ code: 'OK', data: { synthetic: true, kind } }))
  const fetch = vi.fn().mockResolvedValueOnce(response('CONTEXT_SET'))
    .mockResolvedValueOnce(response('SESSION_RATE_LIMITED'))
  vi.stubGlobal('fetch', fetch)
  const reply = await askLuoshengHttpFixture('另一只呢？', null, 'visit', new AbortController().signal)
  expect(reply).toEqual({ text: '问得有点快，稍后可以再问。也可以先看当前讲解。', readingFallback: true })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([
  [['bad URL', 'https://museum.example.test/FEET', 'https://outside.example.test/EAR'],
    ['https://museum.example.test/FEET']],
  [['https://museum.example.test/EAR', 'https://museum.example.test/EAR', 'https://museum.example.test/FEET'],
    ['https://museum.example.test/EAR', 'https://museum.example.test/FEET']],
])('retains unique allowed citations in reply order', async (inputs, sources) => {
  const response = (data: object) => new Response(JSON.stringify({ code: 'OK', data: { synthetic: true, ...data } }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ kind: 'CONTEXT_SET' }))
    .mockResolvedValueOnce(response({
      kind: 'LOOKPOINT_SOURCE',
      text: 'Synthetic citations',
      citations: inputs.map(publicSource => ({ publicSource })),
    })))
  const reply = await askLuoshengHttpFixture('Source?', null, 'visit', new AbortController().signal)
  expect(reply).toEqual({ text: 'Synthetic citations', sources })
})
