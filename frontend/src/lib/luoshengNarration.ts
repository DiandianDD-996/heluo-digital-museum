import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'

type NarrationScope = Readonly<{ clip: string; turn: string; enabled: boolean }>
type NarrationStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'unavailable'

export function useLuoshengNarration(
  scope: Readonly<Ref<NarrationScope | null>>,
  createAudio: () => HTMLAudioElement = () => new Audio(),
) {
  const status = ref<NarrationStatus>('idle')
  let audio: HTMLAudioElement | undefined
  let detach: (() => void) | undefined
  let operation = 0
  let disposed = false

  function stop() {
    operation++
    const previous = audio
    audio = undefined
    detach?.()
    detach = undefined
    if (previous) {
      previous.pause()
      previous.removeAttribute('src')
      previous.load()
    }
    status.value = 'idle'
  }

  function pause() {
    if (!audio || (status.value !== 'starting' && status.value !== 'playing')) return
    operation++
    audio.pause()
    status.value = 'paused'
  }

  async function play(): Promise<void> {
    const clip = scope.value?.clip
    if (disposed || !scope.value?.enabled || !clip || clip !== clip.trim()
        || !/^\/media\/guide\/[\w-]+\.(?:mp3|ogg|wav)$/.test(clip)
        || status.value === 'starting' || status.value === 'playing') return
    const request = ++operation
    try {
      if (!audio) {
        const player = createAudio()
        audio = player
        const ended = () => { if (audio === player) stop() }
        const failed = () => {
          if (audio !== player) return
          stop()
          status.value = 'unavailable'
        }
        player.addEventListener('ended', ended)
        player.addEventListener('error', failed)
        detach = () => {
          player.removeEventListener('ended', ended)
          player.removeEventListener('error', failed)
        }
        player.src = clip
      }
      const player = audio
      status.value = 'starting'
      await player.play()
      if (operation === request) status.value = 'playing'
    } catch {
      if (operation !== request) return
      stop()
      status.value = 'unavailable'
    }
  }

  watch([() => scope.value?.clip, () => scope.value?.turn, () => scope.value?.enabled], stop, { flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    stop()
  })

  return { status: computed(() => status.value), play, pause, stop }
}
