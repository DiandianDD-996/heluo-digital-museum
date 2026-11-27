<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Calendar, Check, CircleCheck, Clock, InfoFilled, Location, Minus, Plus, Refresh, Tickets, Timer, User } from '@element-plus/icons-vue'
import { ApiRequestError, apiGet, apiRequest } from '../lib/api'
import { readPrefetchCache, writePrefetchCache } from '../lib/prefetch'
import { gsap } from 'gsap'
import { createGsapContext, revealBatch, revealFigures, revealSequence, shouldRunGsapReveal } from '../lib/gsap'
import { useAuthStore } from '../stores/auth'
import { clearAppointmentDraft, readAppointmentDraft, saveAppointmentDraft } from '../stores/appointmentDraft'
import { useLocale } from '../stores/locale'
import { useTheme } from '../stores/theme'
import InlineStatus from '../components/InlineStatus.vue'
import FluidButton from '../components/FluidButton.vue'
import AppointmentContactFields from '../components/AppointmentContactFields.vue'
import MuseumPassCard from '../components/MuseumPassCard.vue'
import PointerDotField from '../components/PointerDotField.vue'
import { isPublicSlotDate, shanghaiDay } from '../lib/publicSlotDate'
import { guideEnabled, useLuoshengStore } from '../stores/luoshengStore'

interface Slot { id: number; visitDate: string; startTime: string; endTime: string; remainingPeople: number }
interface CalendarDay {
  iso: string
  day: string
  weekday: string
  inWindow: boolean
  isPast: boolean
  isToday: boolean
  available: boolean
  full: boolean
  isMonday: boolean
  remainingTotal: number
  capacityRatio: number
}
interface CalendarMonthOption {
  value: string
  label: string
}
interface CreatedAppointment { appointmentNo: string; verificationCode?: string }

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useLocale()
const { isDark } = useTheme()
const guideStore = guideEnabled ? useLuoshengStore() : null
const venueMedia = computed(() => (
  isDark.value
    ? {
      src: '/media/editorial/login-pavilion-dark-v3.webp',
      srcset: '/media/responsive/login-pavilion-dark-v3-640w.webp 640w, /media/editorial/login-pavilion-dark-v3.webp 896w, /media/responsive/login-pavilion-dark-v3-960w.webp 960w',
      plateLabel: 'NOCTURNE PAVILION · 河洛夜景',
    }
    : {
      src: '/media/editorial/login-pavilion-light-v3.webp',
      srcset: '/media/responsive/login-pavilion-light-v3-640w.webp 640w, /media/editorial/login-pavilion-light-v3.webp 896w, /media/responsive/login-pavilion-light-v3-960w.webp 960w',
      plateLabel: 'DAYLIGHT PAVILION · 河洛实景',
    }
))
const slots = ref<Slot[]>([])
const selectedDate = ref('')
const loading = ref(true)
const loadError = ref('')
const slotChoicesReady = computed(() => !loading.value && !loadError.value)
const submitError = ref('')
const fieldErrors = reactive<Record<string, string>>({})
const message = ref('')
const bookingNo = ref('')
const bookingVerifyCode = ref('')
const passModalOpen = ref(false)
const passDialog = ref<HTMLDialogElement | null>(null)
const passCloseButton = ref<HTMLButtonElement | null>(null)
const passReopenButton = ref<HTMLButtonElement | null>(null)
let passReturnFocus: HTMLElement | null = null
const stampingSeal = ref(false)
const submitting = ref(false)
let stampRevealTimer: ReturnType<typeof setTimeout> | undefined
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
  window: '可查询未来 365 天',
  emptyWindow: '目前没有可预约的时段，请稍后再查。',
  emptyMonth: '本月没有可预约的时段。',
  nearestDate: '查看最近可约日期',
  closed: '未开放',
  mondayClosed: '周一闭馆',
  pastDay: '已过',
  prevMonth: '上月',
  nextMonth: '下月',
  backToTodayMonth: '回本月',
  monthSelectAria: '选择预约月份',
  monthOpenSummary: '本月可约',
  timeTitle: '选择入馆时段',
  noDate: '尚未选择参观日期',
  noTimes: '当日暂无可预约时段',
  partyNote: '每次预约 1–30 人',
  passLabel: '河洛电子入馆凭证 · 宣纸活字副券母版',
  summary: '本次参观副券',
  pending: '待钤印',
  selected: '待钤印',
  submitted: '已钤印签发',
  unstampedSeal: '待钤\n朱印',
  stampedSeal: '河洛\n验讫',
  contactSlot: '预约人',
  contactPending: '待排入铅字',
  concept: '场馆建筑实景图',
  visitInfo: '参观须知',
  reviewNote: '提交后由管理员确认，请留意预约邮箱。',
  cancelNote: '如需取消，请至少提前 2 小时在个人中心办理。',
  shortage: '当前时段余量不足，请减少人数或选择其他时段。',
} : {
  eyebrow: 'MUSEUM PASS · VISIT BOOKING',
  myBookings: 'My bookings',
  dateTitle: 'Choose your visit date',
  window: 'Check the next 365 days',
  emptyWindow: 'No visit times are available right now. Check again later.',
  emptyMonth: 'No visit times are available this month.',
  nearestDate: 'Go to the next available date',
  closed: 'Closed',
  mondayClosed: 'Closed Mon',
  pastDay: 'Past',
  prevMonth: 'Prev',
  nextMonth: 'Next',
  backToTodayMonth: 'This month',
  monthSelectAria: 'Choose booking month',
  monthOpenSummary: 'Open this month',
  timeTitle: 'Choose an entry time',
  noDate: 'No visit date selected',
  noTimes: 'No entry times for this date',
  partyNote: '1–30 visitors per booking',
  passLabel: 'ELECTRONIC MUSEUM PASS · LIVE TYPESET MASTER',
  summary: 'Typeset pass stub',
  pending: 'Unstamped',
  selected: 'Ready to stamp',
  submitted: 'Stamped & Issued',
  unstampedSeal: 'DRAFT\nSEAL',
  stampedSeal: 'HELUO\nSTAMP',
  contactSlot: 'Visitor',
  contactPending: 'Awaiting name',
  concept: 'Heluo Pavilion Architecture',
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

const todayIso = computed(() => shanghaiDay(0))
const windowEndIso = computed(() => shanghaiDay(364))
const todayMonth = computed(() => todayIso.value.slice(0, 7))
const activeMonth = ref(todayMonth.value)

const availableMonths = computed<CalendarMonthOption[]>(() => {
  const start = todayMonth.value
  const end = windowEndIso.value.slice(0, 7)
  const [startYear, startMon] = start.split('-').map(Number)
  const [endYear, endMon] = end.split('-').map(Number)
  const result: CalendarMonthOption[] = []
  let y = startYear!
  let m = startMon!
  while (y < endYear! || (y === endYear! && m <= endMon!)) {
    const value = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
    const label = locale.value === 'en-US'
      ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))
      : `${y} 年 ${m} 月`
    result.push({ value, label })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return result
})

