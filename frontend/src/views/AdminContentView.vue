<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ElOption, ElSelect } from 'element-plus'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/option/style/css'
import { apiGet, apiRequest, type ContentPage } from '../lib/api'
import { getCuratorialMaterialProfile } from '../lib/curatorialSwatches'
import { useAuthStore } from '../stores/auth'
import AdminShell from '../components/AdminShell.vue'
import FluidButton from '../components/FluidButton.vue'
import InlineStatus from '../components/InlineStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AdminTabs from '../components/AdminTabs.vue'
import AdminActionButton from '../components/AdminActionButton.vue'
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue'
import { useAdminMutation } from '../composables/useAdminMutation'
import { useUnsavedChanges } from '../composables/useUnsavedChanges'

const props = defineProps<{ lockedTab?: 'artifacts' | 'articles' }>()

interface Category { id: number; code: string; name: string }
interface ManagedItem { titleEn?: string | null; summaryEn?: string | null; id: number; title: string; slug: string; summary: string; content: string; categoryId: number; categoryName: string; status: string; deleted: boolean; coverImageUrl: string; updatedAt: string; authorDisplay?: string; period?: string; material?: string; dimensions?: string; collectionLocation?: string; accessionNo?: string; coverAssetRef?: string }

const auth = useAuthStore()
const router = useRouter()
const tab = ref<'artifacts' | 'articles'>(props.lockedTab ?? 'artifacts')
const isStandalone = computed(() => Boolean(props.lockedTab))
const shellTitle = computed(() => !isStandalone.value ? '内容管理' : (tab.value === 'artifacts' ? '馆藏文物' : '文化专题'))
const shellDescription = computed(() => !isStandalone.value
  ? '创建、发布与维护面向公众的馆藏内容。'
  : (tab.value === 'artifacts'
    ? '维护馆藏文物档案、器物规格、中英双语译文与发布状态。'
    : '撰写、实时预览 68ch 图录排印并发布河洛文化专题文章。'))
const contentTabs = [
  { value: 'artifacts', label: '文物' },
  { value: 'articles', label: '文章' },
]
const categories = ref<Category[]>([])
const summary = ref<{ userCount: number; appointmentCount: number; orderCount: number; salesAmount: string } | null>(null)
const artifacts = ref<ManagedItem[]>([])
const articles = ref<ManagedItem[]>([])
const listState = reactive({
  artifacts: { page: 1, totalPages: 1, total: 0, keyword: '', status: '', deleted: false, loading: true, error: '', sequence: 0 },
  articles: { page: 1, totalPages: 1, total: 0, keyword: '', status: '', deleted: false, loading: false, error: '', sequence: 0 },
})
const loading = computed(() => listState[tab.value].loading)
const error = ref('')
const message = ref('')
const artifactForm = reactive({ categoryId: 0, accessionNo: '', title: '', titleEn: '', summaryEn: '', slug: '', period: '', material: '', dimensions: '', collectionLocation: '', summary: '', content: '', coverImageUrl: '', coverAssetRef: '', authorDisplay: '' })
const articleForm = reactive({ categoryId: 0, accessionNo: '', title: '', titleEn: '', summaryEn: '', slug: '', period: '', material: '', dimensions: '', collectionLocation: '', summary: '', content: '', coverImageUrl: '', coverAssetRef: '', authorDisplay: '' })
const editingId = ref<number | null>(null)
const editingType = ref<'artifacts' | 'articles' | null>(null)
const drawerOpen = ref(false)
const drawerView = ref<'form' | 'preview'>('form')
const previewLocale = ref<'zh-CN' | 'en-US'>('zh-CN')
const showDeleted = computed({ get: () => listState[tab.value].deleted, set: value => { listState[tab.value].deleted = value } })
const contentPage = computed({ get: () => listState[tab.value].page, set: value => { listState[tab.value].page = value } })
const contentTotalPages = computed(() => listState[tab.value].totalPages)
const keyword = computed({ get: () => listState[tab.value].keyword, set: value => { listState[tab.value].keyword = value } })
const statusFilter = computed({ get: () => listState[tab.value].status, set: value => { listState[tab.value].status = value } })
const saving = ref(false)
const formElement = ref<HTMLFormElement | null>(null)
const { isPending, run: runMutation } = useAdminMutation()
const confirmationPending = ref(false)
const confirmation = ref<{ title: string; message: string; confirmLabel: string; run: () => void | Promise<void> } | null>(null)
const items = computed(() => tab.value === 'artifacts' ? artifacts.value : articles.value)
const activeForm = computed(() => tab.value === 'artifacts' ? artifactForm : articleForm)
const editing = computed(() => editingId.value !== null && editingType.value === tab.value)
const createButtonLabel = computed(() => tab.value === 'artifacts' ? '+ 新建文物' : '+ 新建文章')
const drawerHeading = computed(() => editing.value
  ? (tab.value === 'artifacts' ? '编辑文物档案' : '编辑策展文章')
  : (tab.value === 'artifacts' ? '新建文物草稿' : '新建文化文章草稿'))

