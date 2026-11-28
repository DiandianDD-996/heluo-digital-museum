<script setup lang="ts">
import '../styles/07-admin.css'
import { onBeforeUnmount, onMounted, ref } from 'vue'
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

interface OrderRow {
  id: number
  orderNo: string
  userId: number
  status: 'PENDING_PAYMENT' | 'PAID' | 'COMPLETED' | 'CANCELLED'
  payableAmount: string
  notificationEmail: string
  createdAt: string
}

interface OrderItemDetail {
  productId: number
  sku: string
  name: string
  coverImageUrl: string
  unitPrice: string
  quantity: number
  subtotalAmount: string
}

interface OrderDetailView {
  id: number
  orderNo: string
  userId: number
  username: string
  userNickname: string
  status: 'PENDING_PAYMENT' | 'PAID' | 'COMPLETED' | 'CANCELLED'
  payableAmount: string
  notificationEmail: string
  cancelReason: string
  paymentNo: string
  createdAt: string
  expiresAt: string
  paidAt: string
  completedAt: string
  cancelledAt: string
  items: OrderItemDetail[]
}

const auth = useAuthStore()
const router = useRouter()

const items = ref<OrderRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const statusFilter = ref('')
const keyword = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(true)
const mutating = ref(false)
const exporting = ref(false)
const error = ref('')
const message = ref('')

// Detail drawer
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailOrder = ref<OrderDetailView | null>(null)
const confirmationPending = ref(false)
const confirmation = ref<{ title: string; message: string; confirmLabel: string; run: () => Promise<void> } | null>(null)

let loadSeq = 0
let abortController: AbortController | undefined

function formatTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

function buildParams(withPage: boolean): URLSearchParams {
  const params = new URLSearchParams()
  if (withPage) {
    params.set('page', String(page.value))
    params.set('size', '20')
  }
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value) params.set('dateTo', dateTo.value)
  return params
}

