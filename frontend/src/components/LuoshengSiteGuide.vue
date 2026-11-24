<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '../assets/luosheng-palette.css'
import { GuideClientError, streamGuideChat } from '../lib/guideClient'
import { getGuideStrings, getRoutePreset } from '../lib/guidePresets'
import {
  GUIDE_ARTIFACT_SLUG,
  type GuideAction,
  type GuideLocale,
  type GuideMessage,
} from '../lib/guideTypes'
import { audioSystem } from '../lib/audioSystem'
import { useLocale } from '../stores/locale'
import { useLuoshengStore } from '../stores/luoshengStore'

const route = useRoute()
const router = useRouter()
const { locale } = useLocale()
const store = useLuoshengStore()

const guideLocale = computed<GuideLocale>(() => (locale.value === 'en-US' ? 'en-US' : 'zh-CN'))
const strings = computed(() => getGuideStrings(guideLocale.value))
const preset = computed(() => getRoutePreset(store.pageContext, guideLocale.value))

const inputText = ref('')
const streaming = ref(false)
const streamError = ref('')
const logContainer = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const fabEl = ref<HTMLButtonElement | null>(null)

let activeAbort: AbortController | null = null

const hasMessages = computed(() => store.messages.some(m => m.role === 'user' || m.role === 'assistant'))
const latestAssistantId = computed(() => {
  for (let i = store.messages.length - 1; i >= 0; i -= 1) {
    if (store.messages[i]?.role === 'assistant') return store.messages[i]!.id
  }
  return ''
})

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function scrollToBottom() {
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}

watch(
  () => store.open,
  async (isOpen) => {
    if (isOpen) {
      if (store.draftQuestion) {
        inputText.value = store.draftQuestion
        store.draftQuestion = ''
      }
      await nextTick()
      await scrollToBottom()
      inputEl.value?.focus({ preventScroll: true })
    } else {
      const target = store.opener && store.opener.isConnected ? store.opener : fabEl.value
      store.opener = null
      await nextTick()
      target?.focus({ preventScroll: true })
    }
  },
)

watch(
  () => store.draftQuestion,
  (draft) => {
    if (draft && store.open) {
      inputText.value = draft
      store.draftQuestion = ''
      void nextTick(() => inputEl.value?.focus({ preventScroll: true }))
    }
  },
)

function openPanel(event: MouseEvent) {
  store.openGuide(event.currentTarget as HTMLElement)
}

function closePanel() {
  store.closeGuide()
}

function stopGeneration() {
  if (activeAbort) {
    activeAbort.abort()
    activeAbort = null
  }
}

function clearHistory() {
  stopGeneration()
  streaming.value = false
  streamError.value = ''
  store.clearConversation()
  void nextTick(() => inputEl.value?.focus({ preventScroll: true }))
}