const previewCategoryName = computed(() => categories.value.find(c => c.id === activeForm.value.categoryId)?.name || (tab.value === 'artifacts' ? '馆藏器物' : '策展研究'))
const previewTitle = computed(() => {
  if (previewLocale.value === 'en-US') return activeForm.value.titleEn.trim() || activeForm.value.title.trim() || 'Untitled Entry'
  return activeForm.value.title.trim() || '未命名内容草稿'
})
const previewSummary = computed(() => {
  if (previewLocale.value === 'en-US') return activeForm.value.summaryEn.trim() || activeForm.value.summary.trim() || 'No English summary entered yet.'
  return activeForm.value.summary.trim() || '填写摘要后，此处将实时呈现前台导语排版效果。'
})
const previewBlocks = computed(() => {
  const raw = activeForm.value.content.trim()
  if (!raw) return []
  return raw.split(/\n{2,}/).map(chunk => chunk.trim()).filter(Boolean).map((block) => ({
    heading: block.length <= 24 && !/[。！？.!?]/.test(block),
    text: block,
  }))
})
const previewProfile = computed(() => tab.value === 'artifacts' ? getCuratorialMaterialProfile(activeForm.value.slug.trim()) : null)
const formEnComplete = computed(() => Boolean(activeForm.value.titleEn.trim() && activeForm.value.summaryEn.trim()))

function hasCompleteEn(item: ManagedItem) {
  return Boolean(item.titleEn?.trim() && item.summaryEn?.trim())
}

const unsaved = useUnsavedChanges({ value: () => activeForm.value, save, discard: discardAndClose, blocked: () => saving.value })
let loadSequence = 0
let loadController: AbortController | undefined
const fallbackImages = ['/media/editorial/explore-water-bird-bronze-user-v2.webp', '/media/editorial/explore-river-map-stone-user-v2.webp', '/media/editorial/explore-painted-pottery-jar-user-v2.webp', '/media/editorial/explore-jade-bi-user-v2.webp', '/media/editorial/explore-bronze-ding-user-v2.webp']
const alphaMattedCovers: Record<string, string> = {
  'heluo-bronze-ding': '/media/editorial/explore-bronze-ding-user-v2.webp',
  'water-bird-bronze': '/media/editorial/explore-water-bird-bronze-user-v2.webp',
  'heluo-bronze-jue': '/media/editorial/explore-bronze-jue-user-v2.webp',
  'river-map-jade-bi': '/media/editorial/explore-jade-bi-user-v2.webp',
  'painted-pottery-water-jar': '/media/editorial/explore-painted-pottery-jar-user-v2.webp',
  'river-map-pattern-stone': '/media/editorial/explore-river-map-stone-user-v2.webp',
}

