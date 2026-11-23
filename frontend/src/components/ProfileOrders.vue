<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ArrowRight, RefreshLeft } from '@element-plus/icons-vue'
import { apiGet, apiRequest, type ContentPage } from '../lib/api'
import InlineStatus from './InlineStatus.vue'
import FluidButton from './FluidButton.vue'
import StatusBadge from './StatusBadge.vue'
import { useLocale } from '../stores/locale'

interface OrderItem { productId: number; name: string; quantity: number; subtotalAmount: string }
interface Order { id: number; orderNo: string; status: string; payableAmount: string; notificationEmail: string; expiresAt: string; items: OrderItem[] }

const props = defineProps<{ token: string }>()
const { locale } = useLocale()
const loading = ref(true)
const error = ref('')
const message = ref('')
const items = ref<Order[]>([])
const payingId = ref<number | null>(null)
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
let requestVersion = 0
let controller: AbortController | undefined

function paymentKey(orderId: number) {
  const storageKey = `heluo.payment-key.${orderId}`
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing
  const next = crypto.randomUUID()
  localStorage.setItem(storageKey, next)
  return next
}

async function load(targetPage = page.value) {
  const version = ++requestVersion
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const result = await apiGet<ContentPage<Order>>(`/orders?page=${targetPage}&size=20`, props.token, { signal: controller.signal })
    if (version !== requestVersion) return
    items.value = result.items
    page.value = result.page
    total.value = result.total
    totalPages.value = Math.max(1, result.totalPages)
  } catch (reason) {
    if (version === requestVersion) error.value = reason instanceof Error ? reason.message : '订单记录加载失败。'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

async function reconcile(orderId: number) {
  const server = await apiGet<Order>(`/orders/${orderId}`, props.token)
  const index = items.value.findIndex((item) => item.id === orderId)
  if (index >= 0) items.value[index] = server
  return server
}

async function pay(order: Order) {
  if (payingId.value !== null) return
  payingId.value = order.id
  message.value = ''
  error.value = ''
  try {
    const updated = await apiRequest<Order>(`/orders/${order.id}/mock-payment`, 'POST', undefined, props.token, { 'Idempotency-Key': paymentKey(order.id) })
    const index = items.value.findIndex((item) => item.id === order.id)
    if (index >= 0) items.value[index] = updated
    localStorage.removeItem(`heluo.payment-key.${order.id}`)
    message.value = locale.value === 'en-US' ? `Mock payment completed for ${updated.orderNo}.` : `订单 ${updated.orderNo} 已完成模拟支付。`
  } catch (reason) {
    try {
      const server = await reconcile(order.id)
      if (['PAID', 'COMPLETED'].includes(server.status)) {
        localStorage.removeItem(`heluo.payment-key.${order.id}`)
        message.value = locale.value === 'en-US' ? `Payment confirmed for ${server.orderNo}.` : `已确认订单 ${server.orderNo} 支付成功。`
        return
      }
    } catch { /* keep the original recoverable message */ }
    error.value = reason instanceof Error ? reason.message : '支付未完成，请稍后重试。'
  } finally {
    payingId.value = null
  }
}

onMounted(load)
onBeforeUnmount(() => { requestVersion++; controller?.abort() })

function formatDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale.value === 'en-US' ? 'en-US' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}
</script>

