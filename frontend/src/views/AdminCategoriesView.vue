<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, apiRequest } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useUnsavedChanges } from '../composables/useUnsavedChanges'
import AdminShell from '../components/AdminShell.vue'
import FluidButton from '../components/FluidButton.vue'
import InlineStatus from '../components/InlineStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AdminActionButton from '../components/AdminActionButton.vue'
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue'

interface CategoryAdminItem {
  id: number
  code: string
  name: string
  description: string
  sortOrder: number
  enabled: boolean
  nameEn?: string | null
  descriptionZh?: string | null
  descriptionEn?: string | null
}

const auth = useAuthStore()
const router = useRouter()

const categories = ref<CategoryAdminItem[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const message = ref('')
const drawerOpen = ref(false)
const editingId = ref<number | null>(null)
const formElement = ref<HTMLFormElement | null>(null)

const form = reactive({
  code: '',
  name: '',
  nameEn: '',
  sortOrder: 40,
  enabled: true,
  description: '',
  descriptionZh: '',
  descriptionEn: '',
})

const drawerTitle = computed(() => editingId.value === null ? '新建展陈分类' : `编辑分类 · ${form.name || form.code}`)

const unsaved = useUnsavedChanges({
  value: () => form,
  save,
  discard: resetAndClose,
  blocked: () => saving.value,
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    await auth.initialize()
    if (!auth.isAdmin) {
      await router.replace('/login')
      return
    }
    categories.value = await apiGet<CategoryAdminItem[]>('/admin/categories', auth.token)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '分类列表加载失败。'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    code: '',
    name: '',
    nameEn: '',
    sortOrder: (categories.value.length + 1) * 10,
    enabled: true,
    description: '',
    descriptionZh: '',
    descriptionEn: '',
  })
  unsaved.markClean()
}

function resetAndClose() {
  resetForm()
  drawerOpen.value = false
}

function openCreate() {
  void unsaved.attempt(() => {
    resetForm()
    error.value = ''
    drawerOpen.value = true
  })
}

function openEdit(item: CategoryAdminItem) {
  void unsaved.attempt(() => {
    editingId.value = item.id
    error.value = ''
    Object.assign(form, {
      code: item.code,
      name: item.name,
      nameEn: item.nameEn ?? '',
      sortOrder: item.sortOrder,
      enabled: item.enabled,
      description: item.description ?? '',
      descriptionZh: item.descriptionZh ?? item.description ?? '',
      descriptionEn: item.descriptionEn ?? '',
    })
    unsaved.markClean()
    drawerOpen.value = true
  })
}

function closeDrawer() {
  if (!drawerOpen.value || saving.value) return
  void unsaved.attempt(() => {
    resetAndClose()
  })
}

