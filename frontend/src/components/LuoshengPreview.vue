<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowRight, Check, Connection, Plus, Search, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import topPlate from '../assets/luosheng-ding-top.webp'
import sidePlate from '../assets/luosheng-ding-side.webp'
import backPlate from '../assets/luosheng-ding-back.webp'
import relief from '../assets/luosheng-ding-relief.webp'
import { GUIDE_ARTIFACT, GUIDE_EXHIBIT, guideVisit, readGuideHandoff, readGuideReturn, type GuideStop, type GuideView } from '../lib/luoshengPreview'
import { useLuoshengTurns } from '../lib/luoshengTurns'
import { useLuoshengNarration } from '../lib/luoshengNarration'
import { askLuoshengHttpFixture, type GuidePlate } from '../lib/luoshengHttpFixture'
import { answerLuoshengWelcome } from '../lib/luoshengWelcome'
import { unifiedGuidePreview, useLuoshengVisit } from '../stores/luoshengVisit'
import '../assets/luosheng-palette.css'

const props = defineProps<{
  place: 'artifact' | 'exhibit'
  viewerStatus?: 'poster' | 'loading' | 'ready' | 'error'
  pointCloud?: 'ready' | 'loading' | 'active'
}>()
const emit = defineEmits<{ orient: [view: GuideView]; showPoints: [] }>()
const route = useRoute()
const router = useRouter()
const unified = unifiedGuidePreview ? useLuoshengVisit() : null
const headingId = useId()
const panelId = useId()
const section = ref<HTMLElement>()
const mode = ref<'quiet' | 'invite' | 'open'>('quiet')
const heading = ref<HTMLElement>()
const observationHeading = ref<HTMLElement>()
const reopen = ref<HTMLButtonElement>()
const selected = ref<GuideStop>('ear')
const confirmed = ref<GuideStop | null>(null)
const testQuestion = ref('')
const openingQuestions = ['三足从哪里看？', '这些纹样象征什么？']
const followUpQuestion = '还是没看清。'
const missedNarration = /^(?:刚才[，,]?\s*)?(?:我)?(?:还是|还)?(?:没(?:有)?听清(?:楚)?|听不(?:太)?清(?:楚)?)(?:呢|呀|啊)?$/
const pointCloudRequest = /^(?:(?:我)?(?:想|要|能不能|可以)?看(?:一下|看)?点云(?:模式)?(?:吗)?|点云(?:模式)?呢)$/
const questionInput = ref<HTMLInputElement>()
const questionControls = ref<HTMLElement>()
const questionResult = ref<HTMLElement>()
const plateIndex = ref(0)
const activeDetail = ref('')
const engravingPass = ref(0)
const modelPreview = computed(() => import.meta.env.DEV && route.query['guide-turn-test'] === 'model')
const httpTest = computed(() => modelPreview.value || (import.meta.env.DEV && route.query['guide-turn-test'] === 'http'))
const turnTest = computed(() => httpTest.value || (import.meta.env.DEV && route.query['guide-turn-test'] === '1'))
const turnTestQuery = computed(() => turnTest.value
  ? { 'guide-turn-test': modelPreview.value ? 'model' : httpTest.value ? 'http' : '1' }
  : undefined)
const narrationScope = computed(() => import.meta.env.DEV && route.query['guide-audio-test'] === '1' && mode.value === 'open'
  ? { clip: '/media/guide/luosheng-browser-test.wav', turn: selected.value, enabled: true }
  : null)
const narration = import.meta.env.DEV ? useLuoshengNarration(narrationScope) : undefined
const narrationStatus = computed(() => narration?.status.value)
const canPauseNarration = computed(() => narrationStatus.value === 'playing' || narrationStatus.value === 'starting')
const testScope = computed(() => turnTest.value && mode.value === 'open'
  ? { exhibit: GUIDE_EXHIBIT, locale: 'zh-CN', lookpoint: confirmed.value }
  : null)
let httpContextId = ''
watch([testScope, httpTest, modelPreview], ([scope, enabled]) => {
  httpContextId = scope && enabled ? crypto.randomUUID() : ''
}, { flush: 'sync' })
const { state: testTurn, history: testHistory, ask: askTest, cancel: cancelTest } = useLuoshengTurns<{
  text: string; hint?: string; sources?: string[]; plate?: GuidePlate; points?: true; readingFallback?: true
  generated?: boolean; observations?: GuidePlate[]
}>(testScope, async ({ question, lookpoint, signal }) => {
  if (modelPreview.value) {
    const welcome = answerLuoshengWelcome(question)
    if (welcome) return { text: welcome }
  }
  const plainQuestion = question.normalize('NFKC').replace(/[。.!?]+$/, '').trim()
  if (missedNarration.test(plainQuestion)) {
    return { text: `「${stop.value.label}」这段讲解：${stop.value.text}` }
  }
  if (pointCloudRequest.test(plainQuestion)) {
    return { text: '点云用一组数字采样点来呈现器形，不是文物表面的真实颗粒。', points: true }
  }
  if (httpTest.value) return askLuoshengHttpFixture(question, lookpoint, httpContextId, signal, modelPreview.value)
  // Deliberately ignore cancellation to exercise the late-result guard.
  await new Promise(resolve => window.setTimeout(resolve, 850))
  if (!/^另一只呢[？?]?$/.test(question)) return { text: '这条模拟用例只验证「另一只呢？」。' }
  if (lookpoint === 'ear') return { text: '看口沿对侧，另一只鼎耳在那里。', hint: '俯视图' }
  if (lookpoint === 'feet') return { text: '侧面有一足被挡住了，对照背视图就能数齐。', hint: '背视图' }
  return { text: '你指的是鼎耳，还是鼎足？' }
})
watch([httpTest, modelPreview], cancelTest, { flush: 'sync' })
const previousQuestions = computed(() => testTurn.value.status === 'answered'
  ? testHistory.value.slice(0, -1)
  : testHistory.value)