const activeMonthIndex = computed(() => availableMonths.value.findIndex((item) => item.value === activeMonth.value))
const canPrevMonth = computed(() => activeMonthIndex.value > 0)
const canNextMonth = computed(() => activeMonthIndex.value >= 0 && activeMonthIndex.value < availableMonths.value.length - 1)
const activeMonthLabel = computed(() => availableMonths.value[activeMonthIndex.value]?.label ?? activeMonth.value)

function stepMonth(delta: number) {
  const nextIndex = activeMonthIndex.value + delta
  const target = availableMonths.value[nextIndex]
  if (target) activeMonth.value = target.value
}

function jumpToTodayMonth() {
  activeMonth.value = todayMonth.value
}

watch(selectedDate, (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return
  const ym = iso.slice(0, 7)
  if (availableMonths.value.some((item) => item.value === ym)) {
    activeMonth.value = ym
  }
})

const weekdayHeaders = computed(() => locale.value === 'en-US'
  ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  : ['一', '二', '三', '四', '五', '六', '日'])

const monthLeadingEmpty = computed(() => {
  const [y, m] = activeMonth.value.split('-').map(Number)
  if (!y || !m) return 0
  const firstUtcDay = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  return (firstUtcDay + 6) % 7
})

const dateDays = computed<CalendarDay[]>(() => {
  const remainingByDate = new Map<string, number>()
  const scheduled = new Set<string>()
  for (const slot of slots.value) {
    scheduled.add(slot.visitDate)
    remainingByDate.set(slot.visitDate, (remainingByDate.get(slot.visitDate) ?? 0) + Math.max(0, slot.remainingPeople))
  }
  const [y, m] = activeMonth.value.split('-').map(Number)
  if (!y || !m) return []
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const today = todayIso.value
  const windowEnd = windowEndIso.value
  const weekdaysZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  return Array.from({ length: daysInMonth }, (_, index) => {
    const value = new Date(Date.UTC(y, m - 1, index + 1))
    const iso = value.toISOString().slice(0, 10)
    const isPast = iso < today
    const inWindow = iso >= today && iso <= windowEnd
    const remainingTotal = inWindow ? (remainingByDate.get(iso) ?? 0) : 0
    const isAvailable = inWindow && remainingTotal > 0
    return {
      iso,
      day: String(value.getUTCDate()).padStart(2, '0'),
      weekday: locale.value === 'en-US' ? value.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : weekdaysZh[value.getUTCDay()]!,
      inWindow,
      isPast,
      isToday: iso === today,
      available: isAvailable,
      full: inWindow && scheduled.has(iso) && !isAvailable,
      isMonday: value.getUTCDay() === 1,
      remainingTotal,
      capacityRatio: Math.min(1, remainingTotal / 120),
    }
  })
})

const activeMonthOpenCount = computed(() => dateDays.value.filter((day) => day.available).length)
const nearestAvailableDate = computed(() => slots.value.reduce((nearest, slot) =>
  slot.remainingPeople > 0 && isPublicSlotDate(slot.visitDate) && (!nearest || slot.visitDate < nearest)
    ? slot.visitDate : nearest, ''))

async function showNearestDate() {
  const date = nearestAvailableDate.value
  if (!date) return
  activeMonth.value = date.slice(0, 7)
  await nextTick()
  root.value?.querySelector<HTMLElement>(`[data-visit-date="${date}"]`)?.focus()
}

function calendarDayStatus(day: CalendarDay) {
  if (day.isPast) return workbenchCopy.value.pastDay
  if (day.available) return pageCopy.value.available
  if (day.full) return pageCopy.value.full
  if (day.isMonday) return workbenchCopy.value.mondayClosed
  return workbenchCopy.value.closed
}

function calendarDayTitle(day: CalendarDay) {
  if (day.available) return `${pageCopy.value.chooseDate}: ${day.iso}`
  if (day.full) return `${day.iso}: ${pageCopy.value.full}`
  if (day.isMonday) return `${day.iso}: ${workbenchCopy.value.mondayClosed}`
  return `${day.iso}: ${pageCopy.value.unavailable}`
}

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
    if (reason.code === 'APPOINTMENT_OUTSIDE_OPEN_WINDOW') return locale.value === 'en-US' ? 'Bookings are open for the next 365 days only.' : '预约仅开放未来 365 天内的时段。'
    if (reason.code === 'DUPLICATE_ACTIVE_APPOINTMENT') return locale.value === 'en-US' ? 'You already have this time slot booked.' : '你已经预约过这个参观时段。'
    if (reason.message.includes('日期')) return t.value.booking.pastDate
    if (reason.message.includes('名额')) return t.value.booking.noCapacity
    if (reason.message.includes('时段')) return t.value.booking.slotUnavailable
    if (reason.message.includes('已预约')) return locale.value === 'en-US' ? 'You already have this time slot booked.' : '你已经预约过这个参观时段。'
  }
  if (reason.status === 422) return t.value.booking.invalidForm
  return type === 'load' ? t.value.booking.loadError : t.value.booking.submitError
}