async function sendMessage(rawQuestion?: string) {
  const question = (rawQuestion ?? inputText.value).trim()
  if (!question || streaming.value) return

  if (!rawQuestion) inputText.value = ''
  streamError.value = ''

  const history = store.historyForApi()
  const requestId = makeId()

  store.appendMessage({
    id: makeId(),
    role: 'user',
    text: question,
    createdAt: Date.now(),
  })

  const assistantMsg: GuideMessage = {
    id: makeId(),
    role: 'assistant',
    text: '',
    streaming: true,
    statusPhase: 'thinking',
    citations: [],
    actions: [],
    followUps: [],
    boundaryNote: '',
    createdAt: Date.now(),
  }
  store.appendMessage(assistantMsg)
  // Retrieve the reactive proxy inside Pinia state
  const liveMsg = store.messages.find(m => m.id === assistantMsg.id)
  if (!liveMsg) return

  await scrollToBottom()

  streaming.value = true
  const abortController = new AbortController()
  activeAbort = abortController

  try {
    const response = await streamGuideChat(
      {
        conversationId: store.conversationId,
        requestId,
        message: question,
        locale: guideLocale.value,
        context: {
          route: store.pageContext.route,
          artifactSlug: store.pageContext.artifactSlug,
          exhibitSlug: store.pageContext.exhibitSlug,
          articleSlug: store.pageContext.articleSlug,
          viewerState: store.pageContext.viewerState,
        },
        history,
      },
      {
        onStatus(phase) {
          liveMsg.statusPhase = phase
          void scrollToBottom()
        },
        onDelta(chunk) {
          liveMsg.statusPhase = null
          liveMsg.text += chunk
          void scrollToBottom()
        },
        onReplace(replacement) {
          liveMsg.statusPhase = null
          liveMsg.text = replacement
          void scrollToBottom()
        },
        onDone(done) {
          liveMsg.text = done.text
          liveMsg.citations = done.citations
          liveMsg.actions = done.actions
          liveMsg.followUps = done.followUps
          liveMsg.boundaryNote = done.boundaryNote
          liveMsg.mode = done.mode
          liveMsg.degraded = done.degraded
          liveMsg.streaming = false
          liveMsg.statusPhase = null
        },
      },
      abortController.signal,
    )

    if (liveMsg.streaming) {
      liveMsg.text = response.text
      liveMsg.citations = response.citations
      liveMsg.actions = response.actions
      liveMsg.followUps = response.followUps
      liveMsg.boundaryNote = response.boundaryNote
      liveMsg.mode = response.mode
      liveMsg.degraded = response.degraded
      liveMsg.streaming = false
      liveMsg.statusPhase = null
    }
    store.persist()
  } catch (err) {
    liveMsg.streaming = false
    liveMsg.statusPhase = null
    if (abortController.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      if (!liveMsg.text.trim()) {
        liveMsg.text = strings.value.stoppedNotice
      }
      store.persist()
    } else if (err instanceof GuideClientError && err.status === 429) {
      streamError.value = strings.value.rateLimited
      if (!liveMsg.text.trim()) store.messages.pop()
      store.persist()
    } else {
      streamError.value = strings.value.networkError
      if (!liveMsg.text.trim()) store.messages.pop()
      store.persist()
    }
  } finally {
    if (activeAbort === abortController) activeAbort = null
    streaming.value = false
    await scrollToBottom()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void sendMessage()
  }
}

async function handleAction(action: GuideAction) {
  const isMobile = window.innerWidth < 768

  if (action.type === 'viewer_focus' && action.exhibitSlug) {
    store.queueViewerAction({
      exhibitSlug: action.exhibitSlug,
      part: action.part ?? null,
      view: action.view ?? null,
      mode: action.mode ?? null,
      label: action.label,
    })
    if (isMobile) store.closeGuide()
    const targetPath = `/exhibits/${action.exhibitSlug}`
    if (route.path !== targetPath) {
      await router.push(targetPath)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    return
  }

  if (action.type === 'viewer_mode' && action.exhibitSlug && action.mode) {
    store.queueViewerAction({
      exhibitSlug: action.exhibitSlug,
      mode: action.mode,
      label: action.label,
    })
    if (isMobile) store.closeGuide()
    const targetPath = `/exhibits/${action.exhibitSlug}`
    if (route.path !== targetPath) {
      await router.push(targetPath)
    }
    return
  }

  if (action.type === 'viewer_tour' && action.exhibitSlug) {
    store.queueViewerAction({
      exhibitSlug: action.exhibitSlug,
      tour: true,
      label: action.label,
    })
    if (isMobile) store.closeGuide()
    const targetPath = `/exhibits/${action.exhibitSlug}`
    if (route.path !== targetPath) {
      await router.push(targetPath)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    return
  }

  if (action.type === 'navigate' && action.path) {
    if (isMobile) store.closeGuide()
    await router.push({ path: action.path, query: action.query ?? undefined })
    return
  }

  if (action.type === 'open_plate' && action.stop) {
    store.queuePlateAction(action.stop, Boolean(action.compare))
    if (isMobile) store.closeGuide()
    if (route.path !== `/artifacts/${GUIDE_ARTIFACT_SLUG}` && !route.path.startsWith('/exhibits/')) {
      await router.push(`/artifacts/${GUIDE_ARTIFACT_SLUG}`)
      await nextTick()
    }
    setTimeout(() => {
      document.getElementById('luosheng-static-plates')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }
}

interface InlineSpan {
  text: string
  bold: boolean
}

interface MessageBlock {
  kind: 'p' | 'ul' | 'ol'
  items: InlineSpan[][]
}

function parseInlineSpans(rawLine: string, isStreaming = false): InlineSpan[] {
  let line = rawLine
  if (isStreaming) {
    // Strip lone trailing asterisk or empty trailing ** before closing content arrives
    if (line.endsWith('**')) {
      const before = line.slice(0, -2)
      if ((before.match(/\*\*/g)?.length ?? 0) % 2 === 0) {
        line = before
      }
    } else if (line.endsWith('*') && !line.endsWith('**')) {
      line = line.slice(0, -1)
    }
    const pairCount = line.match(/\*\*/g)?.length ?? 0
    if (pairCount % 2 === 1) {
      line = `${line}**`
    }
  }

  const spans: InlineSpan[] = []
  const pattern = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: line.slice(lastIndex, match.index), bold: false })
    }
    spans.push({ text: match[1] ?? '', bold: true })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < line.length) {
    spans.push({ text: line.slice(lastIndex), bold: false })
  }
  return spans.length > 0 ? spans : [{ text: line, bold: false }]
}

