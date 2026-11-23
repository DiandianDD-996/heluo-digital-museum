<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ArrowRight, RefreshLeft } from '@element-plus/icons-vue'
import { apiGet, apiRequest, type ContentPage } from '../lib/api'
import InlineStatus from './InlineStatus.vue'
import StatusBadge from './StatusBadge.vue'
import { audioSystem } from '../lib/audioSystem'
import { useLocale } from '../stores/locale'

interface Appointment {
  id: number
  appointmentNo: string
  status: string
  visitorCount: number
  contactName: string
  visitDate: string
  startTime: string
  endTime: string
  cancelReason: string
}

const props = defineProps<{ token: string }>()
const { locale } = useLocale()
const loading = ref(true)
const error = ref('')
const items = ref<Appointment[]>([])
const cancellingId = ref<number | null>(null)
const confirmId = ref<number | null>(null)
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
let requestVersion = 0
let controller: AbortController | undefined

async function load(targetPage = page.value) {
  const version = ++requestVersion
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const result = await apiGet<ContentPage<Appointment>>(`/appointments/me?page=${targetPage}&size=20`, props.token, { signal: controller.signal })
    if (version !== requestVersion) return
    items.value = result.items
    page.value = result.page
    total.value = result.total
    totalPages.value = Math.max(1, result.totalPages)
    confirmId.value = null
  } catch (reason) {
    if (version === requestVersion) error.value = reason instanceof Error ? reason.message : '预约记录加载失败。'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

async function cancel(item: Appointment) {
  if (cancellingId.value !== null) return
  if (confirmId.value !== item.id) {
    confirmId.value = item.id
    return
  }
  cancellingId.value = item.id
  error.value = ''
  try {
    await apiRequest(`/appointments/${item.id}/cancel`, 'POST', { reason: '用户在个人中心取消' }, props.token)
    confirmId.value = null
    void audioSystem.playTransition('dismiss', { volume: 0.24 })
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '预约取消失败。'
  } finally {
    cancellingId.value = null
  }
}

function canCancel(item: Appointment) {
  return new Date(`${item.visitDate}T${item.startTime}+08:00`).getTime() - Date.now() > 2 * 60 * 60 * 1000
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat(locale.value === 'en-US' ? 'en-US' : 'zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date)
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'en-US' ? 'en-US' : 'zh-CN', { month: 'short' }).format(new Date(`${value}T00:00:00`))
}

onMounted(load)
onBeforeUnmount(() => { requestVersion++; controller?.abort() })
</script>

<template>
  <section class="profile-record-section" aria-labelledby="profile-appointments-title">
    <header class="profile-record-heading">
      <div>
        <p class="eyebrow">{{ locale === 'en-US' ? 'VISIT ARCHIVE' : 'VISIT ARCHIVE · 参观档案' }}</p>
        <h2 id="profile-appointments-title">{{ locale === 'en-US' ? 'Visit bookings' : '预约记录' }}</h2>
        <p class="profile-record-count">{{ locale === 'en-US' ? `${total} bookings` : `共 ${total} 条预约` }}</p>
      </div>
      <button class="profile-record-retry" type="button" :disabled="loading || cancellingId !== null" @click="load()" :aria-label="locale === 'en-US' ? 'Refresh visit bookings' : '刷新预约记录'">
        <RefreshLeft aria-hidden="true" />
        <span>{{ locale === 'en-US' ? 'Refresh' : '刷新' }}</span>
      </button>
    </header>

    <div v-if="loading" class="state-panel">{{ locale === 'en-US' ? 'Loading visit bookings…' : '正在加载预约记录…' }}</div>
    <div v-else-if="error" class="state-panel state-panel--action">
      <InlineStatus kind="error" :message="error" />
      <button class="fluid-button fluid-button--secondary" type="button" @click="load()">{{ locale === 'en-US' ? 'Reload' : '重新加载' }}</button>
    </div>
    <div v-else-if="!items.length" class="state-panel">
      <p>{{ locale === 'en-US' ? 'No visit bookings yet.' : '还没有预约记录。' }}</p>
      <RouterLink class="profile-record-link" to="/appointment">{{ locale === 'en-US' ? 'Book a visit →' : '去预约参观 →' }}</RouterLink>
    </div>
    <div v-else class="profile-record-list">
      <article v-for="item in items" :key="item.id" class="profile-record-card profile-record-card--appointment">
        <div class="profile-record-card__date">
          <strong class="font-mono">{{ item.visitDate.slice(8, 10) }}</strong>
          <span>{{ formatMonth(item.visitDate) }}</span>
        </div>
        <div class="profile-record-card__body">
          <span class="profile-record-kicker font-mono">{{ item.appointmentNo }}</span>
          <h3>{{ formatDate(item.visitDate) }}</h3>
          <p class="profile-record-time font-mono">{{ item.startTime.slice(0, 5) }}–{{ item.endTime.slice(0, 5) }} · {{ item.contactName }} · {{ item.visitorCount }} {{ locale === 'en-US' ? 'people' : '人' }}</p>
        </div>
        <div class="profile-record-actions">
          <StatusBadge :status="item.status" />
          <template v-if="(item.status === 'PENDING' || item.status === 'CONFIRMED') && canCancel(item)">
            <button v-if="confirmId !== item.id" class="profile-cancel-btn" type="button" @click="cancel(item)">{{ locale === 'en-US' ? 'Cancel booking' : '取消预约' }}</button>
            <button v-else class="profile-cancel-btn is-confirm" type="button" :disabled="cancellingId === item.id" @click="cancel(item)">{{ cancellingId === item.id ? (locale === 'en-US' ? 'Working…' : '处理中…') : (locale === 'en-US' ? 'Click again to confirm' : '再次点击确认') }}</button>
          </template>
        </div>
      </article>
    </div>

    <nav v-if="totalPages > 1" class="profile-record-pagination" :aria-label="locale === 'en-US' ? 'Visit booking pages' : '预约记录分页'">
      <button type="button" :disabled="page <= 1 || loading || cancellingId !== null" :aria-label="locale === 'en-US' ? 'Previous booking page' : '上一页预约记录'" @click="load(page - 1)"><ArrowLeft aria-hidden="true" /></button>
      <span class="font-mono" aria-current="page">{{ page }} / {{ totalPages }}</span>
      <button type="button" :disabled="page >= totalPages || loading || cancellingId !== null" :aria-label="locale === 'en-US' ? 'Next booking page' : '下一页预约记录'" @click="load(page + 1)"><ArrowRight aria-hidden="true" /></button>
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

/* Ticket-Stub Appointment Card */
.profile-record-card--appointment {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
}

.profile-record-card__date {
  display: grid;
  place-items: center;
  padding: var(--space-2);
  border-right: 1px dashed var(--border-strong);
  text-align: center;
}

.profile-record-card__date strong {
  font-size: var(--text-2xl);
  line-height: 1.1;
  color: var(--ink-primary);
}

.profile-record-card__date span {
  font-size: var(--text-xs);
  color: var(--accent-bronze);
}

.profile-record-card__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.profile-record-kicker {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.profile-record-card__body h3 {
  font-family: var(--font-display);
  font-size: var(--text-md);
}

.profile-record-time {
  font-size: var(--text-xs);
  color: var(--ink-secondary);
}

.profile-record-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.profile-cancel-btn {
  min-height: 34px;
  padding: 0 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}

.profile-cancel-btn.is-confirm {
  border-color: var(--accent-seal);
  background: var(--accent-seal);
  color: var(--accent-seal-ink);
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

@media (max-width: 640px) {
  .profile-record-card--appointment {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  .profile-record-actions {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-hairline);
  }
}
</style>
