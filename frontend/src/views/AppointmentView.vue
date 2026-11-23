<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowRight, Calendar, Check, CircleCheck, Clock, InfoFilled, Location, Minus, Plus, Refresh, Tickets, Timer, User } from '@element-plus/icons-vue'
import { ApiRequestError, apiGet, apiRequest } from '../lib/api'
import { gsap } from 'gsap'
import { createGsapContext, revealBatch, revealFigures, revealSequence, shouldRunGsapReveal } from '../lib/gsap'
import { useAuthStore } from '../stores/auth'
import { clearAppointmentDraft, readAppointmentDraft, saveAppointmentDraft } from '../stores/appointmentDraft'
import { useLocale } from '../stores/locale'
import InlineStatus from '../components/InlineStatus.vue'
import FluidButton from '../components/FluidButton.vue'
import AppointmentContactFields from '../components/AppointmentContactFields.vue'
import PointerDotField from '../components/PointerDotField.vue'
import { isPublicSlotDate } from '../lib/publicSlotDate'
import { guideEnabled, useLuoshengStore } from '../stores/luoshengStore'

interface Slot { id: number; visitDate: string; startTime: string; endTime: string; remainingPeople: number }
interface CalendarDay { iso: string; day: string; weekday: string; available: boolean; full: boolean }
interface CreatedAppointment { appointmentNo: string }

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useLocale()
const guideStore = guideEnabled ? useLuoshengStore() : null
const slots = ref<Slot[]>([])
const selectedDate = ref('')
const loading = ref(true)
const loadError = ref('')
const slotChoicesReady = computed(() => !loading.value && !loadError.value)
const submitError = ref('')
const fieldErrors = reactive<Record<string, string>>({})
const message = ref('')
const bookingNo = ref('')
const submitting = ref(false)
const mobileSummaryOpen = ref(false)
const mobileSummarySnapPoint = ref<'medium' | 'full'>('full')
const mobileBookingTrigger = ref<InstanceType<typeof FluidButton> | null>(null)
const mobileDateQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 760px)')
  : undefined
const mobileDatePicker = ref(mobileDateQuery?.matches ?? false)
let draftOwnerId = auth.user?.id ?? null
const draft = readAppointmentDraft(draftOwnerId)
const form = reactive(draft.form)
const creationKey = ref<string | null>(draft.creationKey)
const formLocked = computed(() => submitting.value || Boolean(creationKey.value) || Boolean(message.value))

watch(() => auth.user?.id, (userId, previousId) => {
  if (previousId && userId !== previousId) {
    if (auth.sessionExpired) saveAppointmentDraft(form, creationKey.value, previousId)
    Object.assign(form, readAppointmentDraft(userId ?? null).form)
    creationKey.value = null
    selectedDate.value = ''
    message.value = ''
    bookingNo.value = ''
  }
  draftOwnerId = userId ?? null
})

let loadController: AbortController | undefined
const BottomSheet = defineAsyncComponent(() => import('../components/BottomSheet.vue'))
const root = ref<HTMLElement | null>(null)
let gsapContext: ReturnType<typeof createGsapContext>
let celebratedStep = 1

const bookingTitle = computed(() => locale.value === 'zh-CN' ? '预约参观' : 'Book your visit')
const bookingIntro = computed(() => locale.value === 'zh-CN' ? '选一个不赶时间的日子，留出两小时，到展厅里慢慢看。' : 'A moment with the stories of Heluo.')
const workbenchCopy = computed(() => locale.value === 'zh-CN' ? {
  eyebrow: 'MUSEUM PASS · 入馆预约',
  myBookings: '我的预约',
  dateTitle: '选择参观日期',
  window: '未来 14 天',
  closed: '未开放',
  timeTitle: '选择入馆时段',
  noDate: '尚未选择参观日期',
  noTimes: '当日暂无可预约时段',
  partyNote: '每次预约 1–30 人',
  passLabel: '河洛电子入馆凭证',
  summary: '本次参观',
  pending: '待选择',
  selected: '已选定',
  submitted: '已签发',
  concept: '场馆建筑概念图',
  visitInfo: '参观须知',
  reviewNote: '提交后由管理员确认，请留意预约邮箱。',
  cancelNote: '如需取消，请至少提前 2 小时在个人中心办理。',
  shortage: '当前时段余量不足，请减少人数或选择其他时段。',
} : {
  eyebrow: 'MUSEUM PASS · VISIT BOOKING',
  myBookings: 'My bookings',
  dateTitle: 'Choose your visit date',
  window: 'Next 14 days',
  closed: 'Closed',
  timeTitle: 'Choose an entry time',
  noDate: 'No visit date selected',
  noTimes: 'No entry times for this date',
  partyNote: '1–30 visitors per booking',
  passLabel: 'ELECTRONIC MUSEUM PASS',
  summary: 'Your visit',
  pending: 'Pending',
  selected: 'Selected',
  submitted: 'Issued',
  concept: 'Museum architectural concept',
  visitInfo: 'Before your visit',
  reviewNote: 'Bookings are reviewed by our team. Confirmation is sent to your booking email.',
  cancelNote: 'You can cancel from your account at least 2 hours before your visit starts.',
  shortage: 'This time has fewer places than your group needs. Reduce the group size or choose another time.',
})

