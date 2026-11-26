import { computed, ref } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'heluo.theme'
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
const storedTheme = isBrowser ? window.localStorage.getItem(STORAGE_KEY) : null
const current = ref<Theme>(storedTheme === 'dark' ? 'dark' : 'light')

export interface ThemeTransitionOrigin {
  x?: number
  y?: number
}

let fadeTimer: number | undefined

function syncDocument(theme: Theme) {
  if (!isBrowser) return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#12110f' : '#f7faf8'
}

syncDocument(current.value)

function resolveOrigin(origin?: ThemeTransitionOrigin): { x: number; y: number } {
  if (origin && typeof origin.x === 'number' && typeof origin.y === 'number' && (origin.x > 0 || origin.y > 0)) {
    return { x: origin.x, y: origin.y }
  }
  const btn = document.querySelector<HTMLElement>('.theme-toggle')
  if (btn) {
    const rect = btn.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
  }
  return { x: window.innerWidth * 0.85, y: 32 }
}

export function useTheme() {
  const isDark = computed(() => current.value === 'dark')

  function setTheme(theme: Theme, origin?: ThemeTransitionOrigin) {
    if (theme === current.value && document.documentElement.dataset.theme === theme) return
    const applyState = () => {
      current.value = theme
      if (isBrowser) window.localStorage.setItem(STORAGE_KEY, theme)
      syncDocument(theme)
      if (isBrowser) window.dispatchEvent(new CustomEvent('heluo:theme-change', { detail: theme }))
    }

    if (!isBrowser || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      applyState()
      return
    }

    if (typeof document.startViewTransition === 'function') {
      const { x, y } = resolveOrigin(origin)
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      const rootStyle = document.documentElement.style
      rootStyle.setProperty('--theme-x', `${Math.round(x)}px`)
      rootStyle.setProperty('--theme-y', `${Math.round(y)}px`)
      rootStyle.setProperty('--theme-radius', `${Math.ceil(radius)}px`)
      document.documentElement.classList.add('is-theme-transitioning')

      try {
        const transition = document.startViewTransition(applyState)
        transition.finished
          .catch(() => undefined)
          .finally(() => {
            document.documentElement.classList.remove('is-theme-transitioning')
          })
      } catch {
        document.documentElement.classList.remove('is-theme-transitioning')
        applyState()
      }
      return
    }

    if (fadeTimer) window.clearTimeout(fadeTimer)
    document.documentElement.classList.add('theme-fading')
    applyState()
    fadeTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-fading')
      fadeTimer = undefined
    }, 280)
  }

  function toggle(origin?: ThemeTransitionOrigin | MouseEvent) {
    const coords = origin && 'clientX' in origin
      ? { x: origin.clientX, y: origin.clientY }
      : origin
    setTheme(isDark.value ? 'light' : 'dark', coords)
  }

  return { theme: current, isDark, setTheme, toggle }
}
