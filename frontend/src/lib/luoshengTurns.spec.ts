import { effectScope, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { useLuoshengTurns, type GuideTurnScope } from './luoshengTurns'

const ear: GuideTurnScope = { exhibit: 'ding', locale: 'zh-CN', lookpoint: 'ear' }

it('在已加载展品的共用输入框中，只让取证问题发同源 /turns', async () => {
  vi.stubEnv('VITE_GUIDE_SITE_ENABLED', 'true')
  vi.stubEnv('VITE_GUIDE_TURNS_ENABLED', 'true')
  const fetched: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input)
    fetched.push(url)
    const data = url.includes('/search?') ? { items: [] }
      : url.includes('/appointment-slots?') ? [] : { kind: 'CLARIFY', citations: [] }
    return new Response(JSON.stringify({ code: 'OK', data }), { headers: { 'Content-Type': 'application/json' } })
  }))
  const { useLuoshengVisit } = await import('../stores/luoshengVisit')
  const { default: Panel } = await import('../components/LuoshengSiteGuide.vue')
  const path = '/artifacts/test-exhibit'
  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path, name: 'artifact-detail', component: { template: '<main />' } },
    ...['explore', 'exhibits', 'appointment', 'shop'].map(name => ({
      path: '/' + name, name, component: { template: '<main />' },
    })),
  ] })
  await router.push(path)
  const visit = useLuoshengVisit(pinia)
  visit.object = { path, slug: 'test-exhibit', exhibit: 'test-exhibit-3d', title: '测试展品', summary: '测试摘要' }
  const panel = mount(Panel, { global: { plugins: [pinia, router] } })
  const submit = async (text: string) => {
    await panel.get('.site-guide-form input').setValue(text)
    await panel.get('.site-guide-form').trigger('submit')
    await flushPromises()
  }
  try {
    await panel.get('.site-guide-trigger').trigger('click')
    for (const question of ['怎么去文创商城？', '明天还有名额吗？', '帮我找玉器', 'asdf']) await submit(question)
    expect(fetched.some(url => url.includes('/appointment-slots?'))).toBe(true)
    expect(fetched.some(url => url.includes('/search?'))).toBe(true)
    expect(fetched.filter(url => url.endsWith('/guide/turns'))).toEqual([])
    const input = panel.get('.site-guide-form input')
    await input.trigger('compositionstart')
    await submit('它是什么年代的？')
    expect(fetched.filter(url => url.endsWith('/guide/turns'))).toEqual([])
    await input.trigger('compositionend')
    await submit('它是什么年代的？')
    await vi.waitFor(() => expect(fetched.filter(url => url.endsWith('/guide/turns'))).toEqual(['/api/v1/guide/turns']))
  } finally {
    panel.unmount()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})

function setup() {
  const lifecycle = effectScope()
  const scope = ref<GuideTurnScope | null>(ear)
  const requests: {
    signal: AbortSignal
    exhibit: string
    lookpoint: string | null
    resolve: (value: string) => void
    reject: (error: Error) => void
  }[] = []
  const transport = vi.fn((request: GuideTurnScope & { signal: AbortSignal }) =>
    new Promise<string>((resolve, reject) => requests.push({ ...request, resolve, reject })))
  const accepted = vi.fn()
  const turns = lifecycle.run(() => useLuoshengTurns(scope, transport, accepted))!
  return { lifecycle, scope, requests, transport, accepted, ...turns }
}

