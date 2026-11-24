<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { gsap } from 'gsap'
import { Box, Connection, InfoFilled, VideoPlay } from '@element-plus/icons-vue'
import { qualityLabel, type PointCloudQuality } from '../lib/pointCloudQuality'
import { apiGet } from '../lib/api'
import BottomSheet from '../components/BottomSheet.vue'
import AcousticRuler from '../components/AcousticRuler.vue'
import { GUIDE_ARTIFACT_SLUG, GUIDE_EXHIBIT_SLUG, type GuidePartName } from '../lib/guideTypes'
import { useLocale } from '../stores/locale'
import { useAudio } from '../stores/audio'
import { guideEnabled, useLuoshengStore } from '../stores/luoshengStore'
import { createGsapContext, isConstrainedGsapReveal, shouldRunGsapReveal } from '../lib/gsap'
import { audioSystem } from '../lib/audioSystem'
import { requiresManualExhibitActivation, selectExhibitModelSource } from '../lib/exhibitInteraction'
import { consumeExhibitRuntimeRecovery, reloadExhibitRuntime } from '../lib/exhibitRuntimeRecovery'

type ViewName = 'front' | 'left' | 'right' | 'back' | 'top'
type ViewerRuntimeState = 'poster' | 'activating' | 'loading-runtime' | 'loading-model' | 'compiling-first-frame' | 'ready' | 'error'

interface Exhibit {
  slug: string
  title: string
  summary: string
  description: string
  modelUrl: string
  modelFormat: string
  modelSizeBytes: number
  coverImageUrl: string
  mobileModelUrl?: string | null
  mobileModelSizeBytes?: number | null
  displayNo: string
  sourceCredit: string
  sourceUrl: string
  licenseLabel: string
  collectionLocation: string
  artifact: { slug: string; title: string }
}

interface ViewerController {
  rotate: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  setView: (view: ViewName, options?: { animated?: boolean }) => void
  focusPart: (part: GuidePartName, options?: { animated?: boolean }) => void
  setMode: (mode: 'solid' | 'points') => void
}

const route = useRoute()
const LuoshengPreset = guideEnabled
  ? defineAsyncComponent(() => import('../components/LuoshengPreset.vue')) : null
const { locale } = useLocale()
const audio = useAudio()
const exhibit = ref<Exhibit | null>(null)
const loading = ref(true)
const guideStore = guideEnabled ? useLuoshengStore() : null

const DARKROOM_INVITE_DISMISSED_KEY = 'museum-audio-darkroom-invite-dismissed'
function readInviteDismissed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DARKROOM_INVITE_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}
const inviteDismissed = ref(readInviteDismissed())
let lastPartFocusSfxAt = 0

const PART_FOCUS_AUDIO: Record<GuidePartName, { rate: number; volume: number; pan: number }> = {
  ear: { rate: 1.14, volume: 0.16, pan: -0.22 },
  motif: { rate: 1.0, volume: 0.18, pan: 0 },
  feet: { rate: 0.84, volume: 0.18, pan: 0.22 },
}

watch([exhibit, loading], ([item, pending]) => {
  if (!guideStore || pending || !item || route.name !== 'exhibit-detail' || route.params.slug !== item.slug) return
  guideStore.setPageContext({
    route: 'exhibit-detail',
    path: route.path,
    title: item.title,
    artifactSlug: item.artifact.slug,
    exhibitSlug: item.slug,
    articleSlug: null,
    viewerState: {
      active: viewerRuntimeState.value === 'ready',
      mode: displayMode.value,
      view: activeView.value,
    },
  })
})

const error = ref('')
const viewer = ref<ViewerController | null>(null)
const acousticRulerRef = ref<InstanceType<typeof AcousticRuler> | null>(null)
const displayMode = ref<'solid' | 'points'>('solid')
const renderQuality = ref<PointCloudQuality>('medium')
const activeView = ref<ViewName>('front')
const desktopDrawerOpen = ref(false)
const mobileInfoOpen = ref(false)
const mobileInfoSnapPoint = ref<'medium' | 'full'>('medium')
const root = ref<HTMLElement | null>(null)
const viewerRuntimeRequested = ref(false)
const viewerRuntimeState = ref<ViewerRuntimeState>('poster')
const viewerRuntimeError = ref('')
const viewerKey = ref(0)
const preferMobileModel = ref(false)
const pointCloudLoading = ref(false)
const pointCloudFailed = ref(false)
let gsapContext: gsap.Context | undefined
let modelPreloadLink: HTMLLinkElement | undefined
let discoveryCued = false
let awakenCued = false

const ThreeExhibitViewer = defineAsyncComponent({
  loader: () => import('../components/ThreeExhibitViewer.vue'),
  delay: 0,
  onError() {
    clearModelPreload()
    viewerRuntimeError.value = navigator.onLine === false ? copy.value.viewerOffline : copy.value.viewerUnavailable
    viewerRuntimeState.value = 'error'
  },
})

