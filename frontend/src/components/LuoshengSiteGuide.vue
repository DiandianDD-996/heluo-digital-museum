<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowRight, Calendar, Close, Compass, Goods, Collection, Box, Promotion } from '@element-plus/icons-vue'
import { answerSiteGuide, asksAboutCurrentArticle, explainSitePage, firstVisit, siteStops, type SiteStop } from '../lib/luoshengSiteGuide'
import '../assets/luosheng-palette.css'
import { guideStopLabels as stopLabels, navigateGuidePlate, recordGuideJourney, unifiedGuideEnabled, unifiedGuidePreview, unifiedGuideTurns, useLuoshengVisit } from '../stores/luoshengVisit'
import { discoveryIntent, findGuideArtifacts, guideArtifactCover, guideArtifactReason, requestsSavedLookpoint } from '../lib/luoshengDiscovery'
import { useLuoshengTurns } from '../lib/luoshengTurns'
import { GUIDE_ARTIFACT, type GuideStop } from '../lib/luoshengPreview'
import { deferredSlotIntent, readGuideSlots, slotIntent } from '../lib/luoshengSlots'
import { apiGet } from '../lib/api'

const route = useRoute()
const router = useRouter()
const expanded = ref(false)
const visit = unifiedGuideEnabled ? useLuoshengVisit() : null
const object = computed(() => visit?.object?.path === route.path ? visit.object : null)
const article = computed(() => visit?.article?.path === route.path ? visit.article : null)
const liveModel = unifiedGuideTurns || import.meta.env.VITE_GUIDE_UNIFIED_PREVIEW === 'model'
const reviewedPreview = import.meta.env.DEV && import.meta.env.VITE_GUIDE_REVIEWED_PREVIEW === 'true'
const input = ref<HTMLInputElement>()
const failedCover = ref<string>()
const plateLabels = { ear: '看俯视图', feet: '看背视图', motif: '看纹样局部' }
const clarifySlotDate = '想查哪一天的公开时段？请给一个日期，例如「明天」或「11 月 23 日」。'
type Reply = {
  text: string; stops?: SiteStop[]; artifact?: string; title?: string; keyword?: string
  cover?: string
  retrySearch?: true
  plate?: GuideStop; observations?: GuideStop[]; sources?: string[]; generated?: boolean; readingFallback?: true
  directPlate?: boolean
  date?: string; resume?: true
  clarifySlotPeople?: number
  clarification?: boolean
  citations?: { label: string; source?: string }[]
}
const scope = computed(() => visit && expanded.value ? {
  exhibit: object.value?.exhibit ?? route.path,
  locale: 'zh-CN',
  lookpoint: visit.lookpoint,
} : null)
let contextId = ''
const turns = useLuoshengTurns<Reply>(scope, async ({ question, lookpoint, signal, previousAnswer }) => {
  if (visit?.resumePoint && requestsSavedLookpoint(question, visit.resumePoint.stop)) {
    return { text: `回到青铜鼎 · ${stopLabels[visit.resumePoint.stop]}，接着看刚才的图版。`, resume: true }
  }
  if (visit?.pendingSlots && /^(?:别|不用|不查|不想)(?:再)?(?:预约|查时段|看时段|查名额)/.test(question)) {
    visit.pendingSlots = null
    return { text: '已清除待查时段，可以继续看展品。' }
  }
  const deferred = deferredSlotIntent(question)
  const requestedSlot = deferred ? null : slotIntent(question, undefined, previousAnswer?.clarifySlotPeople)
  if (requestedSlot) return 'date' in requestedSlot
    ? readGuideSlots(requestedSlot.date, requestedSlot.people, signal)
    : { text: clarifySlotDate, clarifySlotPeople: requestedSlot.people, clarification: true }
  const intent = discoveryIntent(deferred?.first ?? question, !!object.value)
  if (intent.kind === 'clarify-discovery') return { text: '可以换一件。你想看哪类藏品？', stops: ['explore'], clarification: true }
  if (intent.kind === 'appointment') return answerSiteGuide('怎么预约参观', routeName.value)
  if (intent.kind === 'object') {
    if (import.meta.env.DEV && unifiedGuidePreview && object.value?.exhibit) {
      const requestContext = contextId ||= crypto.randomUUID()
      const { askLuoshengHttpFixture } = await import('../lib/luoshengHttpFixture')
      signal.throwIfAborted()
      return askLuoshengHttpFixture(question, lookpoint, requestContext, signal, liveModel)
    }
    if (unifiedGuideTurns && object.value?.exhibit && visit) {
      const request = {
        visitId: visit.getPublicVisitId(), requestId: crypto.randomUUID(),
        question, contextVersion: visit.revision, locale: 'zh-CN',
        artifact: object.value.slug, exhibit: object.value.exhibit, lookpoint,
      }
      const { askPublicGuide } = await import('../lib/luoshengPublicTurns')
      signal.throwIfAborted()
      return askPublicGuide(request, signal)
    }
    return { text: `${object.value?.title}。\n${object.value?.summary}\n可继续阅读此页的公开藏品资料。` }
  }
  if (intent.kind === 'search') {
    const result = await findGuideArtifacts(intent.keyword, signal, intent.exclusions).catch(() => null)
    signal.throwIfAborted()
    if (!result) return { text: '馆藏搜索暂时不可用。可以重试这次搜索，或换一个问题。', retrySearch: true }
    const item = result.items[0]
    if (!item) return { text: `没有找到「${intent.keyword}」的公开藏品。试试换个词，或打开馆藏看看。`, stops: ['explore'] }
    let directPlate = item.slug === GUIDE_ARTIFACT && unifiedGuidePreview
    if (import.meta.env.VITE_GUIDE_TURNS_ENABLED === 'true' && item.slug === GUIDE_ARTIFACT && !directPlate) {
      const preset = await apiGet<{ available: boolean; entries: { cardId: string }[] }>(
        '/guide/exhibits/heluo-bronze-ding-3d?locale=zh-CN', undefined, { signal, timeoutMs: 3000 },
      ).catch(() => null)
      signal.throwIfAborted()
      directPlate = !!preset?.available && preset.entries.some(entry => entry.cardId === 'LS-DING-EARS')
    }
    if (visit && deferred) visit.pendingSlots = 'date' in deferred.slot ? deferred.slot : null
    const quickLook = intent.short && directPlate
    const recommendation = quickLook
      ? '五分钟可以从青铜鼎开始。先从上方找鼎口相对的两只耳。'
      : `${item.title}。\n${guideArtifactReason(item, intent.keyword, result.keyword)}${item.summary ? '\n' + item.summary : ''}`
    return {
      text: deferred && 'clarifyDate' in deferred.slot ? `${recommendation}\n${clarifySlotDate}` : recommendation,
      clarifySlotPeople: deferred && 'clarifyDate' in deferred.slot ? deferred.slot.people : undefined,
      clarification: !!deferred && 'clarifyDate' in deferred.slot,
      artifact: item.slug, title: item.title, directPlate,
      cover: quickLook ? undefined : guideArtifactCover(item.coverImageUrl),
      keyword: result.items.length > 1 && !intent.exclusions.length ? result.keyword : undefined,
    }
  }
  if (routeName.value === 'article-detail' && asksAboutCurrentArticle(question)) {
    return article.value
      ? { text: `《${article.value.title}》\n${article.value.summary}`, stops: ['explore'] }
      : { text: '还没有读到这篇专题的公开资料。可以等页面加载，或回馆藏浏览其他专题。', stops: ['explore'] }
  }
  return answerSiteGuide(question, routeName.value)
}, (answer, previousAnswer) => {
  if (answer.clarification) recordGuideJourney(previousAnswer?.clarification ? 'clarification-repeated' : 'clarification-single')
})
watch(() => visit?.revision, () => {
  contextId = ''
  turns.cancel()
}, { flush: 'sync' })
watch(() => visit?.openRequest, async () => {
  await setExpanded(true)
  input.value?.focus()
}, { flush: 'post' })
const unifiedReply = computed(() => turns.state.value.status === 'answered' ? turns.state.value.answer : null)
const replyPlate = computed(() => unifiedReply.value?.plate ?? unifiedReply.value?.observations?.[0])
const readingTarget = computed(() => {
  if (!visit?.lookpoint || object.value?.slug !== GUIDE_ARTIFACT) return null
  if (!unifiedReply.value?.readingFallback && turns.state.value.status !== 'unavailable') return null
  const { path } = object.value
  const stop = visit.lookpoint
  const compare = visit.arrival?.path === path && visit.arrival.stop === stop && visit.arrival.compare
  return { path, stop, compare }
})
const unifiedText = computed(() => {
  if (turns.state.value.status === 'pending') return '正在查找相关资料…'
  if (turns.state.value.status === 'unavailable') return '暂时无法读取资料。你仍可阅读公开藏品页或查看当前图版。'
  if (unifiedReply.value) return unifiedReply.value.text
  if (visit?.targetFailure === 'content') return '暂时无法打开原展品。可以去馆藏看看其他公开展品。'
  if (visit?.targetFailure === 'plate') return '原看点暂时不可用。你可以继续阅读公开藏品资料，或去馆藏找其他展品。'
  if (object.value) return '想看清哪一处？可以直接说说你看到的细节。'
  if (routeName.value === 'appointment') return '想查哪天的公开时段？可以一起告诉我参观人数。'
  if (article.value) return '想了解这篇专题，或找一件相关展品？'
  if (routeName.value === 'shop') return '想逛文创？可以问我怎么浏览商品，也可以继续找展品。'
  return '想找什么展品？如果只有五分钟，也可以让我推荐一件。'
})