function parseMessageBlocks(text: string, isStreaming = false): MessageBlock[] {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const blocks: MessageBlock[] = []
  lines.forEach((line, idx) => {
    const lineStreaming = isStreaming && idx === lines.length - 1
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/)
    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/)
    if (bulletMatch?.[1]) {
      const last = blocks.at(-1)
      const spans = parseInlineSpans(bulletMatch[1], lineStreaming)
      if (last?.kind === 'ul') last.items.push(spans)
      else blocks.push({ kind: 'ul', items: [spans] })
    } else if (orderedMatch?.[1]) {
      const last = blocks.at(-1)
      const spans = parseInlineSpans(orderedMatch[1], lineStreaming)
      if (last?.kind === 'ol') last.items.push(spans)
      else blocks.push({ kind: 'ol', items: [spans] })
    } else {
      blocks.push({ kind: 'p', items: [parseInlineSpans(line, lineStreaming)] })
    }
  })
  return blocks
}

const parsedBlocksByMsgId = computed<Record<string, MessageBlock[]>>(() => {
  const map: Record<string, MessageBlock[]> = {}
  for (const msg of store.messages) {
    if (msg.role !== 'divider' && msg.text) {
      map[msg.id] = parseMessageBlocks(msg.text, Boolean(msg.streaming))
    }
  }
  return map
})

function dividerQuickQuestion(msg: GuideMessage): string {
  if (msg.role !== 'divider') return ''
  const ctx = msg.dividerContext ?? store.pageContext
  return getRoutePreset(ctx, guideLocale.value).starters[0] ?? ''
}

function askFromDivider(msg: GuideMessage) {
  const q = dividerQuickQuestion(msg)
  if (!q || streaming.value) return
  msg.dividerConsumed = true
  store.persist()
  void sendMessage(q)
}

watch(
  [() => store.open, streaming],
  ([isOpen, isStreaming]) => {
    if (!isOpen) {
      audioSystem.setFocusDuck('luosheng', false)
    } else if (isStreaming) {
      audioSystem.setFocusDuck('luosheng', true, 0.62)
    } else {
      audioSystem.setFocusDuck('luosheng', true, 0.72)
    }
  },
)

onBeforeUnmount(() => {
  stopGeneration()
  audioSystem.setFocusDuck('luosheng', false)
})
</script>