const copy = computed(() => locale.value === 'zh-CN' ? {
  viewerOffline: '网络已断开，请恢复连接后重试启动。',
  pointCloudFailed: '点云暂时无法构建，实体模型仍可查看。可再次选择点云重试。',
  loading: '正在加载数字展项…',
  loadFailed: '无法打开该展项',
  backGallery: '返回数字展厅',
  scene: '深墨青铜厅｜数字展厅',
  toolsAria: '视角控制',
  tools: ['旋转', '放大', '缩小', '重置'],
  info: '查看展项信息',
  openDrawer: '展品档案',
  closeDrawer: '收起档案',
  back: '返回数字展厅',
  factLabels: ['来源', '材质', '位置'],
  material: '古青铜 PBR 网页重制',
  unknownSource: '项目组数字重制',
  noDescription: '数字展项说明',
  digitalExhibit: '数字展项',
  renderMode: '渲染模式',
  solid: '实体',
  points: '点云',
  particles: '粒子解构中',
  pbr: 'PBR 实体展示',
  artifact: '阅读文物故事',
  booking: '预约参观',
  tour: '展览导览',
  modeLabel: '观察模式',
  modeGroup: '展品显示模式',
  solidModel: '实体模型',
  returnSolid: '返回实体',
  pointsOn: '点云已开启',
  pointCloudMode: '点云模式',
  pointCloudTour: '点云讲解',
  returnSolidModel: '返回实体模型',
  viewsTitle: '视角切换',
  views: ['正面', '左侧', '右侧', '背面', '俯视'],
  current: '当前展品',
  infoTitle: '展品档案',
  steps: ['器形概览', '结构观察', '纹样细节', '材质层次', '点云解构', '来源说明'],
  title: '数字展项',
  enterViewer: '进入互动 3D',
  preparingViewer: '正在准备互动 3D…',
  retryViewer: '重试启动',
  viewerUnavailable: '互动 3D 资源加载失败，请重试启动。',
  posterHint: '启动后可 360° 自由旋转、缩放并切换实体与点云视角。',
  modelSize: '模型体积',
  pointCloudLoading: '正在构建点云…',
  pointCloudBusy: '构建中',
} : {
  viewerOffline: 'You are offline. Reconnect before retrying 3D.',
  pointCloudFailed: 'The point cloud could not be built. The solid model remains available. Select Points to retry.',
  loading: 'Loading the digital exhibit…',
  loadFailed: 'Unable to open this exhibit',
  backGallery: 'Back to 3D Gallery',
  scene: 'BRONZE GALLERY | DIGITAL EXHIBIT',
  toolsAria: 'View controls',
  tools: ['Rotate', 'Zoom in', 'Zoom out', 'Reset'],
  info: 'View exhibit details',
  openDrawer: 'Object Plaque',
  closeDrawer: 'Hide Plaque',
  back: 'Back to 3D Gallery',
  factLabels: ['Source', 'Material', 'Location'],
  material: 'Recrafted aged-bronze PBR',
  unknownSource: 'Project digital reconstruction',
  noDescription: 'Digital exhibit notes',
  digitalExhibit: 'Digital exhibit',
  renderMode: 'Render mode',
  solid: 'Solid',
  points: 'Points',
  particles: 'Point cloud active',
  pbr: 'PBR solid model',
  artifact: 'Read object story',
  booking: 'Book a visit',
  tour: 'Exhibit tour',
  modeLabel: 'VIEW MODE',
  modeGroup: 'Exhibit display mode',
  solidModel: 'Solid model',
  returnSolid: 'Return to solid',
  pointsOn: 'Point cloud on',
  pointCloudMode: 'Point cloud mode',
  pointCloudTour: 'Point cloud guide',
  returnSolidModel: 'Return to solid model',
  viewsTitle: 'Viewpoints',
  views: ['Front', 'Left', 'Right', 'Back', 'Top'],
  current: 'Current exhibit',
  infoTitle: 'Object Plaque',
  steps: ['Form overview', 'Structure', 'Motif details', 'Material layers', 'Point cloud', 'Source notes'],
  title: 'Digital exhibit',
  enterViewer: 'Enter interactive 3D',
  preparingViewer: 'Preparing interactive 3D…',
  retryViewer: 'Retry 3D',
  viewerUnavailable: 'Interactive 3D resources could not be loaded. Please retry.',
  posterHint: 'Start to rotate 360°, zoom, and switch between solid and point cloud.',
  modelSize: 'Model size',
  pointCloudLoading: 'Building point cloud…',
  pointCloudBusy: 'Building',
})

const displayTitle = computed(() => exhibit.value?.title || copy.value.title)
const headerBadge = computed(() => {
  if (exhibit.value?.slug === 'heluo-bronze-ding-3d') return 'EXHIBIT 01'
  return `EXHIBIT ${exhibit.value?.displayNo || '01'}`
})
const fromArtifactPath = computed(() => {
  const from = typeof route.query?.from === 'string' ? route.query.from : ''
  return from.startsWith('/artifacts/') ? from : ''
})
const backDestination = computed(() => fromArtifactPath.value || '/exhibits')
const backLabel = computed(() => {
  if (!fromArtifactPath.value) return copy.value.back
  return locale.value === 'en-US' ? 'Back to artifact' : '返回器物档案'
})
const localizedSourceCredit = computed(() => {
  const raw = exhibit.value?.sourceCredit
  if (!raw) return copy.value.unknownSource
  if (locale.value === 'zh-CN' && raw.includes('Cleveland Museum of Art')) {
    return '克利夫兰艺术博物馆 · 1962.281 CC0 公开馆藏参考'
  }
  return raw
})
const exhibitFacts = computed(() => [
  { label: copy.value.factLabels[0], value: localizedSourceCredit.value },
  { label: copy.value.factLabels[1], value: exhibit.value?.licenseLabel || copy.value.material },
  { label: copy.value.factLabels[2], value: exhibit.value?.collectionLocation || exhibit.value?.summary || copy.value.noDescription },
])
const views = computed<Array<{ key: ViewName; label: string; thumbnail: string }>>(() => [
  { key: 'front', label: copy.value.views[0], thumbnail: '/media/exhibits/views/bronze-ding-front-thumb.webp' },
  { key: 'left', label: copy.value.views[1], thumbnail: '/media/exhibits/views/bronze-ding-side-thumb.webp' },
  { key: 'right', label: copy.value.views[2], thumbnail: '/media/exhibits/views/bronze-ding-side-thumb.webp' },
  { key: 'back', label: copy.value.views[3], thumbnail: '/media/exhibits/views/bronze-ding-back-thumb.webp' },
  { key: 'top', label: copy.value.views[4], thumbnail: '/media/exhibits/views/bronze-ding-top-thumb.webp' },
])
const tourSteps = computed(() => copy.value.steps)
const activeTourStep = computed(() => displayMode.value === 'points' ? 5 : 1)
const pointCloudTourLabel = computed(() => displayMode.value === 'points' ? copy.value.returnSolidModel : copy.value.pointCloudTour)
const renderedQuality = computed(() => locale.value === 'zh-CN'
  ? qualityLabel(renderQuality.value)
  : ({ high: 'High quality', medium: 'Balanced quality', low: 'Performance mode', mobile: 'Mobile quality', fallback: 'Solid fallback' }[renderQuality.value]))