function imageFor(item: ManagedItem, index: number) { return alphaMattedCovers[item.slug] || item.coverImageUrl || fallbackImages[index % fallbackImages.length] }
const previewCoverUrl = computed(() => alphaMattedCovers[activeForm.value.slug.trim()] || activeForm.value.coverImageUrl)
function selectContentTab(value: string) {
  if (value === tab.value || !['artifacts', 'articles'].includes(value)) return
  void unsaved.attempt(async () => {
    resetForm()
    drawerOpen.value = false
    tab.value = value as 'artifacts' | 'articles'
    error.value = ''; message.value = ''
    unsaved.markClean()
    await load()
  })
}

async function load(page = contentPage.value) {
  const target = tab.value
  const state = listState[target]
  state.page = Math.max(1, page)
  const query = new URLSearchParams({ page: String(state.page), size: '20', deleted: String(state.deleted), keyword: state.keyword.trim(), status: state.status })
  const sequence = ++loadSequence
  state.sequence = sequence
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  state.loading = true
  state.error = ''
  try {
    await auth.initialize()
    if (sequence !== loadSequence) return
    if (!auth.isAdmin) { await router.replace('/login'); return }
    const options = { signal: controller.signal }
    const [categoryData, data, overview] = await Promise.all([
      categories.value.length ? Promise.resolve(categories.value) : apiGet<Category[]>('/admin/categories', auth.token, options),
      apiGet<ContentPage<ManagedItem>>(`/admin/${target}?${query}`, auth.token, options),
      apiGet<NonNullable<typeof summary.value>>('/admin/dashboard/summary', auth.token, options),
    ])
    if (sequence !== loadSequence) return
    if (state.page > Math.max(1, data.totalPages)) { await load(Math.max(1, data.totalPages)); return }
    categories.value = categoryData
    if (target === 'artifacts') artifacts.value = data.items
    else articles.value = data.items
    state.totalPages = Math.max(1, data.totalPages)
    state.total = data.total
    summary.value = overview
    if (!activeForm.value.categoryId && categories.value[0]) {
      const wasDirty = unsaved.dirty.value
      activeForm.value.categoryId = categories.value[0].id
      if (!wasDirty) unsaved.markClean()
    }
  } catch (reason) {
    if (sequence === loadSequence) state.error = reason instanceof Error ? reason.message : '后台内容加载失败。'
  } finally { if (state.sequence === sequence) state.loading = false }
}