function applyLoadedSlots(result: Slot[]) {
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
  const requestedPeople = typeof route.query.people === 'string' ? Number(route.query.people) : NaN
  if (!formLocked.value && Number.isInteger(requestedPeople) && requestedPeople >= 1 && requestedPeople <= 30) {
    form.visitorCount = requestedPeople
  }
}

async function load() {
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  const prefetched = slots.value.length === 0 ? readPrefetchCache<Slot[]>('/appointment-slots') : undefined
  const cached = prefetched?.length ? prefetched : undefined
  loadError.value = ''
  if (cached) {
    applyLoadedSlots(cached)
    loading.value = false
  } else {
    loading.value = true
  }

  try {
    const result = await apiGet<Slot[]>('/appointment-slots', undefined, { signal: controller.signal })
    writePrefetchCache('/appointment-slots', result)
    if (controller.signal.aborted) return
    applyLoadedSlots(result)
  } catch (reason) {
    if (!cached && !controller.signal.aborted) loadError.value = bookingError(reason, 'load')
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
    bookingVerifyCode.value = created.verificationCode ?? ''
    creationKey.value = null
    clearAppointmentDraft()
    mobileSummaryOpen.value = false
    if (selectedSlot.value) {
      stampingSeal.value = true
      const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
      const reducedMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (isJsdom || reducedMotion) {
        passModalOpen.value = true
      } else {
        if (stampRevealTimer) clearTimeout(stampRevealTimer)
        stampRevealTimer = setTimeout(() => {
          passModalOpen.value = true
          stampRevealTimer = undefined
        }, 360)
      }
    }
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
  const start = todayIso.value.replaceAll('-', '/')
  const end = windowEndIso.value.replaceAll('-', '/')
  return `${start} – ${end}`
})
const insufficientCapacity = computed(() => Boolean(selectedSlot.value && selectedSlot.value.remainingPeople < form.visitorCount && !formLocked.value))

function bookingScope(selector: string): HTMLElement[] {
  const scope = root.value
  if (!scope) return []
  return [...scope.querySelectorAll<HTMLElement>(selector)]
}

