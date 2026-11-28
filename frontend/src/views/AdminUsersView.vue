<script setup lang="ts">
import '../styles/07-admin.css'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, apiRequest, type ContentPage } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useUnsavedChanges } from '../composables/useUnsavedChanges'
import AdminShell from '../components/AdminShell.vue'
import FluidButton from '../components/FluidButton.vue'
import InlineStatus from '../components/InlineStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AdminActionButton from '../components/AdminActionButton.vue'
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue'

interface UserRow {
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  status: 'ACTIVE' | 'DISABLED'
  roles: string[]
  createdAt: string
}

const auth = useAuthStore()
const router = useRouter()

const items = ref<UserRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const statusFilter = ref('')
const keyword = ref('')
const loading = ref(true)
const mutating = ref(false)
const error = ref('')
const message = ref('')

const drawerOpen = ref(false)
const formElement = ref<HTMLFormElement | null>(null)
const baseline = ref('')
const confirmationPending = ref(false)
const confirmation = ref<{ title: string; message: string; confirmLabel: string; run: () => Promise<void> } | null>(null)

const form = reactive({
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
})

let loadSeq = 0
let abortController: AbortController | undefined

const unsaved = useUnsavedChanges({
  value: () => form,
  dirty: () => drawerOpen.value && JSON.stringify(form) !== baseline.value,
  save: createUser,
  discard: resetAndClose,
  blocked: () => mutating.value,
})

function formatTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
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
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())

    const data = await apiGet<ContentPage<UserRow>>(
      `/admin/users?${params.toString()}`,
      auth.token,
      { signal: controller.signal },
    )
    if (seq !== loadSeq) return
    items.value = data.items
    total.value = data.total
    totalPages.value = Math.max(1, data.totalPages)
  } catch (reason) {
    if (seq === loadSeq && !(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '观众账号列表加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function resetAndClose() {
  Object.assign(form, { username: '', password: '', nickname: '', email: '', phone: '' })
  baseline.value = JSON.stringify(form)
  drawerOpen.value = false
  unsaved.markClean()
}

function openCreate() {
  void unsaved.attempt(() => {
    resetAndClose()
    error.value = ''
    drawerOpen.value = true
  })
}

function closeDrawer() {
  if (!drawerOpen.value || mutating.value) return
  void unsaved.attempt(() => {
    resetAndClose()
  })
}

async function createUser(): Promise<boolean> {
  if (mutating.value) return false
  if (formElement.value && !formElement.value.reportValidity()) {
    error.value = '请按格式要求补全用户名、密码与昵称。'
    return false
  }
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    await apiRequest('/admin/users', 'POST', { ...form }, auth.token)
    message.value = `普通观众账号 @${form.username} 已创建。`
    resetAndClose()
    await load()
    return true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '创建观众账号失败。'
    return false
  } finally {
    mutating.value = false
  }
}

async function mutate(path: string, method: 'POST' | 'PATCH', body: unknown, successText: string) {
  if (mutating.value) return
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    await apiRequest(path, method, body, auth.token)
    message.value = successText
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '账号操作失败。'
  } finally {
    mutating.value = false
  }
}