const pageCopy = computed(() => locale.value === 'zh-CN' ? {
  progress: '预约进度',
  steps: ['选择日期', '选择时段', '填写信息', '确认预约'],
  mobileSteps: ['选择日期', '选择时段', '填写信息', '确认预约'],
  chooseDate: '选择日期',
  available: '可预约',
  unavailable: '暂无可预约时段',
  full: '已约满',
  retry: '重新加载',
  fill: '填写预约信息',
  museumAlt: '河洛数字博物馆建筑概念图',
  museum: '河洛数字博物馆',
  address: '河南省洛阳市洛龙区开元大道与学府街交叉口',
  duration: '建议时长 60–90 分钟',
  arrival: '提前 15 分钟到达',
  details: '预约信息',
  date: '参观日期',
  datePending: '请选择日期',
  time: '入馆时段',
  timePending: '请选择时段',
  visitors: '同行人数',
  peopleUnit: '人',
  decreaseVisitors: '减少参与人数',
  increaseVisitors: '增加参与人数',
  contactDetails: '联系人信息',
  confirm: '确认预约',
  privacy: '信息仅用于预约联系，我们将严格保护您的隐私安全。',
  success: '预约已提交，管理员确认后会向联系人邮箱发送通知。',
} : {
  progress: 'Booking progress',
  steps: ['Choose date', 'Choose time', 'Your details', 'Confirm'],
  mobileSteps: ['Date', 'Time', 'Details', 'Confirm'],
  chooseDate: 'Choose a date',
  available: 'Available',
  unavailable: 'No available times',
  full: 'Fully booked',
  retry: 'Retry',
  fill: 'Enter booking details',
  museumAlt: 'Concept view of Heluo Digital Museum',
  museum: 'Heluo Digital Museum',
  address: 'Kaiyuan Avenue & Xuefu Street, Luolong District, Luoyang',
  duration: 'Suggested visit: 60–90 minutes',
  arrival: 'Please arrive 15 minutes early',
  details: 'Booking details',
  date: 'Visit date',
  datePending: 'Select date',
  time: 'Entry time',
  timePending: 'Select time',
  visitors: 'Visitors',
  peopleUnit: 'people',
  decreaseVisitors: 'Decrease visitor count',
  increaseVisitors: 'Increase visitor count',
  contactDetails: 'Contact details',
  confirm: 'Confirm booking',
  privacy: 'Your details are used only to manage this booking and are kept private.',
  success: 'Your booking has been submitted. A confirmation will be sent to the contact email after review.',
})

const selectedSlot = computed(() => (slotChoicesReady.value || creationKey.value)
  ? slots.value.find((slot) => slot.id === form.slotId) : undefined)
const filteredSlots = computed(() => slots.value.filter((slot) => slot.visitDate === selectedDate.value))
const minimumVisitorCount = 1
const maximumVisitorCount = 30
const bookingStep = computed(() => {
  if (message.value) return 4
  if (!form.slotId) return 1
  if (mobileSummaryOpen.value || form.contactPhone || form.notes) return 3
  if (form.slotId) return 2
  return 1
})

const dateDays = computed<CalendarDay[]>(() => {
  const available = new Set(slots.value.filter((slot) => slot.remainingPeople > 0).map((slot) => slot.visitDate))
  const scheduled = new Set(slots.value.map((slot) => slot.visitDate))
  const now = new Date()
  const shanghaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const base = new Date(`${shanghaiDate}T00:00:00Z`)
  const weekdaysZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return Array.from({ length: 14 }, (_, index) => {
    const value = new Date(base)
    value.setUTCDate(base.getUTCDate() + index)
    const iso = value.toISOString().slice(0, 10)
    return {
      iso,
      day: String(value.getUTCDate()).padStart(2, '0'),
      weekday: locale.value === 'en-US' ? value.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : weekdaysZh[value.getUTCDay()],
      available: available.has(iso),
      full: scheduled.has(iso) && !available.has(iso),
    }
  })
})

function selectDate(date: string) {
  if (formLocked.value) return
  const first = slots.value.find((slot) => slot.visitDate === date && slot.remainingPeople > 0)
  if (!first) return
  selectedDate.value = date
  form.slotId = first.id
  fieldErrors.slotId = ''
  creationKey.value = null
  message.value = ''
  bookingNo.value = ''
}

function syncMobileDatePicker(event: MediaQueryListEvent) {
  mobileDatePicker.value = event.matches
  if (!event.matches) mobileSummaryOpen.value = false
}

async function closeMobileSummary() {
  mobileSummaryOpen.value = false
  await nextTick()
  mobileBookingTrigger.value?.$el?.focus({ preventScroll: true })
}

function selectSlot(slotId: number) {
  if (formLocked.value || !slotChoicesReady.value) return
  if (form.slotId !== slotId) creationKey.value = null
  form.slotId = slotId
  fieldErrors.slotId = ''
  message.value = ''
  bookingNo.value = ''
}

function clampVisitorCount(value: number) {
  if (!Number.isFinite(value)) return minimumVisitorCount
  return Math.min(maximumVisitorCount, Math.max(minimumVisitorCount, Math.trunc(value)))
}

function normalizeVisitorCount() {
  form.visitorCount = clampVisitorCount(form.visitorCount)
}

function adjustVisitorCount(amount: number) {
  if (formLocked.value) return
  form.visitorCount = clampVisitorCount(form.visitorCount + amount)
}

function bookingError(reason: unknown, type: 'load' | 'submit') {
  if (!(reason instanceof ApiRequestError)) return type === 'load' ? t.value.booking.loadError : t.value.booking.submitError
  if (reason.status === 401) return t.value.booking.loginRequired
  if (reason.status === 409) {
    if (reason.code === 'APPOINTMENT_OUTSIDE_OPEN_WINDOW') return locale.value === 'en-US' ? 'Bookings are open for the next 14 days only.' : '预约仅开放未来 14 天内的时段。'
    if (reason.code === 'DUPLICATE_ACTIVE_APPOINTMENT') return locale.value === 'en-US' ? 'You already have this time slot booked.' : '你已经预约过这个参观时段。'
    if (reason.message.includes('日期')) return t.value.booking.pastDate
    if (reason.message.includes('名额')) return t.value.booking.noCapacity
    if (reason.message.includes('时段')) return t.value.booking.slotUnavailable
    if (reason.message.includes('已预约')) return locale.value === 'en-US' ? 'You already have this time slot booked.' : '你已经预约过这个参观时段。'
  }
  if (reason.status === 422) return t.value.booking.invalidForm
  return type === 'load' ? t.value.booking.loadError : t.value.booking.submitError
}