const pointCloudReply = computed(() => testTurn.value.status === 'answered' && testTurn.value.answer.points)
const pointCloudStatus = computed(() => {
  if (props.pointCloud === 'active') return '点云已开启。'
  if (props.pointCloud === 'loading') return '正在构建点云…'
  if (props.pointCloud === 'ready') return ''
  return '当前不能切换点云，仍可查看图版和文字讲解。'
})
function showPoints() {
  if (pointCloudReply.value && props.pointCloud === 'ready') emit('showPoints')
}
watch(testTurn, (turn) => {
  if (turn.status !== 'answered' && turn.status !== 'unavailable') return
  const controls = questionControls.value
  const result = questionResult.value
  if (!controls?.contains(document.activeElement) || !result) return

  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  const bottom = top + (viewport?.height ?? window.innerHeight)
  const tabs = document.querySelector('.mobile-tab-bar')?.getBoundingClientRect()
  const limit = tabs && tabs.height > 0 && tabs.top > top ? Math.min(bottom, tabs.top) : bottom
  const anchor = controls.getBoundingClientRect()
  if (anchor.bottom <= top || anchor.top >= limit) return
  const reply = result.getBoundingClientRect()
  if (reply.bottom <= limit) return
  const gap = 12
  const distance = Math.min(reply.bottom - limit + gap, reply.top - top - gap)
  if (distance > 0) window.scrollBy({ top: distance, behavior: 'instant' })
}, { flush: 'post' })

function selectStop(id: GuideStop) {
  if (confirmed.value === id && testScope.value) {
    // The conversation can move to a different topic without changing the visible tab.
    cancelTest()
    if (httpTest.value) httpContextId = crypto.randomUUID()
  }
  selected.value = id
  confirmed.value = id
  unified?.confirm(id)
  engravingPass.value++
}
async function showAnswerPlate(id: GuidePlate) {
  selected.value = id
  await nextTick()
  focusObservation()
}
function focusObservation() {
  observationHeading.value?.focus({ preventScroll: true })
  observationHeading.value?.scrollIntoView({ block: 'center', behavior: 'instant' })
}
const referenceUrl = 'https://www.clevelandart.org/art/1962.281'
const returnLink = computed(() => ({
  path: `/artifacts/${GUIDE_ARTIFACT}`,
  query: turnTestQuery.value,
  hash: '#luosheng-preview',
  state: { luoshengPreviewReturn: selected.value },
}))
const failedImages = ref(new Set<string>())
const stops = {
  ear: {
    label: '鼎耳', title: '找一找鼎耳', view: 'top', action: '从上面看',
    text: '先看鼎口两边：左边一只，右边一只。这对立起来的结构，就叫鼎耳。',
    question: '鼎耳就是把手吗？',
    answer: '形状的确有点像把手。单凭这个模型，我们能指出鼎耳的位置和形状，但不能断定这件鼎实际是怎么被搬动的。',
    evidence: '俯视图的口沿左右各可见一耳。形状可以观察，实际怎么搬动不能只凭图判断。',
    images: [{ src: topPlate, alt: '数字模型俯视图，两只鼎耳位于圆形口沿左、右两侧', caption: '俯视：口沿左右各一耳', width: 480, height: 480 }],
  },
  feet: {
    label: '三足', title: '数一数鼎足', view: 'back', action: '从背面数鼎足',
    text: '从侧面只数到了两只？对照背视图：中间一足，两边各一足。换个角度，被挡住的那一足就露出来了。',
    question: '只看见两足，是不是少了一足？',
    answer: '不是这么数的。侧视图里有一足被遮挡；用背视图对照，三只都能找到。',
    evidence: '侧视图能辨两足，背视图能辨三足。这是模型在不同角度下的遮挡差异，不能用来判断原器是否残损。',
    images: [
      { src: sidePlate, alt: '数字模型侧面，只有两只鼎足清晰可见', caption: '侧视：可见两足', width: 480, height: 480 },
      { src: backPlate, alt: '数字模型背面，三只鼎足均可见', caption: '背视：可见三足', width: 480, height: 480 },
    ],
  },
  motif: {
    label: '纹样', title: '沿着鼎腹纹样看', view: 'front', action: '回到正面找纹样',
    text: '从口沿往下看，找到鼎身中段凸起的线条。沿着图里较宽的一条线走一段，看看它在哪里转了弯。',
    question: '这些纹样象征什么？',
    answer: '图上能看见线条的转折和轮廓；它的寓意需要更多资料，不能从图案形状直接猜出来。',
    evidence: '数字模型局部图能辨凸起宽线的转折，不是原器照片，也不能据此判断纹样寓意。',
    images: [{ src: relief, alt: '数字模型鼎腹局部，凸出的宽线向内回转', caption: '数字模型局部，非原器照片', width: 1100, height: 620 }],
  },
} satisfies Record<GuideStop, { label: string; title: string; view: GuideView; action: string; text: string; question: string; answer: string; evidence: string; images: { src: string; alt: string; caption: string; width: number; height: number }[] }>
const stop = computed(() => stops[selected.value])
const plate = computed(() => stop.value.images[plateIndex.value] ?? stop.value.images[0])
const platePrompt = computed(() => ({
  ear: '换个角度会更好辨认鼎耳吗？',
  feet: '为什么从侧面只能看到两只鼎足？',
  motif: '鼎腹上的凸线从哪里转弯？',
})[selected.value])
const earDetails = [
  { id: 'left', label: '左侧鼎耳', text: '看口沿左侧凸起的一段。沿着圆形边缘找过去，就能看见它和鼎口相接。' },
  { id: 'right', label: '右侧鼎耳', text: '看口沿对侧伸出的这一段。和左侧对照，两只鼎耳分列鼎口两边。' },
]
const plateNote = computed(() => {
  if (selected.value === 'ear') return earDetails.find(detail => detail.id === activeDetail.value)?.text ?? '点图中的两个标记，对照鼎耳的位置。'
  if (selected.value === 'feet') return plateIndex.value === 0
    ? '先在侧面数一数。第三足被器身遮住了，再切到背面验证。'
    : '从背面看，中间一足，两侧各一足。和侧视图对照，就能找出刚才被挡住的那一足。'
  return activeDetail.value
    ? '沿着鼎腹中段较宽的凸线看，留意线条哪里拐弯。图版可以帮助观察轮廓，寓意需要另有资料佐证。'
    : ''
})
watch([selected, mode], () => {
  plateIndex.value = 0
  activeDetail.value = ''
}, { flush: 'sync' })

