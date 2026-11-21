import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'

export type GuideTurnScope = Readonly<{
  exhibit: string
  locale: string
  lookpoint: string | null
}>

type TurnState<Answer> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'answered'; answer: Answer }
  | { status: 'unavailable' }

type Transport<Answer> = (request: GuideTurnScope & { question: string; signal: AbortSignal; previousAnswer?: Answer }) => Promise<Answer>
type CompletedTurn<Answer> = Readonly<{ question: string; answer: Answer }>

export function useLuoshengTurns<Answer>(
  scope: Readonly<Ref<GuideTurnScope | null>>,
  transport: Transport<Answer>,
  onAccepted?: (answer: Answer, previousAnswer?: Answer) => void,
) {
  const state = shallowRef<TurnState<Answer>>({ status: 'idle' })
  const history = shallowRef<readonly CompletedTurn<Answer>[]>([])
  let current: AbortController | undefined
  let disposed = false

  function cancel() {
    const previous = current
    current = undefined
    state.value = { status: 'idle' }
    history.value = []
    previous?.abort()
  }

  watch([
    () => scope.value?.exhibit,
    () => scope.value?.locale,
    () => scope.value?.lookpoint,
  ], cancel, { flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    cancel()
  })

  async function ask(question: string): Promise<void> {
    question = question.trim()
    if (!question || !scope.value || disposed) return
    const context = { ...scope.value }
    const previousAnswer = state.value.status === 'answered' ? state.value.answer : undefined
    const previous = current
    const controller = new AbortController()
    current = controller
    state.value = { status: 'pending' }
    previous?.abort()
    if (current !== controller) return
    try {
      const answer = await transport({ ...context, question, signal: controller.signal, previousAnswer })
      if (current === controller) {
        history.value = [...history.value.slice(-3), { question, answer }]
        state.value = { status: 'answered', answer }
        onAccepted?.(answer, previousAnswer)
      }
    } catch {
      if (current === controller) state.value = { status: 'unavailable' }
    } finally {
      if (current === controller) current = undefined
    }
  }

  return { state: computed(() => state.value), history: computed(() => history.value), ask, cancel }
}
