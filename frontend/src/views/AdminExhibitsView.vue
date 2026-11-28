<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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

interface ExhibitItem {
  id: number
  artifactId: number
  artifactTitle: string
  title: string
  slug: string
  summary: string
  description: string
  modelUrl: string
  modelSourceRef: string
  modelFormat: 'GLB' | 'GLTF'
  modelSizeBytes: number
  mobileModelUrl: string
  mobileModelSizeBytes: number | null
  coverImageUrl: string
  coverAssetRef: string
  displayNo: string
  sourceCredit: string
  sourceUrl: string
  licenseLabel: string
  collectionLocation: string
  status: 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN'
  deleted: boolean
  artifactPublished: boolean
  titleEn?: string | null
  summaryEn?: string | null
  descriptionEn?: string | null
}

interface ArtifactOption {
  id: number
  title: string
  status: string
  deleted: boolean
}

const auth = useAuthStore()
const router = useRouter()

const items = ref<ExhibitItem[]>([])
const artifacts = ref<ArtifactOption[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const deletedMode = ref(false)
const statusFilter = ref('')
const keyword = ref('')
const loading = ref(true)
const mutating = ref(false)
const error = ref('')
const message = ref('')

const drawerOpen = ref(false)
const editingId = ref<number | null>(null)
const formElement = ref<HTMLFormElement | null>(null)
const baseline = ref('')
const confirmationPending = ref(false)
const confirmation = ref<{ title: string; message: string; confirmLabel: string; run: () => Promise<void> } | null>(null)

const form = reactive({
  artifactId: undefined as number | undefined,
  title: '',
  slug: '',
  displayNo: '',
  summary: '',
  description: '',
  modelUrl: '',
  modelSourceRef: '',
  modelFormat: 'GLB' as 'GLB' | 'GLTF',
  modelSizeBytes: 1024,
  mobileModelUrl: '',
  mobileModelSizeBytes: null as number | null,
  coverImageUrl: '',
  coverAssetRef: '',
  sourceCredit: '',
  sourceUrl: '',
  licenseLabel: '',
  collectionLocation: '',
  titleEn: '',
  summaryEn: '',
  descriptionEn: '',
})

let loadSeq = 0
let abortController: AbortController | undefined

const drawerTitle = computed(() => editingId.value === null ? '新建 3D 展项草稿' : `编辑 3D 展项 · ${form.title || form.slug}`)
const unsaved = useUnsavedChanges({
  value: () => form,
  dirty: () => drawerOpen.value && JSON.stringify(form) !== baseline.value,
  save,
  discard: resetAndClose,
  blocked: () => mutating.value,
})

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function hasBilingual(item: ExhibitItem): boolean {
  return Boolean(item.titleEn?.trim() && item.summaryEn?.trim())
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
      deleted: deletedMode.value ? 'true' : 'false',
    })
    if (statusFilter.value && !deletedMode.value) params.set('status', statusFilter.value)
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())

    const [exData, artData] = await Promise.all([
      apiGet<ContentPage<ExhibitItem>>(`/admin/exhibits?${params.toString()}`, auth.token, { signal: controller.signal }),
      apiGet<ContentPage<ArtifactOption>>('/admin/artifacts?page=1&size=100&deleted=false', auth.token, { signal: controller.signal }),
    ])
    if (seq !== loadSeq) return
    items.value = exData.items
    total.value = exData.total
    totalPages.value = Math.max(1, exData.totalPages)
    artifacts.value = artData.items
  } catch (reason) {
    if (seq === loadSeq && !(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '3D 展项列表加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    artifactId: artifacts.value[0]?.id,
    title: '',
    slug: '',
    displayNo: '',
    summary: '',
    description: '',
    modelUrl: '',
    modelSourceRef: '',
    modelFormat: 'GLB',
    modelSizeBytes: 1024,
    mobileModelUrl: '',
    mobileModelSizeBytes: null,
    coverImageUrl: '',
    coverAssetRef: '',
    sourceCredit: '',
    sourceUrl: '',
    licenseLabel: '',
    collectionLocation: '',
    titleEn: '',
    summaryEn: '',
    descriptionEn: '',
  })
  baseline.value = JSON.stringify(form)
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

function openEdit(item: ExhibitItem) {
  void unsaved.attempt(() => {
    editingId.value = item.id
    error.value = ''
    Object.assign(form, {
      artifactId: item.artifactId,
      title: item.title,
      slug: item.slug,
      displayNo: item.displayNo ?? '',
      summary: item.summary ?? '',
      description: item.description ?? '',
      modelUrl: item.modelUrl,
      modelSourceRef: item.modelSourceRef,
      modelFormat: item.modelFormat,
      modelSizeBytes: item.modelSizeBytes,
      mobileModelUrl: item.mobileModelUrl ?? '',
      mobileModelSizeBytes: item.mobileModelSizeBytes ?? null,
      coverImageUrl: item.coverImageUrl ?? '',
      coverAssetRef: item.coverAssetRef ?? '',
      sourceCredit: item.sourceCredit ?? '',
      sourceUrl: item.sourceUrl ?? '',
      licenseLabel: item.licenseLabel ?? '',
      collectionLocation: item.collectionLocation ?? '',
      titleEn: item.titleEn ?? '',
      summaryEn: item.summaryEn ?? '',
      descriptionEn: item.descriptionEn ?? '',
    })
    baseline.value = JSON.stringify(form)
    drawerOpen.value = true
    unsaved.markClean()
  })
}

function closeDrawer() {
  if (!drawerOpen.value || mutating.value) return
  void unsaved.attempt(() => {
    resetAndClose()
  })
}

async function save(): Promise<boolean> {
  if (mutating.value) return false
  if (formElement.value && !formElement.value.reportValidity()) {
    error.value = '请补全必填字段与规范格式。'
    return false
  }
  if (!form.artifactId) {
    error.value = '请选择关联文物。'
    return false
  }
  const mobileUrl = form.mobileModelUrl.trim() || null
  const mobileSize = form.mobileModelSizeBytes ? Number(form.mobileModelSizeBytes) : null
  if (Boolean(mobileUrl) !== Boolean(mobileSize)) {
    error.value = '移动端模型路径与字节数必须同时填写或同时留空。'
    return false
  }

  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    const payload = {
      artifactId: Number(form.artifactId),
      title: form.title.trim(),
      slug: form.slug.trim(),
      displayNo: form.displayNo.trim() || null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      modelUrl: form.modelUrl.trim(),
      modelSourceRef: form.modelSourceRef.trim(),
      modelFormat: form.modelFormat,
      modelSizeBytes: Number(form.modelSizeBytes),
      mobileModelUrl: mobileUrl,
      mobileModelSizeBytes: mobileSize,
      coverImageUrl: form.coverImageUrl.trim() || null,
      coverAssetRef: form.coverAssetRef.trim() || null,
      sourceCredit: form.sourceCredit.trim() || null,
      sourceUrl: form.sourceUrl.trim() || null,
      licenseLabel: form.licenseLabel.trim() || null,
      collectionLocation: form.collectionLocation.trim() || null,
      titleEn: form.titleEn.trim() || null,
      summaryEn: form.summaryEn.trim() || null,
      descriptionEn: form.descriptionEn.trim() || null,
    }
    if (editingId.value === null) {
      await apiRequest('/admin/exhibits', 'POST', payload, auth.token)
      message.value = '3D 展项草稿已创建。'
    } else {
      await apiRequest(`/admin/exhibits/${editingId.value}`, 'PATCH', payload, auth.token)
      message.value = '3D 展项信息与双语内容已更新。'
    }
    resetAndClose()
    await load()
    return true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存 3D 展项失败。'
    return false
  } finally {
    mutating.value = false
  }
}