function makeSlug() { activeForm.value.slug = activeForm.value.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function formatUpdatedAt(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function resetForm() {
  editingId.value = null
  editingType.value = null
  Object.assign(artifactForm, { categoryId: categories.value[0]?.id ?? 0, accessionNo: '', title: '', titleEn: '', summaryEn: '', slug: '', period: '', material: '', dimensions: '', collectionLocation: '', summary: '', content: '', coverImageUrl: '', coverAssetRef: '', authorDisplay: '' })
  Object.assign(articleForm, { categoryId: categories.value[0]?.id ?? 0, accessionNo: '', title: '', titleEn: '', summaryEn: '', slug: '', period: '', material: '', dimensions: '', collectionLocation: '', summary: '', content: '', coverImageUrl: '', coverAssetRef: '', authorDisplay: '' })
  unsaved.markClean()
}
function discardAndClose() {
  resetForm()
  drawerOpen.value = false
  drawerView.value = 'form'
}
function openCreateDrawer() {
  void unsaved.attempt(() => {
    resetForm()
    error.value = ''
    drawerView.value = 'form'
    drawerOpen.value = true
  })
}
function closeDrawer() {
  if (!drawerOpen.value || saving.value) return
  void unsaved.attempt(() => {
    resetForm()
    drawerOpen.value = false
    drawerView.value = 'form'
  })
}
function edit(item: ManagedItem) {
  void unsaved.attempt(() => selectItem(item))
}
function selectItem(item: ManagedItem) {
  editingId.value = item.id
  editingType.value = tab.value
  error.value = ''
  if (tab.value === 'artifacts') Object.assign(artifactForm, { categoryId: item.categoryId, accessionNo: item.accessionNo ?? '', title: item.title, titleEn: item.titleEn ?? '', summaryEn: item.summaryEn ?? '', slug: item.slug, period: item.period ?? '', material: item.material ?? '', dimensions: item.dimensions ?? '', collectionLocation: item.collectionLocation ?? '', summary: item.summary, content: item.content, coverImageUrl: item.coverImageUrl, coverAssetRef: item.coverAssetRef ?? '' })
  else Object.assign(articleForm, { categoryId: item.categoryId, title: item.title, titleEn: item.titleEn ?? '', summaryEn: item.summaryEn ?? '', slug: item.slug, summary: item.summary, content: item.content, coverImageUrl: item.coverImageUrl, coverAssetRef: item.coverAssetRef ?? '', authorDisplay: item.authorDisplay ?? '' })
  unsaved.markClean()
  drawerView.value = 'form'
  drawerOpen.value = true
}
async function toggleRecycleBin() { await unsaved.attempt(async () => { showDeleted.value = !showDeleted.value; resetForm(); drawerOpen.value = false; await load(1) }) }
function refreshList() { contentPage.value = 1; void load(1) }
function clearFilters() { keyword.value = ''; statusFilter.value = ''; refreshList() }
function goToContentPage(page: number) { if (loading.value || page < 1 || page > contentTotalPages.value || page === contentPage.value) return; void load(page) }
async function save(): Promise<boolean> {
  if (saving.value) return false
  if (formElement.value && !formElement.value.reportValidity()) { error.value = '请补全必填项后保存。'; return false }
  error.value = ''; message.value = ''
  saving.value = true
  try {
    const payload = tab.value === 'artifacts'
      ? { categoryId: artifactForm.categoryId, accessionNo: artifactForm.accessionNo, title: artifactForm.title, titleEn: artifactForm.titleEn, summaryEn: artifactForm.summaryEn, slug: artifactForm.slug, period: artifactForm.period, material: artifactForm.material, dimensions: artifactForm.dimensions, collectionLocation: artifactForm.collectionLocation, summary: artifactForm.summary, content: artifactForm.content, coverImageUrl: artifactForm.coverImageUrl, coverAssetRef: artifactForm.coverAssetRef }
      : { categoryId: articleForm.categoryId, title: articleForm.title, titleEn: articleForm.titleEn, summaryEn: articleForm.summaryEn, slug: articleForm.slug, summary: articleForm.summary, content: articleForm.content, coverImageUrl: articleForm.coverImageUrl, coverAssetRef: articleForm.coverAssetRef, authorDisplay: articleForm.authorDisplay }
    if (editingId.value === null) {
      await apiRequest(`/admin/${tab.value}`, 'POST', payload, auth.token)
      message.value = '草稿已创建。发布后才会出现在前台。'
    } else {
      await apiRequest(`/admin/${tab.value}/${editingId.value}`, 'PATCH', payload, auth.token)
      message.value = '内容已更新。'
    }
    resetForm()
    drawerOpen.value = false
    drawerView.value = 'form'
    await load()
    return true
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '保存失败。'; return false }
  finally { saving.value = false }
}
function resourceKey(type: 'artifacts' | 'articles', id: number) { return `${type}:${id}` }
async function action(item: ManagedItem, name: 'publish' | 'withdraw' | 'restore' | 'delete', confirmed = false, resourceType = tab.value) {
  const key = resourceKey(resourceType, item.id)
  if (!confirmed && (name === 'delete' || name === 'withdraw')) {
    confirmation.value = {
      title: name === 'delete' ? '删除这条内容？' : '撤回这条内容？',
      message: `${item.title} 将${name === 'delete' ? '进入回收站，前台不再展示' : '从前台撤下，但保留草稿内容'}。`,
      confirmLabel: name === 'delete' ? '确认删除' : '确认撤回',
      run: () => action(item, name, true, resourceType),
    }
    return
  }
  if (isPending(key)) return
  await runMutation(key, async () => {
    error.value = ''; message.value = ''
    try {
      if (name === 'delete') await apiRequest(`/admin/${resourceType}/${item.id}`, 'DELETE', undefined, auth.token)
      else await apiRequest(`/admin/${resourceType}/${item.id}/${name}`, 'POST', undefined, auth.token)
      message.value = '内容状态已更新。'
      await load()
    } catch (reason) { error.value = reason instanceof Error ? reason.message : '操作失败。' }
  })
}
async function confirmAction() {
  const current = confirmation.value
  if (!current || confirmationPending.value) return
  confirmationPending.value = true
  try { await current.run(); confirmation.value = null }
  finally { confirmationPending.value = false }
}
function cancelEditing() {
  closeDrawer()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drawerOpen.value && !confirmation.value && !unsaved.open.value) {
    closeDrawer()
  }
}
watch(() => props.lockedTab, (next) => {
  if (!next || next === tab.value) return
  resetForm()
  drawerOpen.value = false
  drawerView.value = 'form'
  tab.value = next
  error.value = ''
  message.value = ''
  unsaved.markClean()
  void load(1)
})

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  ++loadSequence
  loadController?.abort()
})
</script>