function requestDisable(user: UserRow) {
  confirmation.value = {
    title: '确认禁用该观众账号？',
    message: `${user.nickname}（@${user.username}）将无法登录，现有会话也会失效。`,
    confirmLabel: '确认禁用',
    run: () => mutate(`/admin/users/${user.id}/status`, 'PATCH', { status: 'DISABLED' }, `账号 @${user.username} 已禁用。`),
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
  page.value = 1
  void load()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drawerOpen.value && !confirmation.value && !unsaved.open.value) {
    closeDrawer()
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
    title="观众账号治理"
    description="检索全馆注册观众账号，支持账户启禁用治理、安全重置邮件发送及后台建号。"
    section="users"
  >
    <template #header-actions>
      <button type="button" class="admin-primary-btn" data-testid="admin-users-create" @click="openCreate">
        + 新建观众账号
      </button>
      <RouterLink class="admin-header-link" to="/admin/logs">审计日志 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <section class="admin-records" data-glass="light">
      <div class="appt-toolbar">
        <div class="dashboard-segmented" role="group" aria-label="账号状态筛选">
          <button type="button" :class="{ active: statusFilter === '' }" @click="selectStatus('')">全部状态</button>
          <button type="button" data-testid="users-status-active" :class="{ active: statusFilter === 'ACTIVE' }" @click="selectStatus('ACTIVE')">已启用</button>
          <button type="button" :class="{ active: statusFilter === 'DISABLED' }" @click="selectStatus('DISABLED')">已禁用</button>
        </div>

        <div class="admin-list-filters">
          <label class="admin-filter-field admin-filter-field--search">
            <span class="admin-filter-field__label">检索用户</span>
            <input
              v-model.trim="keyword"
              type="search"
              data-testid="users-search-input"
              placeholder="用户名、昵称、邮箱或手机号"
              @keyup.enter="applySearch"
            />
          </label>
          <button type="button" class="admin-text-button" data-testid="users-search-btn" @click="applySearch">筛选</button>
          <button type="button" class="admin-text-button" @click="resetFilters">重置</button>
        </div>

        <strong class="admin-count">共 {{ total }} 位</strong>
      </div>

      <div v-if="loading" class="state-panel">正在查询观众账号…</div>
      <div v-else-if="items.length === 0" class="state-panel">暂无符合条件的观众账号。</div>
      <div v-else class="admin-list admin-table--users" data-testid="users-table">
        <div class="admin-list-head" aria-hidden="true">
          <span>状态</span>
          <span>账号与角色</span>
          <span>联系方式</span>
          <span>注册日期</span>
          <span>操作</span>
        </div>

        <article v-for="item in items" :key="item.id" data-glass="compact">
          <div class="admin-record-status">
            <StatusBadge :status="item.status" />
          </div>
          <div class="admin-record-copy">
            <h3>
              {{ item.nickname }}
              <small class="font-mono">@{{ item.username }}</small>
            </h3>
            <p class="font-mono">{{ item.roles.join(' · ') }}</p>
          </div>
          <div class="admin-table-cell">
            <span>{{ item.email || '未绑定邮箱' }}</span>
            <small v-if="item.phone">{{ item.phone }}</small>
          </div>
          <div class="admin-table-cell">
            <span class="font-mono">{{ formatTime(item.createdAt) }}</span>
          </div>
          <div class="admin-actions">
            <AdminActionButton
              v-if="!item.roles.includes('ADMIN') && item.status === 'ACTIVE'"
              action="disable"
              :disabled="mutating"
              @click="requestDisable(item)"
            >
              禁用
            </AdminActionButton>
            <AdminActionButton
              v-if="!item.roles.includes('ADMIN') && item.status === 'DISABLED'"
              action="restore"
              :disabled="mutating"
              @click="mutate(`/admin/users/${item.id}/status`, 'PATCH', { status: 'ACTIVE' }, `账号 @${item.username} 已恢复。`)"
            >
              恢复
            </AdminActionButton>
            <AdminActionButton
              v-if="item.email"
              action="email"
              :disabled="mutating"
              @click="mutate(`/admin/users/${item.id}/reset-password`, 'POST', undefined, `已向 ${item.email} 发送密码重置邮件。`)"
            >
              重置密码
            </AdminActionButton>
          </div>
        </article>

        <nav v-if="totalPages > 1" class="admin-pagination" aria-label="用户分页">
          <button type="button" :disabled="loading || page === 1" @click="page -= 1; load()">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="loading || page === totalPages" @click="page += 1; load()">下一页</button>
        </nav>
      </div>
    </section>

    <div v-if="drawerOpen" class="admin-drawer-backdrop" @click.self="closeDrawer">
      <aside class="admin-drawer" data-testid="admin-user-drawer" role="region" aria-label="新建普通观众账号">
        <header class="admin-drawer__head">
          <div class="admin-drawer__title">
            <h2>新建普通观众账号</h2>
          </div>
          <button type="button" class="admin-drawer__close" aria-label="关闭用户抽屉" @click="closeDrawer">×</button>
        </header>

        <div class="admin-drawer__body">
          <InlineStatus v-if="error" :message="error" kind="error" />
          <form ref="formElement" class="admin-drawer-form" :inert="mutating" @submit.prevent="createUser">
            <label><span>用户名（3–32 位字母数字下划线）</span><input v-model.trim="form.username" required pattern="[A-Za-z0-9_]{3,32}" autocomplete="off" /></label>
            <label><span>初始密码（至少 8 位）</span><input v-model="form.password" type="password" minlength="8" required autocomplete="new-password" /></label>
            <label><span>观众昵称</span><input v-model.trim="form.nickname" required maxlength="50" /></label>
            <label><span>绑定邮箱 <em>可选</em></span><input v-model.trim="form.email" type="email" /></label>
            <label><span>联系电话 <em>可选</em></span><input v-model.trim="form.phone" maxlength="20" /></label>
            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="mutating">创建账号</FluidButton>
              <FluidButton type="button" variant="ghost" block :disabled="mutating" @click="closeDrawer">取消</FluidButton>
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
      @confirm="confirmRun"
      @cancel="confirmation = null"
    />

    <AdminConfirmDialog
      v-if="unsaved.open.value"
      :open="unsaved.open.value"
      title="还有未保存的用户信息"
      message="创建当前账号后继续，或放弃填写。"
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