<template>
  <div class="luosheng-root luosheng-palette">
    <!-- Subtle mobile/3D action toast -->
    <Transition name="luosheng-fade">
      <div v-if="store.toastMessage" class="luosheng-toast" role="status" aria-live="polite">
        {{ store.toastMessage }}
      </div>
    </Transition>

    <!-- Floating trigger capsule -->
    <button
      v-show="!store.open"
      ref="fabEl"
      type="button"
      class="luosheng-fab"
      data-testid="luosheng-fab"
      :aria-label="strings.fabAria"
      aria-haspopup="dialog"
      aria-expanded="false"
      @click="openPanel"
    >
      <span class="luosheng-fab__seal" aria-hidden="true">笙</span>
      <span class="luosheng-fab__label">{{ strings.fabLabel }}</span>
      <span v-if="hasMessages" class="luosheng-fab__dot" aria-hidden="true"></span>
    </button>

    <!-- Multi-turn streaming guide drawer -->
    <Transition name="luosheng-drawer">
      <section
        v-if="store.open"
        class="luosheng-drawer"
        data-testid="luosheng-drawer"
        role="dialog"
        aria-modal="false"
        :aria-label="strings.title"
        @keydown.esc="closePanel"
      >
        <header class="luosheng-drawer__header">
          <div class="luosheng-drawer__identity">
            <span class="luosheng-seal" aria-hidden="true">笙</span>
            <div>
              <h2>{{ strings.title }}</h2>
              <p>{{ strings.subtitle }}</p>
            </div>
          </div>
          <div class="luosheng-drawer__controls">
            <button
              v-if="hasMessages"
              type="button"
              class="luosheng-header-btn"
              data-testid="luosheng-clear"
              :aria-label="strings.clearConfirmAria"
              @click="clearHistory"
            >
              {{ strings.clear }}
            </button>
            <button
              type="button"
              class="luosheng-header-btn luosheng-header-btn--close"
              data-testid="luosheng-close"
              :aria-label="strings.close"
              @click="closePanel"
            >
              ×
            </button>
          </div>
        </header>

        <div ref="logContainer" class="luosheng-log" role="log" aria-live="polite" :aria-busy="streaming">
          <!-- Welcome & route-tailored starter pills -->
          <div v-if="!hasMessages" class="luosheng-welcome">
            <p class="luosheng-welcome__lead">{{ preset.welcome }}</p>
            <div class="luosheng-starters">
              <button
                v-for="starter in preset.starters"
                :key="starter"
                type="button"
                class="luosheng-starter-chip"
                @click="sendMessage(starter)"
              >
                {{ starter }}
              </button>
            </div>
          </div>

          <!-- Conversation messages -->
          <template v-for="msg in store.messages" :key="msg.id">
            <div v-if="msg.role === 'divider'" class="luosheng-divider-group" role="separator">
              <div class="luosheng-divider">
                <span>{{ strings.dividerPrefix }} · {{ msg.text }}</span>
              </div>
              <button
                v-if="!msg.dividerConsumed && dividerQuickQuestion(msg)"
                type="button"
                class="luosheng-divider-chip"
                data-testid="luosheng-divider-starter"
                :disabled="streaming"
                @click="askFromDivider(msg)"
              >
                {{ dividerQuickQuestion(msg) }}
              </button>
            </div>

            <article
              v-else
              class="luosheng-msg"
              :class="`luosheng-msg--${msg.role}`"
              :data-role="msg.role"
            >
              <div v-if="msg.role === 'assistant'" class="luosheng-msg__meta">
                <span
                  v-if="msg.mode"
                  class="luosheng-mode-badge"
                  :class="msg.mode === 'ai' ? 'is-ai' : 'is-archive'"
                  data-testid="luosheng-mode-badge"
                >
                  {{ msg.mode === 'ai' ? strings.aiBadge : strings.archiveBadge }}
                </span>
                <span v-if="msg.degraded" class="luosheng-degraded-hint">{{ strings.degradedHint }}</span>
              </div>

              <p v-if="msg.statusPhase" class="luosheng-status" role="status">
                <span class="luosheng-status__pulse" aria-hidden="true"></span>
                <span>{{ strings.statusLabels[msg.statusPhase] }}</span>
              </p>

              <div class="luosheng-bubble">
                <template v-if="msg.text && parsedBlocksByMsgId[msg.id]">
                  <template v-for="(block, bIdx) in parsedBlocksByMsgId[msg.id]" :key="bIdx">
                    <p v-if="block.kind === 'p'">
                      <template v-for="(span, sIdx) in block.items[0]" :key="sIdx">
                        <strong v-if="span.bold">{{ span.text }}</strong>
                        <template v-else>{{ span.text }}</template>
                      </template>
                      <span
                        v-if="msg.streaming && bIdx === (parsedBlocksByMsgId[msg.id]?.length ?? 1) - 1"
                        class="luosheng-cursor"
                        aria-hidden="true"
                      ></span>
                    </p>
                    <ul v-else-if="block.kind === 'ul'" class="luosheng-list">
                      <li v-for="(item, iIdx) in block.items" :key="iIdx">
                        <template v-for="(span, sIdx) in item" :key="sIdx">
                          <strong v-if="span.bold">{{ span.text }}</strong>
                          <template v-else>{{ span.text }}</template>
                        </template>
                        <span
                          v-if="msg.streaming && bIdx === (parsedBlocksByMsgId[msg.id]?.length ?? 1) - 1 && iIdx === block.items.length - 1"
                          class="luosheng-cursor"
                          aria-hidden="true"
                        ></span>
                      </li>
                    </ul>
                    <ol v-else class="luosheng-list luosheng-list--ordered">
                      <li v-for="(item, iIdx) in block.items" :key="iIdx">
                        <template v-for="(span, sIdx) in item" :key="sIdx">
                          <strong v-if="span.bold">{{ span.text }}</strong>
                          <template v-else>{{ span.text }}</template>
                        </template>
                        <span
                          v-if="msg.streaming && bIdx === (parsedBlocksByMsgId[msg.id]?.length ?? 1) - 1 && iIdx === block.items.length - 1"
                          class="luosheng-cursor"
                          aria-hidden="true"
                        ></span>
                      </li>
                    </ol>
                  </template>
                </template>
                <span v-else-if="msg.streaming" class="luosheng-cursor" aria-hidden="true"></span>
              </div>

              <!-- Validated structured action capsules -->
              <div v-if="msg.actions && msg.actions.length" class="luosheng-actions">
                <template v-for="(action, idx) in msg.actions" :key="`${msg.id}-act-${idx}`">
                  <a
                    v-if="action.type === 'open_source' && action.url"
                    class="luosheng-action-btn luosheng-action-btn--source"
                    :href="action.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ action.label }} ↗
                  </a>
                  <button
                    v-else
                    type="button"
                    class="luosheng-action-btn"
                    :class="{ 'luosheng-action-btn--3d': action.type === 'viewer_focus' || action.type === 'viewer_mode' || action.type === 'viewer_tour' }"
                    :data-action-type="action.type"
                    @click="handleAction(action)"
                  >
                    {{ action.label }}
                  </button>
                </template>
              </div>

              <!-- Collapsible Sources & Boundaries drawer -->
              <details
                v-if="!msg.streaming && ((msg.citations && msg.citations.length) || msg.boundaryNote)"
                class="luosheng-sources"
              >
                <summary>{{ strings.sourcesToggle }}<span v-if="msg.citations?.length"> ({{ msg.citations.length }})</span></summary>
                <div class="luosheng-sources__body">
                  <ul v-if="msg.citations?.length" class="luosheng-citation-list">
                    <li v-for="c in msg.citations" :key="c.id">
                      <span class="luosheng-citation-id font-mono">{{ c.id }} · {{ c.revision }}</span>
                      <strong>{{ c.title }}</strong>
                      <div class="luosheng-citation-links">
                        <a
                          v-if="c.publicSourceUrl"
                          :href="c.publicSourceUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {{ guideLocale === 'en-US' ? 'Public Record ↗' : '馆方公开档案 ↗' }}
                        </a>
                        <button
                          v-if="c.internalPath"
                          type="button"
                          class="luosheng-citation-nav"
                          @click="handleAction({ type: 'navigate', path: c.internalPath, label: c.title })"
                        >
                          {{ guideLocale === 'en-US' ? 'Open Page →' : '查看站内页面 →' }}
                        </button>
                      </div>
                    </li>
                  </ul>
                  <p v-if="msg.boundaryNote" class="luosheng-boundary">
                    <strong>{{ strings.boundaryLabel }}：</strong>{{ msg.boundaryNote }}
                  </p>
                </div>
              </details>

              <!-- Follow-up suggestion pills on the latest assistant message -->
              <div
                v-if="!msg.streaming && msg.id === latestAssistantId && msg.followUps && msg.followUps.length"
                class="luosheng-followups"
              >
                <button
                  v-for="q in msg.followUps.slice(0, 2)"
                  :key="q"
                  type="button"
                  class="luosheng-followup-chip"
                  @click="sendMessage(q)"
                >
                  {{ q }}
                </button>
              </div>
            </article>
          </template>

          <p v-if="streamError" class="luosheng-error" role="alert">{{ streamError }}</p>
        </div>

        <form class="luosheng-composer" @submit.prevent="sendMessage()">
          <textarea
            ref="inputEl"
            v-model="inputText"
            class="luosheng-input"
            data-testid="luosheng-input"
            rows="1"
            maxlength="500"
            :placeholder="strings.inputPlaceholder"
            :aria-label="strings.inputPlaceholder"
            :disabled="streaming"
            @keydown="handleKeydown"
          ></textarea>
          <button
            v-if="streaming"
            type="button"
            class="luosheng-send luosheng-send--stop"
            data-testid="luosheng-stop"
            @click="stopGeneration"
          >
            {{ strings.stop }}
          </button>
          <button
            v-else
            type="submit"
            class="luosheng-send"
            data-testid="luosheng-send"
            :disabled="!inputText.trim()"
          >
            {{ strings.send }}
          </button>
        </form>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.luosheng-root {
  position: fixed;
  right: var(--space-5);
  bottom: var(--space-5);
  z-index: 80;
  pointer-events: none;
}