async function showPlate(stop: GuideStop, compare: boolean) {
  if (!visit || visit.target) return
  const slug = compare ? object.value?.slug : unifiedReply.value?.artifact
  if (slug !== GUIDE_ARTIFACT) return
  await goToPlate({ path: compare ? object.value!.path : `/artifacts/${slug}`, stop, compare })
}

function readPendingSlots() {
  const pending = visit?.pendingSlots
  if (!visit || !pending) return
  visit.pendingSlots = null
  void turns.ask(`${pending.date}还有${pending.people}人的公开时段吗？`)
}

async function goToPlate(target: NonNullable<NonNullable<typeof visit>['target']>, action: 'plate' | 'return' = 'plate') {
  if (visit) await navigateGuidePlate(visit, router, target, action, () => { expanded.value = false })
}

function openSlotPage(event: MouseEvent) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
  if (routeName.value === 'appointment') void setExpanded(false)
}
const panelId = useId()
const headingId = useId()
const question = ref('')
const composingQuestion = ref(false)
const submitted = ref('')
const trigger = ref<HTMLButtonElement>()
const heading = ref<HTMLHeadingElement>()
const startButton = ref<HTMLButtonElement>()
const tourPanel = ref<HTMLElement>()
const touring = ref(false)
const modelPreview = ref(false)
const tourIndex = ref(-1)
const nextStop = computed(() => firstVisit[tourIndex.value + 1])
const routeName = computed(() => String(route.name ?? ''))
const answer = computed(() => submitted.value
  ? answerSiteGuide(submitted.value, routeName.value)
  : explainSitePage(routeName.value))