async function load() {
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  loading.value = true
  loadError.value = ''
  try {
    const result = await apiGet<Slot[]>('/appointment-slots', undefined, { signal: controller.signal })
    if (controller.signal.aborted) return
    slots.value = result
    const selected = slots.value.find((slot) => slot.id === form.slotId)
    if (selected && (creationKey.value || selected.remainingPeople >= form.visitorCount)) selectedDate.value = selected.visitDate
    else if (creationKey.value) selectedDate.value = ''
    else {
      if (form.slotId) fieldErrors.slotId = locale.value === 'en-US' ? 'This time is no longer available. Choose another time.' : '原时段已不可用或名额不足，请重新选择。'
      selectedDate.value = selected?.visitDate ?? ''
      form.slotId = 0
    }
    const requestedDate = typeof route.query.date === 'string' ? route.query.date : ''
    if (!formLocked.value && !form.slotId && isPublicSlotDate(requestedDate)) {
      selectedDate.value = requestedDate
    }
  } catch (reason) {
    if (!controller.signal.aborted) loadError.value = bookingError(reason, 'load')
  } finally {
    if (loadController === controller) loading.value = false
  }
}

function previewRouteDate() {
  if (formLocked.value) return
  selectedDate.value = ''
  form.slotId = 0
  fieldErrors.slotId = ''
  mobileSummaryOpen.value = false
}

async function submit() {
  if (submitting.value || message.value || (!creationKey.value && !slotChoicesReady.value)) return
  normalizeVisitorCount()
  submitError.value = ''
  message.value = ''
  submitting.value = true
  await auth.initialize()
  if (!auth.loggedIn) {
    submitting.value = false
    saveAppointmentDraft(form, creationKey.value, draftOwnerId)
    if (auth.token && auth.initializationError) { submitError.value = auth.initializationError; return }
    await router.push({ path: '/login', query: { returnTo: '/appointment' } })
    return
  }
  fieldErrors.slotId = !creationKey.value && (!selectedSlot.value || selectedSlot.value.remainingPeople < form.visitorCount) ? (locale.value === 'en-US' ? 'Choose an available time.' : '请选择名额充足的参观时段。') : ''
  fieldErrors.contactName = !form.contactName.trim() ? (locale.value === 'en-US' ? 'Enter the contact name.' : '请填写联系人姓名。') : ''
  fieldErrors.contactPhone = !/^[+\d][\d\s()-]{5,19}$/.test(form.contactPhone) ? (locale.value === 'en-US' ? 'Enter a valid contact number.' : '请填写有效的联系电话。') : ''
  fieldErrors.contactEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail) ? (locale.value === 'en-US' ? 'Enter a valid email address.' : '请填写有效的邮箱地址。') : ''
  if (Object.values(fieldErrors).some(Boolean)) { submitting.value = false; return }
  try {
    const key = creationKey.value ?? crypto.randomUUID()
    creationKey.value = key
    const token = auth.token
    const payload = { ...form }
    const created = await apiRequest<CreatedAppointment>('/appointments', 'POST', payload, token, { 'Idempotency-Key': key })
    if (auth.token !== token) return
    Object.assign(form, payload)
    message.value = pageCopy.value.success
    bookingNo.value = created.appointmentNo
    creationKey.value = null
    clearAppointmentDraft()
  } catch (reason) {
    submitError.value = bookingError(reason, 'submit')
    if (reason instanceof ApiRequestError && reason.status >= 400 && reason.status < 500 && reason.status !== 408) {
      creationKey.value = null
      if (reason.status === 409) await load()
    } else {
      submitError.value = locale.value === 'en-US' ? 'The booking result is not confirmed. Retry to check the same booking before changing its details.' : '暂未确认预约结果。请重试核对本次预约，再修改预约信息。'
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  mobileDateQuery?.addEventListener('change', syncMobileDatePicker)
  setupEntrance()
  if (typeof route.query.date === 'string' && isPublicSlotDate(route.query.date)) previewRouteDate()
  await load()
  await auth.initialize()
  if (auth.user) { form.contactName ||= auth.user.nickname; form.contactEmail ||= auth.user.email }
})

const calendarRange = computed(() => {
  const dates = dateDays.value
  if (!dates.length) return ''
  const formatter = new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  return formatter.formatRange(new Date(`${dates[0]!.iso}T00:00:00Z`), new Date(`${dates[dates.length - 1]!.iso}T00:00:00Z`))
})
const insufficientCapacity = computed(() => Boolean(selectedSlot.value && selectedSlot.value.remainingPeople < form.visitorCount && !formLocked.value))

function bookingScope(selector: string): HTMLElement[] {
  const scope = root.value
  if (!scope) return []
  return [...scope.querySelectorAll<HTMLElement>(selector)]
}

function setupEntrance() {
  if (!shouldRunGsapReveal() || !root.value) return
  gsapContext?.revert()
  celebratedStep = bookingStep.value
  gsapContext = createGsapContext(root.value, () => {
    revealSequence('[data-motion="appointment-intro"] > *', { stagger: 0.06 })
    revealSequence('[data-motion="appointment-workbench"] > *', { stagger: 0.05, delay: 0.1 })
    revealSequence('[data-motion="appointment-aside"] > *', { stagger: 0.05, delay: 0.18 })
    revealBatch('[data-motion="appointment-day"]')
  })
}

async function revealTimes() {
  if (!shouldRunGsapReveal()) return
  await nextTick()
  const times = bookingScope('[data-motion="appointment-time"]')
  if (!times.length) return
  const { offset, duration } = revealFigures()
  gsap.fromTo(times, { autoAlpha: 0, y: offset }, {
    autoAlpha: 1, y: 0, duration, stagger: 0.035, ease: 'power3.out',
    overwrite: 'auto', clearProps: 'opacity,visibility,transform',
  })
}