.luosheng-root > * {
  pointer-events: auto;
}

.luosheng-toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--mobile-tab-height, 64px) + var(--space-5));
  transform: translateX(-50%);
  z-index: 90;
  padding: 0.6rem 1.15rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--guide-metal);
  background: var(--guide-paper);
  color: var(--guide-ink);
  font-size: var(--text-xs);
  font-weight: 600;
  box-shadow: var(--shadow-md);
  white-space: nowrap;
}

/* ── Floating Trigger Capsule ── */
.luosheng-fab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 48px;
  padding: 0.45rem 1.05rem 0.45rem 0.55rem;
  border: 1px solid var(--guide-metal);
  border-radius: var(--radius-pill);
  background: var(--guide-paper);
  color: var(--guide-ink);
  font-family: var(--guide-body-font);
  font-size: var(--text-sm);
  font-weight: 600;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-curatorial), border-color var(--duration-fast) var(--ease-curatorial);
}

.luosheng-fab:hover {
  transform: translateY(-2px);
  border-color: var(--guide-signal);
}

.luosheng-fab__seal,
.luosheng-seal {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid var(--guide-metal);
  background: color-mix(in oklch, var(--guide-metal) 14%, var(--guide-paper));
  color: var(--guide-metal);
  font-family: var(--guide-head);
  font-size: var(--text-sm);
  font-weight: 600;
  flex-shrink: 0;
}