<template>
  <AdminShell v-if="auth.isAdmin" :title="shellTitle" :description="shellDescription" :section="isStandalone ? tab : 'content'">
    <template #header-actions>
      <button
        type="button"
        class="admin-primary-btn"
        data-testid="admin-open-create-drawer"
        @click="openCreateDrawer"
      >
        {{ createButtonLabel }}
      </button>
      <RouterLink class="admin-header-link" :to="isStandalone ? '/admin' : '/admin/operations'">
        {{ isStandalone ? '返回运营看板 →' : '进入运营管理 →' }}
      </RouterLink>
    </template>

    <section v-if="summary && !isStandalone" class="dashboard-summary" data-glass="light" aria-label="运营概览">
      <article><span>用户</span><strong>{{ summary.userCount }}</strong><small>注册账号</small></article>
      <article><span>预约</span><strong>{{ summary.appointmentCount }}</strong><small>累计记录</small></article>
      <article><span>订单</span><strong>{{ summary.orderCount }}</strong><small>商城订单</small></article>
      <article><span>销售额</span><strong>¥ {{ summary.salesAmount }}</strong><small>模拟支付</small></article>
    </section>
    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error || listState[tab].error" kind="error" />

    <div class="admin-toolbar">
      <AdminTabs v-if="!isStandalone" :model-value="tab" :tabs="contentTabs" label="内容类型" panel-id="admin-content-panel" @update:model-value="selectContentTab" />
      <div class="admin-list-filters">
        <label class="admin-filter-field admin-filter-field--search">
          <span class="admin-filter-field__label">查找内容</span>
          <input v-model.trim="keyword" type="search" placeholder="搜索标题、标识或登记号" @keyup.enter="refreshList" />
        </label>
        <label class="admin-filter-field">
          <span class="admin-filter-field__label">状态</span>
          <select v-model="statusFilter" @change="refreshList">
            <option value="">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="WITHDRAWN">已撤回</option>
          </select>
        </label>
        <button class="admin-text-button" type="button" @click="clearFilters">清除</button>
      </div>
      <button class="admin-text-button" type="button" @click="toggleRecycleBin">{{ showDeleted ? '返回现有内容' : '查看回收站' }}</button>
    </div>

    <div id="admin-content-panel" class="admin-layout admin-layout--full" role="tabpanel" :aria-labelledby="`admin-content-panel-tab-${tab}`" tabindex="0">
      <section class="admin-records" data-glass="light">
        <div class="section-heading">
          <div>
            <span>{{ showDeleted ? 'RECYCLE BIN' : 'CONTENT LIBRARY' }}</span>
            <h2>{{ showDeleted ? '回收站' : (tab === 'artifacts' ? '馆藏文物列表' : '文化文章列表') }}</h2>
          </div>
          <div class="section-heading__right">
            <strong>{{ listState[tab].total }} 项</strong>
          </div>
        </div>
        <div v-if="loading" class="state-panel">正在加载后台内容…</div>
        <div v-else-if="listState[tab].error" class="state-panel state-panel--action"><button class="state-panel__action" type="button" @click="load()">重试</button></div>
        <div v-else-if="items.length === 0" class="state-panel">{{ showDeleted ? '回收站为空。' : '暂无内容，点击右上角「新建」开始编写第一篇草稿。' }}</div>
        <div v-else class="admin-list admin-list--content">
          <div class="admin-list-head" aria-hidden="true"><span>状态</span><span>内容与路径</span><span>双语</span><span>分类</span><span>更新时间</span><span>操作</span></div>
          <article v-for="(item, index) in items" :key="item.id" data-glass="compact">
            <div class="admin-record-status"><StatusBadge :status="item.deleted ? 'DISABLED' : item.status" /></div>
            <div class="admin-record-copy">
              <div class="admin-record-title">
                <img :src="imageFor(item, index)" :alt="`${item.title}封面`" />
                <div class="admin-record-title__text">
                  <h3>{{ item.title }}</h3>
                  <div class="admin-record-subline">
                    <span class="font-mono">/{{ tab }}/{{ item.slug }}</span>
                    <RouterLink v-if="!item.deleted" :to="`/${tab}/${item.slug}`" target="_blank">前台 ↗</RouterLink>
                  </div>
                </div>
              </div>
            </div>
            <div class="admin-record-i18n">
              <span
                class="admin-i18n-badge"
                data-testid="bilingual-status-badge"
                :class="hasCompleteEn(item) ? 'admin-i18n-badge--ok' : 'admin-i18n-badge--missing'"
              >
                {{ hasCompleteEn(item) ? 'EN 已译' : '缺译文' }}
              </span>
            </div>
            <span class="admin-record-category">{{ item.categoryName }}</span>
            <time class="admin-record-date" :datetime="item.updatedAt">{{ formatUpdatedAt(item.updatedAt) }}</time>
            <div class="admin-actions">
              <AdminActionButton v-if="!item.deleted" action="edit" :disabled="isPending(resourceKey(tab, item.id))" @click="edit(item)">编辑</AdminActionButton>
              <AdminActionButton v-if="!item.deleted && item.status !== 'PUBLISHED'" :disabled="isPending(resourceKey(tab, item.id))" action="publish" @click="action(item, 'publish')">发布</AdminActionButton>
              <AdminActionButton v-if="!item.deleted && item.status === 'PUBLISHED'" :disabled="isPending(resourceKey(tab, item.id))" action="withdraw" @click="action(item, 'withdraw')">撤回</AdminActionButton>
              <AdminActionButton v-if="!item.deleted" :disabled="isPending(resourceKey(tab, item.id))" action="delete" @click="action(item, 'delete')">删除</AdminActionButton>
              <AdminActionButton v-if="item.deleted" :disabled="isPending(resourceKey(tab, item.id))" action="restore" @click="action(item, 'restore')">恢复</AdminActionButton>
            </div>
          </article>
        </div>
        <nav v-if="contentTotalPages > 1" class="admin-pagination" aria-label="内容列表分页"><button type="button" :disabled="contentPage === 1" @click="goToContentPage(contentPage - 1)">上一页</button><span>{{ contentPage }} / {{ contentTotalPages }}</span><button type="button" :disabled="contentPage === contentTotalPages" @click="goToContentPage(contentPage + 1)">下一页</button></nav>
      </section>
    </div>

    <!-- Slide-Over Editor & 68ch Monograph Live Preview Drawer -->
    <div v-if="drawerOpen" class="admin-drawer-backdrop" @click.self="closeDrawer">
      <aside class="admin-drawer admin-create" data-testid="admin-content-drawer" role="region" :aria-label="drawerHeading">
        <header class="admin-drawer__head">
          <div class="admin-drawer__title">
            <span>{{ editing ? 'EDITING RECORD' : 'NEW DRAFT' }}</span>
            <h2>{{ drawerHeading }}</h2>
          </div>
          <button type="button" class="admin-drawer__close" aria-label="关闭编辑抽屉" @click="closeDrawer">×</button>
        </header>

        <div class="admin-drawer__modebar">
          <div class="admin-drawer__segmented" data-testid="admin-drawer-mode-switch" role="group" aria-label="编辑与预览切换">
            <button type="button" :class="{ active: drawerView === 'form' }" :aria-pressed="drawerView === 'form'" @click="drawerView = 'form'">表单编辑</button>
            <button type="button" :class="{ active: drawerView === 'preview' }" :aria-pressed="drawerView === 'preview'" @click="drawerView = 'preview'">前台 68ch 画册预览</button>
          </div>
          <span class="admin-i18n-badge" :class="formEnComplete ? 'admin-i18n-badge--ok' : 'admin-i18n-badge--missing'">
            {{ formEnComplete ? 'EN 已译' : '缺译文' }}
          </span>
        </div>

        <div class="admin-drawer__body">
          <InlineStatus v-if="error" :message="error" kind="error" />

          <form v-show="drawerView === 'form'" ref="formElement" :inert="saving" @submit.prevent="save">
            <label><span>分类</span><el-select v-model="activeForm.categoryId" popper-class="museum-select-popper" placeholder="请选择内容分类" required><el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.id" /></el-select></label>
            <label><span>标题</span><input v-model.trim="activeForm.title" required maxlength="200" @blur="!activeForm.slug && makeSlug()" /></label>
            <label><span>URL 标识</span><input v-model.trim="activeForm.slug" required pattern="[a-z0-9-]+" aria-describedby="slug-help" /><small id="slug-help">仅英文小写、数字和连字符，例如 river-story</small></label>
            <label><span>摘要</span><textarea v-model.trim="activeForm.summary" required maxlength="500" rows="3" /></label>
            <label><span>正文</span><textarea v-model.trim="activeForm.content" required rows="8" /></label>
            <details class="admin-form-fold" :open="editing || Boolean(activeForm.titleEn || activeForm.summaryEn)">
              <summary><span>器物规格与双语译文 <em>可选</em></span></summary>
              <div class="admin-form-fold__body">
                <label v-if="tab === 'artifacts'"><span>登记号 <em>可选</em></span><input v-model.trim="activeForm.accessionNo" maxlength="64" /></label>
                <div v-if="tab === 'artifacts'" class="admin-form-grid"><label><span>年代 <em>可选</em></span><input v-model.trim="activeForm.period" /></label><label><span>材质 <em>可选</em></span><input v-model.trim="activeForm.material" /></label><label><span>尺寸 <em>可选</em></span><input v-model.trim="activeForm.dimensions" /></label><label><span>典藏地 <em>可选</em></span><input v-model.trim="activeForm.collectionLocation" /></label></div>
                <label><span>英文标题 <em>可选</em></span><input v-model.trim="activeForm.titleEn" maxlength="300" /></label>
                <label><span>英文摘要 <em>可选</em></span><textarea v-model.trim="activeForm.summaryEn" maxlength="1000" rows="3" /></label>
                <p class="form-hint">{{ !activeForm.titleEn || !activeForm.summaryEn ? '英文译文尚未补齐，无法保证英文搜索命中。' : '英文译文已填写。' }} 修改中文内容后，请同步核对译文。</p>
                <label><span>封面图片路径 <em>可选</em></span><input v-model.trim="activeForm.coverImageUrl" placeholder="/media/exhibits/…" /></label>
                <label v-if="tab === 'articles'"><span>前台作者名 <em>可选</em></span><input v-model.trim="activeForm.authorDisplay" /></label>
              </div>
            </details>
            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="saving">{{ editing ? '保存修改' : '创建草稿' }}</FluidButton>
              <FluidButton variant="ghost" block :disabled="saving" @click="cancelEditing">{{ editing ? '取消编辑' : '收起抽屉' }}</FluidButton>
            </div>
          </form>

          <!-- Live 68ch Front-of-House Monograph Preview -->
          <section v-show="drawerView === 'preview'" class="admin-preview-plate" data-testid="admin-drawer-preview" aria-label="前台 68ch 画册实时预览">
            <div class="admin-preview-plate__bar">
              <span class="font-mono">FRONTSTAGE · 68CH MONOGRAPH</span>
              <div class="admin-preview-plate__lang" role="group" aria-label="预览语种">
                <button type="button" :class="{ active: previewLocale === 'zh-CN' }" @click="previewLocale = 'zh-CN'">中文</button>
                <button type="button" :class="{ active: previewLocale === 'en-US' }" @click="previewLocale = 'en-US'">EN</button>
              </div>
            </div>
            <p v-if="previewLocale === 'en-US' && !formEnComplete" class="admin-preview-plate__warn">
              当前英文标题或英文摘要尚未填写完整，英文前台将暂用中文兜底。
            </p>
            <header class="admin-preview-plate__head">
              <span class="admin-preview-plate__kicker">{{ previewCategoryName }}<template v-if="activeForm.accessionNo"> · {{ activeForm.accessionNo }}</template></span>
              <h3>{{ previewTitle }}</h3>
              <p class="admin-preview-plate__summary">{{ previewSummary }}</p>
            </header>
            <figure v-if="previewCoverUrl" class="admin-preview-plate__media">
              <img :src="previewCoverUrl" :alt="previewTitle" />
            </figure>
            <dl v-if="tab === 'artifacts' && (activeForm.period || activeForm.material || activeForm.dimensions || activeForm.collectionLocation)" class="admin-preview-plate__specs">
              <div v-if="activeForm.period"><dt>年代</dt><dd>{{ activeForm.period }}</dd></div>
              <div v-if="activeForm.material"><dt>材质</dt><dd>{{ activeForm.material }}</dd></div>
              <div v-if="activeForm.dimensions"><dt>尺寸</dt><dd>{{ activeForm.dimensions }}</dd></div>
              <div v-if="activeForm.collectionLocation"><dt>典藏地</dt><dd>{{ activeForm.collectionLocation }}</dd></div>
            </dl>
            <div v-if="previewProfile" class="admin-preview-plate__swatches">
              <span v-for="swatch in previewProfile.swatches" :key="swatch.oklch" class="admin-preview-swatch">
                <i :style="{ backgroundColor: swatch.oklch }" aria-hidden="true"></i>
                {{ previewLocale === 'en-US' ? swatch.nameEn : swatch.nameZh }}
              </span>
            </div>
            <div class="admin-preview-plate__prose">
              <template v-if="previewBlocks.length">
                <template v-for="(block, idx) in previewBlocks" :key="idx">
                  <h4 v-if="block.heading">{{ block.text }}</h4>
                  <p v-else :class="{ 'is-lead': idx === 0 }">{{ block.text }}</p>
                </template>
              </template>
              <p v-else class="admin-preview-plate__placeholder">在「表单编辑」中输入正文段落，双回车分段即可实时预览 68ch 宋刻图录排印效果。</p>
            </div>
          </section>
        </div>
      </aside>
    </div>

    <AdminConfirmDialog v-if="confirmation" :open="Boolean(confirmation)" :title="confirmation.title" :message="confirmation.message" :confirm-label="confirmation.confirmLabel" :pending="confirmationPending" @confirm="confirmAction" @cancel="confirmation = null" />
    <AdminConfirmDialog v-if="unsaved.open.value" :open="unsaved.open.value" title="还有未保存的内容" message="保存当前表单后继续，或放弃本次修改。" :error="error" confirm-label="保存并继续" secondary-label="放弃修改" cancel-label="继续编辑" :pending="unsaved.pending.value" @confirm="unsaved.decide('save')" @secondary="unsaved.decide('discard')" @cancel="unsaved.decide('continue')" />
  </AdminShell>
</template>