async function celebrateStep(step: number) {
  if (step <= celebratedStep) return
  celebratedStep = step
  if (!shouldRunGsapReveal()) return
  await nextTick()
  const marker = bookingScope(`[data-motion="appointment-step"]:nth-child(${Math.min(step, 4)}) .appointment-progress__number`)
  if (!marker.length) return
  gsap.fromTo(marker, { scale: 0.78 }, { scale: 1, duration: 0.34, ease: 'power3.out', clearProps: 'transform' })
}

async function revealResult() {
  if (!shouldRunGsapReveal()) return
  await nextTick()
  const panel = bookingScope('.appointment-result')[0]
    ?? document.querySelector<HTMLElement>('.appointment-result')
  if (!panel) return
  gsap.fromTo(panel, { autoAlpha: 0, y: 12 }, {
    autoAlpha: 1, y: 0, duration: 0.36, ease: 'power3.out', clearProps: 'opacity,visibility,transform',
  })
}

async function pulseSelection() {
  if (!shouldRunGsapReveal()) return
  await nextTick()
  const current = bookingScope('[data-motion="appointment-summary-value"]')
  if (!current.length) return
  gsap.fromTo(current, { autoAlpha: 0.4 }, {
    autoAlpha: 1, duration: 0.28, stagger: 0.04, ease: 'power2.out', clearProps: 'opacity,visibility',
  })
}

watch(selectedDate, () => { void revealTimes() })
watch(() => route.query.date, () => {
  previewRouteDate()
  void load()
})
watch(bookingStep, (step) => { void celebrateStep(step) })
watch(message, (text) => { if (text) void revealResult() })
watch([() => form.slotId, () => form.visitorCount], () => { void pulseSelection() })

onBeforeUnmount(() => {
  mobileDateQuery?.removeEventListener('change', syncMobileDatePicker)
  loadController?.abort()
  gsapContext?.revert()
  if (!message.value && !auth.sessionExpired && (auth.user?.id ?? null) === draftOwnerId) saveAppointmentDraft(form, creationKey.value, draftOwnerId)
})
</script>