.luosheng-fab__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--guide-signal);
}

/* ── Gallery Guide Drawer ── */
.luosheng-drawer {
  width: min(420px, calc(100vw - 2rem));
  max-height: min(680px, calc(100dvh - 5.5rem));
  display: flex;
  flex-direction: column;
  border: 1px solid var(--guide-edge);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--guide-paper) 94%, transparent);
  color: var(--guide-ink);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  overflow: hidden;
}

.luosheng-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-hairline);
  background: color-mix(in oklch, var(--guide-screen) 65%, transparent);
}

.luosheng-drawer__identity {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.luosheng-drawer__identity h2 {
  margin: 0;
  font-family: var(--guide-head);
  font-size: var(--text-md);
  line-height: 1.25;
}

.luosheng-drawer__identity p {
  margin: 0.1rem 0 0;
  font-size: var(--text-xs);
  color: var(--guide-muted);
}

.luosheng-drawer__controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.luosheng-header-btn {
  min-height: 36px;
  padding: 0 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--guide-paper);
  color: var(--guide-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.luosheng-header-btn:hover {
  color: var(--guide-ink);
  border-color: var(--guide-metal);
}

.luosheng-header-btn--close {
  min-width: 36px;
  padding: 0;
  font-size: 1.25rem;
  line-height: 1;
}

/* ── Chat Log ── */
.luosheng-log {
  flex: 1 1 auto;
  min-height: 220px;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.luosheng-welcome {
  display: grid;
  gap: 0.85rem;
}

.luosheng-welcome__lead {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-md);
  background: var(--guide-reply);
  border: 1px solid var(--border-hairline);
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-secondary);
}

.luosheng-starters {
  display: grid;
  gap: 0.5rem;
}

.luosheng-starter-chip {
  text-align: left;
  min-height: 44px;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--guide-field);
  color: var(--guide-ink);
  font-size: var(--text-sm);
  line-height: 1.45;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial);
}