async function save(): Promise<boolean> {
  if (saving.value) return false
  if (formElement.value && !formElement.value.reportValidity()) {
    error.value = '请按格式要求补全分类编码、名称与排序权重。'
    return false
  }
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || null,
      sortOrder: Number(form.sortOrder),
      enabled: form.enabled,
      description: form.description.trim() || form.descriptionZh.trim() || null,
      descriptionZh: form.descriptionZh.trim() || form.description.trim() || null,
      descriptionEn: form.descriptionEn.trim() || null,
    }
    if (editingId.value === null) {
      await apiRequest('/admin/categories', 'POST', payload, auth.token)
      message.value = '展陈分类已创建，并已刷新馆藏知识缓存。'
    } else {
      await apiRequest(`/admin/categories/${editingId.value}`, 'PATCH', payload, auth.token)
      message.value = '展陈分类已更新。'
    }
    resetAndClose()
    await load()
    return true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '分类保存失败。'
    return false
  } finally {
    saving.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drawerOpen.value && !unsaved.open.value) {
    closeDrawer()
  }
}

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <AdminShell
    v-if="auth.isAdmin"
    title="展陈分类管理"
    description="维护博物馆馆藏与专题的中英文分类编码、排序权重及前台启用状态。"
    section="categories"
  >
    <template #header-actions>
      <button type="button" class="admin-primary-btn" data-testid="admin-create-category-btn" @click="openCreate">
        + 新建分类
      </button>
      <RouterLink class="admin-header-link" to="/admin">返回运营看板 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <section class="admin-records" data-glass="light">
      <div class="section-heading">
        <div>
          <span>CURATORIAL TAXONOMY</span>
          <h2>馆藏展陈分类列表</h2>
        </div>
        <div class="section-heading__right">
          <strong>{{ categories.length }} 项</strong>
        </div>
      </div>

      <div v-if="loading" class="state-panel">正在加载展陈分类…</div>
      <div v-else-if="categories.length === 0" class="state-panel">暂无展陈分类。</div>
      <div v-else class="admin-list admin-list--categories">
        <div class="admin-list-head" aria-hidden="true">
          <span>状态</span>
          <span>分类名称与编码</span>
          <span>英文名称</span>
          <span>排序权重</span>
          <span>策展说明</span>
          <span>操作</span>
        </div>
        <article v-for="item in categories" :key="item.id" data-glass="compact">
          <div class="admin-record-status">
            <StatusBadge :status="item.enabled ? 'ACTIVE' : 'DISABLED'" />
          </div>
          <div class="admin-record-copy">
            <h3>{{ item.name }}</h3>
            <span class="font-mono admin-category-code">{{ item.code }}</span>
          </div>
          <div class="admin-record-en">
            <span>{{ item.nameEn || '— 未填写 —' }}</span>
          </div>
          <span class="admin-record-sort font-mono">#{{ item.sortOrder }}</span>
          <p class="admin-record-desc">{{ item.descriptionZh || item.description || '暂无说明' }}</p>
          <div class="admin-actions">
            <AdminActionButton action="edit" @click="openEdit(item)">编辑</AdminActionButton>
          </div>
        </article>
      </div>
    </section>

    <div v-if="drawerOpen" class="admin-drawer-backdrop" @click.self="closeDrawer">
      <aside class="admin-drawer" data-testid="admin-category-drawer" role="region" :aria-label="drawerTitle">
        <header class="admin-drawer__head">
          <div class="admin-drawer__title">
            <span>{{ editingId === null ? 'NEW CATEGORY' : 'EDIT CATEGORY' }}</span>
            <h2>{{ drawerTitle }}</h2>
          </div>
          <button type="button" class="admin-drawer__close" aria-label="关闭分类抽屉" @click="closeDrawer">×</button>
        </header>

        <div class="admin-drawer__body">
          <InlineStatus v-if="error" :message="error" kind="error" />
          <form ref="formElement" class="admin-drawer-form" :inert="saving" @submit.prevent="save">
            <div class="admin-form-grid">
              <label>
                <span>分类编码</span>
                <input v-model.trim="form.code" required pattern="[A-Z0-9_]{2,32}" placeholder="如 BRONZE" />
                <small>仅大写字母、数字与下划线（2–32 位）</small>
              </label>
              <label>
                <span>排序权重</span>
                <input v-model.number="form.sortOrder" type="number" min="0" max="9999" required />
              </label>
            </div>
            <div class="admin-form-grid">
              <label><span>中文名称</span><input v-model.trim="form.name" required maxlength="64" /></label>
              <label><span>英文名称 <em>可选</em></span><input v-model.trim="form.nameEn" maxlength="100" /></label>
            </div>
            <label><span>中文导览描述 <em>可选</em></span><textarea v-model.trim="form.descriptionZh" maxlength="300" rows="3" /></label>
            <label><span>英文导览描述 <em>可选</em></span><textarea v-model.trim="form.descriptionEn" maxlength="300" rows="3" /></label>
            <label class="admin-toggle-field">
              <input v-model="form.enabled" type="checkbox" />
              <span>启用该分类并向公众馆藏筛选开放</span>
            </label>
            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="saving">{{ editingId === null ? '创建分类' : '保存分类修改' }}</FluidButton>
              <FluidButton type="button" variant="ghost" block :disabled="saving" @click="closeDrawer">取消</FluidButton>
            </div>
          </form>
        </div>
      </aside>
    </div>

    <AdminConfirmDialog
      v-if="unsaved.open.value"
      :open="unsaved.open.value"
      title="还有未保存的分类修改"
      message="保存当前分类信息后继续，或放弃本次修改。"
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