async function mutate(path: string, method: 'POST' | 'DELETE', successText: string) {
  if (mutating.value) return
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    await apiRequest(path, method, undefined, auth.token)
    message.value = successText
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作失败。'
  } finally {
    mutating.value = false
  }
}

function requestConfirm(title: string, msg: string, confirmLabel: string, path: string, method: 'POST' | 'DELETE', successText: string) {
  confirmation.value = {
    title,
    message: msg,
    confirmLabel,
    run: () => mutate(path, method, successText),
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

function switchTrash(isTrash: boolean) {
  deletedMode.value = isTrash
  page.value = 1
  void load()
}

function applySearch() {
  page.value = 1
  void load()
}

function resetFilters() {
  deletedMode.value = false
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
    title="3D 数字展项"
    description="管理 3D 点云与 WebGL 光学展项的模型资产、关联文物、版权溯源及中英双语说明。"
    section="exhibits"
  >
    <template #header-actions>
      <button type="button" class="admin-primary-btn" data-testid="admin-exhibits-create" @click="openCreate">
        + 新建 3D 展项
      </button>
      <RouterLink class="admin-header-link" to="/admin/artifacts">馆藏文物 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <section class="admin-records" data-glass="light">
      <div class="appt-toolbar">
        <div class="dashboard-segmented" role="group" aria-label="展项视图切换">
          <button type="button" :class="{ active: !deletedMode }" @click="switchTrash(false)">正常展项</button>
          <button type="button" :class="{ active: deletedMode }" @click="switchTrash(true)">回收站</button>
        </div>

        <div class="admin-list-filters">
          <label class="admin-filter-field admin-filter-field--search">
            <span class="admin-filter-field__label">检索展项</span>
            <input
              v-model.trim="keyword"
              type="search"
              data-testid="exhibits-search-input"
              placeholder="标题、编号、Slug 或关联文物"
              @keyup.enter="applySearch"
            />
          </label>
          <label class="admin-filter-field">
            <span class="admin-filter-field__label">状态</span>
            <select v-model="statusFilter" :disabled="deletedMode" @change="applySearch">
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">已发布</option>
              <option value="WITHDRAWN">已撤回</option>
            </select>
          </label>
          <button type="button" class="admin-text-button" data-testid="exhibits-search-btn" @click="applySearch">筛选</button>
          <button type="button" class="admin-text-button" @click="resetFilters">重置</button>
        </div>

        <strong class="admin-count">共 {{ total }} 项</strong>
      </div>

      <div v-if="loading" class="state-panel">正在加载 3D 数字展项…</div>
      <div v-else-if="items.length === 0" class="state-panel">暂无符合条件的 3D 展项记录。</div>
      <div v-else class="admin-list admin-table--exhibits" data-testid="exhibits-table">
        <div class="admin-list-head" aria-hidden="true">
          <span>状态</span>
          <span>展项名称与编号</span>
          <span>关联文物</span>
          <span>模型资产</span>
          <span>双语</span>
          <span>操作</span>
        </div>

        <article v-for="item in items" :key="item.id" data-glass="compact">
          <div class="admin-record-status">
            <StatusBadge :status="item.deleted ? 'DISABLED' : item.status" />
          </div>
          <div class="admin-record-copy">
            <h3>
              <span v-if="item.displayNo" class="admin-pill-tag font-mono">{{ item.displayNo }}</span>
              {{ item.title }}
            </h3>
            <p class="font-mono">/exhibits/{{ item.slug }}</p>
          </div>
          <div class="admin-table-cell">
            <span>{{ item.artifactTitle }}</span>
            <small>{{ item.artifactPublished ? '关联文物已公开' : '关联文物未公开' }}</small>
          </div>
          <div class="admin-table-cell">
            <span class="font-mono">{{ item.modelFormat }} · {{ formatBytes(item.modelSizeBytes) }}</span>
            <small v-if="item.mobileModelSizeBytes">移动版 {{ formatBytes(item.mobileModelSizeBytes) }}</small>
            <small v-else>未配独立移动模型</small>
          </div>
          <div>
            <span class="admin-bilingual-badge" :class="hasBilingual(item) ? 'is-ready' : 'is-missing'">
              {{ hasBilingual(item) ? 'EN 已译' : '缺译文' }}
            </span>
          </div>
          <div class="admin-actions">
            <AdminActionButton v-if="!item.deleted" action="edit" :data-testid="`exhibit-edit-${item.id}`" @click="openEdit(item)">
              编辑
            </AdminActionButton>
            <AdminActionButton
              v-if="!item.deleted && item.status !== 'PUBLISHED'"
              action="publish"
              :disabled="mutating"
              @click="mutate(`/admin/exhibits/${item.id}/publish`, 'POST', '3D 展项已公开上线。')"
            >
              发布
            </AdminActionButton>
            <AdminActionButton
              v-if="!item.deleted && item.status === 'PUBLISHED'"
              action="withdraw"
              :disabled="mutating"
              @click="requestConfirm('确认撤回展项？', `${item.title} 将从数字展厅下线。`, '确认撤回', `/admin/exhibits/${item.id}/withdraw`, 'POST', '3D 展项已撤回。')"
            >
              撤回
            </AdminActionButton>
            <AdminActionButton
              v-if="!item.deleted"
              action="delete"
              :disabled="mutating"
              @click="requestConfirm('确认移入回收站？', `${item.title} 将移入回收站。`, '移入回收站', `/admin/exhibits/${item.id}`, 'DELETE', '3D 展项已移入回收站。')"
            >
              删除
            </AdminActionButton>
            <AdminActionButton
              v-if="item.deleted"
              action="restore"
              :disabled="mutating"
              @click="mutate(`/admin/exhibits/${item.id}/restore`, 'POST', '3D 展项已恢复为已撤回草稿。')"
            >
              恢复
            </AdminActionButton>
          </div>
        </article>

        <nav v-if="totalPages > 1" class="admin-pagination" aria-label="展项分页">
          <button type="button" :disabled="loading || page === 1" @click="page -= 1; load()">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="loading || page === totalPages" @click="page += 1; load()">下一页</button>
        </nav>
      </div>
    </section>

    <div v-if="drawerOpen" class="admin-drawer-backdrop" @click.self="closeDrawer">
      <aside class="admin-drawer admin-drawer--wide" data-testid="admin-exhibit-drawer" role="region" :aria-label="drawerTitle">
        <header class="admin-drawer__head">
          <div class="admin-drawer__title">
            <h2>{{ drawerTitle }}</h2>
          </div>
          <button type="button" class="admin-drawer__close" aria-label="关闭展项抽屉" @click="closeDrawer">×</button>
        </header>

        <div class="admin-drawer__body">
          <InlineStatus v-if="error" :message="error" kind="error" />
          <form ref="formElement" class="admin-drawer-form" :inert="mutating" @submit.prevent="save">
            <label>
              <span>关联文物</span>
              <select v-model.number="form.artifactId" required>
                <option :value="undefined" disabled>请选择关联文物</option>
                <option v-for="art in artifacts" :key="art.id" :value="art.id">
                  {{ art.title }}（{{ art.status === 'PUBLISHED' ? '已发布' : '未发布' }}）
                </option>
              </select>
            </label>

            <div class="admin-form-grid">
              <label><span>展项中文名称</span><input v-model.trim="form.title" required maxlength="150" /></label>
              <label><span>展项英文名称 <em>可选</em></span><input v-model.trim="form.titleEn" maxlength="300" /></label>
            </div>

            <div class="admin-form-grid">
              <label><span>URL 标识（Slug）</span><input v-model.trim="form.slug" pattern="[a-z0-9-]{3,180}" required /></label>
              <label><span>展示编号 <em>如 EXHIBIT 01</em></span><input v-model.trim="form.displayNo" maxlength="32" /></label>
            </div>

            <div class="admin-form-grid">
              <label><span>桌面模型路径</span><input v-model.trim="form.modelUrl" required maxlength="500" /></label>
              <label><span>原创资产编号</span><input v-model.trim="form.modelSourceRef" required maxlength="128" /></label>
            </div>

            <div class="admin-form-grid">
              <label>
                <span>模型格式</span>
                <select v-model="form.modelFormat">
                  <option value="GLB">GLB</option>
                  <option value="GLTF">GLTF</option>
                </select>
              </label>
              <label><span>桌面模型字节数</span><input v-model.number="form.modelSizeBytes" type="number" min="1" required /></label>
            </div>

            <div class="admin-form-grid">
              <label><span>移动模型路径 <em>需与字节数成对</em></span><input v-model.trim="form.mobileModelUrl" maxlength="500" /></label>
              <label><span>移动模型字节数 <em>可选</em></span><input v-model.number="form.mobileModelSizeBytes" type="number" min="1" /></label>
            </div>

            <div class="admin-form-grid">
              <label><span>封面图片路径</span><input v-model.trim="form.coverImageUrl" maxlength="500" /></label>
              <label><span>展示位置</span><input v-model.trim="form.collectionLocation" maxlength="255" /></label>
            </div>

            <div class="admin-form-grid">
              <label><span>来源署名</span><input v-model.trim="form.sourceCredit" maxlength="255" /></label>
              <label><span>许可协议标签</span><input v-model.trim="form.licenseLabel" maxlength="128" /></label>
            </div>

            <label><span>中文摘要</span><textarea v-model.trim="form.summary" rows="2" maxlength="500" /></label>
            <label><span>英文摘要 <em>可选</em></span><textarea v-model.trim="form.summaryEn" rows="2" maxlength="1000" /></label>
            <label><span>中文详情导览</span><textarea v-model.trim="form.description" rows="4" /></label>
            <label><span>英文详情导览 <em>可选</em></span><textarea v-model.trim="form.descriptionEn" rows="4" /></label>

            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="mutating">{{ editingId === null ? '创建 3D 展项草稿' : '保存展项修改' }}</FluidButton>
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
      title="还有未保存的展项编辑"
      message="保存当前更改后继续，或放弃本次修改。"
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