function setupEntrance() {
  if (!shouldRunGsapReveal() || !root.value || mobileDatePicker.value) return
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

const issuedPass = computed(() => {
  if (!message.value || !bookingNo.value || !selectedSlot.value) return null
  return {
    appointmentNo: bookingNo.value,
    verificationCode: bookingVerifyCode.value,
    visitDate: selectedSlot.value.visitDate,
    startTime: selectedSlot.value.startTime,
    endTime: selectedSlot.value.endTime,
    visitorCount: form.visitorCount,
    contactName: form.contactName,
    status: 'PENDING' as const,
  }
})

const passModalCopy = computed(() => locale.value === 'en-US' ? {
  eyebrow: 'HELUO KEEPSAKE · ADMISSION PASS ISSUED',
  title: 'Your collector’s museum pass is ready',
  hint: 'Saved automatically under Account › My Bookings. Switch keepsake plates or export as a high-res PNG anytime.',
  viewBookings: 'View my bookings',
  reopen: 'Open keepsake pass',
  stayHere: 'Stay on this page',
  closeAria: 'Close museum pass dialog',
} : {
  eyebrow: '河洛礼遇 · 入馆纪念票根已签发',
  title: '这份河洛藏书票，敬赠此行',
  hint: '凭证已同步归档至「个人中心 · 我的预约」；可自由切换馆藏画片，或保存高清 PNG 留作纪念。',
  viewBookings: '查看我的预约',
  reopen: '检视纪念票根',
  stayHere: '收起，留在当前页',
  closeAria: '关闭电子票根弹窗',
})

function reopenPass(event: MouseEvent) {
  passReturnFocus = event.currentTarget as HTMLElement
  passModalOpen.value = true
}

watch(passDialog, (dialog) => {
  if (!dialog || !passModalOpen.value || dialog.open) return
  dialog.showModal?.()
  passCloseButton.value?.focus({ preventScroll: true })
}, { flush: 'post' })

function finishPassClose(element: Element) {
  const dialog = element as HTMLDialogElement
  if (dialog.open) dialog.close()
  if (passModalOpen.value) return
  // The confirmation button no longer exists after a successful mobile booking.
  const opener = passReturnFocus
  passReturnFocus = null
  const target = opener?.getClientRects().length ? opener : passReopenButton.value
  target?.focus()
}

function containPassTab(event: KeyboardEvent) {
  const dialog = event.currentTarget as HTMLDialogElement
  if (event.key !== 'Tab' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
  const stops = [...dialog.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible')
  event.preventDefault()
  if (!stops.length) return
  const current = stops.findIndex(element => element === document.activeElement)
  const step = event.shiftKey ? -1 : 1
  const next = current < 0 ? (event.shiftKey ? stops.length - 1 : 0) : (current + step + stops.length) % stops.length
  stops[next]?.focus()
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
  if (stampRevealTimer) clearTimeout(stampRevealTimer)
  if (passDialog.value?.open) passDialog.value.close()
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
            <div class="appointment-result__actions">
              <button
                v-if="issuedPass"
                ref="passReopenButton"
                type="button"
                class="appointment-result__pass-btn"
                data-testid="reopen-museum-pass"
                @click="reopenPass"
              >
                <Tickets aria-hidden="true" />{{ passModalCopy.reopen }}
              </button>
              <RouterLink v-if="!passModalOpen" class="appointment-result__link" to="/profile">
                {{ passModalCopy.viewBookings }}<ArrowRight aria-hidden="true" />
              </RouterLink>
            </div>
          </div>
        </div>

        <MuseumPassCard v-if="issuedPass" :pass="issuedPass" />

        <InlineStatus v-if="fieldErrors.slotId" id="booking-slot-error" kind="error" :message="fieldErrors.slotId" />
        <FluidButton v-if="creationKey" data-recover-booking block :disabled="submitting" :loading="submitting" @click="submit()">
          <Refresh aria-hidden="true" />{{ locale === 'en-US' ? 'Check booking result' : '核对预约结果' }}
        </FluidButton>
        <InlineStatus v-if="submitError && !mobileSummaryOpen" data-submit-error kind="error" :message="submitError" />

        <!-- Step 01: Full-Year (365-day) Monthly Calendar Grid -->
        <section class="appointment-section" aria-labelledby="appointment-date-title" :aria-busy="loading">
          <header class="appointment-section__heading">
            <h2 id="appointment-date-title"><span class="font-mono">01</span>{{ workbenchCopy.dateTitle }}</h2>
            <span class="appointment-window">{{ workbenchCopy.window }}</span>
          </header>
          <div class="appointment-calendar-heading">
            <span><Calendar aria-hidden="true" />{{ calendarRange }}</span>
            <span class="appointment-legend">
              <i aria-hidden="true"></i>{{ pageCopy.available }}
              <span class="appointment-legend__count font-mono">· {{ workbenchCopy.monthOpenSummary }} {{ activeMonthOpenCount }}</span>
            </span>
          </div>

          <div class="appointment-month-nav" role="group" :aria-label="workbenchCopy.monthSelectAria">
            <button
              type="button"
              class="appointment-month-btn"
              data-testid="calendar-prev-month"
              :disabled="!canPrevMonth"
              :aria-label="workbenchCopy.prevMonth"
              @click="stepMonth(-1)"
            >
              <ArrowLeft aria-hidden="true" /><span>{{ workbenchCopy.prevMonth }}</span>
            </button>
            <div class="appointment-month-select-wrap">
              <select
                v-model="activeMonth"
                class="appointment-month-select"
                data-testid="calendar-month-select"
                :aria-label="workbenchCopy.monthSelectAria"
              >
                <option v-for="m in availableMonths" :key="m.value" :value="m.value">
                  {{ m.label }}
                </option>
              </select>
              <button
                v-if="activeMonth !== todayMonth"
                type="button"
                class="appointment-month-today"
                data-testid="calendar-today-month"
                @click="jumpToTodayMonth"
              >
                {{ workbenchCopy.backToTodayMonth }}
              </button>
            </div>
            <button
              type="button"
              class="appointment-month-btn"
              data-testid="calendar-next-month"
              :disabled="!canNextMonth"
              :aria-label="workbenchCopy.nextMonth"
              @click="stepMonth(1)"
            >
              <span>{{ workbenchCopy.nextMonth }}</span><ArrowRight aria-hidden="true" />
            </button>
          </div>

          <div v-if="loading" class="appointment-calendar-loading" role="status" :aria-label="t.booking.loading">
            <span v-for="day in 35" :key="day"></span>
          </div>
          <div v-else-if="loadError" class="appointment-empty" role="alert">
            <InfoFilled aria-hidden="true" />
            <p>{{ loadError }}</p>
            <FluidButton variant="secondary" @click="load"><Refresh aria-hidden="true" />{{ pageCopy.retry }}</FluidButton>
          </div>
          <template v-else>
            <div v-if="!activeMonthOpenCount" class="appointment-empty">
              <InfoFilled aria-hidden="true" />
              <p role="status">{{ nearestAvailableDate ? workbenchCopy.emptyMonth : workbenchCopy.emptyWindow }}</p>
              <FluidButton v-if="nearestAvailableDate" type="button" variant="secondary" @click="showNearestDate">
                {{ workbenchCopy.nearestDate }}：{{ nearestAvailableDate }}
              </FluidButton>
              <FluidButton v-else type="button" variant="secondary" @click="load">
                <Refresh aria-hidden="true" />{{ pageCopy.retry }}
              </FluidButton>
            </div>
            <div class="appointment-weekdays" aria-hidden="true">
              <span v-for="head in weekdayHeaders" :key="head">{{ head }}</span>
            </div>
            <div class="appointment-dates" role="group" :aria-label="`${pageCopy.chooseDate} (${activeMonthLabel})`">
              <span
                v-for="pad in monthLeadingEmpty"
                :key="`pad-${activeMonth}-${pad}`"
                class="appointment-day-pad"
                aria-hidden="true"
              ></span>
              <button
                v-for="day in dateDays"
                :key="day.iso"
                class="appointment-day"
                :data-visit-date="day.iso"
                data-motion="appointment-day"
                :class="{
                  active: selectedDate === day.iso,
                  'is-full': day.full,
                  'is-available': day.available,
                  'is-past': day.isPast,
                  'is-today': day.isToday,
                  'is-monday-closed': day.isMonday && day.inWindow && !day.available && !day.full,
                }"
                :disabled="formLocked || !day.available"
                :aria-pressed="selectedDate === day.iso"
                :aria-label="`${pageCopy.chooseDate}: ${day.iso}, ${calendarDayStatus(day)}`"
                :title="calendarDayTitle(day)"
                type="button"
                @click="selectDate(day.iso)"
              >
                <span class="appointment-day__weekday">{{ day.weekday }}</span>
                <strong class="font-mono">{{ day.day }}</strong>
                <span class="appointment-day__status">{{ calendarDayStatus(day) }}</span>
                <span v-if="day.available" class="appointment-day__meter" aria-hidden="true">
                  <i :style="{ width: `${Math.max(18, Math.round(day.capacityRatio * 100))}%` }"></i>
                </span>
                <Check v-if="selectedDate === day.iso" class="appointment-day__check" aria-hidden="true" />
              </button>
            </div>
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

        <div
          v-else
          class="appointment-mobile-action"
          :class="{ 'has-selection': Boolean(selectedSlot), 'is-submitted': Boolean(message) }"
        >
          <div class="appointment-mobile-action__summary">
            <template v-if="selectedSlot">
              <span class="appointment-mobile-action__date font-mono">{{ selectedSlot.visitDate.slice(5) }} · {{ selectedSlot.startTime.slice(0,5) }}–{{ selectedSlot.endTime.slice(0,5) }}</span>
              <span class="appointment-mobile-action__meta">{{ form.visitorCount }} {{ pageCopy.peopleUnit }} · {{ message ? workbenchCopy.submitted : workbenchCopy.selected }}</span>
            </template>
            <span v-else class="appointment-mobile-action__placeholder">{{ workbenchCopy.noDate }}</span>
          </div>
          <FluidButton
            ref="mobileBookingTrigger"
            size="md"
            :disabled="!slotChoicesReady || !selectedSlot || Boolean(message)"
            @click="mobileSummarySnapPoint = 'full'; mobileSummaryOpen = true"
          >
            {{ pageCopy.fill }}<ArrowRight aria-hidden="true" />
          </FluidButton>
        </div>
      </section>

      <!-- Right Highlight: Real-Time Electronic Museum Pass with Ticket Perforation -->
      <aside class="appointment-aside" data-motion="appointment-aside" :aria-label="workbenchCopy.summary">
        <div class="museum-pass" :class="{ 'is-issued': Boolean(message), 'is-selected': Boolean(selectedSlot) }">
          <figure class="appointment-venue">
            <img
              :src="venueMedia.src"
              :srcset="venueMedia.srcset"
              sizes="(max-width: 760px) calc(100vw - 2rem), 360px"
              :alt="pageCopy.museumAlt"
              width="896"
              height="1200"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            <span class="appointment-venue__scrim" aria-hidden="true"></span>
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

          <!-- Live Typeset Rice-Paper Ticket Stub (待钤印宣纸活字副券母版) -->
          <section class="appointment-summary" data-testid="live-typeset-stub" :class="{ 'has-selection': selectedSlot, 'is-stamped': Boolean(message) || stampingSeal }" aria-labelledby="appointment-summary-title">
            <header class="pass-stub__header">
              <div class="pass-stub__title-group">
                <h2 id="appointment-summary-title">{{ workbenchCopy.summary }}</h2>
                <span
                  class="pass-seal"
                  :class="{ 'is-issued': Boolean(message), 'is-selected': Boolean(selectedSlot) && !message }"
                >
                  {{ message ? workbenchCopy.submitted : selectedSlot ? workbenchCopy.selected : workbenchCopy.pending }}
                </span>
              </div>
              <span
                class="pass-cinnabar-seal"
                data-testid="pass-cinnabar-seal"
                :class="{ 'is-stamped': Boolean(message) || stampingSeal }"
                aria-hidden="true"
              >
                {{ Boolean(message) || stampingSeal ? workbenchCopy.stampedSeal : workbenchCopy.unstampedSeal }}
              </span>
            </header>

            <dl class="pass-stub__grid">
              <div :class="{ 'is-typeset': Boolean(selectedSlot) }">
                <dt><Calendar aria-hidden="true" />{{ pageCopy.date }}</dt>
                <dd class="font-mono pass-stub__lead" data-motion="appointment-summary-value">{{ selectedSlot?.visitDate || pageCopy.datePending }}</dd>
              </div>
              <div :class="{ 'is-typeset': Boolean(selectedSlot) }">
                <dt><Clock aria-hidden="true" />{{ pageCopy.time }}</dt>
                <dd class="font-mono pass-stub__lead" data-motion="appointment-summary-value">{{ selectedSlot ? `${selectedSlot.startTime.slice(0,5)} – ${selectedSlot.endTime.slice(0,5)}` : pageCopy.timePending }}</dd>
              </div>
              <div class="is-typeset">
                <dt><User aria-hidden="true" />{{ pageCopy.visitors }}</dt>
                <dd class="font-mono pass-stub__lead" data-motion="appointment-summary-value">{{ form.visitorCount }} {{ pageCopy.peopleUnit }}</dd>
              </div>
              <div :class="{ 'is-typeset': Boolean(form.contactName.trim()) }">
                <dt><Tickets aria-hidden="true" />{{ workbenchCopy.contactSlot }}</dt>
                <dd class="pass-stub__lead">{{ form.contactName.trim() || workbenchCopy.contactPending }}</dd>
              </div>
            </dl>

            <div v-if="bookingNo" class="pass-stub__code">
              <span>{{ locale === 'en-US' ? 'PASS NO.' : '凭证编号' }}</span>
              <strong class="font-mono">{{ bookingNo }}</strong>
              <button
                v-if="issuedPass"
                type="button"
                class="pass-stub__open-btn"
                  @click="reopenPass"
              >
                <Tickets aria-hidden="true" />{{ passModalCopy.reopen }}
              </button>
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
          <RouterLink v-if="!passModalOpen" to="/profile">{{ passModalCopy.viewBookings }}<ArrowRight aria-hidden="true" /></RouterLink>
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

    <!-- Ceremonial Keepsake Pass Modal: immediately presented on booking success -->
    <Teleport to="body">
      <Transition name="pass-modal-fade" @after-leave="finishPassClose">
        <dialog
          v-if="passModalOpen && issuedPass"
          ref="passDialog"
          class="pass-modal-backdrop"
          data-testid="museum-pass-modal"
          aria-labelledby="pass-modal-title"
          @cancel.prevent="passModalOpen = false"
          @click.self="passModalOpen = false"
          @keydown="containPassTab"
        >
          <div class="pass-modal-stage">
            <header class="pass-modal-head">
              <div class="pass-modal-head__copy">
                <p class="pass-modal-head__eyebrow font-mono">{{ passModalCopy.eyebrow }}</p>
                <h2 id="pass-modal-title">{{ passModalCopy.title }}</h2>
                <p class="pass-modal-head__msg">{{ message }}</p>
              </div>
              <button
                ref="passCloseButton"
                type="button"
                class="pass-modal-close"
                :aria-label="passModalCopy.closeAria"
                @click="passModalOpen = false"
              >
                ×
              </button>
            </header>

            <div class="pass-modal-body">
              <MuseumPassCard :pass="issuedPass" surface="velvet" />
            </div>

            <footer class="pass-modal-foot">
              <p class="pass-modal-foot__hint">{{ passModalCopy.hint }}</p>
              <div class="pass-modal-foot__actions">
                <button
                  type="button"
                  class="pass-modal-stay"
                  @click="passModalOpen = false"
                >
                  {{ passModalCopy.stayHere }}
                </button>
                <RouterLink
                  class="pass-modal-profile"
                  to="/profile"
                  @click="passModalOpen = false"
                >
                  {{ passModalCopy.viewBookings }}<ArrowRight aria-hidden="true" />
                </RouterLink>
              </div>
            </footer>
          </div>
        </dialog>
      </Transition>
    </Teleport>
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

.appointment-legend__count {
  color: var(--ink-secondary);
}

.appointment-month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
}

.appointment-month-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 44px;
  padding: 0 0.85rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial);
}