function choosePlate(index: number) {
  plateIndex.value = index
  if (selected.value === 'feet') {
    unified?.recordPlateView({ path: route.path, stop: selected.value, compare: index === 1 })
  }
  engravingPass.value++
}

function chooseDetail(id: string) {
  activeDetail.value = activeDetail.value === id ? '' : id
  engravingPass.value++
}

function preparePlateQuestion() {
  if (confirmed.value !== selected.value) selectStop(selected.value)
  testQuestion.value = platePrompt.value
  questionInput.value?.focus()
}
function continueUnified(event: MouseEvent) {
  if (!unified) return
  if (unified.lookpoint !== selected.value) unified.confirm(selected.value)
  unified.recordPlateView({ path: route.path, stop: selected.value, compare: plateIndex.value === 1 || activeDetail.value === 'right' })
  unified.openFrom(event.currentTarget as HTMLElement)
}

async function receiveUnifiedPlate(target = unified?.target) {
  if (!unified || !target || target.path !== route.path) return
  mode.value = 'open'
  selected.value = target.stop
  confirmed.value = target.stop
  plateIndex.value = target.stop === 'feet' && target.compare ? 1 : 0
  activeDetail.value = target.stop === 'ear' && target.compare ? 'right' : ''
  await nextTick()
  if (unified.target !== target || route.path !== target.path || !observationHeading.value) return
  focusObservation()
  unified.arrive(target)
}
watch(() => unified?.target, target => void receiveUnifiedPlate(target), { flush: 'post' })
const suggestedQuestions = computed(() => modelPreview.value
  ? confirmed.value
    ? [stops[confirmed.value].question, '参考藏品是什么年代的？', '材质和尺寸是什么？']
    : ['介绍一下自己', '介绍一下这件鼎', '材质和尺寸是什么？']
  : openingQuestions)
const fallbackStatus = computed(() => {
  const status = props.viewerStatus === 'error' ? '3D 暂不可用。'
    : props.viewerStatus === 'loading' ? '3D 正在准备。'
    : '3D 尚未启动。'
  const hasPlate = stop.value.images.some(image => !failedImages.value.has(image.src))
  return status + (hasPlate ? '可以先看这处细节图。' : '仍可按文字说明找这一处。')
})
const tourLink = computed(() => ({
  path: `/exhibits/${GUIDE_EXHIBIT}`,
  query: turnTestQuery.value,
  state: { luoshengPreviewHandoff: selected.value },
}))

function prepareUnifiedHandoff(path: string) {
  if (unified) unified.target = { path, stop: selected.value, compare: plateIndex.value === 1 || activeDetail.value === 'right' }
}

onMounted(() => {
  if (unified) {
    void receiveUnifiedPlate()
    return
  }
  const back = window.history.state?.back
  if (props.place === 'artifact' && route.hash === returnLink.value.hash
      && typeof back === 'string' && router.resolve(back).path === `/exhibits/${GUIDE_EXHIBIT}`) {
    const returnStop = readGuideReturn(window.history.state)
    if (returnStop) {
      window.history.replaceState({ ...window.history.state, luoshengPreviewReturn: null }, '')
      selected.value = returnStop
      confirmed.value = returnStop
    }
    guideVisit.claimInvitation()
    section.value?.scrollIntoView({ block: 'start', behavior: 'instant' })
    reopen.value?.focus({ preventScroll: true })
    return
  }
  const handoff = props.place === 'exhibit' ? readGuideHandoff(window.history.state) : null
  if (handoff) {
    window.history.replaceState({ ...window.history.state, luoshengPreviewHandoff: null }, '')
    selected.value = handoff
    confirmed.value = handoff
    guideVisit.claimInvitation()
    mode.value = 'open'
  } else if (guideVisit.claimInvitation()) {
    mode.value = 'invite'
  }
})

async function open() {
  mode.value = 'open'
  engravingPass.value++
  await nextTick()
  heading.value?.focus()
}

async function close() {
  mode.value = 'quiet'
  confirmed.value = null
  testQuestion.value = ''
  await nextTick()
  reopen.value?.focus()
}

function submitTestQuestion() {
  const question = testQuestion.value.trim()
  if (/^(?:够了(?:[，,]\s*我自己看)?|我自己看|不用讲了|停止讲解|结束讲解)[。！!.]?$/.test(question)) {
    return close()
  }
  if (question) narration?.stop()
  return askTest(question)
}

function askSuggestedQuestion(question: string) {
  testQuestion.value = question
  questionInput.value?.focus({ preventScroll: true })
  return submitTestQuestion()
}
</script>