.luosheng-starter-chip:hover {
  border-color: var(--guide-metal);
}

.luosheng-divider-group {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
}

.luosheng-divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: var(--text-xs);
  color: var(--guide-muted);
}

.luosheng-divider-chip {
  min-height: 34px;
  padding: 0.25rem 0.85rem;
  border: 1px solid color-mix(in oklch, var(--guide-metal) 55%, var(--border-strong));
  border-radius: var(--radius-pill);
  background: var(--guide-paper);
  color: var(--guide-ink);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial), transform 100ms ease-out;
}

.luosheng-divider-chip:hover:not(:disabled) {
  border-color: var(--guide-signal);
}

.luosheng-divider-chip:active:not(:disabled) {
  transform: scale(0.97);
}

.luosheng-divider-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.luosheng-divider::before,
.luosheng-divider::after {
  content: '';
  flex: 1 1 auto;
  height: 1px;
  background: var(--border-hairline);
}

.luosheng-msg {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.luosheng-msg--user {
  align-items: flex-end;
}

.luosheng-msg--assistant {
  align-items: flex-start;
}

.luosheng-msg__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.luosheng-mode-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.55rem;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 600;
}

.luosheng-mode-badge.is-ai {
  background: color-mix(in oklch, var(--guide-signal) 15%, var(--guide-paper));
  color: var(--guide-signal);
  border: 1px solid color-mix(in oklch, var(--guide-signal) 35%, transparent);
}

.luosheng-mode-badge.is-archive {
  background: color-mix(in oklch, var(--guide-metal) 14%, var(--guide-paper));
  color: var(--guide-metal);
  border: 1px solid color-mix(in oklch, var(--guide-metal) 35%, transparent);
}

.luosheng-degraded-hint {
  font-size: 0.75rem;
  color: var(--guide-muted);
}

.luosheng-status {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--text-xs);
  color: var(--guide-muted);
}

.luosheng-status__pulse {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--guide-metal);
  animation: luosheng-pulse 1.2s ease-in-out infinite;
}

.luosheng-bubble {
  max-width: 92%;
  padding: 0.7rem 0.95rem;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.72;
  overflow-wrap: anywhere;
}

.luosheng-bubble p {
  margin: 0;
}

.luosheng-bubble p + p,
.luosheng-bubble p + .luosheng-list,
.luosheng-bubble .luosheng-list + p,
.luosheng-bubble .luosheng-list + .luosheng-list {
  margin-top: 0.5rem;
}

.luosheng-list {
  margin: 0;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.3rem;
}

.luosheng-bubble strong {
  font-weight: 600;
  color: inherit;
}

.luosheng-msg--user .luosheng-bubble {
  background: var(--guide-action);
  color: var(--guide-action-ink);
  border-bottom-right-radius: var(--radius-xs);
}

.luosheng-msg--assistant .luosheng-bubble {
  background: var(--guide-reply);
  border: 1px solid var(--border-hairline);
  color: var(--guide-ink);
  border-bottom-left-radius: var(--radius-xs);
}

