<script setup lang="ts">
import '../styles/07-admin.css'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, type ContentPage } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import AdminShell from '../components/AdminShell.vue'
import InlineStatus from '../components/InlineStatus.vue'

interface OperationLogRow {
  id: number
  actorUserId: number | null
  actorUsername: string
  module: string
  action: string
  targetType: string
  targetId: string | null
  createdAt: string
}

const MODULES = [
  { value: '', label: '全部模块' },
  { value: 'CONTENT', label: '内容与分类' },
  { value: 'APPOINTMENT', label: '预约与排班' },
  { value: 'STORE', label: '文创与订单' },
  { value: 'ORDER', label: '用户下单' },
  { value: 'USER', label: '账号管理' },
  { value: 'GUIDE', label: '洛笙 AI' },
]

const auth = useAuthStore()
const router = useRouter()

const items = ref<OperationLogRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const moduleFilter = ref('')
const keyword = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(true)
const error = ref('')

let loadSeq = 0
let abortController: AbortController | undefined

function formatTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
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
    const params = new URLSearchParams({
      page: String(page.value),
      size: '20',
    })
    if (moduleFilter.value) params.set('module', moduleFilter.value)
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
    if (dateFrom.value) params.set('dateFrom', dateFrom.value)
    if (dateTo.value) params.set('dateTo', dateTo.value)

    const data = await apiGet<ContentPage<OperationLogRow>>(
      `/admin/operation-logs?${params.toString()}`,
      auth.token,
      { signal: controller.signal },
    )
    if (seq !== loadSeq) return
    items.value = data.items
    total.value = data.total
    totalPages.value = Math.max(1, data.totalPages)
  } catch (reason) {
    if (seq === loadSeq && !(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '审计日志加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function selectModule(mod: string) {
  moduleFilter.value = mod
  page.value = 1
  void load()
}

function applySearch() {
  page.value = 1
  void load()
}

function resetFilters() {
  moduleFilter.value = ''
  keyword.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  void load()
}

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  ++loadSeq
  abortController?.abort()
})
</script>

<template>
  <AdminShell
    v-if="auth.isAdmin"
    title="系统审计日志"
    description="按业务模块、操作人与日期追踪内容、排班、商城、账号及洛笙治理的关键审计轨迹。"
    section="logs"
  >
    <template #header-actions>
      <RouterLink class="admin-header-link" to="/admin">返回运营看板 →</RouterLink>
    </template>

    <InlineStatus :message="error" kind="error" />

    <section class="admin-records" data-glass="light">
      <div class="appt-toolbar">
        <div class="dashboard-segmented" data-testid="logs-module-switch" role="group" aria-label="日志模块筛选">
          <button
            v-for="mod in MODULES"
            :key="mod.value || 'ALL'"
            type="button"
            :class="{ active: moduleFilter === mod.value }"
            @click="selectModule(mod.value)"
          >
            {{ mod.label }}
          </button>
        </div>

        <div class="admin-list-filters">
          <label class="admin-filter-field">
            <span class="admin-filter-field__label">起</span>
            <input v-model="dateFrom" type="date" aria-label="日志起始日期" />
          </label>
          <label class="admin-filter-field">
            <span class="admin-filter-field__label">止</span>
            <input v-model="dateTo" type="date" aria-label="日志结束日期" />
          </label>
          <label class="admin-filter-field admin-filter-field--search">
            <span class="admin-filter-field__label">检索日志</span>
            <input
              v-model.trim="keyword"
              type="search"
              data-testid="logs-search-input"
              placeholder="操作人、动作或目标编号"
              @keyup.enter="applySearch"
            />
          </label>
          <button type="button" class="admin-text-button" data-testid="logs-search-btn" @click="applySearch">筛选</button>
          <button type="button" class="admin-text-button" @click="resetFilters">重置</button>
        </div>

        <strong class="admin-count">共 {{ total }} 条</strong>
      </div>

      <div v-if="loading" class="state-panel">正在查询系统审计日志…</div>
      <div v-else-if="items.length === 0" class="state-panel">当前筛选条件下暂无审计日志。</div>
      <div v-else class="admin-list admin-table--logs" data-testid="logs-table">
        <div class="admin-list-head" aria-hidden="true">
          <span>操作时间</span>
          <span>操作账号</span>
          <span>业务模块</span>
          <span>执行动作</span>
          <span>目标对象</span>
        </div>

        <article v-for="item in items" :key="item.id" data-glass="compact">
          <div class="admin-table-cell">
            <span class="font-mono">{{ formatTime(item.createdAt) }}</span>
          </div>
          <div class="admin-table-cell">
            <strong>{{ item.actorUsername }}</strong>
          </div>
          <div>
            <span class="admin-pill-tag font-mono">{{ item.module }}</span>
          </div>
          <div class="admin-table-cell">
            <span class="font-mono">{{ item.action }}</span>
          </div>
          <div class="admin-table-cell">
            <span class="font-mono">{{ item.targetType }} #{{ item.targetId || '—' }}</span>
          </div>
        </article>

        <nav v-if="totalPages > 1" class="admin-pagination" aria-label="审计日志分页">
          <button type="button" :disabled="loading || page === 1" @click="page -= 1; load()">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="loading || page === totalPages" @click="page += 1; load()">下一页</button>
        </nav>
      </div>
    </section>
  </AdminShell>
</template>