const prompts = ['这个网站能做什么？', '从哪里开始逛？', '怎么预约参观？']
const stopIcons = { explore: Collection, exhibits: Box, appointment: Calendar, shop: Goods, ding: Box }

function destination(stop: SiteStop) {
  if (stop === 'ding' && import.meta.env.DEV && modelPreview.value) {
    return { path: siteStops.ding.path, query: { 'guide-turn-test': 'model' }, hash: '#luosheng-preview' }
  }
  return siteStops[stop].path
}

async function startTour() {
  touring.value = true
  tourIndex.value = route.path === siteStops[firstVisit[0]].path ? 0 : -1
  question.value = ''
  submitted.value = ''
  await nextTick()
  tourPanel.value?.focus()
}

async function endTour() {
  touring.value = false
  await nextTick()
  startButton.value?.focus()
}

async function setExpanded(value: boolean) {
  const opener = visit?.opener
  if (!value) {
    question.value = ''
    composingQuestion.value = false
    // The scope watcher aborts locally. A new version also prevents a completed
    // server-side turn from becoming the topic after the panel is reopened.
    if (visit && turns.state.value.status === 'pending') visit.revision++
  }
  expanded.value = value
  await nextTick()
  if (expanded.value !== value) return
  if (value) heading.value?.focus()
  else if (opener?.isConnected) opener.focus()
  else trigger.value?.focus()
}