.luosheng-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.15em;
  background: var(--guide-metal);
  animation: luosheng-blink 0.9s steps(2) infinite;
}

/* ── Action Capsules ── */
.luosheng-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  max-width: 96%;
}

.luosheng-action-btn {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--guide-paper);
  color: var(--guide-ink);
  font-size: var(--text-xs);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial), background var(--duration-fast) var(--ease-curatorial);
}

.luosheng-action-btn--3d {
  border-color: var(--guide-signal);
  background: color-mix(in oklch, var(--guide-signal) 12%, var(--guide-paper));
  color: var(--guide-ink);
}

.luosheng-action-btn:hover {
  border-color: var(--guide-metal);
}

/* ── Sources & Boundary Collapsible Drawer ── */
.luosheng-sources {
  width: 100%;
  max-width: 96%;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--guide-field);
  font-size: var(--text-xs);
}

.luosheng-sources summary {
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  color: var(--guide-muted);
  font-weight: 600;
  user-select: none;
}

.luosheng-sources__body {
  padding: 0.5rem 0.75rem 0.75rem;
  border-top: 1px solid var(--border-hairline);
  display: grid;
  gap: 0.6rem;
}

.luosheng-citation-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.luosheng-citation-list li {
  display: grid;
  gap: 0.2rem;
}

.luosheng-citation-id {
  font-size: 0.75rem;
  color: var(--guide-metal);
}

.luosheng-citation-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.luosheng-citation-links a,
.luosheng-citation-nav {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--guide-signal);
  font-size: var(--text-xs);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.18em;
  cursor: pointer;
}

.luosheng-boundary {
  margin: 0;
  line-height: 1.6;
  color: var(--guide-muted);
}

/* ── Follow-up Pills ── */
.luosheng-followups {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.luosheng-followup-chip {
  min-height: 36px;
  padding: 0.3rem 0.75rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
}

.luosheng-followup-chip:hover {
  border-color: var(--guide-metal);
  color: var(--guide-ink);
}

.luosheng-error {
  margin: 0;
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--danger, var(--guide-metal));
  background: var(--guide-field);
  color: var(--guide-ink);
  font-size: var(--text-xs);
}

/* ── Composer ── */
.luosheng-composer {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-top: 1px solid var(--border-hairline);
  background: var(--guide-paper);
}

.luosheng-input {
  flex: 1 1 auto;
  min-height: 44px;
  max-height: 112px;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--guide-field-edge);
  border-radius: var(--radius-sm);
  background: var(--guide-field);
  color: var(--guide-ink);
  font-family: var(--guide-body-font);
  font-size: var(--text-sm);
  line-height: 1.45;
  resize: none;
}

.luosheng-input:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 1px;
}

.luosheng-send {
  min-width: 68px;
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid var(--guide-action);
  border-radius: var(--radius-sm);
  background: var(--guide-action);
  color: var(--guide-action-ink);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.luosheng-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.luosheng-send--stop {
  border-color: var(--guide-metal);
  background: var(--guide-paper);
  color: var(--guide-ink);
}

@keyframes luosheng-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
}

@keyframes luosheng-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.luosheng-drawer-enter-active,
.luosheng-drawer-leave-active {
  transition: opacity 200ms var(--ease-curatorial), transform 220ms var(--ease-curatorial);
}

.luosheng-drawer-enter-from,
.luosheng-drawer-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

.luosheng-fade-enter-active,
.luosheng-fade-leave-active {
  transition: opacity 200ms ease;
}

.luosheng-fade-enter-from,
.luosheng-fade-leave-to {
  opacity: 0;
}

/* ── Tablet / Mobile Tab-Bar Clearance (<= 960px) ── */
@media (max-width: 960px) {
  .luosheng-root {
    right: var(--space-4);
    bottom: calc(68px + env(safe-area-inset-bottom, 0px) + var(--space-2));
  }
}

/* ── Mobile Bottom Sheet Layout (< 768px) ── */
@media (max-width: 767px) {
  .luosheng-drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 82dvh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
</style>