<template>
  <section ref="root" class="booking-page appointment-workbench" data-motion-page="appointment">
    <header class="appointment-heading" data-motion="appointment-intro">
      <PointerDotField variant="heading" />
      <div class="appointment-heading__copy">
        <p class="eyebrow">{{ workbenchCopy.eyebrow }}</p>
        <h1>{{ bookingTitle }}</h1>
        <p class="appointment-heading__intro">{{ bookingIntro }}</p>
      </div>
      <RouterLink class="appointment-account-link" to="/profile">
        <Tickets aria-hidden="true" />
        <span>{{ workbenchCopy.myBookings }}</span>
        <ArrowRight aria-hidden="true" />
      </RouterLink>
    </header>

    <div class="appointment-layout">
      <section class="appointment-main" data-motion="appointment-workbench">
        <!-- Minimal Horizontal Step Track -->
        <ol class="appointment-progress" :aria-label="pageCopy.progress">
          <li
            v-for="(label, index) in (mobileDatePicker ? pageCopy.mobileSteps : pageCopy.steps)"
            :key="index"
            data-motion="appointment-step"
            :class="{ active: bookingStep >= index + 1, current: bookingStep === index + 1 }"
            :aria-current="bookingStep === index + 1 ? 'step' : undefined"
          >
            <span class="appointment-progress__number font-mono">
              <Check v-if="bookingStep > index + 1" aria-hidden="true" />
              <template v-else>{{ index + 1 }}</template>
            </span>
            <span class="appointment-progress__label">{{ label }}</span>
          </li>
        </ol>

        <div v-if="message" class="appointment-result" data-motion="appointment-result" role="status">
          <CircleCheck aria-hidden="true" />
          <div>
            <h2>{{ workbenchCopy.submitted }}</h2>
            <p>{{ message }}</p>
            <p class="font-mono">{{ locale === 'en-US' ? 'Booking No.' : '预约编号' }}：{{ bookingNo }}</p>
            <RouterLink class="appointment-result__link" to="/profile">{{ locale === 'en-US' ? 'View my bookings' : '查看我的预约' }}<ArrowRight aria-hidden="true" /></RouterLink>
          </div>
        </div>

        <InlineStatus v-if="fieldErrors.slotId" id="booking-slot-error" kind="error" :message="fieldErrors.slotId" />
        <FluidButton v-if="creationKey" data-recover-booking block :disabled="submitting" :loading="submitting" @click="submit()">
          <Refresh aria-hidden="true" />{{ locale === 'en-US' ? 'Check booking result' : '核对预约结果' }}
        </FluidButton>
        <InlineStatus v-if="submitError && !mobileSummaryOpen" data-submit-error kind="error" :message="submitError" />

        <!-- Step 01: 14-day 2x7 Calendar Grid -->
        <section class="appointment-section" aria-labelledby="appointment-date-title" :aria-busy="loading">
          <header class="appointment-section__heading">
            <h2 id="appointment-date-title"><span class="font-mono">01</span>{{ workbenchCopy.dateTitle }}</h2>
            <span class="appointment-window">{{ workbenchCopy.window }}</span>
          </header>
          <div class="appointment-calendar-heading">
            <span><Calendar aria-hidden="true" />{{ calendarRange }}</span>
            <span class="appointment-legend"><i aria-hidden="true"></i>{{ pageCopy.available }}</span>
          </div>
          <div v-if="loading" class="appointment-calendar-loading" role="status" :aria-label="t.booking.loading">
            <span v-for="day in 14" :key="day"></span>
          </div>
          <div v-else-if="loadError" class="appointment-empty" role="alert">
            <InfoFilled aria-hidden="true" />
            <p>{{ loadError }}</p>
            <FluidButton variant="secondary" @click="load"><Refresh aria-hidden="true" />{{ pageCopy.retry }}</FluidButton>
          </div>
          <template v-else>
            <div class="appointment-dates" role="group" :aria-label="pageCopy.chooseDate">
              <button
                v-for="day in dateDays"
                :key="day.iso"
                class="appointment-day"
                data-motion="appointment-day"
                :class="{ active: selectedDate === day.iso, 'is-full': day.full, 'is-available': day.available }"
                :disabled="formLocked || !day.available"
                :aria-pressed="selectedDate === day.iso"
                :aria-label="`${pageCopy.chooseDate}: ${day.iso}, ${day.available ? pageCopy.available : day.full ? pageCopy.full : workbenchCopy.closed}`"
                :title="day.available ? `${pageCopy.chooseDate}: ${day.iso}` : `${day.iso}: ${day.full ? pageCopy.full : pageCopy.unavailable}`"
                type="button"
                @click="selectDate(day.iso)"
              >
                <span class="appointment-day__weekday">{{ day.weekday }}</span>
                <strong class="font-mono">{{ day.day }}</strong>
                <span class="appointment-day__status">{{ day.available ? pageCopy.available : day.full ? pageCopy.full : workbenchCopy.closed }}</span>
                <Check v-if="selectedDate === day.iso" class="appointment-day__check" aria-hidden="true" />
              </button>
            </div>
            <p v-if="!slots.length" class="appointment-inline-note">{{ t.booking.empty }}</p>
          </template>
        </section>

        <!-- Step 02: Time Slot Cards -->
        <section class="appointment-section appointment-time-section" aria-labelledby="appointment-time-title">
          <header class="appointment-section__heading">
            <h2 id="appointment-time-title"><span class="font-mono">02</span>{{ workbenchCopy.timeTitle }}</h2>
            <span v-if="selectedDate" class="appointment-selected-date font-mono">{{ selectedDate }}</span>
          </header>
          <div v-if="slotChoicesReady && selectedDate && filteredSlots.length" class="appointment-times" role="group" :aria-label="workbenchCopy.timeTitle">
            <button
              v-for="slot in filteredSlots"
              :key="slot.id"
              class="appointment-time"
              data-motion="appointment-time"
              :class="{ active: form.slotId === slot.id }"
              type="button"
              :disabled="formLocked || slot.remainingPeople <= 0"
              :aria-pressed="form.slotId === slot.id"
              :aria-label="`${slot.startTime.slice(0,5)} – ${slot.endTime.slice(0,5)}, ${slot.remainingPeople > 0 ? `${t.booking.remaining} ${slot.remainingPeople} ${t.booking.people}` : pageCopy.full}`"
              @click="selectSlot(slot.id)"
            >
              <span class="appointment-time__radio" aria-hidden="true"><Check v-if="form.slotId === slot.id" /></span>
              <span class="appointment-time__info">
                <strong class="font-mono">{{ slot.startTime.slice(0,5) }} – {{ slot.endTime.slice(0,5) }}</strong>
                <small>{{ slot.remainingPeople > 0 ? `${t.booking.remaining} ${slot.remainingPeople} ${t.booking.people}` : pageCopy.full }}</small>
                <span class="appointment-time__bar" aria-hidden="true"><i :style="{ width: `${Math.min(100, Math.max(8, Math.round((slot.remainingPeople / 30) * 100)))}%` }"></i></span>
              </span>
            </button>
          </div>
          <div v-else-if="slotChoicesReady" class="appointment-time-empty">
            <Clock aria-hidden="true" />
            <span>{{ selectedDate ? workbenchCopy.noTimes : workbenchCopy.noDate }}</span>
          </div>
          <div v-if="guideStore" class="appointment-guide-actions">
            <FluidButton variant="secondary" size="sm" @click="guideStore.openGuide($event.currentTarget as HTMLElement, locale === 'en-US' ? 'Which appointment slots are open in the next 3 days?' : '最近三天还有哪些可预约时段？')">
              {{ locale === 'en-US' ? 'Ask Luosheng about open slots' : '问洛笙查可约时段' }}
            </FluidButton>
          </div>
        </section>

        <!-- Step 03: Contact Details -->
        <form v-if="!mobileDatePicker" class="appointment-details" @submit.prevent="submit">
          <section class="appointment-section" aria-labelledby="appointment-contact-title">
            <header class="appointment-section__heading">
              <h2 id="appointment-contact-title"><span class="font-mono">03</span>{{ pageCopy.contactDetails }}</h2>
            </header>
            <div class="appointment-party">
              <div>
                <label for="appointment-visitors">{{ pageCopy.visitors }}</label>
                <p>{{ workbenchCopy.partyNote }}</p>
              </div>
              <div class="appointment-quantity">
                <button type="button" :aria-label="pageCopy.decreaseVisitors" :disabled="formLocked || form.visitorCount <= minimumVisitorCount" @click="adjustVisitorCount(-1)"><Minus aria-hidden="true" /></button>
                <input id="appointment-visitors" class="visitor-stepper__input font-mono" v-model.number="form.visitorCount" :disabled="formLocked" type="number" :min="minimumVisitorCount" :max="maximumVisitorCount" :aria-label="pageCopy.visitors" required @blur="normalizeVisitorCount" />
                <button type="button" :aria-label="pageCopy.increaseVisitors" :disabled="formLocked || form.visitorCount >= maximumVisitorCount" @click="adjustVisitorCount(1)"><Plus aria-hidden="true" /></button>
              </div>
            </div>
            <p v-if="insufficientCapacity" class="appointment-field-error" role="status">{{ workbenchCopy.shortage }}</p>
            <AppointmentContactFields v-model:contact-name="form.contactName" v-model:contact-phone="form.contactPhone" v-model:contact-email="form.contactEmail" v-model:notes="form.notes" :locked="formLocked" :errors="fieldErrors" />
          </section>
          <div class="appointment-submit">
            <p><InfoFilled aria-hidden="true" /><span>{{ workbenchCopy.reviewNote }}</span></p>
            <FluidButton type="submit" size="lg" :disabled="!form.slotId || (!slotChoicesReady && !creationKey) || submitting || Boolean(message)" :loading="submitting">
              {{ pageCopy.confirm }}<ArrowRight aria-hidden="true" />
            </FluidButton>
          </div>
          <p class="appointment-privacy">{{ pageCopy.privacy }}</p>
        </form>

        <div v-else class="appointment-mobile-action">
          <p v-if="selectedSlot" class="font-mono">{{ selectedSlot.visitDate }} · {{ selectedSlot.startTime.slice(0,5) }} – {{ selectedSlot.endTime.slice(0,5) }}</p>
          <FluidButton ref="mobileBookingTrigger" block size="lg" :disabled="!slotChoicesReady || !selectedSlot || Boolean(message)" @click="mobileSummarySnapPoint = 'full'; mobileSummaryOpen = true">
            {{ pageCopy.fill }}<ArrowRight aria-hidden="true" />
          </FluidButton>
        </div>
      </section>

      <!-- Right Highlight: Real-Time Electronic Museum Pass with Ticket Perforation -->
      <aside class="appointment-aside" data-motion="appointment-aside" :aria-label="workbenchCopy.summary">
        <div class="museum-pass" :class="{ 'is-issued': Boolean(message), 'is-selected': Boolean(selectedSlot) }">
          <figure class="appointment-venue">
            <img
              src="/media/editorial/museum-exterior-watercolor.webp"
              srcset="/media/editorial/museum-exterior-watercolor-480w-v1.webp 480w, /media/editorial/museum-exterior-watercolor-960w-v1.webp 960w, /media/editorial/museum-exterior-watercolor-1280w-v1.webp 1280w, /media/editorial/museum-exterior-watercolor.webp 1896w"
              sizes="(max-width: 760px) calc(100vw - 2rem), 360px"
              :alt="pageCopy.museumAlt"
              width="1896"
              height="830"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            <figcaption>{{ workbenchCopy.concept }}</figcaption>
          </figure>

          <div class="appointment-venue-info">
            <span class="museum-pass__kicker">{{ workbenchCopy.passLabel }}</span>
            <h2>{{ pageCopy.museum }}</h2>
            <p><Location aria-hidden="true" /><span>{{ pageCopy.address }}</span></p>
            <div class="museum-pass__meta-row">
              <span><Timer aria-hidden="true" />{{ pageCopy.duration }}</span>
              <span><Clock aria-hidden="true" />{{ pageCopy.arrival }}</span>
            </div>
          </div>

          <!-- Semicircle Cutout + Dashed Ticket Perforation -->
          <div class="pass-perforation" aria-hidden="true">
            <span class="pass-perforation__notch pass-perforation__notch--left"></span>
            <span class="pass-perforation__line"></span>
            <span class="pass-perforation__notch pass-perforation__notch--right"></span>
          </div>

          <!-- Live Ticket Stub -->
          <section class="appointment-summary" :class="{ 'has-selection': selectedSlot }" aria-labelledby="appointment-summary-title">
            <header class="pass-stub__header">
              <h2 id="appointment-summary-title">{{ workbenchCopy.summary }}</h2>
              <span
                class="pass-seal"
                :class="{ 'is-issued': Boolean(message), 'is-selected': Boolean(selectedSlot) && !message }"
              >
                {{ message ? workbenchCopy.submitted : selectedSlot ? workbenchCopy.selected : workbenchCopy.pending }}
              </span>
            </header>

            <dl class="pass-stub__grid">
              <div>
                <dt><Calendar aria-hidden="true" />{{ pageCopy.date }}</dt>
                <dd class="font-mono" data-motion="appointment-summary-value">{{ selectedSlot?.visitDate || pageCopy.datePending }}</dd>
              </div>
              <div>
                <dt><Clock aria-hidden="true" />{{ pageCopy.time }}</dt>
                <dd class="font-mono" data-motion="appointment-summary-value">{{ selectedSlot ? `${selectedSlot.startTime.slice(0,5)} – ${selectedSlot.endTime.slice(0,5)}` : pageCopy.timePending }}</dd>
              </div>
              <div>
                <dt><User aria-hidden="true" />{{ pageCopy.visitors }}</dt>
                <dd class="font-mono" data-motion="appointment-summary-value">{{ form.visitorCount }} {{ pageCopy.peopleUnit }}</dd>
              </div>
            </dl>

            <div v-if="bookingNo" class="pass-stub__code">
              <span>{{ locale === 'en-US' ? 'PASS NO.' : '凭证编号' }}</span>
              <strong class="font-mono">{{ bookingNo }}</strong>
            </div>
          </section>
        </div>

        <section class="appointment-notice" aria-labelledby="appointment-notice-title">
          <h2 id="appointment-notice-title">{{ workbenchCopy.visitInfo }}</h2>
          <p>{{ workbenchCopy.reviewNote }}</p>
          <p>{{ workbenchCopy.cancelNote }}</p>
        </section>
      </aside>
    </div>

    <BottomSheet v-if="mobileSummaryOpen" :open="mobileSummaryOpen" :title="pageCopy.details" panel-class="appointment-bottom-sheet appointment-refined-sheet" :snap-point="mobileSummarySnapPoint" @close="closeMobileSummary" @update:snap-point="mobileSummarySnapPoint = $event">
      <div v-if="message" class="appointment-result" data-motion="appointment-result" role="status">
        <CircleCheck aria-hidden="true" />
        <div>
          <h2>{{ workbenchCopy.submitted }}</h2>
          <p>{{ message }}</p>
          <p class="font-mono">{{ bookingNo }}</p>
          <RouterLink to="/profile">{{ locale === 'en-US' ? 'View my bookings' : '查看我的预约' }}<ArrowRight aria-hidden="true" /></RouterLink>
        </div>
      </div>
      <InlineStatus v-if="submitError" data-submit-error kind="error" :message="submitError" />
      <form class="appointment-details" @submit.prevent="submit">
        <p v-if="selectedSlot" class="appointment-sheet-date font-mono"><Calendar aria-hidden="true" />{{ selectedSlot.visitDate }} · {{ selectedSlot.startTime.slice(0,5) }} – {{ selectedSlot.endTime.slice(0,5) }}</p>
        <div class="appointment-party">
          <div><label for="appointment-mobile-visitors">{{ pageCopy.visitors }}</label><p>{{ workbenchCopy.partyNote }}</p></div>
          <div class="appointment-quantity">
            <button type="button" :aria-label="pageCopy.decreaseVisitors" :disabled="formLocked || form.visitorCount <= minimumVisitorCount" @click="adjustVisitorCount(-1)"><Minus aria-hidden="true" /></button>
            <input id="appointment-mobile-visitors" class="visitor-stepper__input font-mono" v-model.number="form.visitorCount" :disabled="formLocked" type="number" :min="minimumVisitorCount" :max="maximumVisitorCount" :aria-label="pageCopy.visitors" required @blur="normalizeVisitorCount" />
            <button type="button" :aria-label="pageCopy.increaseVisitors" :disabled="formLocked || form.visitorCount >= maximumVisitorCount" @click="adjustVisitorCount(1)"><Plus aria-hidden="true" /></button>
          </div>
        </div>
        <p v-if="insufficientCapacity" class="appointment-field-error" role="status">{{ workbenchCopy.shortage }}</p>
        <AppointmentContactFields v-model:contact-name="form.contactName" v-model:contact-phone="form.contactPhone" v-model:contact-email="form.contactEmail" v-model:notes="form.notes" :locked="formLocked" :errors="fieldErrors" />
        <p class="appointment-inline-note">{{ workbenchCopy.reviewNote }}</p>
        <FluidButton type="submit" block size="lg" :disabled="!form.slotId || (!slotChoicesReady && !creationKey) || submitting || Boolean(message)" :loading="submitting">{{ pageCopy.confirm }}<ArrowRight aria-hidden="true" /></FluidButton>
        <p class="appointment-privacy">{{ pageCopy.privacy }}</p>
      </form>
    </BottomSheet>
  </section>