const activeModel = computed(() => exhibit.value ? selectExhibitModelSource(exhibit.value, preferMobileModel.value) : null)
const viewerInteractive = computed(() => viewerRuntimeState.value === 'ready')
const posterStatus = computed(() => viewerRuntimeState.value === 'error' ? viewerRuntimeError.value || copy.value.viewerUnavailable : copy.value.posterHint)
const formattedModelSize = computed(() => {
  const bytes = activeModel.value?.sizeBytes
  if (!bytes || bytes <= 0) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(bytes / 1024)} KB`
})
const showDarkroomInvite = computed(() => (
  !audio.enabled.value && !inviteDismissed.value && !loading.value && Boolean(exhibit.value)
))
const darkroomInviteCopy = computed(() => {
  const isBronze = exhibit.value?.slug === 'heluo-bronze-ding-3d'
  if (locale.value === 'en-US') {
    return {
      text: isBronze ? 'Enable darkroom soundscape · Warm Bronze' : 'Enable darkroom soundscape · Quiet Reading',
      enable: 'Enable',
      dismiss: 'Dismiss soundscape invitation',
    }
  }
  return {
    text: isBronze ? '开启暗房声景 ·《观器·温金》' : '开启暗房声景 ·《水岸·静读》',
    enable: '开启',
    dismiss: '关闭声景邀请',
  }
})

function acceptDarkroomInvite() {
  audio.enable()
}

function dismissDarkroomInvite() {
  inviteDismissed.value = true
  try {
    localStorage.setItem(DARKROOM_INVITE_DISMISSED_KEY, 'true')
  } catch { /* Non-fatal if storage is blocked. */ }
}

function revealExhibitShell() {
  if (!shouldRunGsapReveal() || !root.value || !exhibit.value) return
  gsapContext?.revert()
  gsapContext = createGsapContext(root.value, () => {
    const constrained = isConstrainedGsapReveal()
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    timeline
      .from('[data-motion="scene-label"]', { autoAlpha: 0, y: constrained ? 0 : -8, duration: 0.28, clearProps: 'transform' }, 0)
      .from('[data-motion="exhibit-dock"]', { autoAlpha: 0, y: constrained ? 6 : 18, duration: 0.36, clearProps: 'transform' }, 0.12)
  })
}

let detailRequestId = 0
function clearModelPreload() {
  modelPreloadLink?.remove()
  modelPreloadLink = undefined
}

function preloadActiveModel() {
  const modelUrl = activeModel.value?.url
  if (!modelUrl) return
  const resolvedUrl = new URL(modelUrl, window.location.href).href
  if (modelPreloadLink?.isConnected && modelPreloadLink.href === resolvedUrl) return
  clearModelPreload()
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'fetch'
  link.href = resolvedUrl
  link.crossOrigin = 'anonymous'
  link.dataset.heluoThreeModelPreload = 'true'
  document.head.appendChild(link)
  modelPreloadLink = link
}

function resetViewerRuntime() {
  clearModelPreload()
  discoveryCued = false
  awakenCued = false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const manualActivation = requiresManualExhibitActivation({
    coarsePointer,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
    memoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  })
  preferMobileModel.value = manualActivation || window.innerWidth <= 760
  const hasQueuedViewerAction = Boolean(
    guideStore?.pendingViewerAction && guideStore.pendingViewerAction.exhibitSlug === String(route.params.slug),
  )
  viewerRuntimeRequested.value = consumeExhibitRuntimeRecovery() || !manualActivation || hasQueuedViewerAction
  viewerRuntimeState.value = viewerRuntimeRequested.value ? 'activating' : 'poster'
  viewerRuntimeError.value = ''
  viewerKey.value += 1
  viewer.value = null
  displayMode.value = 'solid'
  renderQuality.value = 'medium'
  activeView.value = 'front'
  pointCloudLoading.value = false
  pointCloudFailed.value = false
}

function activateViewer() {
  if (navigator.onLine === false) {
    viewerRuntimeError.value = copy.value.viewerOffline
    viewerRuntimeState.value = 'error'
    return
  }
  if (viewerRuntimeState.value === 'error' && viewerRuntimeError.value) {
    viewerRuntimeState.value = 'activating'
    reloadExhibitRuntime()
    return
  }
  preloadActiveModel()
  viewerRuntimeRequested.value = true
  viewerRuntimeState.value = 'activating'
  viewerRuntimeError.value = ''
  if (!awakenCued) {
    awakenCued = true
    void audioSystem.playInteraction('awaken-bronze', { volume: 0.24 })
  }
}

function handleViewerState(state: ViewerRuntimeState) {
  viewerRuntimeState.value = state
  if (state === 'ready' && !discoveryCued) {
    discoveryCued = true
    void audioSystem.playNarrative('discovery', { volume: 0.26 })
    acousticRulerRef.value?.triggerRipple(0.5, 0.55)
  }
  if (state === 'ready' || state === 'error') clearModelPreload()
  if (state !== 'error') viewerRuntimeError.value = ''
}

function handlePointCloudState(state: 'idle' | 'loading' | 'ready' | 'error') {
  pointCloudLoading.value = state === 'loading'
  pointCloudFailed.value = state === 'error'
}

async function load() {
  const requestId = ++detailRequestId
  resetViewerRuntime()
  loading.value = true
  error.value = ''
  exhibit.value = null
  try {
    const result = await apiGet<Exhibit>(`/exhibits/${encodeURIComponent(String(route.params.slug))}`)
    if (requestId === detailRequestId) exhibit.value = result
  } catch (reason) {
    if (requestId === detailRequestId) error.value = reason instanceof Error ? reason.message : copy.value.loadFailed
  } finally {
    if (requestId !== detailRequestId) return
    loading.value = false
    await nextTick()
    revealExhibitShell()
  }
  if (requestId === detailRequestId && exhibit.value === null) loading.value = false
}

// Passively report viewer state to Luosheng store
watch([viewerRuntimeState, displayMode, activeView], ([state, mode, view]) => {
  guideStore?.setViewerState({
    active: state === 'ready',
    mode,
    view,
  })
})

let tourTimers: ReturnType<typeof setTimeout>[] = []
function clearGuidedTour() {
  for (const timer of tourTimers) clearTimeout(timer)
  tourTimers = []
}

// Consume queued 3D actions from Luosheng (same-page or cross-page navigation)
watch(
  [() => guideStore?.pendingViewerAction, viewerRuntimeState, viewer, exhibit],
  async ([action, state, ctrl, currentExhibit]) => {
    if (!guideStore || !action || !currentExhibit || action.exhibitSlug !== currentExhibit.slug) return
    if (state === 'poster') {
      activateViewer()
      return
    }
    if (state === 'error') {
      guideStore.consumeViewerAction()
      if (action.part) {
        guideStore.queuePlateAction(action.part)
        await nextTick()
        document.getElementById('luosheng-static-plates')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        mobileInfoOpen.value = true
      }
      guideStore.showToast(
        locale.value === 'en-US'
          ? 'WebGL is unavailable on this device; switched to static reference plates.'
          : '当前设备暂不支持 WebGL，已为你定位到静态看点图版。',
      )
      return
    }
    if (state === 'ready' && ctrl) {
      const consumed = guideStore.consumeViewerAction()
      if (!consumed) return
      clearGuidedTour()
      if (consumed.mode && consumed.mode !== displayMode.value) {
        selectMode(consumed.mode)
      }
      if (consumed.tour) {
        const en = locale.value === 'en-US'
        const stops: { part: GuidePartName; delay: number; hint: string }[] = [
          { part: 'ear', delay: 0, hint: en ? 'Step 1/3 · Upright Ears (Top)' : '导览 1/3 · 俯视双耳对称轮廓' },
          { part: 'motif', delay: 2800, hint: en ? 'Step 2/3 · Belly Band Motif (Front)' : '导览 2/3 · 正面器腹宽线纹样' },
          { part: 'feet', delay: 5600, hint: en ? 'Step 3/3 · Three Tripod Legs (Back)' : '导览 3/3 · 背面三足完整支撑' },
        ]
        for (const stop of stops) {
          const timer = setTimeout(() => {
            if (viewerRuntimeState.value !== 'ready' || !viewer.value) return
            viewer.value.focusPart(stop.part, { animated: true })
            guideStore.showToast(stop.hint, 2500)
          }, stop.delay)
          tourTimers.push(timer)
        }
        return
      }
      if (consumed.part) {
        ctrl.focusPart(consumed.part, { animated: true })
      } else if (consumed.view) {
        activeView.value = consumed.view
        ctrl.setView(consumed.view, { animated: true })
      }
      if (window.innerWidth < 768) {
        guideStore.showToast(
          locale.value === 'en-US'
            ? 'View updated — drag freely to inspect.'
            : '已切换视角，可自由旋转查看',
        )
      }
    }
  },
  { immediate: true },
)

const PART_RIPPLE_POS: Record<GuidePartName, number> = {
  ear: 0.34,
  motif: 0.5,
  feet: 0.66,
}

function selectMode(mode: 'solid' | 'points') {
  if (!viewerInteractive.value || (mode === 'points' && pointCloudLoading.value)) return
  if (mode !== displayMode.value) {
    acousticRulerRef.value?.triggerRipple(0.5, 0.65)
  }
  viewer.value?.setMode(mode)
}

function handlePartFocus(part: GuidePartName) {
  const now = Date.now()
  if (now - lastPartFocusSfxAt >= 180) {
    lastPartFocusSfxAt = now
    void audioSystem.playInteraction('awaken-bronze', PART_FOCUS_AUDIO[part])
  }
  acousticRulerRef.value?.triggerRipple(PART_RIPPLE_POS[part], 0.9)
}

watch(displayMode, (mode) => {
  audioSystem.setSpaceAcoustic(mode === 'points' ? 'pointcloud' : 'default')
}, { immediate: true })

function togglePointCloud() { selectMode(displayMode.value === 'points' ? 'solid' : 'points') }
function chooseView(view: ViewName) { if (!viewerInteractive.value) return; activeView.value = view; viewer.value?.setView(view, { animated: true }) }
function reset() { if (!viewerInteractive.value) return; activeView.value = 'front'; viewer.value?.resetView() }

onMounted(load)
watch(() => route.params.slug, load)
onBeforeUnmount(() => {
  clearGuidedTour()
  audioSystem.setSpaceAcoustic('default')
  gsapContext?.revert()
  clearModelPreload()
})
</script>

<template>
  <section v-if="loading" class="state-panel detail-state">{{ copy.loading }}</section>
  <section v-else-if="error" class="state-panel detail-state">
    <h1>{{ copy.loadFailed }}</h1>
    <p>{{ error }}</p>
    <RouterLink class="fluid-button fluid-button--secondary" to="/exhibits">{{ copy.backGallery }}</RouterLink>
  </section>

  <section v-else-if="exhibit" ref="root" class="immersive-exhibit" data-motion-page="exhibit-detail">
    <section class="exhibit-scene" :data-display-mode="displayMode">
      <!-- Module 1: Frameless Top Floating Bar -->
      <header class="darkroom-topbar" data-motion="scene-label">
        <RouterLink class="darkroom-back" :to="backDestination">← {{ backLabel }}</RouterLink>
        <div class="darkroom-title">
          <span class="font-mono">{{ headerBadge }}</span>
          <i aria-hidden="true">·</i>
          <h1>{{ displayTitle }}</h1>
        </div>
        <div class="darkroom-topbar__actions">
          <button
            class="darkroom-drawer-toggle"
            type="button"
            :aria-expanded="desktopDrawerOpen"
            @click="desktopDrawerOpen = !desktopDrawerOpen"
          >
            <InfoFilled aria-hidden="true" />
            <span>{{ desktopDrawerOpen ? copy.closeDrawer : copy.openDrawer }}</span>
          </button>
          <button
            v-if="viewerRuntimeState === 'ready'"
            class="mobile-exhibit-info-trigger"
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="mobileInfoOpen"
            @click="mobileInfoOpen = true"
          >
            <InfoFilled aria-hidden="true" />
            <span>{{ copy.info }}</span>
          </button>
        </div>
      </header>

      <Transition name="audio-panel">
        <div
          v-if="showDarkroomInvite"
          class="darkroom-invite"
          data-glass="dark"
          data-testid="darkroom-audio-invite"
          role="region"
          :aria-label="darkroomInviteCopy.text"
        >
          <button
            type="button"
            class="darkroom-invite__enable"
            data-testid="darkroom-invite-enable"
            @click="acceptDarkroomInvite"
          >
            <span class="darkroom-invite__dot" aria-hidden="true"></span>
            <span>{{ darkroomInviteCopy.text }}</span>
            <em>{{ darkroomInviteCopy.enable }}</em>
          </button>
          <button
            type="button"
            class="darkroom-invite__dismiss"
            data-testid="darkroom-invite-dismiss"
            :aria-label="darkroomInviteCopy.dismiss"
            @click="dismissDarkroomInvite"
          >
            ×
          </button>
        </div>
      </Transition>

      <!-- Full-bleed Studio Darkroom 3D Stage -->
      <div class="exhibit-viewer-wrap" :data-viewer-state="viewerRuntimeState">
        <ThreeExhibitViewer
          v-if="viewerRuntimeRequested && activeModel"
          :key="viewerKey"
          ref="viewer"
          :model-url="activeModel.url"
          :cover-image-url="exhibit.coverImageUrl"
          :alt="displayTitle"
          :enable-point-cloud="true"
          initial-mode="solid"
          @mode-change="displayMode = $event"
          @view-change="activeView = $event"
          @part-focus="handlePartFocus"
          @quality-change="renderQuality = $event"
          @state-change="handleViewerState"
          @point-cloud-state="handlePointCloudState"
        />

        <!-- Poster / Activation State -->
        <div
          v-if="!viewerRuntimeRequested || viewerRuntimeState === 'activating' || (viewerRuntimeState === 'error' && viewerRuntimeError)"
          class="three-viewer three-viewer--poster"
        >
          <div class="three-fallback three-fallback--activation" role="status" aria-live="polite">
            <img :src="exhibit.coverImageUrl" :alt="displayTitle" decoding="async" fetchpriority="high" />
            <div class="viewer-poster-copy">
              <span class="viewer-poster-badge font-mono">{{ headerBadge }}</span>
              <p>
                {{ viewerRuntimeState === 'activating' ? copy.preparingViewer : posterStatus }}
                <small v-if="formattedModelSize">{{ copy.modelSize }}：{{ formattedModelSize }}</small>
              </p>
              <div v-if="viewerRuntimeState !== 'activating'" class="viewer-poster-actions">
                <button class="viewer-poster-start" type="button" @click="activateViewer">
                  <VideoPlay aria-hidden="true" />
                  <span>{{ viewerRuntimeState === 'error' ? copy.retryViewer : copy.enterViewer }}</span>
                </button>
                <button
                  class="viewer-poster-info"
                  type="button"
                  aria-haspopup="dialog"
                  :aria-expanded="mobileInfoOpen"
                  @click="mobileInfoOpen = true"
                >
                  <InfoFilled aria-hidden="true" />
                  <span>{{ copy.info }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Module 3: Collapsible Right Specimen Plaque Drawer (Desktop) -->
      <aside
        class="exhibit-panel exhibit-panel-desktop"
        :class="{ 'is-open': desktopDrawerOpen }"
        data-glass="dark"
        data-motion="exhibit-panel"
        :aria-hidden="!desktopDrawerOpen"
      >
        <div class="exhibit-panel-heading" data-motion="panel-heading">
          <div class="exhibit-panel-title">
            <p class="font-mono">{{ headerBadge }} · DIGITAL COLLECTION</p>
            <h2>{{ displayTitle }}</h2>
          </div>
          <button class="exhibit-panel-close" type="button" :aria-label="copy.closeDrawer" @click="desktopDrawerOpen = false">×</button>
        </div>

        <dl class="exhibit-facts">
          <div v-for="fact in exhibitFacts" :key="fact.label" data-motion="panel-fact">
            <dt>{{ fact.label }}</dt>
            <dd>{{ fact.value }}</dd>
          </div>
        </dl>

        <p class="render-quality" aria-live="polite">
          <i aria-hidden="true"></i>
          <span>{{ pointCloudLoading ? copy.pointCloudLoading : pointCloudFailed ? copy.pointCloudFailed : `${renderedQuality} · ${displayMode === 'points' ? copy.particles : copy.pbr}` }}</span>
        </p>

        <div class="tour-route">
          <p class="tour-route__label">{{ copy.tour }} <span class="font-mono">{{ activeTourStep }} / 6</span></p>
          <p v-if="pointCloudFailed" class="point-cloud-error" role="status">{{ copy.pointCloudFailed }}</p>
          <ol v-else :aria-label="copy.tour">
            <li
              v-for="(step, index) in tourSteps"
              :key="step"
              :class="{ active: activeTourStep === index + 1 }"
              :aria-current="activeTourStep === index + 1 ? 'step' : undefined"
            >
              <button
                v-if="index === 4"
                type="button"
                :aria-label="pointCloudTourLabel"
                :aria-pressed="displayMode === 'points'"
                :disabled="!viewerInteractive || pointCloudLoading || renderQuality === 'fallback'"
                @click="togglePointCloud"
              >
                {{ pointCloudLoading ? copy.pointCloudBusy : pointCloudTourLabel }}
              </button>
              <span v-else>{{ step }}</span>
            </li>
          </ol>
        </div>

        <div class="exhibit-panel-actions">
          <RouterLink class="panel-cta-primary" data-motion="panel-action" :to="`/artifacts/${exhibit.artifact.slug}`">{{ copy.artifact }} →</RouterLink>
          <RouterLink class="panel-cta-secondary" data-motion="panel-action" to="/appointment">{{ copy.booking }}</RouterLink>
        </div>
      </aside>

      <!-- Module 2: Centered Floating Pill Dock -->
      <section class="exhibit-dock" data-glass="dark" data-motion="exhibit-dock">
        <div class="dock-section" data-motion="dock-section">
          <div
            class="dock-mode-switch"
            role="group"
            :aria-label="copy.modeGroup"
            :data-mode="displayMode"
          >
            <button
              type="button"
              :class="{ active: displayMode === 'solid' }"
              :aria-pressed="displayMode === 'solid'"
              :disabled="!viewerInteractive"
              @click="selectMode('solid')"
            >
              <Box aria-hidden="true" />
              <span>{{ displayMode === 'points' ? copy.returnSolid : copy.solidModel }}</span>
            </button>
            <button
              type="button"
              :class="{ active: displayMode === 'points' }"
              :aria-pressed="displayMode === 'points'"
              :aria-busy="pointCloudLoading"
              :disabled="!viewerInteractive || pointCloudLoading || renderQuality === 'fallback'"
              @click="selectMode('points')"
            >
              <Connection aria-hidden="true" />
              <span>{{ pointCloudLoading ? copy.pointCloudBusy : displayMode === 'points' ? copy.pointsOn : copy.pointCloudMode }}</span>
            </button>
          </div>
        </div>

        <div class="dock-divider" aria-hidden="true"></div>

        <div class="dock-section view-switcher" data-motion="dock-section">
          <div role="group" :aria-label="copy.viewsTitle">
            <button
              v-for="view in views"
              :key="view.key"
              type="button"
              :class="{ active: activeView === view.key }"
              :data-view="view.key"
              :aria-label="view.label"
              :aria-pressed="activeView === view.key"
              :disabled="!viewerInteractive"
              @click="chooseView(view.key)"
            >
              <span>{{ view.label }}</span>
            </button>
          </div>
        </div>

        <div class="dock-divider" aria-hidden="true"></div>

        <div class="dock-section viewer-tools" data-motion="dock-section" role="group" :aria-label="copy.toolsAria">
          <button data-motion="exhibit-tool" type="button" :aria-label="copy.tools[0]" :title="copy.tools[0]" :disabled="!viewerInteractive" @click="viewer?.rotate()">↻</button>
          <button data-motion="exhibit-tool" type="button" :aria-label="copy.tools[1]" :title="copy.tools[1]" :disabled="!viewerInteractive" @click="viewer?.zoomIn()">＋</button>
          <button data-motion="exhibit-tool" type="button" :aria-label="copy.tools[2]" :title="copy.tools[2]" :disabled="!viewerInteractive" @click="viewer?.zoomOut()">−</button>
          <button data-motion="exhibit-tool" type="button" :aria-label="copy.tools[3]" :title="copy.tools[3]" :disabled="!viewerInteractive" @click="reset">◇</button>
        </div>
      </section>

      <div class="exhibit-scene__ruler">
        <AcousticRuler
          ref="acousticRulerRef"
          variant="darkroom"
          :visual-mode="displayMode"
          :show-placard="false"
          :default-track="exhibit.slug === 'heluo-bronze-ding-3d' ? 'bronze' : 'reading'"
        />
      </div>
    </section>

    <LuoshengPreset
      v-if="LuoshengPreset && exhibit.slug === GUIDE_EXHIBIT_SLUG && exhibit.artifact.slug === GUIDE_ARTIFACT_SLUG"
      :exhibit-slug="GUIDE_EXHIBIT_SLUG"
    />

    <BottomSheet
      :open="mobileInfoOpen"
      :title="copy.infoTitle"
      :snap-point="mobileInfoSnapPoint"
      @close="mobileInfoOpen = false"
      @update:snap-point="mobileInfoSnapPoint = $event"
    >
      <div class="mobile-exhibit-info">
        <h2>{{ displayTitle }}</h2>
        <dl class="mobile-exhibit-facts">
          <div v-for="fact in exhibitFacts" :key="fact.label">
            <dt>{{ fact.label }}</dt>
            <dd>{{ fact.value }}</dd>
          </div>
        </dl>
        <div class="mobile-mode-switch" role="group" :aria-label="copy.renderMode">
          <button type="button" :class="{ active: displayMode === 'solid' }" :aria-pressed="displayMode === 'solid'" :disabled="!viewerInteractive" @click="selectMode('solid')">{{ copy.solid }}</button>
          <button type="button" :class="{ active: displayMode === 'points' }" :aria-pressed="displayMode === 'points'" :aria-busy="pointCloudLoading" :disabled="!viewerInteractive || pointCloudLoading || renderQuality === 'fallback'" @click="selectMode('points')">{{ pointCloudLoading ? copy.pointCloudBusy : copy.points }}</button>
        </div>
        <p v-if="pointCloudFailed" class="point-cloud-error" role="status">{{ copy.pointCloudFailed }}</p>
        <div class="exhibit-panel-actions">
          <RouterLink class="fluid-button fluid-button--primary fluid-button--block" :to="`/artifacts/${exhibit.artifact.slug}`">{{ copy.artifact }} →</RouterLink>
          <RouterLink class="fluid-button fluid-button--secondary fluid-button--block" to="/appointment">{{ copy.booking }}</RouterLink>
        </div>
      </div>
    </BottomSheet>
  </section>
</template>

<style scoped>
.detail-state {
  width: min(calc(100% - 2rem), 680px);
  margin: var(--space-10) auto;
}

.immersive-exhibit {
  position: relative;
  width: 100%;
  background: var(--surface-canvas);
  color: var(--ink-primary);
}

/* ── Museum Exhibition Stage: Sunlit Architectural Hall (Light) & Obsidian Silk Warm Gallery (Dark) ── */
.exhibit-scene {
  position: relative;
  width: 100%;
  height: calc(100dvh - var(--header-height));
  min-height: 580px;
  overflow: hidden;
  background-color: var(--exhibit-stage-bg-color);
  background-image: var(--exhibit-stage-bg-image);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}

/* Architectural curatorial dimming veil in Light Mode Point Cloud:
   softly dims the sunlit hall with an overhead spotlight pool so burnished gold
   and antique bronze points gleam crisply while the header & UI stay Light Mode. */
.exhibit-scene::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(ellipse 52% 24% at 50% 6%, oklch(92% 0.032 80 / 0.16) 0%, transparent 72%),
    radial-gradient(ellipse 54% 68% at 50% 48%, oklch(12% 0.010 78 / 0.86) 0%, oklch(16% 0.010 80 / 0.78) 48%, oklch(22% 0.008 82 / 0.62) 78%, oklch(26% 0.008 84 / 0.48) 100%),
    linear-gradient(180deg, oklch(20% 0.008 82 / 0.24) 0%, oklch(15% 0.010 80 / 0.14) 48%, oklch(14% 0.010 78 / 0.34) 100%);
  transition: opacity 560ms var(--ease-curatorial);
}

.exhibit-scene[data-display-mode="points"]::after {
  opacity: 1;
}

.exhibit-viewer-wrap {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
}

/* ── Module 1: Frameless Top Floating Bar ── */
.darkroom-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) clamp(1rem, 3vw, 2rem);
  background: linear-gradient(180deg, oklch(97% 0.006 95 / 0.52) 0%, transparent 100%);
  pointer-events: none;
}

.darkroom-topbar > * {
  pointer-events: auto;
}

.darkroom-back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  min-height: var(--control-min);
  padding: 0 0.875rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--glass-light-bg);
  color: var(--ink-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color var(--duration-fast) var(--ease-curatorial);
}

.darkroom-back:hover {
  border-color: var(--accent-bronze);
}

.darkroom-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.9rem;
  border-radius: var(--radius-pill);
  background: var(--glass-light-bg);
  border: 1px solid var(--border-hairline);
  color: var(--ink-primary);
  text-align: center;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.darkroom-title span {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--accent-bronze);
}

.darkroom-title i {
  font-style: normal;
  opacity: 0.5;
}

.darkroom-title h1 {
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 600;
  color: inherit;
  letter-spacing: 0.04em;
}

.darkroom-topbar__actions {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.darkroom-drawer-toggle,
.mobile-exhibit-info-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: var(--control-min);
  padding: 0 1rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--glass-light-bg);
  color: var(--ink-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color var(--duration-fast) var(--ease-curatorial);
}

.darkroom-drawer-toggle:hover,
.mobile-exhibit-info-trigger:hover {
  border-color: var(--accent-bronze);
}

.darkroom-drawer-toggle svg,
.mobile-exhibit-info-trigger svg {
  width: 15px;
  height: 15px;
  color: var(--accent-bronze);
}

.mobile-exhibit-info-trigger {
  display: none;
}

.darkroom-invite {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 18;
  display: inline-flex;
  align-items: center;
  max-width: calc(100% - 1.5rem);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-md);
  color: var(--ink-on-dark);
}

.darkroom-invite__enable {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0 0.75rem 0 1rem;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.darkroom-invite__enable em {
  font-style: normal;
  font-weight: 600;
  color: oklch(84% 0.058 78);
  padding-left: 0.25rem;
}

.darkroom-invite__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: oklch(81% 0.048 78);
  flex-shrink: 0;
}

.darkroom-invite__dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--glass-dark-border);
  background: transparent;
  color: var(--ink-on-dark-muted);
  font-size: var(--text-md);
  line-height: 1;
  cursor: pointer;
}

.darkroom-invite__dismiss:hover {
  color: var(--ink-on-dark);
}

/* ── Module 2: Centered Floating Pill Dock ── */
.exhibit-dock {
  position: absolute;
  left: 50%;
  bottom: 54px;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: calc(100% - 2rem);
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-lg);
}

.exhibit-scene__ruler {
  position: absolute;
  inset-inline: clamp(20px, 4vw, 56px);
  bottom: 10px;
  z-index: 4;
  pointer-events: none;
}

.dock-divider {
  width: 1px;
  height: 28px;
  background: var(--glass-dark-border);
  flex-shrink: 0;
}

.dock-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--glass-dark-border);
  border-radius: var(--radius-pill);
  background: oklch(11% 0.005 74 / 0.68);
}

.dock-mode-switch button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0 0.875rem;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-on-dark-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial);
}

.dock-mode-switch button svg {
  width: 14px;
  height: 14px;
}

.dock-mode-switch button.active {
  background: oklch(81% 0.048 78);
  color: oklch(14% 0.006 74);
}

.dock-mode-switch button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.view-switcher > div {
  display: flex;
  align-items: center;
  gap: 4px;
}

.view-switcher button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-on-dark-muted);
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial);
}

.view-switcher button:hover:not(:disabled) {
  color: var(--ink-on-dark);
  background: oklch(90% 0.01 90 / 0.08);
}

.view-switcher button.active {
  border-color: oklch(72% 0.092 75 / 0.65);
  background: oklch(72% 0.092 75 / 0.18);
  color: var(--ink-on-dark);
  font-weight: 600;
}

.view-switcher button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.viewer-tools {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.viewer-tools button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-on-dark-muted);
  font-size: var(--text-md);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial);
}

.viewer-tools button:hover:not(:disabled) {
  background: oklch(90% 0.01 90 / 0.12);
  color: var(--ink-on-dark);
}

.viewer-tools button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Module 3: Collapsible Right Specimen Plaque Drawer ── */
.exhibit-panel-desktop {
  position: absolute;
  top: 76px;
  right: var(--space-5);
  z-index: 19;
  display: grid;
  gap: var(--space-4);
  width: 332px;
  max-height: calc(100% - 168px);
  overflow-y: auto;
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  color: var(--ink-on-dark);
  opacity: 0;
  pointer-events: none;
  transform: translateX(18px);
  transition: opacity var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-ui) var(--ease-curatorial);
}

.exhibit-panel-desktop.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.exhibit-panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--glass-dark-border);
}

.exhibit-panel-title p {
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--accent-bronze);
  margin-bottom: 0.25rem;
}

.exhibit-panel-title h2 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--ink-on-dark);
  line-height: 1.3;
}

.exhibit-panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--glass-dark-border);
  border-radius: 50%;
  background: transparent;
  color: var(--ink-on-dark-muted);
  font-size: var(--text-lg);
  cursor: pointer;
}

.exhibit-panel-close:hover {
  color: var(--ink-on-dark);
  border-color: var(--accent-bronze);
}

.exhibit-facts {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.exhibit-facts > div {
  display: grid;
  gap: 0.15rem;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid oklch(88% 0.02 85 / 0.08);
}

.exhibit-facts dt {
  font-size: var(--text-xs);
  color: var(--ink-on-dark-muted);
}

.exhibit-facts dd {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-on-dark);
  line-height: 1.5;
}

.render-quality {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--text-xs);
  color: var(--ink-on-dark-muted);
}

.render-quality i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: oklch(72% 0.095 162);
  flex-shrink: 0;
}

.tour-route {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-dark-border);
}

.tour-route__label {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--ink-on-dark-muted);
}

.tour-route ol {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tour-route li span,
.tour-route li button {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 0.625rem;
  border: 1px solid var(--glass-dark-border);
  border-radius: var(--radius-xs);
  background: oklch(18% 0.006 74 / 0.72);
  color: var(--ink-on-dark-muted);
  font-size: var(--text-xs);
}

.tour-route li.active span,
.tour-route li button {
  border-color: oklch(78% 0.052 76 / 0.55);
  color: var(--ink-on-dark);
}

.tour-route li button {
  cursor: pointer;
  background: oklch(78% 0.052 76 / 0.18);
  font-weight: 600;
}

.tour-route li button:hover:not(:disabled) {
  background: oklch(81% 0.048 78);
  color: oklch(14% 0.006 74);
}

.exhibit-panel-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  padding-top: var(--space-2);
}

.panel-cta-primary,
.panel-cta-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 0.75rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  text-align: center;
}

.panel-cta-primary {
  background: oklch(81% 0.048 78);
  color: oklch(14% 0.006 74);
}

.panel-cta-secondary {
  border: 1px solid var(--glass-dark-border);
  color: var(--ink-on-dark);
}

.panel-cta-secondary:hover {
  border-color: var(--accent-bronze);
}

/* ── Poster Activation State ── */
.three-viewer--poster {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
}

.three-fallback--activation {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 5.5rem 1.5rem 7rem;
}

.three-fallback--activation > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.42;
  pointer-events: none;
}

.viewer-poster-copy {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: var(--space-4);
  max-width: 380px;
  padding: var(--space-6);
  border: 1px solid var(--glass-dark-border);
  border-radius: var(--radius-lg);
  background: oklch(13% 0.005 74 / 0.86);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  text-align: center;
}

.viewer-poster-badge {
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: var(--accent-bronze);
}

.viewer-poster-copy p {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-on-dark);
}

.viewer-poster-copy small {
  display: block;
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--ink-on-dark-muted);
}

.viewer-poster-actions {
  display: grid;
  gap: var(--space-2);
  width: min(100%, 260px);
}

.viewer-poster-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 48px;
  padding: 0 1.25rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  pointer-events: auto;
}

.viewer-poster-actions button svg {
  width: 18px;
  height: 18px;
}

.viewer-poster-start {
  border: 1px solid oklch(81% 0.048 78);
  background: oklch(81% 0.048 78);
  color: oklch(14% 0.006 74);
}

.viewer-poster-info {
  border: 1px solid var(--glass-dark-border);
  background: transparent;
  color: var(--ink-on-dark);
}

.point-cloud-error {
  font-size: var(--text-xs);
  color: var(--status-warning);
  line-height: 1.5;
}

/* ── Mobile Info BottomSheet Content ── */
.mobile-exhibit-info {
  display: grid;
  gap: var(--space-4);
}

.mobile-exhibit-info h2 {
  font-size: var(--text-xl);
}

.mobile-exhibit-facts {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.mobile-exhibit-facts > div {
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-hairline);
}

.mobile-exhibit-facts dt {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.mobile-exhibit-facts dd {
  margin: 0.2rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-primary);
}

.mobile-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.mobile-mode-switch button {
  min-height: var(--control-min);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.mobile-mode-switch button.active {
  background: var(--accent-jade);
  border-color: var(--accent-jade);
  color: var(--accent-jade-ink);
}

/* ── Responsive ── */
@media (max-width: 1080px) {
  .exhibit-dock {
    flex-wrap: wrap;
    justify-content: center;
    border-radius: var(--radius-lg);
    padding: 8px 12px;
  }

  .dock-divider {
    display: none;
  }
}

@media (max-width: 760px) {
  .exhibit-scene {
    height: calc(100dvh - 64px - 60px);
    min-height: 460px;
  }

  .darkroom-topbar {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-3);
  }

  .darkroom-back,
  .mobile-exhibit-info-trigger {
    white-space: nowrap;
    padding: 0 0.7rem;
  }

  .darkroom-title {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  .darkroom-title span,
  .darkroom-title i {
    display: none;
  }

  .darkroom-title h1 {
    font-size: var(--text-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .darkroom-invite {
    top: 74px;
    max-width: calc(100% - 1.5rem);
  }

  .darkroom-invite__enable {
    min-height: 38px;
    padding: 0 0.7rem;
  }

  .darkroom-invite__dismiss {
    width: 38px;
    height: 38px;
  }

  .darkroom-drawer-toggle,
  .exhibit-panel-desktop {
    display: none;
  }

  .mobile-exhibit-info-trigger {
    display: inline-flex;
    padding: 0 0.75rem;
  }

  .exhibit-dock {
    left: var(--space-3);
    right: var(--space-3);
    bottom: 36px;
    transform: none;
    max-width: none;
    gap: var(--space-2);
    padding: 8px;
  }

  .exhibit-scene__ruler {
    inset-inline: var(--space-3);
    bottom: 6px;
  }

  .view-switcher {
    width: 100%;
    overflow-x: auto;
  }

  .view-switcher > div {
    width: max-content;
    margin: 0 auto;
  }

  .view-switcher button img {
    display: none;
  }

  .view-switcher button {
    padding: 0 0.65rem;
  }
}

@media (max-width: 760px) and (max-height: 700px) {
  .darkroom-topbar {
    padding: var(--space-2) var(--space-3);
  }

  .darkroom-invite {
    top: 68px;
  }

  .exhibit-dock {
    bottom: 30px;
    gap: 4px;
    padding: 6px;
  }

  .exhibit-scene__ruler {
    bottom: 4px;
  }
}
</style>

<style>
/* Root theme overrides live in an unscoped block because Vue's <style scoped>
   compiler strips descendant selectors following :global(html[data-theme="dark"]). */
html[data-theme="dark"] .immersive-exhibit .exhibit-scene::after,
html[data-theme="dark"] .immersive-exhibit .exhibit-scene[data-display-mode="points"]::after {
  opacity: 0;
}

html[data-theme="dark"] .immersive-exhibit .darkroom-topbar {
  background: linear-gradient(180deg, oklch(12% 0.005 74 / 0.68) 0%, transparent 100%);
}

html[data-theme="dark"] .immersive-exhibit .darkroom-back {
  border-color: var(--glass-dark-border);
  background: var(--glass-dark-bg);
  color: var(--ink-on-dark);
}

html[data-theme="dark"] .immersive-exhibit .darkroom-title {
  background: oklch(18% 0.006 74 / 0.66);
  border-color: var(--glass-dark-border);
  color: var(--ink-on-dark);
}

html[data-theme="dark"] .immersive-exhibit .darkroom-drawer-toggle,
html[data-theme="dark"] .immersive-exhibit .mobile-exhibit-info-trigger {
  border-color: var(--glass-dark-border);
  background: var(--glass-dark-bg);
  color: var(--ink-on-dark);
}
</style>