function openFromTrigger() {
  if (visit) visit.opener = null
  void setExpanded(true)
}

function endVisit() {
  void setExpanded(false)
  visit?.end()
}

function ask(value: string) {
  const clean = value.trim()
  if (!clean) return
  question.value = ''
  if (visit) {
    if (/^(?:我先自己逛|不用讲了|结束讲解|我自己看)[。！!]?$/.test(clean)) {
      endVisit()
      return
    }
    void turns.ask(clean)
  } else submitted.value = clean
}

function isQuestionComposition(event: KeyboardEvent) {
  return composingQuestion.value || event.isComposing || event.keyCode === 229
}

function closeOnEscape(event: KeyboardEvent) {
  if (isQuestionComposition(event)) return
  event.stopPropagation()
  if (expanded.value) void setExpanded(false)
}

function submitQuestion() {
  if (!composingQuestion.value) ask(question.value)
}

function retrySearch() {
  if (!unifiedReply.value?.retrySearch) return
  const last = turns.history.value.at(-1)
  if (!last?.answer.retrySearch) return
  input.value?.focus()
  void turns.ask(last.question)
}

function guardCompositionEnter(event: KeyboardEvent) {
  // Some browsers end composition before reporting the confirming Enter.
  if (!composingQuestion.value && !event.isComposing && event.keyCode === 229) event.preventDefault()
}

if (import.meta.env.DEV) {
  watch(() => route.query['guide-turn-test'], (mode) => {
    if (mode === 'model') modelPreview.value = true
  }, { immediate: true })
}

watch(() => route.path, (path) => {
  if (touring.value && nextStop.value && siteStops[nextStop.value].path === path) {
    tourIndex.value += 1
  }
  expanded.value = false
  submitted.value = ''
  question.value = ''
  composingQuestion.value = false
})
watch(() => visit?.targetFailure, failure => {
  if (failure) void setExpanded(true)
}, { flush: 'post' })
</script>