</template>

<style scoped>
.appointment-workbench {
  width: min(calc(100% - 4rem), var(--container-max));
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(4rem, 7vw, 6rem);
  color: var(--ink-secondary);
}

.appointment-workbench svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ── Header ── */
.appointment-heading {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  padding-bottom: var(--space-6);
  margin-bottom: var(--space-8);
  border-bottom: 1px solid var(--border-hairline);
}

.appointment-heading__copy {
  position: relative;
  z-index: 1;
}

.appointment-heading h1 {
  margin: var(--space-2) 0 var(--space-2);
  font-size: clamp(2rem, 3.2vw, 2.75rem);
  line-height: 1.18;
}

.appointment-heading__intro {
  font-size: var(--text-md);
  color: var(--ink-muted);
}

.appointment-account-link {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--control-min);
  padding: 0 1rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: border-color var(--duration-fast) var(--ease-curatorial);
}

.appointment-account-link:hover {
  border-color: var(--accent-jade);
}

/* ── Two-Column Layout (1fr Steps + 380px Museum Pass) ── */
.appointment-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  align-items: start;
  gap: clamp(2rem, 4vw, 3.5rem);
}

.appointment-main {
  display: grid;
  gap: var(--space-8);
  min-width: 0;
}

/* ── Minimal Horizontal Step Track ── */
.appointment-progress {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}