<template>
  <section class="profile-record-section" aria-labelledby="profile-orders-title">
    <header class="profile-record-heading">
      <div>
        <p class="eyebrow">{{ locale === 'en-US' ? 'STORE LEDGER' : 'STORE LEDGER · 文创账簿' }}</p>
        <h2 id="profile-orders-title">{{ locale === 'en-US' ? 'Store orders' : '订单记录' }}</h2>
        <p class="profile-record-count">{{ locale === 'en-US' ? `${total} orders` : `共 ${total} 条订单` }}</p>
      </div>
      <button class="profile-record-retry" type="button" :disabled="loading || payingId !== null" @click="load()" :aria-label="locale === 'en-US' ? 'Refresh store orders' : '刷新订单记录'">
        <RefreshLeft aria-hidden="true" />
        <span>{{ locale === 'en-US' ? 'Refresh' : '刷新' }}</span>
      </button>
    </header>

    <InlineStatus v-if="message" kind="success" :message="message" />
    <InlineStatus v-if="error" kind="error" :message="error" />

    <div v-if="loading" class="state-panel">{{ locale === 'en-US' ? 'Loading store orders…' : '正在加载订单记录…' }}</div>
    <div v-else-if="!items.length && !error" class="state-panel">
      <p>{{ locale === 'en-US' ? 'No store orders yet.' : '还没有订单记录。' }}</p>
      <RouterLink class="profile-record-link" to="/shop">{{ locale === 'en-US' ? 'Browse the store →' : '去文创商城 →' }}</RouterLink>
    </div>
    <div v-else class="profile-record-list">
      <article v-for="item in items" :key="item.id" class="profile-record-card profile-record-card--order">
        <div class="profile-record-card__body">
          <span class="profile-record-kicker font-mono">{{ item.orderNo }}</span>
          <h3 class="font-mono"><span class="order-amount-label">{{ locale === 'en-US' ? 'Total' : '订单金额' }}</span> ¥ {{ item.payableAmount }}</h3>
          <p class="profile-order-items">{{ item.items.map((line) => `${line.name} × ${line.quantity}`).join(locale === 'en-US' ? ', ' : '、') }}</p>
          <small class="profile-order-email">{{ item.notificationEmail }}</small>
        </div>
        <div class="profile-record-actions">
          <StatusBadge :status="item.status" />
          <template v-if="item.status === 'PENDING_PAYMENT'">
            <small v-if="item.expiresAt" class="order-deadline">
              {{ locale === 'en-US' ? 'Pay by' : '支付截止' }} <time class="font-mono" :datetime="item.expiresAt">{{ formatDeadline(item.expiresAt) }}</time>
            </small>
            <FluidButton size="sm" :disabled="payingId !== null && payingId !== item.id" :loading="payingId === item.id" @click="pay(item)">
              {{ locale === 'en-US' ? 'Continue payment' : '继续支付' }}
            </FluidButton>
          </template>
        </div>
      </article>
    </div>

    <nav v-if="totalPages > 1" class="profile-record-pagination" :aria-label="locale === 'en-US' ? 'Order pages' : '订单记录分页'">
      <button type="button" :disabled="page <= 1 || loading || payingId !== null" :aria-label="locale === 'en-US' ? 'Previous order page' : '上一页订单记录'" @click="load(page - 1)"><ArrowLeft aria-hidden="true" /></button>
      <span class="font-mono" aria-current="page">{{ page }} / {{ totalPages }}</span>
      <button type="button" :disabled="page >= totalPages || loading || payingId !== null" :aria-label="locale === 'en-US' ? 'Next order page' : '下一页订单记录'" @click="load(page + 1)"><ArrowRight aria-hidden="true" /></button>
    </nav>
  </section>
</template>

<style scoped>
.profile-record-section {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
}

.profile-record-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-hairline);
}

.profile-record-heading h2 {
  margin: 2px 0;
  font-size: var(--text-xl);
}

.profile-record-count {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.profile-record-retry {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0 0.875rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.profile-record-retry:hover:not(:disabled) {
  color: var(--ink-primary);
  border-color: var(--ink-muted);
}

.profile-record-retry svg {
  width: 14px;
  height: 14px;
}

.profile-record-link {
  color: var(--accent-jade);
  font-size: var(--text-sm);
  font-weight: 600;
}

.profile-record-list {
  display: grid;
  gap: var(--space-3);
}

.profile-record-card--order {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
}

.profile-record-card__body {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.profile-record-kicker {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.profile-record-card__body h3 {
  font-size: var(--text-lg);
  color: var(--ink-primary);
}

.order-amount-label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-muted);
}

.profile-order-items {
  font-size: var(--text-sm);
  color: var(--ink-secondary);
}

.profile-order-email,
.order-deadline {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.profile-record-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.profile-record-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.profile-record-pagination button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.profile-record-pagination button svg {
  width: 15px;
  height: 15px;
}
</style>