<template>
  <aside class="luosheng-site luosheng-palette" aria-label="洛笙全站导览" @keydown.esc="closeOnEscape">
    <button
      v-show="!expanded" ref="trigger" class="site-guide-trigger" type="button"
      :aria-expanded="expanded" :aria-controls="panelId" @click="openFromTrigger"
    >
      <span class="site-guide-dial" aria-hidden="true"><Compass /></span>
      <span class="site-guide-trigger-label">{{ touring ? '继续导览' : '洛笙导览' }}</span>
    </button>
    <Transition name="site-guide-panel">
    <section v-show="expanded" :id="panelId" class="site-guide-panel" :aria-labelledby="headingId" :inert="!expanded">
      <header class="site-guide-header">
        <span class="site-guide-mark" aria-hidden="true"><Compass /></span>
        <div class="site-guide-title">
          <h2 :id="headingId" ref="heading" tabindex="-1">洛笙 · 全站导览</h2>
          <p v-if="visit">{{ object?.title ?? article?.title ?? (routeName === 'shop' ? siteStops.shop.label : '河洛数字博物馆') }}{{ visit.lookpoint ? ' › ' + stopLabels[visit.lookpoint] : '' }}</p>
          <p v-else>河洛数字博物馆</p>
        </div>
        <button type="button" class="site-guide-close" aria-label="关闭洛笙导览" @click="setExpanded(false)">
          <Close aria-hidden="true" />
        </button>
      </header>
      <div v-if="visit" class="site-guide-body">
        <div class="site-guide-response">
          <img v-if="unifiedReply?.cover && unifiedReply.cover !== failedCover" :key="unifiedReply.cover"
            :src="unifiedReply.cover" class="site-guide-cover" alt="" width="64" height="64" decoding="async"
            @error="failedCover = unifiedReply.cover" />
          <p class="site-guide-answer" role="status">{{ unifiedText }}</p>
        </div>
        <button v-if="unifiedReply?.retrySearch" type="button" class="site-guide-start" @click="retrySearch">重试搜索</button>
        <RouterLink v-if="visit.targetFailure && turns.state.value.status === 'idle'" to="/explore" class="site-guide-start">探索公开馆藏</RouterLink>
        <span v-if="unifiedReply?.generated" class="site-guide-meta">AI 实时回答</span>
        <button v-if="unifiedReply?.directPlate" type="button" class="site-guide-start" @click="showPlate('ear', false)">带我找鼎耳</button>
        <RouterLink v-else-if="unifiedReply?.artifact" class="site-guide-start" :to="`/artifacts/${unifiedReply.artifact}`">看{{ unifiedReply.title }}</RouterLink>
        <RouterLink v-if="unifiedReply?.keyword" :to="{ path: '/explore', query: { q: unifiedReply.keyword } }">看更多结果</RouterLink>
        <button v-if="replyPlate && object?.exhibit" type="button" class="site-guide-start" @click="showPlate(replyPlate, true)">{{ plateLabels[replyPlate] }}</button>
        <details v-if="unifiedReply?.sources?.length || unifiedReply?.observations?.length">
          <summary>查看本轮依据</summary>
          <p v-for="source in unifiedReply.sources" :key="source">
            <a :href="source" target="_blank" rel="noopener noreferrer">{{ liveModel || reviewedPreview ? 'Cleveland Museum of Art · 1962.281' : '合成测试出处' }}</a>
          </p>
          <button v-for="stop in unifiedReply.observations" :key="stop" type="button" class="site-guide-start" @click="showPlate(stop, true)">{{ stopLabels[stop] }}图版</button>
        </details>
        <details v-if="unifiedReply?.citations?.length">
          <summary>查看本轮依据</summary>
          <ul>
            <li v-for="citation in unifiedReply.citations" :key="citation.label">
              <a v-if="citation.source" :href="citation.source" target="_blank" rel="noopener noreferrer">{{ citation.label }}</a>
              <span v-else>{{ citation.label }}</span>
            </li>
          </ul>
        </details>
        <button v-if="readingTarget" type="button" class="site-guide-start" @click="goToPlate(readingTarget)">读当前讲解</button>
        <RouterLink v-if="unifiedReply?.date" class="site-guide-start"
          :to="{ path: '/appointment', query: { date: unifiedReply.date } }"
          @click="openSlotPage">看这天的时段</RouterLink>
        <button v-if="visit.resumePoint && (routeName === 'appointment' || unifiedReply?.resume)" type="button" class="site-guide-start"
          @click="goToPlate(visit.resumePoint, 'return')">回到青铜鼎 · {{ stopLabels[visit.resumePoint.stop] }}</button>
        <button v-if="visit.pendingSlots && !unifiedReply?.artifact" type="button" class="site-guide-start"
          @click="readPendingSlots">查 {{ visit.pendingSlots.date }} 的时段</button>
        <nav v-if="unifiedReply?.stops?.length" aria-label="洛笙推荐的目的地" class="site-guide-stops">
          <RouterLink v-for="stop in unifiedReply.stops" :key="stop" :to="destination(stop)">{{ siteStops[stop].label }} <ArrowRight aria-hidden="true" /></RouterLink>
        </nav>
      </div>
      <div v-else class="site-guide-body">
        <section v-if="touring" ref="tourPanel" class="site-guide-tour" aria-label="首次逛馆路线" tabindex="-1">
          <p role="status">{{ tourIndex < 0 ? '首次逛馆 · 3 站' : `已到达第 ${tourIndex + 1} / ${firstVisit.length} 站 · ${siteStops[firstVisit[tourIndex]!].label}` }}</p>
          <RouterLink v-if="nextStop" :to="destination(nextStop)">
            {{ tourIndex < 0 ? '第一站' : '下一站' }}：{{ siteStops[nextStop].label }} <ArrowRight aria-hidden="true" />
          </RouterLink>
          <p v-else>三站逛完啦。接下来可以打开青铜鼎展签，和我一起找鼎耳、三足和纹样。</p>
          <button type="button" @click="endTour">结束路线</button>
        </section>
        <button v-else ref="startButton" type="button" class="site-guide-start" @click="startTour">
          <Compass aria-hidden="true" /> 带我逛馆 <ArrowRight aria-hidden="true" />
        </button>
        <p class="site-guide-answer" role="status">{{ answer.text }}</p>
        <nav aria-label="洛笙推荐的目的地" class="site-guide-stops">
          <RouterLink
            v-for="stop in answer.stops" :key="stop" :to="destination(stop)"
            @click="route.path === siteStops[stop].path && setExpanded(false)"
          >
            <component :is="stopIcons[stop]" class="site-guide-stop-icon" aria-hidden="true" />
            <span>{{ siteStops[stop].label }}</span>
            <ArrowRight class="site-guide-stop-arrow" aria-hidden="true" />
          </RouterLink>
        </nav>
      </div>
      <footer class="site-guide-composer">
        <div class="site-guide-prompts" role="group" aria-label="导览操作">
          <button v-for="prompt in (visit ? (object ? [] : routeName === 'appointment' ? ['明天还有可约时段吗？'] : ['我只有五分钟，带我看一件']) : prompts)" :key="prompt" type="button" @click="ask(prompt)">{{ prompt }}</button>
          <button v-if="visit" type="button" @click="endVisit">我先自己逛</button>
        </div>
        <form class="site-guide-form" @submit.prevent="submitQuestion">
          <input ref="input" v-model="question" :aria-label="visit ? '问洛笙' : '问洛笙怎么逛馆'" :placeholder="object ? '例如，另一只在哪里？' : visit && routeName === 'appointment' ? '例如，明天还有三个人的名额吗？' : '例如，在哪能看 3D？'" :maxlength="visit ? 300 : 160"
            @compositionstart="composingQuestion = true"
            @compositionend="composingQuestion = false"
            @change="composingQuestion = false"
            @keydown.enter="guardCompositionEnter" />
          <button type="submit" :disabled="composingQuestion || !question.trim()"><Promotion aria-hidden="true" /> 发送</button>
        </form>
        <small v-if="visit" class="site-guide-meta">{{ unifiedGuideTurns ? 'AI 向导 · 请勿输入个人信息' : liveModel ? '模型预览 · 请勿输入个人信息' : reviewedPreview ? '内部预览 · 固定资料问答' : '内部预览 · 使用合成资料' }}</small>
      </footer>
    </section>
    </Transition>
  </aside>