.appointment-progress li {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding-bottom: var(--space-3);
  border-bottom: 2px solid var(--border-hairline);
  font-size: var(--text-xs);
  color: var(--ink-muted);
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              color var(--duration-ui) var(--ease-curatorial);
}

.appointment-progress li.active {
  border-bottom-color: var(--accent-bronze);
  color: var(--ink-primary);
}

.appointment-progress li.current {
  border-bottom-color: var(--accent-jade);
  font-weight: 600;
}

.appointment-progress__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  font-size: var(--text-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.appointment-progress li.active .appointment-progress__number {
  border-color: var(--accent-jade);
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
}

/* ── Booking Sections ── */
.appointment-section {
  display: grid;
  gap: var(--space-4);
}

.appointment-section__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.appointment-section__heading h2 {
  display: inline-flex;
  align-items: baseline;
  gap: 0.625rem;
  font-size: var(--text-xl);
}

.appointment-section__heading h2 span {
  font-size: var(--text-sm);
  color: var(--accent-bronze);
}

.appointment-window,
.appointment-selected-date {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.appointment-calendar-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.appointment-calendar-heading > span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.appointment-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-jade);
}

/* 14-day 2x7 Calendar Grid */
.appointment-dates,
.appointment-calendar-loading {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-2);
}

.appointment-calendar-loading span {
  height: 84px;
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
}

.appointment-day {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 3px;
  min-height: 84px;
  padding: var(--space-2);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--ink-muted);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial);
}

.appointment-day.is-available {
  border-color: var(--border-strong);
  background: var(--surface-elevated);
  color: var(--ink-primary);
}

.appointment-day.is-available:hover:not(:disabled) {
  border-color: var(--accent-jade);
}

.appointment-day.active {
  border-color: var(--accent-jade);
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
}

.appointment-day:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.appointment-day__weekday {
  font-size: var(--text-xs);
}

.appointment-day strong {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.2;
}

.appointment-day__status {
  font-size: var(--text-xs);
}

.appointment-day__check {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 13px;
  height: 13px;
}

/* Time Slots */
.appointment-times {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.appointment-time {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-height: 76px;
  padding: var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              background-color var(--duration-ui) var(--ease-curatorial);
}

.appointment-time:hover:not(:disabled) {
  border-color: var(--accent-jade);
}

.appointment-time.active {
  border-color: var(--accent-jade);
  background: color-mix(in oklch, var(--accent-jade) 7%, var(--surface-elevated));
}

.appointment-time:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.appointment-time__radio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  flex-shrink: 0;
}