<template>
  <section id="luosheng-preview" ref="section" class="luosheng-preview luosheng-palette" data-local-control-theme :data-mode="mode" :aria-labelledby="headingId" @keydown.esc="mode === 'open' && close()">
    <header class="guide-heading">
      <div class="guide-engraving" aria-hidden="true">
        <svg viewBox="0 0 216 112" fill="none">
          <defs>
            <path :id="`${headingId}-engraved-path`" d="M216 16H128a40 40 0 0 0 0 80h26a20 20 0 0 0 0-40h-26a8 8 0 0 0 0 16h24M216 32h-88a24 24 0 0 0 0 48h25a4 4 0 0 0 0-8M216 48h-45a32 32 0 0 1-17 64h-26a56 56 0 0 1 0-112h88" />
          </defs>
          <path class="guide-etch-fine" d="M216 8H128a48 48 0 0 0 0 96h26M216 24h-88a32 32 0 0 0 0 64h26M216 40h-88a16 16 0 0 0 0 32M74 6a69 69 0 0 0 0 100M64 6a77 77 0 0 0 0 100" />
          <use :href="`#${headingId}-engraved-path`" class="guide-etch-shadow" y="1" />
          <use :href="`#${headingId}-engraved-path`" class="guide-etch-line" />
        </svg>
        <svg v-if="engravingPass" :key="engravingPass" class="guide-etch-light" viewBox="0 0 216 112" fill="none">
          <use :href="`#${headingId}-engraved-path`" />
        </svg>
      </div>
      <span class="guide-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M6 9v7m4-10v13m4-15v16m4-12v9" />
        </svg>
      </span>
      <h2 :id="headingId" ref="heading" tabindex="-1">洛笙</h2>
      <span class="guide-caption">{{ httpTest ? 'AI 向导预览' : '讲解预览' }}</span>
    </header>
    <div v-if="mode === 'invite'" class="guide-body guide-invite">
      <p class="guide-invite-copy">看见鼎口那双“耳朵”了吗？<br />要我指给你看吗？</p>
      <div class="guide-actions">
        <button type="button" class="guide-primary" :aria-controls="panelId" aria-expanded="false" @click="open">带我看看 <ArrowRight aria-hidden="true" /></button>
        <button type="button" @click="close">我先自己逛</button>
      </div>
    </div>
    <div v-else-if="mode === 'quiet'" class="guide-actions">
      <button v-if="unified" class="guide-primary" type="button" @click="unified.openFrom($event.currentTarget as HTMLElement)">问洛笙 <ArrowRight aria-hidden="true" /></button>
      <button v-else ref="reopen" class="guide-primary" type="button" :aria-controls="panelId" aria-expanded="false" @click="open">问洛笙 <ArrowRight aria-hidden="true" /></button>
      <button v-if="unified" type="button" @click="open">看展品图版</button>
      <RouterLink v-if="place === 'exhibit'" class="guide-return" :to="returnLink">回到藏品展签</RouterLink>
    </div>
    <div v-show="mode === 'open'" :id="panelId" class="guide-body">
      <template v-if="mode === 'open'">
      <form v-if="httpTest && !unified" class="guide-turn-test guide-dialogue" :class="{ 'guide-dialogue-live': modelPreview }" @submit.prevent="submitTestQuestion">
        <div class="guide-dialogue-heading">
          <label :for="`${panelId}-test-question`">问洛笙</label>
          <span :id="`${panelId}-test-note`" class="guide-caption">{{ modelPreview ? '模型问答预览 · 请勿输入个人信息' : '合成资料 · 非实时 AI' }}</span>
        </div>
        <p v-if="modelPreview" class="guide-context"><span aria-hidden="true"></span>{{ confirmed ? `当前看点 · ${stops[confirmed].label}` : '当前展品 · 青铜鼎' }}</p>
        <div class="guide-actions guide-suggestions" role="group" aria-label="推荐问题">
          <button v-for="question in suggestedQuestions" :key="question" type="button" @click="askSuggestedQuestion(question)">
            {{ question }} <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <div ref="questionControls" class="guide-actions">
          <input :id="`${panelId}-test-question`" ref="questionInput" v-model="testQuestion" maxlength="300" :aria-describedby="`${panelId}-test-note`" placeholder="你想问这件鼎什么？" />
          <button class="guide-primary" type="submit" :disabled="!testQuestion.trim()">发送</button>
        </div>
        <div ref="questionResult" class="guide-response" :data-status="testTurn.status" role="status">
          <p v-if="testTurn.status === 'pending'">正在查找相关资料…</p>
          <template v-else-if="testTurn.status === 'answered'">
            <span v-if="modelPreview && testTurn.answer.generated" class="guide-caption">AI 实时回答</span>
            <p>{{ testTurn.answer.text }}</p>
            <div v-if="testTurn.answer.observations?.length" class="guide-actions" role="group" aria-label="回答依据">
              <button v-for="item in testTurn.answer.observations" :key="item" type="button" @click="showAnswerPlate(item)">
                <Search aria-hidden="true" /> {{ stops[item].label }}图版
              </button>
            </div>
            <p v-if="testTurn.answer.hint">建议查看：{{ testTurn.answer.hint }}</p>
            <div v-if="pointCloudReply" class="guide-actions">
              <button v-if="!pointCloudStatus" type="button" @click="showPoints"><Connection aria-hidden="true" /> 以点云观察</button>
              <p v-else>{{ pointCloudStatus }}</p>
            </div>
            <div v-if="testTurn.answer.plate || testTurn.answer.sources?.length" class="guide-actions">
              <button v-if="testTurn.answer.plate && !modelPreview" type="button" @click="showAnswerPlate(testTurn.answer.plate)">
                <Search aria-hidden="true" /> 看{{ stops[testTurn.answer.plate].label }}图版
              </button>
              <button v-if="testTurn.answer.plate && testTurn.answer.sources?.length" type="button" @click="askSuggestedQuestion(followUpQuestion)">
                {{ followUpQuestion }} <ArrowRight aria-hidden="true" />
              </button>
              <span v-if="modelPreview && testTurn.answer.sources?.length" class="guide-citation">
                <span>资料出处</span>克利夫兰馆藏记录 · 1962.281
              </span>
              <template v-else>
                <a v-for="(source, index) in testTurn.answer.sources" :key="source" :href="source">
                  {{ testTurn.answer.sources?.length === 1 ? '测试出处' : `测试出处 ${index + 1}` }}
                </a>
              </template>
            </div>
          </template>
          <p v-else-if="testTurn.status === 'unavailable'">{{ modelPreview ? '实时' : '模拟' }}问答暂不可用，仍可阅读当前看点的讲解。</p>
          <div v-if="testTurn.status === 'unavailable' || (testTurn.status === 'answered' && testTurn.answer.readingFallback)" class="guide-actions">
            <button type="button" @click="focusObservation">读{{ stop.label }}讲解 <ArrowRight aria-hidden="true" /></button>
          </div>
        </div>
        <details v-if="modelPreview && previousQuestions.length" class="guide-review">
          <summary>回看问答（{{ previousQuestions.length }}）</summary>
          <dl>
            <template v-for="(turn, index) in previousQuestions" :key="index">
              <dt>{{ turn.question }}</dt>
              <dd>{{ turn.answer.text }}</dd>
            </template>
          </dl>
        </details>
      </form>
      <div class="guide-stops" role="group" aria-label="选择看点">
        <button v-for="(item, id) in stops" :key="id" type="button" :aria-pressed="selected === id" @click="selectStop(id)">
          {{ item.label }}<Check class="guide-stop-check" aria-hidden="true" />
        </button>
      </div>
      <div class="guide-observation">
        <div class="guide-reading">
          <div class="guide-reading" aria-live="polite">
            <h3 ref="observationHeading" tabindex="-1">{{ stop.title }}</h3>
            <p>{{ stop.text }}</p>
            <p class="guide-caption">预设讲解 · 内容待审核</p>
          </div>
          <div v-if="unified" class="guide-actions">
            <button type="button" @click="continueUnified">接着问 <ArrowRight aria-hidden="true" /></button>
          </div>
          <div v-else-if="modelPreview" class="guide-actions">
            <button type="button" @click="preparePlateQuestion">问洛笙这个看点 <ArrowRight aria-hidden="true" /></button>
          </div>
          <div v-if="narrationScope" class="guide-actions">
            <button type="button" @click="canPauseNarration ? narration?.pause() : narration?.play()">
              <VideoPause v-if="canPauseNarration" aria-hidden="true" />
              <VideoPlay v-else aria-hidden="true" />
              {{ canPauseNarration ? '暂停试听' : narrationStatus === 'paused' ? '继续试听' : '试听测试音频' }}
            </button>
            <span v-if="narrationStatus === 'unavailable'" class="guide-caption" role="status">音频暂不可用，仍可阅读讲解。</span>
          </div>
        </div>
        <div class="guide-plates" :data-stop="selected">
          <div v-if="selected === 'feet'" class="guide-actions guide-viewpoints" role="group" aria-label="对照三足视角">
            <button type="button" :aria-pressed="plateIndex === 0" @click="choosePlate(0)">侧视</button>
            <button type="button" :aria-pressed="plateIndex === 1" @click="choosePlate(1)">背视</button>
          </div>
          <figure>
            <div v-if="!failedImages.has(plate.src)" class="guide-plate-image">
              <img :key="plate.src" :src="plate.src" :alt="plate.alt" :width="plate.width" :height="plate.height" loading="lazy" @error="failedImages.add(plate.src)" />
              <template v-if="selected === 'ear'">
                <button v-for="detail in earDetails" :key="detail.id" type="button"
                  class="guide-hotspot" :data-side="detail.id" :aria-label="detail.label"
                  :aria-pressed="activeDetail === detail.id" @click="chooseDetail(detail.id)">
                  <Plus aria-hidden="true" />
                </button>
              </template>
            </div>
            <p v-else class="guide-caption" role="status">图版暂不可用，仍可阅读讲解。</p>
            <figcaption>{{ plate.caption }}</figcaption>
          </figure>
          <div v-if="selected === 'motif'" class="guide-actions">
            <button type="button" :aria-expanded="activeDetail === 'motif'" @click="chooseDetail('motif')">
              <Search aria-hidden="true" /> {{ activeDetail === 'motif' ? '收起纹样提示' : '找找纹样的转折' }}
            </button>
          </div>
          <div class="guide-plate-note" aria-live="polite"><p v-if="plateNote">{{ plateNote }}</p></div>
        </div>
      </div>
      <div class="guide-actions">
        <RouterLink v-if="place === 'artifact'" class="guide-primary" :to="tourLink"
          @click="prepareUnifiedHandoff(tourLink.path)">去 3D 看{{ stop.label }} <ArrowRight aria-hidden="true" /></RouterLink>
        <button v-else-if="viewerStatus === 'ready'" class="guide-primary" type="button" @click="emit('orient', stop.view)"><Search aria-hidden="true" /> {{ stop.action }}</button>
        <p v-else class="guide-caption">{{ fallbackStatus }}</p>
        <button type="button" @click="close">结束讲解</button>
        <RouterLink v-if="place === 'exhibit'" class="guide-return" :to="returnLink"
          @click="prepareUnifiedHandoff(returnLink.path)">回到藏品展签</RouterLink>
      </div>
      <form v-if="turnTest && !httpTest && !unified" class="guide-notes guide-turn-test" @submit.prevent="submitTestQuestion">
        <label :for="`${panelId}-test-question`">模拟问答 · 非实时 AI</label>
        <div ref="questionControls" class="guide-actions">
          <input :id="`${panelId}-test-question`" v-model="testQuestion" maxlength="300" placeholder="另一只呢？" />
          <button type="submit" :disabled="!testQuestion.trim()">发送</button>
        </div>
        <div ref="questionResult" role="status">
          <p v-if="testTurn.status === 'pending'">等待模拟回答…</p>
          <template v-else-if="testTurn.status === 'answered'">
            <p>{{ testTurn.answer.text }}</p>
            <p v-if="testTurn.answer.hint">建议查看：{{ testTurn.answer.hint }}</p>
            <div v-if="pointCloudReply" class="guide-actions">
              <button v-if="!pointCloudStatus" type="button" @click="showPoints"><Connection aria-hidden="true" /> 以点云观察</button>
              <p v-else>{{ pointCloudStatus }}</p>
            </div>
          </template>
          <p v-else-if="testTurn.status === 'unavailable'">模拟问答暂不可用，仍可阅读当前看点的讲解。</p>
        </div>
      </form>
      <div class="guide-notes">
        <details :key="selected" class="guide-source">
          <summary><span>{{ stop.question }}</span><Plus aria-hidden="true" /></summary>
          <p>{{ stop.answer }}</p>
        </details>
        <details class="guide-source">
          <summary><span>这件鼎是在洛阳出土的吗？</span><Plus aria-hidden="true" /></summary>
          <p>目前不能确定。这个数字模型参考了<a :href="referenceUrl">克利夫兰艺术博物馆 1962.281 号藏品</a>，但该馆公开记录没有填写出土地。</p>
        </details>
        <details class="guide-source">
          <summary><span>查看依据</span><Plus aria-hidden="true" /></summary>
          <p><strong>{{ stop.label }} · 数字模型观察</strong><br />{{ stop.evidence }}</p>
          <p>重制参考：<a :href="referenceUrl">克利夫兰艺术博物馆 1962.281</a>。参考链接不能证明原物在洛阳出土或归本馆收藏。</p>
        </details>
      </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.luosheng-preview {
  display: grid;
  gap: var(--space-4);
  width: min(100%, 60rem);
  margin: var(--space-6) auto;
  padding: var(--space-8);
  scroll-margin-block-start: 5rem;
  border: 1px solid var(--guide-edge);
  border-radius: 1.25rem;
  background: var(--guide-paper);
  color: var(--guide-ink);
  font-family: var(--guide-body-font);
}
.luosheng-preview[data-mode="quiet"] { gap: var(--space-3); }
.guide-turn-test {
  display: grid;
  gap: var(--space-2);
  padding-block-start: var(--space-3);
  border-block-start: 1px solid var(--theme-border);
}
.guide-turn-test input {
  flex: 1 1 12rem;
  min-inline-size: 0;
  min-block-size: 44px;
  padding-inline: var(--space-3);
  border: 1px solid var(--guide-field-edge, var(--guide-edge));
  border-radius: var(--theme-control-radius);
  background: var(--guide-field);
  color: var(--guide-ink);
  font: inherit;
}
.guide-turn-test button:disabled { opacity: .55; }
.guide-dialogue {
  gap: var(--space-3);
  margin-block-end: var(--space-3);
  padding-block: var(--space-2) var(--space-4);
  border-block-start: 0;
  border-block-end: 1px solid var(--theme-border);
}
.guide-dialogue-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
}
.guide-dialogue-heading label {
  color: var(--theme-text-strong);
  font-size: 1.125rem;
  font-weight: 650;
}
.guide-dialogue [role="group"] { gap: var(--space-2); }
.guide-dialogue [role="status"]:empty { margin-block-start: calc(-1 * var(--space-3)); }
.guide-dialogue input { flex-basis: 8rem; }
.guide-review {
  padding-block-start: var(--space-2);
  border-block-start: 1px solid var(--guide-edge);
}
.guide-review summary {
  width: fit-content;
  min-height: 2.75rem;
  align-content: center;
  color: var(--guide-signal);
  cursor: pointer;
}
.guide-review dl { margin: 0; overflow-wrap: anywhere; }
.guide-review dt { margin-block-start: var(--space-2); font-weight: 650; }
.guide-review dd { margin: var(--space-1) 0 var(--space-3); line-height: 1.65; }
.guide-dialogue-live {
  position: relative;
  padding: clamp(.875rem, 2.4vw, 1.5rem);
  border: 1px solid var(--guide-edge);
  border-radius: 1.125rem;
  background:
    radial-gradient(ellipse at 8% 0, color-mix(in oklch, var(--guide-signal) var(--guide-screen-light, 9%), transparent), transparent 52%),
    var(--guide-screen);
  box-shadow: inset 0 1px 0 color-mix(in oklch, var(--guide-ink) 8%, transparent);
}
.guide-dialogue-live::before {
  content: '';
  position: absolute;
  inset: 0 auto auto 1.5rem;
  inline-size: 5rem;
  block-size: 2px;
  background: linear-gradient(90deg, var(--guide-screen-rule, var(--guide-signal)), transparent);
}
.guide-dialogue-live .guide-dialogue-heading label {
  color: var(--guide-ink);
  font: 600 clamp(1.25rem, 2.6vw, 1.5rem)/1.35 var(--guide-head);
  letter-spacing: .05em;
}
.guide-dialogue-live .guide-context {
  display: flex;
  align-items: center;
  gap: .55rem;
  color: var(--guide-signal);
  font-size: .875rem;
  font-weight: 650;
}
.guide-context span {
  inline-size: 7px;
  block-size: 7px;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in oklch, currentColor 17%, transparent);
}
.guide-dialogue-live .guide-response:not(:empty) {
  display: grid;
  gap: .5rem;
  padding: .875rem 1rem;
  border-inline-start: 2px solid var(--guide-signal);
  border-radius: .25rem .75rem .75rem .25rem;
  background: var(--guide-reply);
}
.guide-dialogue-live .guide-response > p { font-size: 1rem; line-height: 1.85; }
.guide-dialogue-live .guide-response > .guide-caption { color: var(--guide-signal); font-weight: 650; }
.guide-dialogue-live .guide-response[data-status="pending"] {
  background-image: repeating-linear-gradient(120deg, transparent 0 10px,
    color-mix(in oklch, var(--guide-signal) 8%, transparent) 10px 11px);
  background-size: 40px 100%;
  animation: guide-reading-scan 2.4s linear infinite;
}
.luosheng-preview .guide-dialogue-live .guide-suggestions button {
  border-radius: 999px;
  font-size: .875rem;
}
.guide-citation {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .4rem .65rem;
  padding-block-start: .5rem;
  border-block-start: 1px solid color-mix(in oklch, var(--guide-edge) 58%, transparent);
  color: var(--guide-muted);
  font-size: .8125rem;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
}
.guide-citation > span { color: var(--guide-metal); font-weight: 650; }
@keyframes guide-reading-scan { to { background-position: 40px 0; } }
@media (prefers-reduced-motion: reduce) {
  .guide-dialogue-live .guide-response[data-status="pending"] { animation: none; }
}
.guide-heading, .guide-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.guide-heading {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-block-size: 52px;
  padding-block-end: var(--space-3);
  border-block-end: 1px solid var(--theme-border);
}
.guide-engraving {
  position: absolute;
  z-index: -1;
  inset: 50% 0 auto auto;
  inline-size: min(34%, 13.5rem);
  block-size: auto;
  transform: translateY(-50%);
  color: var(--guide-metal);
  pointer-events: none;
}
.guide-engraving svg { display: block; inline-size: 100%; }
.guide-etch-fine { stroke: currentColor; stroke-width: .55; opacity: .22; }
.guide-etch-shadow { stroke: var(--guide-ink); stroke-width: 1.3; opacity: .12; }
.guide-etch-line { stroke: currentColor; stroke-width: 1.1; opacity: .45; }
.guide-engraving .guide-etch-light {
  position: absolute;
  inset: 0;
  stroke: currentColor;
  stroke-width: 1.75;
  opacity: 0;
  mask-image: linear-gradient(110deg, transparent 38%, black 50%, transparent 62%);
  mask-size: 240% 100%;
}
@media (prefers-reduced-motion: no-preference) {
  .guide-etch-light { animation: guide-etch-pass 900ms ease-out both; }
  @keyframes guide-etch-pass {
    0% { mask-position: 100% 50%; opacity: 0; }
    20%, 65% { opacity: .92; }
    100% { mask-position: 0 50%; opacity: 0; }
  }
}
.guide-heading h2, .guide-observation h3 {
  margin: 0;
  font-family: var(--guide-head);
  color: var(--guide-ink);
  letter-spacing: .055em;
}
.guide-heading h2 { font-size: 1.625rem; line-height: 1.2; }
.guide-caption { color: var(--guide-muted); font-size: .8125rem; line-height: 1.55; }
.guide-mark {
  display: grid;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  border: 1px solid var(--theme-tactile-edge);
  border-radius: var(--theme-control-radius);
  color: var(--guide-metal);
  background: var(--guide-mount);
  box-shadow: inset 0 1px var(--theme-tactile-highlight);
}
.guide-mark svg { inline-size: 24px; }
.guide-body, .guide-observation, .guide-reading { display: grid; }
.guide-body { gap: var(--space-4); }
.guide-body p { margin: 0; max-inline-size: 65ch; line-height: 1.7; overflow-wrap: anywhere; }
.guide-body .guide-invite-copy {
  font-family: var(--font-display);
  color: var(--theme-text-strong);
  font-size: 1.5rem;
  line-height: 1.42;
}
.guide-stops {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
  inline-size: min(100%, 23rem);
  padding: var(--space-1);
  background: var(--guide-mount);
  border-radius: var(--theme-control-radius);
}
.guide-observation {
  grid-template-columns: minmax(0, 4fr) minmax(0, 5fr);
  gap: var(--space-6);
  align-items: start;
}
.guide-reading { gap: var(--space-2); }
.guide-observation h3 { font-size: 1.625rem; line-height: 1.25; overflow-wrap: anywhere; }
.guide-reading .guide-caption { margin-block-start: var(--space-1); }
.guide-plates {
  display: grid;
  min-inline-size: 0;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--theme-control-radius);
  background: var(--guide-mount);
}
.guide-plates figure { min-inline-size: 0; margin: 0; }
.guide-plate-image { position: relative; }
.guide-plate-image:has(.guide-hotspot) { isolation: isolate; }
.guide-plate-image:has(.guide-hotspot) img { pointer-events: none; }
.guide-plates img { display: block; inline-size: 100%; block-size: auto; border-radius: 4px; }
.guide-plates:not([data-stop="motif"]) img {
  background-color: var(--theme-surface-control);
  box-shadow: inset 0 0 0 1px var(--theme-border);
}
.guide-plates[data-stop="ear"] img {
  aspect-ratio: 4 / 3;
  object-fit: contain;
}
.guide-plates [role="status"] { padding: var(--space-2); }
.guide-plates figcaption {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-1) var(--space-1);
  font-size: .875rem;
  color: var(--theme-text-muted);
  overflow-wrap: anywhere;
}
.guide-plate-note:empty { display: none; }
.guide-plate-note p {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-inline-start: 2px solid var(--guide-metal);
  background: var(--guide-field);
  font-size: .9375rem;
}
.luosheng-preview .guide-viewpoints [aria-pressed="true"] { border-color: var(--guide-signal); color: var(--guide-signal); }
.luosheng-preview .guide-plate-image .guide-hotspot {
  position: absolute;
  z-index: 1;
  inset-block-start: calc(48% - 22px);
  inset-inline-start: calc(29% - 22px);
  scroll-margin-block: 7rem;
  display: grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  padding: 0;
  border: 1px solid var(--guide-metal);
  border-radius: 50%;
  color: var(--guide-ink);
  background: var(--guide-field);
  transform: none;
  box-shadow: 0 0 0 4px color-mix(in oklch, var(--guide-metal) 24%, transparent);
}
.luosheng-preview .guide-plate-image .guide-hotspot[data-side="right"] { inset-inline-start: calc(71% - 22px); }
.luosheng-preview .guide-plate-image .guide-hotspot:active { transform: none; }
.luosheng-preview .guide-plate-image .guide-hotspot:is([aria-pressed="true"], :focus-visible) {
  color: var(--guide-action-ink);
  background: var(--guide-action);
  box-shadow: 0 0 0 5px color-mix(in oklch, var(--guide-metal) 34%, transparent),
    0 0 18px color-mix(in oklch, var(--guide-metal) 62%, transparent);
}
@media (hover: hover) {
  .luosheng-preview .guide-plate-image .guide-hotspot:hover { border-color: var(--guide-signal); }
}
.luosheng-preview :is(button, .guide-primary, .guide-return) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-block-size: var(--theme-control-min);
  inline-size: fit-content;
  padding-inline: var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--theme-control-radius);
  color: var(--guide-ink);
  background: transparent;
  box-shadow: none;
  font: 600 .9375rem/1.25 var(--guide-body-font);
  text-decoration: none;
  transition: background-color 140ms ease-out, border-color 140ms ease-out;
}
.luosheng-preview :is(button, .guide-primary, summary) svg { flex: none; inline-size: 1rem; block-size: 1rem; }
.luosheng-preview .guide-stops button {
  inline-size: 100%;
  padding-inline: var(--space-1);
  border-radius: 5px;
  white-space: nowrap;
}
.guide-stop-check { display: none; }
.guide-stops [aria-pressed="true"] .guide-stop-check { display: block; color: var(--guide-metal); }
.luosheng-preview .guide-primary {
  padding-inline: var(--space-4);
  color: var(--guide-action-ink);
  background: var(--guide-action);
  border-color: var(--guide-action);
  box-shadow: inset 0 1px color-mix(in oklch, white 18%, transparent);
}
.luosheng-preview .guide-actions :is(button:not(.guide-primary), .guide-return) {
  color: var(--guide-ink);
  background: var(--guide-field);
  border-color: var(--guide-edge);
}
.luosheng-preview .guide-stops [aria-pressed="true"] {
  background: var(--guide-field);
  border-color: var(--guide-signal);
}
.guide-turn-test input::placeholder { color: var(--guide-muted); opacity: 1; }
@media (hover: hover) {
  .luosheng-preview :is(button:not(.guide-primary), .guide-return, summary):hover { background: var(--guide-mount); }
  .luosheng-preview .guide-primary:hover { background: color-mix(in oklch, var(--guide-action) 87%, var(--guide-action-ink)); }
}
.luosheng-preview :is(button, .guide-primary, .guide-return):active { transform: translateY(1px); }
.luosheng-preview :focus-visible { outline: 2px solid var(--theme-focus); outline-offset: 2px; }
.luosheng-preview h2:focus-visible { outline-offset: 0; }
.luosheng-preview ::selection { color: var(--theme-primary-text); background: var(--theme-primary-surface); }
.guide-source { border-block-start: 1px solid var(--theme-border); }
.guide-source summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  min-block-size: var(--theme-control-min);
  padding: var(--space-2);
  color: var(--theme-text-strong);
  cursor: pointer;
  list-style: none;
}
.guide-source summary::-webkit-details-marker { display: none; }
.guide-source summary svg { color: var(--guide-metal); }
.guide-source[open] summary svg { transform: rotate(45deg); }
.guide-source p { padding: 0 var(--space-2) var(--space-3); }
.guide-source a { text-decoration: underline; text-underline-offset: .2em; }
@media (max-width: 600px) {
  .luosheng-preview { padding: var(--space-4); }
  .guide-observation { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
  .guide-body .guide-invite-copy { font-size: 1.25rem; }
  .guide-observation h3 { font-size: 1.375rem; }
  .guide-engraving { inline-size: 6.5rem; }
  .guide-plates figcaption { gap: var(--space-1); }
}
@media (prefers-reduced-motion: reduce) {
  .luosheng-preview :is(button, .guide-primary, .guide-return) { transition: none; }
  .luosheng-preview :is(button, .guide-primary, .guide-return):active { transform: none; }
}
@media (prefers-contrast: more), (forced-colors: active) {
  .guide-engraving { display: none; }
  .luosheng-preview :is(button, .guide-primary, .guide-return) { border-color: currentColor; }
}
@media (forced-colors: active) {
  .luosheng-preview :focus-visible { outline-color: Highlight; }
}
</style>