async function load() {
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
    const data = await apiGet<ContentPage<OrderRow>>(
      `/admin/orders?${buildParams(true).toString()}`,
      auth.token,
      { signal: controller.signal },
    )
    if (seq !== loadSeq) return
    items.value = data.items
    total.value = data.total
    totalPages.value = Math.max(1, data.totalPages)
  } catch (reason) {
    if (seq === loadSeq && !(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '商城订单加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

async function openDetail(orderId: number) {
  detailOpen.value = true
  detailLoading.value = true
  error.value = ''
  try {
    detailOrder.value = await apiGet<OrderDetailView>(`/admin/orders/${orderId}`, auth.token)
  } catch (reason) {
    detailOrder.value = null
    error.value = reason instanceof Error ? reason.message : '加载订单明细失败。'
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  detailOrder.value = null
}

function requestComplete(orderId: number, orderNo: string) {
  confirmation.value = {
    title: '确认完成该订单履约？',
    message: `订单 ${orderNo} 将标记为「已完成」，之后不可再回退至待履约状态。`,
    confirmLabel: '确认完成',
    run: async () => {
      mutating.value = true
      error.value = ''
      message.value = ''
      try {
        await apiRequest(`/admin/orders/${orderId}/complete`, 'POST', undefined, auth.token)
        message.value = `订单 ${orderNo} 已标记完成。`
        await Promise.all([
          load(),
          detailOpen.value && detailOrder.value?.id === orderId ? openDetail(orderId) : Promise.resolve(),
          refreshAdminNavCounts(true),
        ])
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : '订单完成操作失败。'
      } finally {
        mutating.value = false
      }
    },
  }
}

async function confirmRun() {
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

async function exportCsv() {
  if (exporting.value) return
  exporting.value = true
  error.value = ''
  message.value = ''
  try {
    const qs = buildParams(false).toString()
    const path = qs ? `/admin/orders/export?${qs}` : '/admin/orders/export'
    const filename = await downloadAdminCsv(path, auth.token, 'heluo-orders.csv')
    message.value = `已导出订单台账：${filename}`
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '导出订单失败。'
  } finally {
    exporting.value = false
  }
}

function selectStatus(status: string) {
  statusFilter.value = status
  page.value = 1
  void load()
}

function applySearch() {
  page.value = 1
  void load()
}

function resetFilters() {
  statusFilter.value = ''
  keyword.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  void load()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && detailOpen.value && !confirmation.value) {
    closeDetail()
  }
}

onMounted(() => {
  void load()
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
    title="商城订单管理"
    description="支持全库订单检索、明细与流转时间轴抽屉核查、履约标记及 CSV 对账导出。"
    section="orders"
  >
    <template #header-actions>
      <button
        type="button"
        class="admin-text-button"
        data-testid="admin-orders-export"
        :disabled="exporting"
        @click="exportCsv"
      >
        导出订单 CSV
      </button>
      <RouterLink class="admin-header-link" to="/admin/products">文创商品 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <section class="admin-records" data-glass="light">
      <div class="appt-toolbar">
        <div class="dashboard-segmented" role="group" aria-label="订单状态预设">
          <button type="button" :class="{ active: statusFilter === '' }" @click="selectStatus('')">全部</button>
          <button type="button" :class="{ active: statusFilter === 'PENDING_PAYMENT' }" @click="selectStatus('PENDING_PAYMENT')">待支付</button>
          <button type="button" :class="{ active: statusFilter === 'PAID' }" @click="selectStatus('PAID')">已支付</button>
          <button type="button" :class="{ active: statusFilter === 'COMPLETED' }" @click="selectStatus('COMPLETED')">已完成</button>
          <button type="button" :class="{ active: statusFilter === 'CANCELLED' }" @click="selectStatus('CANCELLED')">已取消</button>
        </div>

        <div class="admin-list-filters">
          <label class="admin-filter-field">
            <span class="admin-filter-field__label">起</span>
            <input v-model="dateFrom" type="date" aria-label="订单起始日期" />
          </label>
          <label class="admin-filter-field">
            <span class="admin-filter-field__label">止</span>
            <input v-model="dateTo" type="date" aria-label="订单结束日期" />
          </label>
          <label class="admin-filter-field admin-filter-field--search">
            <span class="admin-filter-field__label">检索订单</span>
            <input
              v-model.trim="keyword"
              type="search"
              data-testid="orders-search-input"
              placeholder="订单号、通知邮箱或用户"
              @keyup.enter="applySearch"
            />
          </label>
          <button type="button" class="admin-text-button" data-testid="orders-search-btn" @click="applySearch">筛选</button>
          <button type="button" class="admin-text-button" @click="resetFilters">重置</button>
        </div>

        <strong class="admin-count">共 {{ total }} 笔</strong>
      </div>

      <div v-if="loading" class="state-panel">正在加载商城订单…</div>
      <div v-else-if="items.length === 0" class="state-panel">暂无符合条件的商城订单。</div>
      <div v-else class="admin-list admin-table--orders" data-testid="orders-table">
        <div class="admin-list-head" aria-hidden="true">
          <span>状态</span>
          <span>订单编号与下单时间</span>
          <span>应付金额</span>
          <span>通知邮箱</span>
          <span>操作</span>
        </div>

        <article v-for="item in items" :key="item.id" data-glass="compact">
          <div class="admin-record-status">
            <StatusBadge :status="item.status" />
          </div>
          <div class="admin-record-copy">
            <h3 class="font-mono">{{ item.orderNo }}</h3>
            <p>{{ formatTime(item.createdAt) }}</p>
          </div>
          <div class="admin-table-cell">
            <strong class="admin-price-val">¥ {{ item.payableAmount }}</strong>
            <small>模拟支付</small>
          </div>
          <div class="admin-table-cell">
            <span>{{ item.notificationEmail }}</span>
          </div>
          <div class="admin-actions">
            <button
              type="button"
              class="admin-text-button admin-text-button--compact"
              :data-testid="`order-detail-btn-${item.id}`"
              @click="openDetail(item.id)"
            >
              查看详情
            </button>
            <AdminActionButton
              v-if="item.status === 'PAID'"
              action="complete"
              :disabled="mutating"
              @click="requestComplete(item.id, item.orderNo)"
            >
              标记完成
            </AdminActionButton>
          </div>
        </article>

        <nav v-if="totalPages > 1" class="admin-pagination" aria-label="订单分页">
          <button type="button" :disabled="loading || page === 1" @click="page -= 1; load()">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="loading || page === totalPages" @click="page += 1; load()">下一页</button>
        </nav>
      </div>
    </section>

    <div v-if="detailOpen" class="admin-drawer-backdrop" @click.self="closeDetail">
      <aside class="admin-drawer admin-drawer--wide" data-testid="admin-order-detail-drawer" role="region" aria-label="订单明细与流转详情">
        <header class="admin-drawer__head">
          <div class="admin-drawer__title">
            <h2>{{ detailOrder ? `订单详情 · ${detailOrder.orderNo}` : '订单详情' }}</h2>
          </div>
          <button type="button" class="admin-drawer__close" aria-label="关闭订单详情抽屉" @click="closeDetail">×</button>
        </header>

        <div class="admin-drawer__body">
          <div v-if="detailLoading" class="state-panel">正在加载订单商品明细与流转记录…</div>
          <template v-else-if="detailOrder">
            <section class="order-detail-summary">
              <div>
                <span>当前状态</span>
                <StatusBadge :status="detailOrder.status" />
              </div>
              <div>
                <span>应付总额</span>
                <strong class="admin-price-val">¥ {{ detailOrder.payableAmount }}</strong>
              </div>
              <div>
                <span>下单观众</span>
                <strong>{{ detailOrder.userNickname || '观众' }}（@{{ detailOrder.username || detailOrder.userId }}）</strong>
              </div>
              <div>
                <span>通知邮箱</span>
                <strong>{{ detailOrder.notificationEmail }}</strong>
              </div>
              <div v-if="detailOrder.paymentNo">
                <span>模拟支付流水</span>
                <strong class="font-mono">{{ detailOrder.paymentNo }}</strong>
              </div>
              <div v-if="detailOrder.cancelReason">
                <span>取消说明</span>
                <strong>{{ detailOrder.cancelReason }}</strong>
              </div>
            </section>

            <section class="order-detail-block">
              <h3>订单流转时间轴</h3>
              <ol class="order-timeline">
                <li class="is-done">
                  <b>提交订单</b>
                  <span>{{ formatTime(detailOrder.createdAt) }}</span>
                </li>
                <li :class="detailOrder.paidAt ? 'is-done' : (detailOrder.cancelledAt ? 'is-muted' : 'is-pending')">
                  <b>{{ detailOrder.paidAt ? '模拟支付完成' : (detailOrder.cancelledAt ? '未完成支付' : '等待模拟支付') }}</b>
                  <span>{{ detailOrder.paidAt ? formatTime(detailOrder.paidAt) : `截止 ${formatTime(detailOrder.expiresAt)}` }}</span>
                </li>
                <li v-if="detailOrder.cancelledAt" class="is-cancelled">
                  <b>订单已取消</b>
                  <span>{{ formatTime(detailOrder.cancelledAt) }}</span>
                </li>
                <li v-else :class="detailOrder.completedAt ? 'is-done' : 'is-pending'">
                  <b>{{ detailOrder.completedAt ? '履约已完成' : '待馆方标记完成' }}</b>
                  <span>{{ detailOrder.completedAt ? formatTime(detailOrder.completedAt) : '等待核对发货/领用' }}</span>
                </li>
              </ol>
            </section>

            <section class="order-detail-block">
              <h3>商品明细（{{ detailOrder.items.length }} 项）</h3>
              <ul class="order-item-list">
                <li v-for="item in detailOrder.items" :key="`${item.productId}-${item.sku}`" class="order-item-row">
                  <img v-if="item.coverImageUrl" :src="item.coverImageUrl" :alt="item.name" class="admin-product-thumb" />
                  <div class="order-item-row__copy">
                    <strong>{{ item.name }}</strong>
                    <small class="font-mono">{{ item.sku }} · 单价 ¥ {{ item.unitPrice }} × {{ item.quantity }}</small>
                  </div>
                  <strong class="order-item-row__sub">¥ {{ item.subtotalAmount }}</strong>
                </li>
              </ul>
            </section>

            <div v-if="detailOrder.status === 'PAID'" class="admin-form-actions">
              <FluidButton type="button" block :loading="mutating" @click="requestComplete(detailOrder.id, detailOrder.orderNo)">
                标记该订单已完成
              </FluidButton>
            </div>
          </template>
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
      @confirm="confirmRun"
      @cancel="confirmation = null"
    />
  </AdminShell>
</template>