.appointment-time.active .appointment-time__radio {
  border-color: var(--accent-jade);
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
}

.appointment-time__info {
  display: grid;
  gap: 0.25rem;
  flex: 1 1 auto;
}

.appointment-time__info strong {
  font-size: var(--text-md);
}

.appointment-time__info small {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.appointment-time__bar {
  display: block;
  width: 100%;
  height: 3px;
  margin-top: 2px;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  overflow: hidden;
}

.appointment-time__bar i {
  display: block;
  height: 100%;
  background: var(--accent-bronze);
}

.appointment-time-empty,
.appointment-empty {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--ink-muted);
  font-size: var(--text-sm);
}

.appointment-guide-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* Visitor Count Stepper & Contact Form */
.appointment-details {
  display: grid;
  gap: var(--space-5);
}

.appointment-party {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
}

.appointment-party label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-primary);
}

.appointment-party p {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.appointment-quantity {
  display: inline-grid;
  grid-template-columns: 44px 60px 44px;
  align-items: center;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-canvas);
  overflow: hidden;
}

.appointment-quantity button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--ink-primary);
  cursor: pointer;
}

.appointment-quantity button:hover:not(:disabled) {
  background: var(--surface-subtle);
}

.visitor-stepper__input {
  width: 60px;
  min-height: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: center;
  font-weight: 600;
}

.appointment-field-error {
  font-size: var(--text-xs);
  color: var(--status-negative);
}

.appointment-submit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-hairline);
}

.appointment-submit p {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.appointment-privacy,
.appointment-inline-note {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.appointment-result {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid color-mix(in oklch, var(--status-positive) 35%, transparent);
  border-radius: var(--radius-md);
  background: var(--status-positive-bg);
  color: var(--ink-primary);
}

.appointment-result > svg {
  width: 24px;
  height: 24px;
  color: var(--status-positive);
}

.appointment-result h2 {
  font-size: var(--text-lg);
  margin-bottom: 0.25rem;
}

.appointment-result p {
  font-size: var(--text-sm);
  margin-bottom: 0.25rem;
}

.appointment-result__link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: var(--space-2);
  color: var(--accent-jade);
  font-size: var(--text-sm);
  font-weight: 600;
}

/* ── Right Highlight: Real-Time Electronic Museum Pass ── */
.appointment-aside {
  position: sticky;
  top: calc(var(--header-height) + var(--space-5));
  display: grid;
  gap: var(--space-5);
}

.museum-pass {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: border-color var(--duration-ui) var(--ease-curatorial);
}

.museum-pass.is-selected {
  border-color: var(--accent-bronze);
}

.museum-pass.is-issued {
  border-color: var(--accent-seal);
}

.appointment-venue {
  position: relative;
  margin: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--surface-plinth);
}

.appointment-venue img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.appointment-venue figcaption {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-2);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs);
  background: oklch(12% 0.01 165 / 0.72);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
}

.appointment-venue-info {
  display: grid;
  gap: 0.45rem;
  padding: var(--space-5) var(--space-5) var(--space-4);
}

.museum-pass__kicker {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--accent-bronze);
}

.appointment-venue-info h2 {
  font-size: var(--text-xl);
}

.appointment-venue-info p {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: var(--text-xs);
  line-height: 1.55;
  color: var(--ink-muted);
}

.museum-pass__meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--ink-secondary);
}

.museum-pass__meta-row span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

/* Ticket Perforation with Semicircular Cutouts */
.pass-perforation {
  position: relative;
  display: flex;
  align-items: center;
  height: 22px;
}

.pass-perforation__notch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface-canvas);
  border: 1px solid var(--border-strong);
  flex-shrink: 0;
}

.pass-perforation__notch--left {
  margin-left: -12px;
}

.pass-perforation__notch--right {
  margin-right: -12px;
}

.pass-perforation__line {
  flex: 1 1 auto;
  height: 1px;
  margin-inline: 6px;
  border-top: 1px dashed var(--border-strong);
}

/* Live Ticket Stub */
.appointment-summary {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.pass-stub__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.pass-stub__header h2 {
  font-size: var(--text-md);
}

.pass-seal {
  padding: 0.2rem 0.65rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}

.pass-seal.is-selected {
  border-color: var(--accent-bronze);
  background: var(--accent-bronze-soft);
  color: var(--accent-bronze);
}

.pass-seal.is-issued {
  border-color: var(--accent-seal);
  background: var(--status-negative-bg);
  color: var(--accent-seal);
}

.pass-stub__grid {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.pass-stub__grid > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-hairline);
}

.pass-stub__grid > div:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.pass-stub__grid dt {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.pass-stub__grid dd {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-primary);
}

.pass-stub__code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.pass-stub__code strong {
  font-size: var(--text-sm);
  color: var(--ink-primary);
  letter-spacing: 0.08em;
}

.appointment-notice {
  display: grid;
  gap: 0.4rem;
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
}

.appointment-notice h2 {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--accent-bronze);
}

.appointment-notice p {
  font-size: var(--text-xs);
  line-height: 1.65;
  color: var(--ink-muted);
}

.appointment-mobile-action {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-hairline);
}

.appointment-sheet-date {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-primary);
}

/* ── Responsive ── */
@media (max-width: 1040px) {
  .appointment-layout {
    grid-template-columns: 1fr;
  }

  .appointment-aside {
    position: static;
  }
}

@media (max-width: 760px) {
  .appointment-workbench {
    width: calc(100% - 2rem);
    padding-top: var(--space-6);
  }

  .appointment-dates,
  .appointment-calendar-loading {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .appointment-times {
    grid-template-columns: 1fr;
  }

  .appointment-progress {
    gap: var(--space-2);
  }

  .appointment-progress li {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }
}
</style>
