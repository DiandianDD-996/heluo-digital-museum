<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, apiRequest, type ContentPage } from '../lib/api'
import { downloadAdminCsv } from '../lib/adminCsvExport'
import { useAuthStore } from '../stores/auth'
import { refreshAdminNavCounts } from '../composables/useAdminNavCounts'
import AdminShell from '../components/AdminShell.vue'
import FluidButton from '../components/FluidButton.vue'
import InlineStatus from '../components/InlineStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AdminActionButton from '../components/AdminActionButton.vue'
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue'

interface AppointmentView {
  id: number
  appointmentNo: string
  userId: number
  slotId: number
  visitorCount: number
  contactName: string
  contactPhone: string
  contactEmail: string
  notes: string
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  cancelReason: string
  visitDate: string
  startTime: string
  endTime: string
  startAt: string
  verificationCode: string
}

interface AppointmentLookupView {
  appointment: AppointmentView
  canCheckInNow: boolean
  checkInHint: string
}

type DatePreset = 'all' | 'today' | 'tomorrow' | 'next7d' | 'custom'

function shanghaiToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
}

function addDays(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

const auth = useAuthStore()
const router = useRouter()
const todayStr = shanghaiToday()

const items = ref<AppointmentView[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const loading = ref(true)
const mutating = ref(false)
const exporting = ref(false)
const error = ref('')
const message = ref('')

// Quick check-in desk state
const lookupCode = ref('')
const lookupLoading = ref(false)
const lookupError = ref('')
const lookupResult = ref<AppointmentLookupView | null>(null)

// Server-side filters
const datePreset = ref<DatePreset>('all')
const keyword = ref('')
const statusFilter = ref('')
const customFrom = ref(todayStr)
const customTo = ref(addDays(todayStr, 6))

const checkInCodes = reactive<Record<number, string>>({})
const confirmationPending = ref(false)
const confirmation = ref<{ title: string; message: string; confirmLabel: string; run: () => Promise<void> } | null>(null)

let loadSeq = 0
let abortController: AbortController | undefined

const isHex10Code = computed(() => /^[0-9A-Fa-f]{10}$/.test(lookupCode.value.trim()))

function buildFilterParams(includePagination: boolean): URLSearchParams {
  const params = new URLSearchParams()
  if (includePagination) {
    params.set('page', String(page.value))
    params.set('size', '20')
  }
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (keyword.value.trim()) params.set('keyword', keyword.value.trim())

  if (datePreset.value === 'today') {
    params.set('visitDate', todayStr)
  } else if (datePreset.value === 'tomorrow') {
    params.set('visitDate', addDays(todayStr, 1))
  } else if (datePreset.value === 'next7d') {
    params.set('dateFrom', todayStr)
    params.set('dateTo', addDays(todayStr, 6))
  } else if (datePreset.value === 'custom') {
    if (customFrom.value) params.set('dateFrom', customFrom.value)
    if (customTo.value) params.set('dateTo', customTo.value)
  }
  return params
}

async function loadAppointments() {
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
    const query = buildFilterParams(true).toString()
    const data = await apiGet<ContentPage<AppointmentView>>(
      `/admin/appointments?${query}`,
      auth.token,
      { signal: controller.signal },
    )
    if (seq !== loadSeq) return
    if (page.value > Math.max(1, data.totalPages)) {
      page.value = Math.max(1, data.totalPages)
      await loadAppointments()
      return
    }
    items.value = data.items
    total.value = data.total
    totalPages.value = Math.max(1, data.totalPages)
    for (const appt of data.items) {
      if (appt.verificationCode && !checkInCodes[appt.id]) {
        checkInCodes[appt.id] = appt.verificationCode
      }
    }
  } catch (reason) {
    if (seq === loadSeq && !(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '预约列表加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function selectDatePreset(preset: DatePreset) {
  datePreset.value = preset
  if (preset !== 'custom') {
    page.value = 1
    void loadAppointments()
  }
}

function applySearch() {
  page.value = 1
  void loadAppointments()
}

function resetFilters() {
  datePreset.value = 'all'
  keyword.value = ''
  statusFilter.value = ''
  customFrom.value = todayStr
  customTo.value = addDays(todayStr, 6)
  page.value = 1
  void loadAppointments()
}

function goToPage(nextPage: number) {
  if (loading.value || nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  void loadAppointments()
}

async function lookupTicket() {
  const code = lookupCode.value.trim()
  lookupError.value = ''
  if (!code) {
    lookupError.value = '请输入 10 位核验码或 AP 预约编号。'
    return
  }
  lookupLoading.value = true
  try {
    lookupResult.value = await apiGet<AppointmentLookupView>(
      `/admin/appointments/lookup?code=${encodeURIComponent(code)}`,
      auth.token,
    )
  } catch (reason) {
    lookupResult.value = null
    lookupError.value = reason instanceof Error ? reason.message : '查询票根失败。'
  } finally {
    lookupLoading.value = false
  }
}

async function quickCheckInByCode(explicitCode?: string) {
  const code = (explicitCode ?? lookupCode.value).trim()
  if (!/^[0-9A-Fa-f]{10}$/.test(code)) {
    lookupError.value = '请输入正确的 10 位十六进制入馆核验码。'
    return
  }
  if (mutating.value) return
  mutating.value = true
  lookupError.value = ''
  error.value = ''
  message.value = ''
  try {
    const updated = await apiRequest<AppointmentView>(
      '/admin/appointments/check-in-by-code',
      'POST',
      { verificationCode: code },
      auth.token,
    )
    message.value = `已完成入馆核销：${updated.contactName}（${updated.visitorCount} 人 · ${updated.appointmentNo}）。`
    lookupResult.value = {
      appointment: updated,
      canCheckInNow: false,
      checkInHint: '该预约已完成入馆核销',
    }
    await Promise.all([loadAppointments(), refreshAdminNavCounts(true)])
  } catch (reason) {
    lookupError.value = reason instanceof Error ? reason.message : '快速核销失败。'
  } finally {
    mutating.value = false
  }
}

function clearLookup() {
  lookupCode.value = ''
  lookupError.value = ''
  lookupResult.value = null
}

async function refreshLookupIfMatches(appointmentId: number) {
  if (!lookupResult.value || lookupResult.value.appointment.id !== appointmentId) return
  try {
    lookupResult.value = await apiGet<AppointmentLookupView>(
      `/admin/appointments/lookup?code=${encodeURIComponent(lookupResult.value.appointment.appointmentNo)}`,
      auth.token,
    )
  } catch {
    // Keep existing lookup view untouched if refresh fails
  }
}

async function runAppointmentMutation(
  appointmentId: number,
  path: string,
  body: unknown,
  successText: string,
) {
  if (mutating.value) return
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    await apiRequest(path, 'POST', body, auth.token)
    message.value = successText
    await Promise.all([
      loadAppointments(),
      refreshLookupIfMatches(appointmentId),
      refreshAdminNavCounts(true),
    ])
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '预约操作失败。'
  } finally {
    mutating.value = false
  }
}

async function rowCheckIn(item: AppointmentView) {
  const code = (checkInCodes[item.id] || item.verificationCode || '').trim()
  if (!/^[0-9A-Fa-f]{10}$/.test(code)) {
    error.value = '请输入 10 位十六进制入馆核验码。'
    return
  }
  await runAppointmentMutation(
    item.id,
    `/admin/appointments/${item.id}/check-in`,
    { verificationCode: code },
    `已完成入馆核销：${item.contactName}。`,
  )
}

function requestCancel(item: AppointmentView) {
  confirmation.value = {
    title: '确认取消这条预约？',
    message: `${item.contactName}（${item.visitDate} ${item.startTime.slice(0, 5)} · ${item.visitorCount} 人）的预约将取消，并立即释放对应名额。`,
    confirmLabel: '确认取消',
    run: () => runAppointmentMutation(
      item.id,
      `/admin/appointments/${item.id}/cancel`,
      { reason: '管理员运营取消' },
      '预约已取消并释放名额。',
    ),
  }
}

function requestComplete(item: AppointmentView) {
  confirmation.value = {
    title: '确认将预约标记完成？',
    message: `${item.contactName}（${item.appointmentNo}）将标记为已完成，不能再从待核销列表操作。`,
    confirmLabel: '标记完成',
    run: () => runAppointmentMutation(
      item.id,
      `/admin/appointments/${item.id}/complete`,
      undefined,
      '预约已标记完成。',
    ),
  }
}

async function confirmDialogRun() {
  const current = confirmation.value
  if (!current || confirmationPending.value) return
  confirmationPending.value = true
  try {
    await current.run()
    confirmation.value = null
  } finally {
    confirmationPending.value = false
  }
}

async function exportCsv(todayOnly: boolean) {
  if (exporting.value) return
  exporting.value = true
  error.value = ''
  message.value = ''
  try {
    const params = todayOnly
      ? new URLSearchParams({ visitDate: todayStr })
      : buildFilterParams(false)
    const qs = params.toString()
    const path = qs ? `/admin/appointments/export?${qs}` : '/admin/appointments/export'
    const fallback = todayOnly ? `heluo-appointments-${todayStr}.csv` : 'heluo-appointments.csv'
    const filename = await downloadAdminCsv(path, auth.token, fallback)
    message.value = `已导出名单文件：${filename}`
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '导出名单失败。'
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  void loadAppointments()
})

onBeforeUnmount(() => {
  ++loadSeq
  abortController?.abort()
})
</script>

<template>
  <AdminShell
    v-if="auth.isAdmin"
    title="预约与现场核销"
    description="支持前厅扫码/输码快速核验入馆、全库多维检索筛选与入馆名单 CSV 导出。"
    section="appointments"
  >
    <template #header-actions>
      <button
        type="button"
        class="admin-text-button"
        data-testid="admin-appointments-export-today"
        :disabled="exporting"
        @click="exportCsv(true)"
      >
        导出今日入馆名单
      </button>
      <button
        type="button"
        class="admin-text-button"
        data-testid="admin-appointments-export"
        :disabled="exporting"
        @click="exportCsv(false)"
      >
        导出当前筛选 CSV
      </button>
      <RouterLink class="admin-header-link" to="/admin/slots">排班与时段 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <!-- Quick front-desk check-in station -->
    <section class="checkin-desk-card" data-testid="quick-checkin-desk" aria-label="现场扫码与核验码快速核销台">
      <div class="checkin-desk-card__head">
        <div>
          <h2>现场入馆快核台</h2>
          <p>输入或扫码填入观众票根 10 位核验码或预约编号（AP 开头），即时查验时段状态并完成入馆登记。</p>
        </div>
      </div>

      <form class="checkin-desk-form" @submit.prevent="lookupTicket">
        <input
          v-model.trim="lookupCode"
          type="search"
          class="checkin-desk-input font-mono"
          data-testid="quick-checkin-input"
          maxlength="32"
          placeholder="输入 10 位核验码（如 A1B2C3D4E5）或 AP 预约号"
          aria-label="现场入馆核验码或预约编号"
        />
        <button
          type="submit"
          class="admin-text-button"
          data-testid="quick-checkin-lookup"
          :disabled="lookupLoading || mutating"
        >
          {{ lookupLoading ? '查询中…' : '查询票根' }}
        </button>
        <FluidButton
          type="button"
          data-testid="quick-checkin-direct"
          :disabled="!isHex10Code || mutating"
          :loading="mutating"
          @click="quickCheckInByCode()"
        >
          凭码直接核销
        </FluidButton>
        <button
          v-if="lookupCode || lookupResult"
          type="button"
          class="admin-text-button"
          @click="clearLookup"
        >
          清空
        </button>
      </form>

      <InlineStatus v-if="lookupError" :message="lookupError" kind="error" />

      <div v-if="lookupResult" class="checkin-preview-card" data-testid="quick-checkin-preview">
        <div class="checkin-preview-card__info">
          <div class="admin-record-meta">
            <StatusBadge :status="lookupResult.appointment.status" />
            <span class="font-mono">{{ lookupResult.appointment.appointmentNo }}</span>
            <span class="font-mono">核验码 {{ lookupResult.appointment.verificationCode }}</span>
          </div>
          <h3>
            {{ lookupResult.appointment.contactName }} · {{ lookupResult.appointment.visitorCount }} 人
            <small>{{ lookupResult.appointment.contactPhone }}</small>
          </h3>
          <p>
            参观时段：<strong>{{ lookupResult.appointment.visitDate }} {{ lookupResult.appointment.startTime.slice(0, 5) }}–{{ lookupResult.appointment.endTime.slice(0, 5) }}</strong>
            · {{ lookupResult.checkInHint }}
          </p>
        </div>
        <div class="checkin-preview-card__actions">
          <FluidButton
            v-if="lookupResult.canCheckInNow"
            type="button"
            data-testid="quick-checkin-confirm"
            :loading="mutating"
            @click="quickCheckInByCode(lookupResult.appointment.verificationCode)"
          >
            立即核销入馆
          </FluidButton>
          <AdminActionButton
            v-else-if="lookupResult.appointment.status === 'PENDING'"
            action="confirm"
            :disabled="mutating"
            @click="runAppointmentMutation(
              lookupResult.appointment.id,
              `/admin/appointments/${lookupResult.appointment.id}/confirm`,
              undefined,
              '预约已确认，可继续核销。',
            )"
          >
            先确认预约
          </AdminActionButton>
        </div>
      </div>
    </section>

    <!-- Server-side filters & list -->
    <section class="admin-records" data-glass="light" aria-label="全库预约记录台账">
      <div class="appt-toolbar">
        <div class="dashboard-segmented" data-testid="appt-date-presets" role="group" aria-label="入馆日期快捷筛选">
          <button type="button" :class="{ active: datePreset === 'all' }" @click="selectDatePreset('all')">全部日期</button>
          <button type="button" data-testid="appt-preset-today" :class="{ active: datePreset === 'today' }" @click="selectDatePreset('today')">今日入馆</button>
          <button type="button" :class="{ active: datePreset === 'tomorrow' }" @click="selectDatePreset('tomorrow')">明日入馆</button>
          <button type="button" :class="{ active: datePreset === 'next7d' }" @click="selectDatePreset('next7d')">未来 7 天</button>
          <button type="button" :class="{ active: datePreset === 'custom' }" @click="selectDatePreset('custom')">自定义</button>
        </div>

        <div class="admin-list-filters">
          <template v-if="datePreset === 'custom'">
            <label class="admin-filter-field">
              <span class="admin-filter-field__label">起</span>
              <input v-model="customFrom" type="date" aria-label="筛选起始日期" />
            </label>
            <label class="admin-filter-field">
              <span class="admin-filter-field__label">止</span>
              <input v-model="customTo" type="date" aria-label="筛选结束日期" />
            </label>
          </template>
          <label class="admin-filter-field admin-filter-field--search">
            <span class="admin-filter-field__label">全库搜索</span>
            <input
              v-model.trim="keyword"
              type="search"
              data-testid="appt-search-input"
              placeholder="预约号、姓名、手机号或邮箱"
              @keyup.enter="applySearch"
            />
          </label>
          <label class="admin-filter-field">
            <span class="admin-filter-field__label">状态</span>
            <select v-model="statusFilter" data-testid="appt-status-select" @change="applySearch">
              <option value="">全部状态</option>
              <option value="PENDING">待确认</option>
              <option value="CONFIRMED">已确认</option>
              <option value="COMPLETED">已完成</option>
              <option value="CANCELLED">已取消</option>
            </select>
          </label>
          <button type="button" class="admin-text-button" data-testid="appt-search-btn" @click="applySearch">筛选</button>
          <button type="button" class="admin-text-button" @click="resetFilters">重置</button>
        </div>

        <strong class="admin-count">共 {{ total }} 条</strong>
      </div>

      <div v-if="loading" class="state-panel">正在检索预约记录…</div>
      <div v-else-if="items.length === 0" class="state-panel">当前筛选条件下暂无预约记录。</div>
      <div v-else class="admin-list admin-list--operations" data-testid="appointments-table">
        <article v-for="item in items" :key="item.id">
          <div class="admin-record-copy">
            <div class="admin-record-meta">
              <StatusBadge :status="item.status" />
              <span>{{ item.visitDate }} {{ item.startTime.slice(0, 5) }}–{{ item.endTime.slice(0, 5) }}</span>
              <span class="font-mono">{{ item.appointmentNo }}</span>
            </div>
            <h3>
              {{ item.contactName }} · {{ item.visitorCount }} 人
              <small>{{ item.contactPhone }} · {{ item.contactEmail }}</small>
            </h3>
            <p>
              <template v-if="item.verificationCode">
                核验码 <strong class="font-mono">{{ item.verificationCode }}</strong>
              </template>
              <template v-if="item.notes"> · 备注：{{ item.notes }}</template>
              <template v-if="item.cancelReason"> · 取消原因：{{ item.cancelReason }}</template>
            </p>
          </div>

          <div class="admin-actions">
            <div v-if="item.status === 'CONFIRMED'" class="admin-checkin-inline">
              <input
                v-model.trim="checkInCodes[item.id]"
                class="admin-checkin-input"
                maxlength="10"
                placeholder="10位核验码"
                :aria-label="`${item.contactName} 入馆核验码`"
              />
              <AdminActionButton
                :data-testid="`appt-checkin-${item.id}`"
                :disabled="mutating"
                action="confirm"
                @click="rowCheckIn(item)"
              >
                凭码核销
              </AdminActionButton>
            </div>
            <AdminActionButton
              v-if="item.status === 'PENDING'"
              :disabled="mutating"
              action="confirm"
              @click="runAppointmentMutation(item.id, `/admin/appointments/${item.id}/confirm`, undefined, '预约已确认。')"
            >
              确认
            </AdminActionButton>
            <AdminActionButton
              v-if="item.status === 'PENDING' || item.status === 'CONFIRMED'"
              :disabled="mutating"
              action="cancel"
              @click="requestCancel(item)"
            >
              取消
            </AdminActionButton>
            <AdminActionButton
              v-if="item.status === 'CONFIRMED'"
              :disabled="mutating"
              action="complete"
              @click="requestComplete(item)"
            >
              标记完成
            </AdminActionButton>
          </div>
        </article>

        <nav v-if="totalPages > 1" class="admin-pagination" aria-label="预约列表分页">
          <button type="button" :disabled="loading || page === 1" @click="goToPage(page - 1)">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="loading || page === totalPages" @click="goToPage(page + 1)">下一页</button>
        </nav>
      </div>
    </section>

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
  </AdminShell>
</template>