describe('Luosheng turn ownership', () => {
  it('keeps only the last four completed turns and clears them at the next lookpoint', async () => {
    const session = setup()
    for (let index = 0; index < 5; index++) {
      const pending = session.ask(`question ${index}`)
      session.requests[index]?.resolve(`answer ${index}`)
      await pending
    }
    expect(session.history.value.map(turn => turn.question)).toEqual([
      'question 1', 'question 2', 'question 3', 'question 4',
    ])
    session.scope.value = { ...ear, lookpoint: 'feet' }
    expect(session.history.value).toEqual([])
    session.lifecycle.stop()
  })

  it('keeps the newer answer when the previous transport ignores cancellation', async () => {
    const session = setup()
    const first = session.ask('first')
    const second = session.ask('second')
    expect(session.requests[0]?.signal.aborted).toBe(true)
    session.requests[1]?.resolve('current')
    await second
    session.requests[0]?.resolve('superseded')
    await first
    expect(session.state.value).toEqual({ status: 'answered', answer: 'current' })
    expect(session.history.value).toEqual([{ question: 'second', answer: 'current' }])
    expect(session.accepted.mock.calls).toEqual([['current', undefined]])
    session.lifecycle.stop()
  })

  it.each([
    { ...ear, lookpoint: 'feet' },
    { ...ear, exhibit: 'other' },
    { ...ear, locale: 'en-US' },
    null,
  ])('drops the old result on scope change, even after re-entry (%j)', async (replacement) => {
    const session = setup()
    const old = session.ask('follow-up')
    session.scope.value = replacement
    expect(session.requests[0]?.signal.aborted).toBe(true)
    expect(session.state.value.status).toBe('idle')
    session.scope.value = ear
    const fresh = session.ask('follow-up')
    session.requests[0]?.reject(new Error('late failure'))
    await old
    expect(session.state.value.status).toBe('pending')
    session.requests[1]?.resolve('fresh answer')
    await fresh
    expect(session.state.value).toEqual({ status: 'answered', answer: 'fresh answer' })
    expect(session.accepted.mock.calls).toEqual([['fresh answer', undefined]])
    session.lifecycle.stop()
  })

  it('clears shown answers on context change and sends only the new context', async () => {
    const session = setup()
    const old = session.ask('follow-up')
    session.requests[0]?.resolve('ear answer')
    await old
    session.scope.value = { ...ear, lookpoint: 'feet' }
    expect(session.state.value).toEqual({ status: 'idle' })
    const next = session.ask(' follow-up ')
    expect(session.transport).toHaveBeenLastCalledWith(expect.objectContaining({
      exhibit: 'ding', locale: 'zh-CN', lookpoint: 'feet', question: 'follow-up', previousAnswer: undefined,
    }))
    session.requests[1]?.reject(new Error('unavailable'))
    await next
    expect(session.state.value).toEqual({ status: 'unavailable' })
    session.lifecycle.stop()
  })

  it('passes the immediately preceding visible answer only in the current scope', async () => {
    const session = setup()
    const clarification = session.ask('which date')
    session.requests[0]?.resolve('clarification')
    await clarification
    const followup = session.ask('tomorrow')
    expect(session.transport).toHaveBeenLastCalledWith(expect.objectContaining({ previousAnswer: 'clarification' }))
    const newer = session.ask('another question')
    expect(session.transport).toHaveBeenLastCalledWith(expect.objectContaining({ previousAnswer: undefined }))
    session.requests[2]?.resolve('newest')
    session.requests[1]?.resolve('late')
    await Promise.all([followup, newer])
    expect(session.accepted.mock.calls).toEqual([['clarification', undefined], ['newest', undefined]])
    session.lifecycle.stop()
  })

  it('notifies accepted answers with the prior answer, but not across a failed turn', async () => {
    const session = setup()
    const first = session.ask('first')
    session.requests[0]?.resolve('clarify')
    await first
    const second = session.ask('second')
    session.requests[1]?.resolve('clarify again')
    await second
    const failure = session.ask('third')
    session.requests[2]?.reject(new Error('unavailable'))
    await failure
    const fourth = session.ask('fourth')
    session.requests[3]?.resolve('clarify from scratch')
    await fourth
    expect(session.accepted.mock.calls).toEqual([
      ['clarify', undefined], ['clarify again', 'clarify'], ['clarify from scratch', undefined],
    ])
    session.lifecycle.stop()
  })

  it('ignores blank questions and cancels on disposal', async () => {
    const session = setup()
    await session.ask(' ')
    expect(session.transport).not.toHaveBeenCalled()
    const pending = session.ask('follow-up')
    session.lifecycle.stop()
    expect(session.requests[0]?.signal.aborted).toBe(true)
    session.requests[0]?.resolve('late answer')
    await pending
    await session.ask('after disposal')
    expect(session.state.value.status).toBe('idle')
    expect(session.transport).toHaveBeenCalledTimes(1)
  })
})