.appointment-month-btn:hover:not(:disabled) {
  border-color: var(--accent-bronze);
}

.appointment-month-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.appointment-month-btn svg {
  width: 14px;
  height: 14px;
}

.appointment-month-select-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.appointment-month-select {
  min-height: 44px;
  padding: 0 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.appointment-month-today {
  min-height: 44px;
  padding: 0 0.75rem;
  border: 1px dashed var(--accent-bronze);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--accent-bronze);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.appointment-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-2);
  padding-inline: 2px;
  text-align: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-muted);
}

/* Monthly 7-Column Calendar Grid */
.appointment-dates,
.appointment-calendar-loading {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-2);
}

.appointment-day-pad {
  min-height: 68px;
  border-radius: var(--radius-sm);
  background: color-mix(in oklch, var(--surface-subtle) 45%, transparent);
}

.appointment-calendar-loading span {
  height: 68px;
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
}

.appointment-day {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  min-height: 68px;
  padding: 0.35rem var(--space-2);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--ink-muted);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial);
}

.appointment-day.is-today:not(.active) {
  border-color: color-mix(in oklch, var(--accent-bronze) 75%, var(--border-strong));
}

.appointment-day.is-past {
  opacity: 0.34;
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

.appointment-day.is-monday-closed {
  border-style: dashed;
  background: var(--surface-subtle);
  color: var(--ink-muted);
}

.appointment-day.is-monday-closed .appointment-day__status {
  color: var(--accent-bronze);
  letter-spacing: 0.02em;
}

.appointment-day__meter {
  position: relative;
  display: block;
  width: 72%;
  height: 2.5px;
  margin-top: 2px;
  border-radius: var(--radius-pill);
  background: color-mix(in oklch, var(--border-strong) 65%, transparent);
  overflow: hidden;
}

.appointment-day__meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent-jade);
}