</template>

<style scoped>
.luosheng-site {
  position: fixed;
  z-index: 31;
  inset: auto max(1rem, env(safe-area-inset-right)) 1.25rem auto;
  color: var(--guide-ink);
  font-family: var(--guide-body-font);
  min-block-size: 52px;
}
.luosheng-site :where(button, a, input) { font: inherit; }
.luosheng-site :is(button, a) { cursor: pointer; }
.luosheng-site :focus-visible { outline: 2px solid var(--guide-signal); outline-offset: 3px; }
.luosheng-site svg { flex: none; inline-size: 1rem; block-size: 1rem; }
.site-guide-trigger, .site-guide-form button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .55rem;
  min-block-size: 44px;
  padding-inline: 1rem;
  border: 1px solid var(--guide-action);
  border-radius: .75rem;
  background: var(--guide-action);
  color: var(--guide-action-ink);
  white-space: nowrap;
}
.luosheng-site .site-guide-trigger {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  gap: .65rem;
  min-block-size: 52px;
  padding-inline: .48rem 1rem;
  border-color: color-mix(in oklch, var(--guide-metal) 70%, var(--guide-edge));
  border-radius: 999px;
  background-color: var(--guide-paper);
  background-image: linear-gradient(160deg, color-mix(in oklch, var(--guide-metal) 12%, transparent), transparent 78%);
  color: var(--guide-ink);
  box-shadow: 0 7px 24px #11161052, inset 0 1px 0 color-mix(in oklch, var(--guide-metal) 18%, transparent);
  font-weight: 650;
  touch-action: manipulation;
}
.site-guide-trigger-label { position: relative; }
.site-guide-dial {
  position: relative;
  display: grid;
  place-items: center;
  inline-size: 38px;
  block-size: 38px;
  flex: none;
  border: 1px solid color-mix(in oklch, var(--guide-metal) 50%, transparent);
  border-radius: 50%;
  background: var(--guide-mount);
  color: var(--guide-metal);
}
.site-guide-dial svg { inline-size: 19px; block-size: 19px; }
.site-guide-dial::after {
  content: '';
  position: absolute;
  inset: -2px;
  background: conic-gradient(from -100deg, transparent 8%, var(--guide-signal) 23%, var(--guide-metal) 37%, transparent 54%);
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px), #000 97%, transparent 100%);
  border-radius: 50%;
  transform: rotate(-28deg);
}
.site-guide-trigger::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  inline-size: 50%;
  background: linear-gradient(108deg, transparent, color-mix(in oklch, var(--guide-metal) 8%, transparent) 34%, color-mix(in oklch, var(--guide-metal) 35%, transparent) 53%, transparent 82%);
  pointer-events: none;
  opacity: 0;
}
.luosheng-site .site-guide-trigger:active {
  background: var(--guide-field);
  border-color: var(--guide-metal);
}
@media (prefers-reduced-motion: no-preference) {
  .luosheng-site .site-guide-trigger { transition: transform 230ms cubic-bezier(.2, .85, .25, 1); }
  .luosheng-site .site-guide-trigger:active { transform: scale(.95); transition-duration: 80ms; }
  .site-guide-dial::after { animation: site-guide-orbit 3.6s cubic-bezier(.22, .72, .22, 1) infinite; }
  .site-guide-trigger::before { animation: site-guide-scan 3.6s ease-out infinite; }
}
@keyframes site-guide-orbit {
  0% { transform: rotate(-28deg); opacity: .65; }
  16% { opacity: 1; }
  32%, 100% { transform: rotate(332deg); }
  48%, 100% { opacity: .65; }
}
@keyframes site-guide-scan {
  0% { transform: translateX(-100%); opacity: 0; }
  12%, 23% { opacity: 1; }
  38%, 100% { transform: translateX(220%); opacity: 0; }
}
.site-guide-panel {
  position: absolute;
  inset: auto 0 0 auto;
  display: flex;
  flex-direction: column;
  transform-origin: bottom right;
  inline-size: min(25rem, calc(100vi - 2rem));
  max-block-size: min(38rem, calc(100dvh - 7rem - env(safe-area-inset-bottom)));
  overflow: hidden;
  border: 1px solid var(--guide-edge);
  border-radius: 1.125rem;
  background: var(--guide-paper);
  box-shadow: 0 16px 54px #0d1e1a38;
}
.site-guide-panel[inert] { pointer-events: none; }
.site-guide-panel-enter-active { transition: opacity 140ms ease-out; }
.site-guide-panel-leave-active { transition: opacity 130ms ease-in; }
.site-guide-panel-enter-from, .site-guide-panel-leave-to { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .site-guide-panel-enter-active {
    transition: transform 280ms cubic-bezier(.18, .88, .25, 1), opacity 170ms ease-out;
  }
  .site-guide-panel-leave-active {
    transition: transform 185ms cubic-bezier(.75, 0, .82, .12), opacity 150ms ease-in;
  }
  .site-guide-panel-enter-from, .site-guide-panel-leave-to { transform: translateY(7px) scale(.93); }
}
.site-guide-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-block-end: 1px solid var(--guide-edge);
}
.site-guide-mark {
  display: grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border: 1px solid var(--guide-edge);
  border-radius: 50%;
  background: var(--guide-mount);
  color: var(--guide-metal);
}
.site-guide-mark svg { inline-size: 1.25rem; block-size: 1.25rem; }
.site-guide-header p {
  margin: var(--space-1) 0 0;
  color: var(--guide-muted);
  font-size: .8125rem;
  line-height: 1.3;
}
.site-guide-header h2 { margin: 0; color: var(--guide-ink); font: 600 1.3rem/1.25 var(--guide-head); }
.site-guide-header h2:focus { outline: none; }
.site-guide-close {
  display: grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--guide-muted);
}
.site-guide-body {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  min-block-size: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--guide-edge) transparent;
}
.site-guide-start, .site-guide-tour a {
  display: flex;
  align-items: center;
  gap: .55rem;
  min-block-size: 48px;
  padding: .45rem .85rem;
  border: 1px solid var(--guide-action);
  border-radius: .65rem;
  background: var(--guide-action);
  color: var(--guide-action-ink);
  font-size: .9375rem;
  font-weight: 620;
  text-decoration: none;
}
.site-guide-start svg:last-child, .site-guide-tour a svg { margin-inline-start: auto; }
.site-guide-tour { display: grid; gap: .4rem; }
.site-guide-tour p { margin: 0; color: var(--guide-muted); font-size: .875rem; line-height: 1.55; }
.site-guide-tour button {
  justify-self: start;
  min-block-size: 44px;
  padding-inline: .65rem;
  border: 1px solid var(--guide-edge);
  border-radius: .6rem;
  background: var(--guide-field);
  color: var(--guide-ink);
  font-size: .8125rem;
}
.site-guide-answer {
  margin: 0;
  padding: var(--space-3);
  border-radius: .65rem;
  background: var(--guide-reply);
  color: var(--guide-ink);
  font-size: .9375rem;
  line-height: 1.7;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.site-guide-response {
  display: flex;
  align-items: flex-start;
  gap: .55rem;
}
.site-guide-response .site-guide-answer { flex: 1; min-inline-size: 0; }
.site-guide-cover {
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: .5rem;
}
.site-guide-meta { color: var(--guide-muted); }
.site-guide-body summary { cursor: pointer; min-block-size: 44px; align-content: center; }
.site-guide-body details a { color: var(--guide-signal); overflow-wrap: anywhere; }
.site-guide-stops {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--space-2);
}
.site-guide-stops a {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  min-block-size: 44px;
  padding: var(--space-1) var(--space-2);
  border-block-end: 1px solid var(--guide-edge);
  color: var(--guide-ink);
  font-size: .875rem;
  font-weight: 550;
  text-decoration: none;
}
.site-guide-stop-icon { color: var(--guide-metal); }
.site-guide-stops .site-guide-stop-arrow { inline-size: .75rem; color: var(--guide-muted); }
.site-guide-composer {
  flex: none;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4) var(--space-4);
  border-block-start: 1px solid var(--guide-edge);
  background: var(--guide-screen);
}
.site-guide-prompts { display: flex; flex-wrap: wrap; gap: 0 var(--space-2); }
.site-guide-prompts button {
  min-block-size: 44px;
  padding-inline: var(--space-1);
  border: 1px solid transparent;
  border-radius: .5rem;
  background: transparent;
  color: var(--guide-signal);
  font-size: .8125rem;
}
.site-guide-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .5rem; }
.site-guide-form input {
  min-inline-size: 0;
  min-block-size: 44px;
  padding-inline: .625rem;
  border: 1px solid var(--guide-field-edge, var(--guide-edge));
  border-radius: .65rem;
  background: var(--guide-field);
  color: var(--guide-ink);
  caret-color: var(--guide-metal);
  font-size: 1rem;
}
.site-guide-form input::placeholder { color: var(--guide-muted); opacity: 1; }
.site-guide-form button { padding-inline: var(--space-3); }
.site-guide-form button:disabled {
  background: var(--guide-field);
  border-color: var(--guide-edge);
  color: var(--guide-muted);
  cursor: default;
}
.site-guide-panel :is(button:not(:disabled), a):active { filter: brightness(.91); }
@media (hover: hover) {
  .luosheng-site .site-guide-trigger:hover {
    background: var(--guide-field);
    border-color: var(--guide-metal);
  }
  .site-guide-panel :is(.site-guide-start, .site-guide-tour a, .site-guide-form button:not(:disabled)):hover {
    background: color-mix(in oklch, var(--guide-action) 85%, var(--guide-action-ink));
  }
  .site-guide-stops a:hover, .site-guide-prompts button:hover, .site-guide-close:hover {
    background: var(--guide-field);
  }
}
@media (max-width: 880px) {
  .luosheng-site { inset-block-end: calc(5.25rem + env(safe-area-inset-bottom)); }
}
@media (max-height: 500px) {
  .site-guide-prompts { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; }
  .site-guide-prompts button { flex: none; }
}
</style>
