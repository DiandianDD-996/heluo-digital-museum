<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiGet, apiRequest } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { refreshAdminNavCounts } from '../composables/useAdminNavCounts'
import { useUnsavedChanges } from '../composables/useUnsavedChanges'
import AdminShell from '../components/AdminShell.vue'
import FluidButton from '../components/FluidButton.vue'
import InlineStatus from '../components/InlineStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AdminActionButton from '../components/AdminActionButton.vue'
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue'

interface SlotView {
  id: number
  visitDate: string
  startTime: string
  endTime: string
  capacity: number
  reservedPeople: number
  status: 'OPEN' | 'CLOSED' | 'CANCELLED'
}

interface CalendarDaySummary {
  visitDate: string
  isMonday: boolean
  slotCount: number
  openSlotCount: number
  closedSlotCount: number
  totalCapacity: number
  reservedPeople: number
  utilizationRate: number
  slots: SlotView[]
}

interface CalendarMonthView {
  month: string
  startDate: string
  endDate: string
  openDays: number
  totalSlots: number
  totalCapacity: number
  totalReserved: number
  days: CalendarDaySummary[]
}

interface BatchGenerateResult {
  createdCount: number
  skippedExistingCount: number
  skippedMondayCount: number
  skippedPastCount: number
}

interface BatchStatusResult {
  updatedCount: number
  skippedPastCount: number
  skippedCapacityConflictCount: number
  affectedReservedPeople: number
}

type DrawerMode = 'closed' | 'create' | 'edit' | 'batch-generate' | 'batch-status'

function shanghaiToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
}

function shanghaiNowTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function addMonths(month: string, delta: number): string {
  const [yStr, mStr] = month.split('-')
  const date = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function addDays(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

function weekdayZh(dateStr: string): string {
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return labels[day] ?? ''
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${y} 年 ${Number(m)} 月`
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const todayStr = ref(shanghaiToday())
const activeMonth = ref(todayStr.value.slice(0, 7))
const selectedDate = ref(todayStr.value)

const calendar = ref<CalendarMonthView | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const message = ref('')

const drawerMode = ref<DrawerMode>('closed')
const editingSlot = ref<SlotView | null>(null)
const formElement = ref<HTMLFormElement | null>(null)
const drawerBaseline = ref('')
const confirmationPending = ref(false)
const confirmation = ref<{ title: string; message: string; confirmLabel: string; run: () => Promise<void> } | null>(null)

const slotForm = reactive({
  visitDate: todayStr.value,
  startTime: '09:00',
  endTime: '10:30',
  capacity: 40,
  status: 'OPEN' as 'OPEN' | 'CLOSED' | 'CANCELLED',
})

const batchGenForm = reactive({
  dateFrom: todayStr.value,
  dateTo: addDays(todayStr.value, 30),
  skipMondays: true,
  capacity: 40,
})

const batchStatusForm = reactive({
  dateFrom: todayStr.value,
  dateTo: addDays(todayStr.value, 6),
  status: 'CLOSED' as 'OPEN' | 'CLOSED',
  capacity: '' as string | number,
})

let loadSeq = 0
let abortController: AbortController | undefined

const activeDrawerSnapshot = computed(() => {
  if (drawerMode.value === 'closed') return 'closed'
  if (drawerMode.value === 'create' || drawerMode.value === 'edit') return JSON.stringify(slotForm)
  if (drawerMode.value === 'batch-generate') return JSON.stringify(batchGenForm)
  return JSON.stringify(batchStatusForm)
})

const unsaved = useUnsavedChanges({
  value: () => activeDrawerSnapshot.value,
  dirty: () => drawerMode.value !== 'closed' && activeDrawerSnapshot.value !== drawerBaseline.value,
  save: saveDrawerForm,
  discard: resetAndCloseDrawer,
  blocked: () => submitting.value,
})

const drawerTitle = computed(() => {
  if (drawerMode.value === 'create') return '新建单场时段'
  if (drawerMode.value === 'edit') return `编辑时段 · ${editingSlot.value?.visitDate ?? ''}`
  if (drawerMode.value === 'batch-generate') return '批量排班生成'
  if (drawerMode.value === 'batch-status') return '批量开关与调容'
  return ''
})

const monthUtilization = computed(() => {
  const c = calendar.value
  if (!c || c.totalCapacity <= 0) return 0
  return Math.round((c.totalReserved / c.totalCapacity) * 1000) / 10
})

const leadingEmptyDays = computed(() => {
  const startDate = calendar.value?.startDate ?? `${activeMonth.value}-01`
  const utcDay = new Date(`${startDate}T00:00:00Z`).getUTCDay()
  return (utcDay + 6) % 7
})

const selectedDaySummary = computed<CalendarDaySummary | null>(() => {
  const days = calendar.value?.days ?? []
  return days.find(d => d.visitDate === selectedDate.value) ?? days[0] ?? null
})

function isSlotEditable(slot: SlotView): boolean {
  const nowDay = shanghaiToday()
  if (slot.visitDate > nowDay) return true
  if (slot.visitDate < nowDay) return false
  return slot.startTime.slice(0, 5) > shanghaiNowTime()
}

const dayCanGenerate = computed(() => {
  const day = selectedDaySummary.value
  return Boolean(day && day.visitDate >= todayStr.value)
})

const dayHasFutureOpen = computed(() => {
  const day = selectedDaySummary.value
  return Boolean(day?.slots.some(s => s.status === 'OPEN' && isSlotEditable(s)))
})

const dayHasFutureClosed = computed(() => {
  const day = selectedDaySummary.value
  return Boolean(day?.slots.some(s => s.status === 'CLOSED' && isSlotEditable(s)))
})

function cellToneClass(day: CalendarDaySummary): string {
  if (day.slotCount === 0) return day.isMonday ? 'is-monday-closed' : 'is-empty'
  if (day.openSlotCount === 0) return 'is-all-closed'
  if (day.utilizationRate >= 85) return 'is-critical'
  if (day.utilizationRate >= 65) return 'is-warm'
  return 'is-normal'
}

async function loadCalendar() {
  const seq = ++loadSeq
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  loading.value = true
  error.value = ''
  try {
    await auth.initialize()
    if (seq !== loadSeq) return
    if (!auth.isAdmin) {
      await router.replace('/login')
      return
    }
    const data = await apiGet<CalendarMonthView>(
      `/admin/appointment-slots/calendar?month=${encodeURIComponent(activeMonth.value)}`,
      auth.token,
      { signal: controller.signal },
    )
    if (seq !== loadSeq) return
    calendar.value = data
    if (!data.days.some(d => d.visitDate === selectedDate.value)) {
      selectedDate.value = data.days[0]?.visitDate ?? data.startDate
    }
  } catch (reason) {
    if (seq === loadSeq && !(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '排班月历加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function shiftMonth(delta: number) {
  const nextMonth = addMonths(activeMonth.value, delta)
  activeMonth.value = nextMonth
  selectedDate.value = `${nextMonth}-01`
  void loadCalendar()
}

function jumpToday() {
  todayStr.value = shanghaiToday()
  activeMonth.value = todayStr.value.slice(0, 7)
  selectedDate.value = todayStr.value
  void loadCalendar()
}

function selectDay(visitDate: string) {
  selectedDate.value = visitDate
}

function resetAndCloseDrawer() {
  drawerMode.value = 'closed'
  editingSlot.value = null
  drawerBaseline.value = 'closed'
  unsaved.markClean()
}

function openCreateDrawer() {
  void unsaved.attempt(() => {
    error.value = ''
    editingSlot.value = null
    Object.assign(slotForm, {
      visitDate: selectedDate.value >= todayStr.value ? selectedDate.value : todayStr.value,
      startTime: '09:00',
      endTime: '10:30',
      capacity: 40,
      status: 'OPEN',
    })
    drawerMode.value = 'create'
    drawerBaseline.value = activeDrawerSnapshot.value
    unsaved.markClean()
  })
}

function openEditDrawer(slot: SlotView) {
  void unsaved.attempt(() => {
    error.value = ''
    editingSlot.value = slot
    Object.assign(slotForm, {
      visitDate: slot.visitDate,
      startTime: slot.startTime.slice(0, 5),
      endTime: slot.endTime.slice(0, 5),
      capacity: slot.capacity,
      status: slot.status,
    })
    drawerMode.value = 'edit'
    drawerBaseline.value = activeDrawerSnapshot.value
    unsaved.markClean()
  })
}

function openBatchGenerateDrawer() {
  void unsaved.attempt(() => {
    error.value = ''
    const base = selectedDate.value >= todayStr.value ? selectedDate.value : todayStr.value
    Object.assign(batchGenForm, {
      dateFrom: base,
      dateTo: addDays(base, 30),
      skipMondays: true,
      capacity: 40,
    })
    drawerMode.value = 'batch-generate'
    drawerBaseline.value = activeDrawerSnapshot.value
    unsaved.markClean()
  })
}

function openBatchStatusDrawer() {
  void unsaved.attempt(() => {
    error.value = ''
    const base = selectedDate.value >= todayStr.value ? selectedDate.value : todayStr.value
    Object.assign(batchStatusForm, {
      dateFrom: base,
      dateTo: addDays(base, 6),
      status: 'CLOSED',
      capacity: '',
    })
    drawerMode.value = 'batch-status'
    drawerBaseline.value = activeDrawerSnapshot.value
    unsaved.markClean()
  })
}

function closeDrawer() {
  if (drawerMode.value === 'closed' || submitting.value) return
  void unsaved.attempt(() => {
    resetAndCloseDrawer()
  })
}

async function saveDrawerForm(): Promise<boolean> {
  if (submitting.value) return false
  if (formElement.value && !formElement.value.reportValidity()) {
    error.value = '请检查必填字段与输入格式。'
    return false
  }
  submitting.value = true
  error.value = ''
  message.value = ''
  try {
    if (drawerMode.value === 'create') {
      await apiRequest('/admin/appointment-slots', 'POST', {
        visitDate: slotForm.visitDate,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        capacity: Number(slotForm.capacity),
        status: slotForm.status,
      }, auth.token)
      message.value = `已新增 ${slotForm.visitDate} ${slotForm.startTime}–${slotForm.endTime} 场次。`
      activeMonth.value = slotForm.visitDate.slice(0, 7)
      selectedDate.value = slotForm.visitDate
    } else if (drawerMode.value === 'edit' && editingSlot.value) {
      await apiRequest(`/admin/appointment-slots/${editingSlot.value.id}`, 'PATCH', {
        visitDate: slotForm.visitDate,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        capacity: Number(slotForm.capacity),
        status: slotForm.status,
      }, auth.token)
      message.value = `已更新 ${slotForm.visitDate} ${slotForm.startTime}–${slotForm.endTime} 场次配置。`
      activeMonth.value = slotForm.visitDate.slice(0, 7)
      selectedDate.value = slotForm.visitDate
    } else if (drawerMode.value === 'batch-generate') {
      const res = await apiRequest<BatchGenerateResult>('/admin/appointment-slots/batch-generate', 'POST', {
        dateFrom: batchGenForm.dateFrom,
        dateTo: batchGenForm.dateTo,
        skipMondays: batchGenForm.skipMondays,
        capacity: Number(batchGenForm.capacity),
      }, auth.token)
      message.value = `批量排班完成：新建 ${res.createdCount} 个场次`
        + (res.skippedExistingCount > 0 ? `，跳过已有 ${res.skippedExistingCount} 个` : '')
        + (res.skippedMondayCount > 0 ? `，跳过周一闭馆 ${res.skippedMondayCount} 天` : '')
        + '。'
      activeMonth.value = batchGenForm.dateFrom.slice(0, 7)
      selectedDate.value = batchGenForm.dateFrom
    } else if (drawerMode.value === 'batch-status') {
      const cap = batchStatusForm.capacity === '' || batchStatusForm.capacity === null
        ? null
        : Number(batchStatusForm.capacity)
      const res = await apiRequest<BatchStatusResult>('/admin/appointment-slots/batch-status', 'POST', {
        dateFrom: batchStatusForm.dateFrom,
        dateTo: batchStatusForm.dateTo,
        status: batchStatusForm.status,
        capacity: cap,
      }, auth.token)
      message.value = `批量调整完成：更新 ${res.updatedCount} 个场次`
        + (res.skippedCapacityConflictCount > 0 ? `，因已约人数超新容量跳过 ${res.skippedCapacityConflictCount} 场` : '')
        + (res.affectedReservedPeople > 0 ? `（涉及已预约 ${res.affectedReservedPeople} 人次）` : '')
        + '。'
    }
    resetAndCloseDrawer()
    await Promise.all([loadCalendar(), refreshAdminNavCounts(true)])
    return true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存排班变更失败。'
    return false
  } finally {
    submitting.value = false
  }
}

async function generateForSelectedDay() {
  if (!selectedDaySummary.value || submitting.value) return
  submitting.value = true
  error.value = ''
  message.value = ''
  try {
    const visitDate = selectedDaySummary.value.visitDate
    const res = await apiRequest<BatchGenerateResult>('/admin/appointment-slots/batch-generate', 'POST', {
      dateFrom: visitDate,
      dateTo: visitDate,
      skipMondays: false,
      capacity: 40,
    }, auth.token)
    message.value = res.createdCount > 0
      ? `已为 ${visitDate} 补全 ${res.createdCount} 个标准开放场次。`
      : `${visitDate} 的标准 4 场时段已全部就绪（跳过 ${res.skippedExistingCount} 个）。`
    await loadCalendar()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '补全当日时段失败。'
  } finally {
    submitting.value = false
  }
}

function requestDayStatusChange(status: 'OPEN' | 'CLOSED') {
  const day = selectedDaySummary.value
  if (!day) return
  const closing = status === 'CLOSED'
  confirmation.value = {
    title: closing ? `临时闭馆 ${day.visitDate}？` : `恢复开放 ${day.visitDate}？`,
    message: closing
      ? `将该日尚未开始的所有开放时段设为关闭（当前已预约 ${day.reservedPeople} 人次不会被自动取消）。`
      : `将该日尚未开始的关闭时段恢复为对外开放预约。`,
    confirmLabel: closing ? '确认闭馆' : '确认开放',
    run: async () => {
      const res = await apiRequest<BatchStatusResult>('/admin/appointment-slots/batch-status', 'POST', {
        dateFrom: day.visitDate,
        dateTo: day.visitDate,
        status,
        capacity: null,
      }, auth.token)
      message.value = `${day.visitDate} 已${closing ? '临时闭馆' : '恢复开放'}，共更新 ${res.updatedCount} 个场次。`
      await loadCalendar()
    },
  }
}

function toggleSingleSlotStatus(slot: SlotView) {
  const nextStatus = slot.status === 'OPEN' ? 'CLOSED' : 'OPEN'
  const doToggle = async () => {
    await apiRequest(`/admin/appointment-slots/${slot.id}`, 'PATCH', {
      visitDate: slot.visitDate,
      startTime: slot.startTime.slice(0, 5),
      endTime: slot.endTime.slice(0, 5),
      capacity: slot.capacity,
      status: nextStatus,
    }, auth.token)
    message.value = `${slot.visitDate} ${slot.startTime.slice(0, 5)} 场次已${nextStatus === 'OPEN' ? '开放' : '关闭'}。`
    await loadCalendar()
  }

  if (nextStatus === 'CLOSED' && slot.reservedPeople > 0) {
    confirmation.value = {
      title: '关闭已有预约的场次？',
      message: `${slot.visitDate} ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)} 已有 ${slot.reservedPeople} 位观众预约，关闭后停止新增预约，既有预约仍保留。`,
      confirmLabel: '确认关闭',
      run: doToggle,
    }
    return
  }

  submitting.value = true
  error.value = ''
  message.value = ''
  void doToggle()
    .catch((reason) => {
      error.value = reason instanceof Error ? reason.message : '更新场次状态失败。'
    })
    .finally(() => {
      submitting.value = false
    })
}

async function confirmDialogRun() {
  const current = confirmation.value
  if (!current || confirmationPending.value) return
  confirmationPending.value = true
  error.value = ''
  try {
    await current.run()
    confirmation.value = null
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作失败。'
  } finally {
    confirmationPending.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drawerMode.value !== 'closed' && !confirmation.value && !unsaved.open.value) {
    closeDrawer()
  }
}

watch(() => route.query.date, (dateParam) => {
  if (typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const nextMonth = dateParam.slice(0, 7)
    const monthChanged = nextMonth !== activeMonth.value
    activeMonth.value = nextMonth
    selectedDate.value = dateParam
    if (monthChanged && calendar.value) {
      void loadCalendar()
    }
  }
}, { immediate: true })

onMounted(() => {
  void loadCalendar()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  ++loadSeq
  abortController?.abort()
})
</script>

<template>
  <AdminShell
    v-if="auth.isAdmin"
    title="排班与时段日历"
    description="按自然月直观统筹每日 4 场参观承载容量，支持单场调控、批量排班及一键临时闭馆。"
    section="slots"
  >
    <template #header-actions>
      <button type="button" class="admin-text-button" data-testid="slots-open-batch-status" @click="openBatchStatusDrawer">
        批量开关
      </button>
      <button type="button" class="admin-text-button" data-testid="slots-open-batch-generate" @click="openBatchGenerateDrawer">
        批量排班
      </button>
      <button type="button" class="admin-primary-btn" data-testid="slots-open-create" @click="openCreateDrawer">
        + 新建单场
      </button>
      <RouterLink class="admin-header-link" to="/admin/appointments">预约与核销 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <section v-if="calendar" class="slots-summary-grid" aria-label="月度排班统计">
      <article class="admin-kpi-card">
        <div class="admin-kpi-card__head"><h2>开放参观日</h2></div>
        <div class="admin-kpi-card__metric">
          <strong>{{ calendar.openDays }} 天</strong>
          <p>{{ formatMonthLabel(calendar.month) }} 可预约天数</p>
        </div>
      </article>
      <article class="admin-kpi-card">
        <div class="admin-kpi-card__head"><h2>月度总场次</h2></div>
        <div class="admin-kpi-card__metric">
          <strong>{{ calendar.totalSlots }} 场</strong>
          <p>按全月开放与关闭时段汇总</p>
        </div>
      </article>
      <article class="admin-kpi-card">
        <div class="admin-kpi-card__head"><h2>月度总名额</h2></div>
        <div class="admin-kpi-card__metric">
          <strong>{{ calendar.totalCapacity.toLocaleString('zh-CN') }} 人</strong>
          <p>馆内承载上限总计</p>
        </div>
      </article>
      <article class="admin-kpi-card">
        <div class="admin-kpi-card__head"><h2>当月已约与满载率</h2></div>
        <div class="admin-kpi-card__metric">
          <strong>{{ calendar.totalReserved.toLocaleString('zh-CN') }} 人 · {{ monthUtilization }}%</strong>
          <p>实时累计占用名额占比</p>
        </div>
      </article>
    </section>

    <div class="slots-workspace-grid">
      <section class="slots-calendar-card" data-testid="slots-calendar" aria-label="月度排班日历">
        <header class="slots-calendar-head">
          <div class="slots-calendar-title">
            <h2>{{ formatMonthLabel(activeMonth) }}</h2>
            <span class="slots-calendar-legend">
              <i><em class="dot dot--normal"></em>正常</i>
              <i><em class="dot dot--warm"></em>≥65%</i>
              <i><em class="dot dot--critical"></em>≥85%</i>
              <i><em class="dot dot--closed"></em>休/关</i>
            </span>
          </div>
          <div class="slots-month-nav" role="group" aria-label="月份切换">
            <button type="button" data-testid="slots-prev-month" @click="shiftMonth(-1)">上月</button>
            <button type="button" data-testid="slots-today-btn" @click="jumpToday">本月</button>
            <button type="button" data-testid="slots-next-month" @click="shiftMonth(1)">下月</button>
          </div>
        </header>

        <div v-if="loading && !calendar" class="state-panel">正在加载月度排班日历…</div>

        <template v-else-if="calendar">
          <div class="slots-weekdays" aria-hidden="true">
            <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
          </div>
          <div class="slots-calendar-grid">
            <div v-for="n in leadingEmptyDays" :key="`empty-${n}`" class="slots-cal-spacer" aria-hidden="true"></div>
            <button
              v-for="day in calendar.days"
              :key="day.visitDate"
              type="button"
              class="slots-cal-cell"
              :class="[
                cellToneClass(day),
                {
                  'is-selected': selectedDate === day.visitDate,
                  'is-today': day.visitDate === todayStr,
                  'is-past': day.visitDate < todayStr,
                },
              ]"
              :data-testid="`calendar-day-${day.visitDate}`"
              :aria-pressed="selectedDate === day.visitDate"
              @click="selectDay(day.visitDate)"
            >
              <div class="slots-cal-cell__top">
                <span class="slots-cal-cell__num">{{ Number(day.visitDate.slice(8)) }}</span>
                <em v-if="day.visitDate === todayStr" class="slots-cal-today-tag">今</em>
                <em v-else-if="day.isMonday && day.slotCount === 0" class="slots-cal-rest-tag">休</em>
              </div>
              <div class="slots-cal-cell__stat">
                <template v-if="day.slotCount > 0">
                  <span>{{ day.reservedPeople }}/{{ day.totalCapacity }}</span>
                </template>
                <template v-else>
                  <span>{{ day.isMonday ? '闭馆' : '未排' }}</span>
                </template>
              </div>
              <span class="slots-cal-cell__bar" aria-hidden="true">
                <i :style="{ width: day.totalCapacity > 0 ? `${Math.min(100, Math.round(day.utilizationRate))}%` : '0%' }"></i>
              </span>
            </button>
          </div>
        </template>
      </section>

      <aside class="slots-day-inspector" data-testid="slots-day-panel" aria-label="选中日期时段详情">
        <template v-if="selectedDaySummary">
          <header class="slots-day-head">
            <div>
              <span class="slots-day-date">{{ selectedDaySummary.visitDate }} · {{ weekdayZh(selectedDaySummary.visitDate) }}</span>
              <h3>
                <template v-if="selectedDaySummary.slotCount > 0">
                  已预约 {{ selectedDaySummary.reservedPeople }} / {{ selectedDaySummary.totalCapacity }} 人（{{ selectedDaySummary.utilizationRate }}%）
                </template>
                <template v-else>
                  {{ selectedDaySummary.isMonday ? '常规周一闭馆日' : '当日暂未生成排班场次' }}
                </template>
              </h3>
            </div>
            <div class="slots-day-quick-actions">
              <button
                v-if="dayCanGenerate"
                type="button"
                class="admin-text-button admin-text-button--compact"
                data-testid="day-generate-btn"
                :disabled="submitting"
                @click="generateForSelectedDay"
              >
                补全 4 场
              </button>
              <button
                v-if="dayHasFutureOpen"
                type="button"
                class="admin-text-button admin-text-button--compact"
                data-testid="day-close-btn"
                :disabled="submitting"
                @click="requestDayStatusChange('CLOSED')"
              >
                临时闭馆
              </button>
              <button
                v-if="dayHasFutureClosed"
                type="button"
                class="admin-text-button admin-text-button--compact"
                data-testid="day-open-btn"
                :disabled="submitting"
                @click="requestDayStatusChange('OPEN')"
              >
                恢复开放
              </button>
            </div>
          </header>

          <div v-if="selectedDaySummary.slots.length === 0" class="admin-chart-empty">
            <p v-if="selectedDaySummary.visitDate < todayStr">历史日期未记录开放时段。</p>
            <p v-else>点击上方「补全 4 场」即可生成 09:00–16:45 标准参观场次，或点击「+ 新建单场」自定义时段。</p>
          </div>

          <ul v-else class="slot-session-list">
            <li v-for="slot in selectedDaySummary.slots" :key="slot.id" class="slot-session-card" :data-testid="`slot-card-${slot.id}`">
              <div class="slot-session-card__top">
                <strong class="slot-session-time">{{ slot.startTime.slice(0, 5) }} – {{ slot.endTime.slice(0, 5) }}</strong>
                <StatusBadge :status="slot.status" />
              </div>
              <div class="slot-session-card__meter">
                <div class="slot-session-track" aria-hidden="true">
                  <i
                    :style="{ width: slot.capacity > 0 ? `${Math.min(100, Math.round((slot.reservedPeople / slot.capacity) * 100))}%` : '0%' }"
                    :class="{ 'is-full': slot.reservedPeople >= slot.capacity }"
                  ></i>
                </div>
                <span class="slot-session-nums">
                  已约 <b>{{ slot.reservedPeople }}</b> / {{ slot.capacity }} · 余 {{ Math.max(0, slot.capacity - slot.reservedPeople) }} 名额
                </span>
              </div>
              <div class="slot-session-card__actions">
                <template v-if="isSlotEditable(slot)">
                  <AdminActionButton action="edit" :data-testid="`slot-edit-${slot.id}`" @click="openEditDrawer(slot)">编辑</AdminActionButton>
                  <button
                    type="button"
                    class="admin-text-button admin-text-button--compact"
                    :data-testid="`slot-toggle-${slot.id}`"
                    :disabled="submitting"
                    @click="toggleSingleSlotStatus(slot)"
                  >
                    {{ slot.status === 'OPEN' ? '关闭' : '开放' }}
                  </button>
                </template>
                <span v-else class="slot-session-readonly">已过开始时间 · 只读存档</span>
              </div>
            </li>
          </ul>
        </template>
      </aside>
    </div>

    <div v-if="drawerMode !== 'closed'" class="admin-drawer-backdrop" @click.self="closeDrawer">
      <aside class="admin-drawer" data-testid="slots-drawer" role="region" :aria-label="drawerTitle">
        <header class="admin-drawer__head">
          <div class="admin-drawer__title">
            <h2>{{ drawerTitle }}</h2>
          </div>
          <button type="button" class="admin-drawer__close" aria-label="关闭排班抽屉" @click="closeDrawer">×</button>
        </header>

        <div class="admin-drawer__body">
          <InlineStatus v-if="error" :message="error" kind="error" />

          <form
            v-if="drawerMode === 'create' || drawerMode === 'edit'"
            ref="formElement"
            class="admin-drawer-form"
            :inert="submitting"
            @submit.prevent="saveDrawerForm"
          >
            <label>
              <span>参观日期</span>
              <input v-model="slotForm.visitDate" type="date" :min="todayStr" required />
            </label>
            <div class="admin-form-grid">
              <label><span>开始时间</span><input v-model="slotForm.startTime" type="time" required /></label>
              <label><span>结束时间</span><input v-model="slotForm.endTime" type="time" required /></label>
            </div>
            <div class="admin-form-grid">
              <label>
                <span>承载容量 <em v-if="editingSlot">已约 {{ editingSlot.reservedPeople }} 人</em></span>
                <input
                  v-model.number="slotForm.capacity"
                  type="number"
                  :min="Math.max(1, editingSlot?.reservedPeople ?? 1)"
                  max="500"
                  required
                />
              </label>
              <label>
                <span>时段状态</span>
                <select v-model="slotForm.status">
                  <option value="OPEN">OPEN · 开放</option>
                  <option value="CLOSED">CLOSED · 关闭</option>
                  <option value="CANCELLED" :disabled="(editingSlot?.reservedPeople ?? 0) > 0">CANCELLED · 取消</option>
                </select>
              </label>
            </div>
            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="submitting">{{ drawerMode === 'edit' ? '保存时段配置' : '创建时段' }}</FluidButton>
              <FluidButton type="button" variant="ghost" block :disabled="submitting" @click="closeDrawer">取消</FluidButton>
            </div>
          </form>

          <form
            v-else-if="drawerMode === 'batch-generate'"
            ref="formElement"
            class="admin-drawer-form"
            :inert="submitting"
            @submit.prevent="saveDrawerForm"
          >
            <p class="slots-drawer-note">按馆方标准 4 场（09:00、10:30、13:30、15:15）为选定日期范围生成时段，已存在的时段将自动跳过（单次最多 90 天）。</p>
            <div class="admin-form-grid">
              <label><span>起始日期</span><input v-model="batchGenForm.dateFrom" type="date" :min="todayStr" required /></label>
              <label><span>结束日期</span><input v-model="batchGenForm.dateTo" type="date" :min="batchGenForm.dateFrom" required /></label>
            </div>
            <label><span>每场默认容量（人）</span><input v-model.number="batchGenForm.capacity" type="number" min="1" max="500" required /></label>
            <label class="admin-toggle-field">
              <input v-model="batchGenForm.skipMondays" type="checkbox" />
              <span>自动跳过常规周一闭馆日</span>
            </label>
            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="submitting">执行批量排班</FluidButton>
              <FluidButton type="button" variant="ghost" block :disabled="submitting" @click="closeDrawer">取消</FluidButton>
            </div>
          </form>

          <form
            v-else-if="drawerMode === 'batch-status'"
            ref="formElement"
            class="admin-drawer-form"
            :inert="submitting"
            @submit.prevent="saveDrawerForm"
          >
            <p class="slots-drawer-note">批量开放或关闭区间内所有未来时段；若填写新容量，已预约人数超过新容量的场次将自动跳过保护。</p>
            <div class="admin-form-grid">
              <label><span>起始日期</span><input v-model="batchStatusForm.dateFrom" type="date" required /></label>
              <label><span>结束日期</span><input v-model="batchStatusForm.dateTo" type="date" :min="batchStatusForm.dateFrom" required /></label>
            </div>
            <div class="admin-form-grid">
              <label>
                <span>目标状态</span>
                <select v-model="batchStatusForm.status">
                  <option value="CLOSED">CLOSED · 临时关闭</option>
                  <option value="OPEN">OPEN · 开放预约</option>
                </select>
              </label>
              <label>
                <span>统一调整容量 <em>留空保持原容量</em></span>
                <input v-model="batchStatusForm.capacity" type="number" min="1" max="500" placeholder="不修改" />
              </label>
            </div>
            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="submitting">确认批量调整</FluidButton>
              <FluidButton type="button" variant="ghost" block :disabled="submitting" @click="closeDrawer">取消</FluidButton>
            </div>
          </form>
        </div>
      </aside>
    </div>

    <AdminConfirmDialog
      v-if="confirmation"
      :open="Boolean(confirmation)"
      :title="confirmation.title"
      :message="confirmation.message"
      :confirm-label="confirmation.confirmLabel"
      :pending="confirmationPending"
      @confirm="confirmDialogRun"
      @cancel="confirmation = null"
    />

    <AdminConfirmDialog
      v-if="unsaved.open.value"
      :open="unsaved.open.value"
      title="还有未保存的排班更改"
      message="保存当前更改后继续，或放弃本次编辑。"
      :error="error"
      confirm-label="保存并继续"
      secondary-label="放弃修改"
      cancel-label="继续编辑"
      :pending="unsaved.pending.value"
      @confirm="unsaved.decide('save')"
      @secondary="unsaved.decide('discard')"
      @cancel="unsaved.decide('continue')"
    />
  </AdminShell>
</template>