.appointment-day.active .appointment-day__meter {
  background: color-mix(in oklch, var(--accent-jade-ink) 28%, transparent);
}

.appointment-day.active .appointment-day__meter i {
  background: var(--accent-jade-ink);
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
  padding-bottom: 4.5rem;
}

.museum-pass {
  position: relative;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
  box-shadow: var(--card-frame-sheen), var(--shadow-md);
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
  background: var(--surface-darkroom);
}

.appointment-venue img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 42%;
}

.appointment-venue__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 42%,
    oklch(10% 0.008 238 / 0.58) 100%
  );
  pointer-events: none;
}

.appointment-venue figcaption {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  z-index: 2;
  padding: 0.25rem 0.65rem;
  border: 1px solid oklch(96% 0.006 86 / 0.22);
  border-radius: var(--radius-pill);
  background: oklch(11% 0.008 238 / 0.48);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: oklch(95% 0.006 86);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
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
  position: relative;
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5) var(--space-5);
  background-color: var(--surface-canvas);
  background-image: var(--pattern-yunlei);
  background-repeat: repeat;
  background-size: 64px 64px;
}

.pass-stub__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.pass-stub__title-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.pass-stub__header h2 {
  font-size: var(--text-md);
}

.pass-cinnabar-seal {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 1px dashed color-mix(in oklch, var(--accent-seal) 42%, var(--border-strong));
  border-radius: 4px;
  background: transparent;
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.15;
  white-space: pre-line;
  text-align: center;
  transform: rotate(-4deg);
  transition: border-color 220ms var(--ease-curatorial),
              background-color 220ms var(--ease-curatorial),
              color 220ms var(--ease-curatorial),
              transform 280ms var(--ease-curatorial);
}

