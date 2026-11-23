import { defineStore } from 'pinia'
import type {
  GuideHistoryTurn,
  GuideMessage,
  GuidePageContext,
  GuideViewerState,
  PendingPlateAction,
  PendingViewerAction,
} from '../lib/guideTypes'

const STORAGE_KEY = 'heluo.luosheng.v2.session'
const MAX_STORED_MESSAGES = 40

export const guideEnabled = import.meta.env.VITE_GUIDE_ENABLED === 'true'

interface PersistedSession {
  conversationId: string
  messages: GuideMessage[]
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ls-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadSession(): PersistedSession {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSession>
      if (typeof parsed.conversationId === 'string' && Array.isArray(parsed.messages)) {
        const cleanMessages = parsed.messages
          .filter((m): m is GuideMessage => Boolean(m && typeof m.id === 'string' && typeof m.role === 'string' && typeof m.text === 'string'))
          .map(m => ({ ...m, streaming: false, statusPhase: null }))
          .slice(-MAX_STORED_MESSAGES)
        return { conversationId: parsed.conversationId, messages: cleanMessages }
      }
    }
  } catch {
    // Ignore restricted storage environments
  }
  return { conversationId: makeUuid(), messages: [] }
}

function saveSession(conversationId: string, messages: GuideMessage[]) {
  try {
    const snapshot: PersistedSession = {
      conversationId,
      messages: messages.slice(-MAX_STORED_MESSAGES).map(m => ({
        ...m,
        streaming: false,
        statusPhase: null,
      })),
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore quota or privacy mode errors
  }
}

export const useLuoshengStore = defineStore('luosheng-v2', {
  state: () => {
    const initial = loadSession()
    return {
      conversationId: initial.conversationId,
      messages: initial.messages as GuideMessage[],
      open: false,
      opener: null as HTMLElement | null,
      draftQuestion: '',
      pageContext: {
        route: 'home',
        path: '/',
        title: '',
        artifactSlug: null,
        exhibitSlug: null,
        articleSlug: null,
        viewerState: undefined,
      } as GuidePageContext,
      pendingViewerAction: null as PendingViewerAction | null,
      pendingPlateAction: null as PendingPlateAction | null,
      toastMessage: '',
      toastTimer: null as ReturnType<typeof setTimeout> | null,
    }
  },
  actions: {
    persist() {
      saveSession(this.conversationId, this.messages)
    },
    openGuide(opener?: HTMLElement | null, prefill?: string) {
      if (opener) this.opener = opener
      if (prefill !== undefined) this.draftQuestion = prefill
      this.open = true
    },
    closeGuide() {
      this.open = false
    },
    setPageContext(next: Partial<GuidePageContext> & { route: string; path: string }) {
      const prevKey = `${this.pageContext.route}:${this.pageContext.artifactSlug ?? ''}:${this.pageContext.exhibitSlug ?? ''}:${this.pageContext.articleSlug ?? ''}`
      const nextArtifact = next.artifactSlug ?? null
      const nextExhibit = next.exhibitSlug ?? null
      const nextArticle = next.articleSlug ?? null
      const nextKey = `${next.route}:${nextArtifact ?? ''}:${nextExhibit ?? ''}:${nextArticle ?? ''}`

      this.pageContext = {
        route: next.route,
        path: next.path,
        title: next.title ?? '',
        artifactSlug: nextArtifact,
        exhibitSlug: nextExhibit,
        articleSlug: nextArticle,
        viewerState: next.route === 'exhibit-detail' ? (next.viewerState ?? this.pageContext.viewerState) : undefined,
      }

      // Insert subtle context divider when switching pages mid-conversation
      if (prevKey !== nextKey && this.messages.some(m => m.role === 'user' || m.role === 'assistant')) {
        const last = this.messages.at(-1)
        const label = next.title || next.path
        if (last?.role === 'divider') {
          last.text = label
        } else {
          this.messages.push({
            id: makeUuid(),
            role: 'divider',
            text: label,
            createdAt: Date.now(),
          })
        }
        this.persist()
      }
    },
    setViewerState(state: GuideViewerState) {
      if (this.pageContext.route === 'exhibit-detail') {
        this.pageContext = { ...this.pageContext, viewerState: { ...state } }
      }
    },
    appendMessage(message: GuideMessage) {
      this.messages.push(message)
      if (this.messages.length > MAX_STORED_MESSAGES) {
        this.messages.splice(0, this.messages.length - MAX_STORED_MESSAGES)
      }
      this.persist()
    },
    clearConversation() {
      this.conversationId = makeUuid()
      this.messages = []
      this.draftQuestion = ''
      this.persist()
    },
    historyForApi(): GuideHistoryTurn[] {
      return this.messages
        .filter((m): m is GuideMessage & { role: 'user' | 'assistant' } =>
          (m.role === 'user' || m.role === 'assistant') && !m.streaming && Boolean(m.text.trim()))
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.text.trim().slice(0, 400),
        }))
    },
    queueViewerAction(action: Omit<PendingViewerAction, 'id'>) {
      this.pendingViewerAction = { ...action, id: makeUuid() }
    },
    consumeViewerAction(): PendingViewerAction | null {
      const action = this.pendingViewerAction
      this.pendingViewerAction = null
      return action
    },
    queuePlateAction(stop: PendingPlateAction['stop'], compare?: boolean) {
      this.pendingPlateAction = { id: makeUuid(), stop, compare }
    },
    consumePlateAction(): PendingPlateAction | null {
      const action = this.pendingPlateAction
      this.pendingPlateAction = null
      return action
    },
    showToast(message: string, durationMs = 3000) {
      if (this.toastTimer) clearTimeout(this.toastTimer)
      this.toastMessage = message
      this.toastTimer = setTimeout(() => {
        this.toastMessage = ''
        this.toastTimer = null
      }, durationMs)
    },
  },
})