.pass-cinnabar-seal.is-stamped {
  border-style: solid;
  border-width: 1.5px;
  border-color: var(--accent-seal);
  background: color-mix(in oklch, var(--accent-seal) 12%, var(--surface-canvas));
  color: var(--accent-seal);
  animation: heluo-seal-drop 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes heluo-seal-drop {
  0% {
    opacity: 0.4;
    transform: translateY(-10px) scale(1.28) rotate(-14deg);
  }
  70% {
    opacity: 1;
    transform: translateY(1px) scale(0.96) rotate(-5deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(-6deg);
  }
}

.pass-stub__grid > div.is-typeset .pass-stub__lead {
  color: var(--ink-primary);
}

.pass-stub__grid > div:not(.is-typeset) .pass-stub__lead {
  color: var(--ink-muted);
  font-weight: 500;
}

@media (prefers-reduced-motion: reduce) {
  .pass-cinnabar-seal.is-stamped {
    animation: none;
    transform: rotate(-6deg);
  }
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

.appointment-result__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  margin-top: 0.55rem;
}

.appointment-result__pass-btn,
.pass-stub__open-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0 1.05rem;
  border: 1px solid var(--accent-bronze);
  border-radius: var(--radius-pill);
  background: color-mix(in oklch, var(--accent-bronze) 12%, var(--surface-elevated));
  color: var(--ink-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background 180ms var(--ease-standard), transform 180ms var(--ease-standard);
}

.appointment-result__pass-btn:hover,
.pass-stub__open-btn:hover {
  background: color-mix(in oklch, var(--accent-bronze) 22%, var(--surface-elevated));
}

.pass-stub__open-btn {
  width: 100%;
  margin-top: 0.65rem;
}

/* ── Ceremonial Keepsake Pass Velvet Stage (Zero Bulky Modal Chrome) ── */
.pass-modal-backdrop {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  border: 0;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 3.5vw, 2.5rem);
  background:
    radial-gradient(ellipse 68% 58% at 50% 42%, oklch(17% 0.008 238 / 0.90), oklch(9% 0.006 238 / 0.95) 75%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.pass-modal-backdrop:not([open]) { display: none; }
.pass-modal-backdrop::backdrop { background: transparent; }
:global(html:has(.pass-modal-backdrop[open])) { overflow: hidden; }

.pass-modal-stage {
  width: min(100%, 940px);
  display: grid;
  gap: var(--space-5);
  padding: clamp(0.5rem, 1.5vw, 1rem);
  color: oklch(95% 0.012 86);
}

.pass-modal-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid oklch(86% 0.03 80 / 0.16);
}

.pass-modal-head__copy {
  display: grid;
  gap: 0.25rem;
}

.pass-modal-head__eyebrow {
  margin: 0;
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  color: oklch(82% 0.072 78);
}

.pass-modal-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2.4vw, 1.85rem);
  font-weight: 500;
  letter-spacing: 0.06em;
  color: oklch(97% 0.008 86);
}

.pass-modal-head__msg {
  margin: 0;
  font-size: var(--text-sm);
  color: oklch(80% 0.012 82);
}

.pass-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 1px solid oklch(86% 0.02 80 / 0.22);
  border-radius: 50%;
  background: transparent;
  color: oklch(84% 0.01 82);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 180ms var(--ease-standard), color 180ms var(--ease-standard);
}

.pass-modal-close:hover {
  border-color: oklch(84% 0.075 78);
  color: oklch(98% 0.008 86);
}

.pass-modal-body {
  min-width: 0;
}

.pass-modal-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid oklch(86% 0.03 80 / 0.14);
}

.pass-modal-foot__hint {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.65;
  color: oklch(82% 0.008 228);
  max-width: 50ch;
}

.pass-modal-foot__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.pass-modal-stay {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 0.75rem;
  border: 0;
  background: transparent;
  color: oklch(86% 0.008 228);
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 180ms var(--ease-standard);
}

.pass-modal-stay:hover {
  color: oklch(97% 0.006 86);
}

.pass-modal-profile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0 1.4rem;
  border-radius: 3px;
  background: oklch(95% 0.008 86);
  color: oklch(13% 0.006 238);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  transition: opacity 180ms var(--ease-standard);
}

.pass-modal-profile:hover {
  opacity: 0.92;
}

.pass-modal-profile svg {
  width: 15px;
  height: 15px;
}

.pass-modal-fade-enter-active,
.pass-modal-fade-leave-active {
  transition: opacity 260ms var(--ease-standard);
}

.pass-modal-fade-enter-active .pass-modal-stage,
.pass-modal-fade-leave-active .pass-modal-stage {
  transition: transform 320ms var(--ease-standard), opacity 260ms var(--ease-standard);
}

.pass-modal-fade-enter-from,
.pass-modal-fade-leave-to {
  opacity: 0;
}

.pass-modal-fade-enter-from .pass-modal-stage,
.pass-modal-fade-leave-to .pass-modal-stage {
  opacity: 0;
  transform: translateY(16px) scale(0.975);
}

@media (prefers-reduced-motion: reduce) {
  .pass-modal-fade-enter-active,
  .pass-modal-fade-leave-active,
  .pass-modal-fade-enter-active .pass-modal-stage,
  .pass-modal-fade-leave-active .pass-modal-stage {
    transition: none;
  }
}

/* Teleport-mounted BottomSheet overrides (outside .appointment-workbench scope) */
:global(.appointment-bottom-sheet .appointment-details svg) {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

:global(.appointment-bottom-sheet .appointment-result > svg) {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

:global(.appointment-bottom-sheet .appointment-sheet-date) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border-hairline);
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

@media (pointer: coarse) {
  .appointment-guide-actions .fluid-button {
    min-block-size: var(--control-min);
    min-inline-size: var(--control-min);
  }

  .appointment-workbench :is(.appointment-month-btn, .appointment-month-today) {
    min-inline-size: var(--control-min);
  }

  .appointment-workbench :is(input, textarea, .appointment-month-select) {
    font-size: max(16px, 1rem);
  }
}

@media (max-width: 760px) {
  .appointment-workbench {
    width: calc(100% - 1.5rem);
    padding-top: var(--space-4);
    padding-bottom: calc(6.5rem + 60px + env(safe-area-inset-bottom, 0px));
  }

  .appointment-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding-bottom: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .appointment-heading .eyebrow {
    display: none;
  }

  .appointment-heading h1 {
    margin: 0;
    font-size: 1.625rem;
    line-height: 1.15;
  }

  .appointment-heading__intro {
    margin-top: 0.25rem;
    font-size: var(--text-xs);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .appointment-account-link {
    min-height: 44px;
    padding: 0 0.75rem;
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    white-space: nowrap;
  }

  .appointment-main {
    gap: var(--space-5);
  }

  .appointment-progress,
  .appointment-window,
  .appointment-calendar-heading > span:first-child {
    display: none;
  }

  .appointment-section {
    gap: var(--space-3);
  }

  .appointment-section__heading h2 {
    font-size: var(--text-lg);
  }

  .appointment-calendar-heading {
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: -0.35rem;
  }

  .appointment-month-nav {
    flex-wrap: nowrap;
    justify-content: space-between;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .appointment-month-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
    border-color: var(--border-hairline);
  }

  .appointment-month-btn span {
    display: none;
  }

  .appointment-month-select {
    min-height: 44px;
    padding: 0 0.5rem;
    border: 0;
    background: transparent;
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: 700;
    text-align: center;
  }

  .appointment-month-today {
    min-height: 36px;
    min-width: 44px;
    padding: 0 0.55rem;
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
  }

  .appointment-weekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border-hairline);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
  }

  .appointment-dates,
  .appointment-calendar-loading {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
  }

  .appointment-day,
  .appointment-day-pad,
  .appointment-calendar-loading span {
    min-height: 48px;
    padding: 4px 2px;
    border-radius: var(--radius-sm);
  }

  .appointment-day-pad {
    background: transparent;
  }

  .appointment-day {
    border-color: transparent;
    background: transparent;
    gap: 3px;
  }

  .appointment-day.is-available {
    border-color: var(--border-hairline);
    background: var(--surface-elevated);
  }

  .appointment-day.is-today:not(.active) {
    border-color: var(--accent-bronze);
  }

  .appointment-day.is-past {
    opacity: 0.26;
    background: transparent;
  }

  .appointment-day.is-monday-closed {
    border: 0;
    background: transparent;
    opacity: 0.35;
  }

  .appointment-day.active {
    border-color: var(--accent-jade);
    background: var(--accent-jade);
    color: var(--accent-jade-ink);
    box-shadow: 0 4px 12px color-mix(in oklch, var(--accent-jade) 28%, transparent);
  }

  .appointment-day strong {
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1;
  }

  .appointment-day__weekday,
  .appointment-day__check {
    display: none;
  }

  .appointment-day__status {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .appointment-day__meter {
    width: 18px;
    height: 3px;
    margin-top: 1px;
  }

  .appointment-times {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .appointment-time {
    min-height: 64px;
    padding: 0.65rem 0.7rem;
    gap: 0.5rem;
    align-items: center;
    border-radius: var(--radius-md);
  }

  .appointment-time__radio {
    width: 18px;
    height: 18px;
    margin-top: 0;
  }

  .appointment-time__info {
    min-width: 0;
    gap: 0.15rem;
  }

  .appointment-time__info strong {
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .appointment-time__info small {
    font-size: 0.72rem;
    line-height: 1.25;
  }

  .appointment-time__bar {
    height: 2px;
    margin-top: 3px;
  }

  .appointment-mobile-action {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(60px + env(safe-area-inset-bottom, 0px));
    z-index: 65;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    padding: 0.6rem 1rem;
    border-top: 1px solid var(--border-hairline);
    background: color-mix(in oklch, var(--surface-canvas) 92%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 -6px 20px oklch(10% 0.006 238 / 0.07);
  }

  .appointment-mobile-action.is-submitted {
    position: static;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    box-shadow: none;
  }

  .appointment-mobile-action__summary {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  .appointment-mobile-action__date {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--ink-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .appointment-mobile-action__meta,
  .appointment-mobile-action__placeholder {
    font-size: 0.72rem;
    color: var(--ink-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .appointment-mobile-action :deep(.fluid-button) {
    min-height: 44px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .appointment-aside {
    gap: var(--space-3);
    padding-bottom: var(--space-4);
  }

  .appointment-venue {
    aspect-ratio: 16 / 7;
  }

  .appointment-venue-info {
    padding: var(--space-3) var(--space-4);
    gap: 0.3rem;
  }

  .appointment-venue-info h2 {
    font-size: var(--text-md);
  }

  .museum-pass__kicker {
    display: none;
  }

  .pass-perforation {
    height: 14px;
  }

  .appointment-summary {
    padding: var(--space-3) var(--space-4);
    gap: var(--space-2);
  }

  .pass-stub__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-3);
  }

  .pass-stub__grid > div {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    padding-bottom: 0;
    border-bottom: 0;
  }

  .pass-cinnabar-seal {
    width: 36px;
    height: 36px;
    font-size: 0.65rem;
  }

  .appointment-notice {
    padding: var(--space-3) var(--space-4);
  }

  .pass-modal-backdrop {
    align-items: start;
    padding: 0.75rem;
  }

  .pass-modal-foot {
    flex-direction: column;
    align-items: stretch;
  }

  .pass-modal-foot__actions {
    justify-content: stretch;
  }

  .pass-modal-stay,
  .pass-modal-profile {
    flex: 1 1 auto;
  }
}

@media (max-width: 359px) {
  .appointment-workbench {
    width: calc(100% - 1rem);
  }

  .appointment-weekdays,
  .appointment-day-pad {
    display: none;
  }

  .appointment-dates,
  .appointment-calendar-loading {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .appointment-day__weekday {
    display: inline;
    font-size: 0.68rem;
  }

  .appointment-times {
    grid-template-columns: 1fr;
  }

  .appointment-mobile-action {
    padding-inline: 0.75rem;
    gap: var(--space-2);
  }
}
</style>
