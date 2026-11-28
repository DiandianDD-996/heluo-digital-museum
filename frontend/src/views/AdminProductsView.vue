<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiGet, apiRequest, type ContentPage } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { refreshAdminNavCounts } from '../composables/useAdminNavCounts'
import { useUnsavedChanges } from '../composables/useUnsavedChanges'
import AdminShell from '../components/AdminShell.vue'
import FluidButton from '../components/FluidButton.vue'
import InlineStatus from '../components/InlineStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AdminActionButton from '../components/AdminActionButton.vue'
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue'

interface ProductItem {
  id: number
  sku: string
  name: string
  slug: string
  summary: string
  description: string
  price: string
  stockQuantity: number
  lockedStock: number
  coverImageUrl: string
  status: 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN'
  deleted: boolean
  nameEn?: string | null
  summaryEn?: string | null
  descriptionEn?: string | null
  categoryCode?: string | null
  inspirationArtifactSlug?: string | null
}

interface CategoryOption {
  code: string
  name: string
}

interface ArtifactSlugOption {
  id: number
  title: string
  slug: string
}

type ViewFilter = 'all' | 'lowStock' | 'trash'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const items = ref<ProductItem[]>([])
const categories = ref<CategoryOption[]>([])
const artifacts = ref<ArtifactSlugOption[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const viewMode = ref<ViewFilter>('all')
const statusFilter = ref('')
const keyword = ref('')
const loading = ref(true)
const mutating = ref(false)
const error = ref('')
const message = ref('')

// Inline quick restock state
const restockingId = ref<number | null>(null)
const restockQty = ref(0)

// Drawer state
const drawerOpen = ref(false)
const editingProduct = ref<ProductItem | null>(null)
const formElement = ref<HTMLFormElement | null>(null)
const baseline = ref('')
const confirmationPending = ref(false)
const confirmation = ref<{ title: string; message: string; confirmLabel: string; run: () => Promise<void> } | null>(null)

const form = reactive({
  sku: '',
  name: '',
  slug: '',
  price: '39.00',
  stockQuantity: 10,
  coverImageUrl: '',
  summary: '',
  description: '',
  nameEn: '',
  summaryEn: '',
  descriptionEn: '',
  categoryCode: '',
  inspirationArtifactSlug: '',
})

let loadSeq = 0
let abortController: AbortController | undefined

const drawerTitle = computed(() => editingProduct.value ? `编辑文创商品 · ${editingProduct.value.name}` : '新建文创商品草稿')
const unsaved = useUnsavedChanges({
  value: () => form,
  dirty: () => drawerOpen.value && JSON.stringify(form) !== baseline.value,
  save,
  discard: resetAndClose,
  blocked: () => mutating.value,
})

function availableStock(item: ProductItem): number {
  return Math.max(0, item.stockQuantity - item.lockedStock)
}

function hasBilingual(item: ProductItem): boolean {
  return Boolean(item.nameEn?.trim() && item.summaryEn?.trim())
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
      deleted: viewMode.value === 'trash' ? 'true' : 'false',
    })
    if (viewMode.value === 'lowStock') params.set('lowStock', 'true')
    if (statusFilter.value && viewMode.value !== 'trash') params.set('status', statusFilter.value)
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())

    const [prodData, catData, artData] = await Promise.all([
      apiGet<ContentPage<ProductItem>>(`/admin/products?${params.toString()}`, auth.token, { signal: controller.signal }),
      categories.value.length ? Promise.resolve(categories.value) : apiGet<CategoryOption[]>('/admin/categories', auth.token, { signal: controller.signal }),
      artifacts.value.length ? Promise.resolve({ items: artifacts.value }) : apiGet<ContentPage<ArtifactSlugOption>>('/admin/artifacts?page=1&size=100&deleted=false', auth.token, { signal: controller.signal }),
    ])
    if (seq !== loadSeq) return
    items.value = prodData.items
    total.value = prodData.total
    totalPages.value = Math.max(1, prodData.totalPages)
    categories.value = catData
    artifacts.value = artData.items
  } catch (reason) {
    if (seq === loadSeq && !(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '文创商品加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function resetForm() {
  editingProduct.value = null
  Object.assign(form, {
    sku: '',
    name: '',
    slug: '',
    price: '39.00',
    stockQuantity: 10,
    coverImageUrl: '',
    summary: '',
    description: '',
    nameEn: '',
    summaryEn: '',
    descriptionEn: '',
    categoryCode: '',
    inspirationArtifactSlug: '',
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

function openEdit(item: ProductItem) {
  void unsaved.attempt(() => {
    editingProduct.value = item
    error.value = ''
    Object.assign(form, {
      sku: item.sku,
      name: item.name,
      slug: item.slug,
      price: item.price,
      stockQuantity: item.stockQuantity,
      coverImageUrl: item.coverImageUrl ?? '',
      summary: item.summary ?? '',
      description: item.description ?? '',
      nameEn: item.nameEn ?? '',
      summaryEn: item.summaryEn ?? '',
      descriptionEn: item.descriptionEn ?? '',
      categoryCode: item.categoryCode ?? '',
      inspirationArtifactSlug: item.inspirationArtifactSlug ?? '',
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
    error.value = '请补全商品 SKU、名称、价格与库存等必填项。'
    return false
  }
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      slug: form.slug.trim(),
      price: Number(form.price),
      stockQuantity: Number(form.stockQuantity),
      coverImageUrl: form.coverImageUrl.trim() || null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      nameEn: form.nameEn.trim() || null,
      summaryEn: form.summaryEn.trim() || null,
      descriptionEn: form.descriptionEn.trim() || null,
      categoryCode: form.categoryCode.trim() || '',
      inspirationArtifactSlug: form.inspirationArtifactSlug.trim() || '',
    }
    if (!editingProduct.value) {
      await apiRequest('/admin/products', 'POST', payload, auth.token)
      message.value = '文创商品草稿已创建。'
    } else {
      await apiRequest(`/admin/products/${editingProduct.value.id}`, 'PATCH', payload, auth.token)
      message.value = '文创商品信息、双语与溯源关联已保存。'
    }
    resetAndClose()
    await Promise.all([load(), refreshAdminNavCounts(true)])
    return true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存商品失败。'
    return false
  } finally {
    mutating.value = false
  }
}

function beginRestock(item: ProductItem) {
  if (restockingId.value === item.id) {
    restockingId.value = null
    return
  }
  restockingId.value = item.id
  restockQty.value = item.stockQuantity
}

async function submitRestock(item: ProductItem, nextQuantity = restockQty.value) {
  if (mutating.value) return
  if (nextQuantity < item.lockedStock) {
    error.value = `库存不能低于当前已锁定库存（${item.lockedStock} 件）。`
    return
  }
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    await apiRequest(`/admin/products/${item.id}/stock`, 'PATCH', { stockQuantity: Number(nextQuantity) }, auth.token)
    message.value = `「${item.name}」库存已调整为 ${nextQuantity} 件。`
    restockingId.value = null
    await Promise.all([load(), refreshAdminNavCounts(true)])
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '快捷补货失败。'
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
    await Promise.all([load(), refreshAdminNavCounts(true)])
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '商品状态更新失败。'
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

function selectViewMode(mode: ViewFilter) {
  viewMode.value = mode
  page.value = 1
  void load()
}

function applySearch() {
  page.value = 1
  void load()
}

function resetFilters() {
  viewMode.value = 'all'
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

watch(() => route.query.lowStock, (val) => {
  if (val === '1' || val === 'true') {
    viewMode.value = 'lowStock'
    if (items.value.length) void load()
  }
}, { immediate: true })

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
    title="文创商品台账"
    description="管理文创商品定价、行内快捷补货、双语策展文案及灵感馆藏文物溯源关联。"
    section="products"
  >
    <template #header-actions>
      <button type="button" class="admin-primary-btn" data-testid="admin-products-create" @click="openCreate">
        + 新建商品
      </button>
      <RouterLink class="admin-header-link" to="/admin/orders">商城订单 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <section class="admin-records" data-glass="light">
      <div class="appt-toolbar">
        <div class="dashboard-segmented" role="group" aria-label="商品视图">
          <button type="button" :class="{ active: viewMode === 'all' }" @click="selectViewMode('all')">全部在库</button>
          <button type="button" data-testid="products-low-stock-tab" :class="{ active: viewMode === 'lowStock' }" @click="selectViewMode('lowStock')">
            低库存（≤5）
          </button>
          <button type="button" :class="{ active: viewMode === 'trash' }" @click="selectViewMode('trash')">回收站</button>
        </div>

        <div class="admin-list-filters">
          <label class="admin-filter-field admin-filter-field--search">
            <span class="admin-filter-field__label">检索商品</span>
            <input
              v-model.trim="keyword"
              type="search"
              data-testid="products-search-input"
              placeholder="名称、SKU、Slug 或摘要"
              @keyup.enter="applySearch"
            />
          </label>
          <label class="admin-filter-field">
            <span class="admin-filter-field__label">状态</span>
            <select v-model="statusFilter" :disabled="viewMode === 'trash'" @change="applySearch">
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">已上架</option>
              <option value="WITHDRAWN">已下架</option>
            </select>
          </label>
          <button type="button" class="admin-text-button" data-testid="products-search-btn" @click="applySearch">筛选</button>
          <button type="button" class="admin-text-button" @click="resetFilters">重置</button>
        </div>

        <strong class="admin-count">共 {{ total }} 件</strong>
      </div>

      <div v-if="loading" class="state-panel">正在加载文创商品台账…</div>
      <div v-else-if="items.length === 0" class="state-panel">暂无符合条件的文创商品。</div>
      <div v-else class="admin-list admin-table--products" data-testid="products-table">
        <div class="admin-list-head" aria-hidden="true">
          <span>状态</span>
          <span>商品档案</span>
          <span>单价</span>
          <span>库存态势</span>
          <span>双语与溯源</span>
          <span>操作</span>
        </div>

        <article v-for="item in items" :key="item.id" data-glass="compact">
          <div class="admin-record-status">
            <StatusBadge :status="item.deleted ? 'DISABLED' : item.status" />
          </div>

          <div class="admin-product-identity">
            <img v-if="item.coverImageUrl" :src="item.coverImageUrl" :alt="item.name" class="admin-product-thumb" />
            <div class="admin-record-copy">
              <h3>{{ item.name }}</h3>
              <p class="font-mono">{{ item.sku }} · /shop#{{ item.slug }}</p>
            </div>
          </div>

          <div class="admin-table-cell">
            <strong class="admin-price-val">¥ {{ item.price }}</strong>
          </div>

          <div class="admin-table-cell">
            <span :class="{ 'is-low-stock-text': !item.deleted && availableStock(item) <= 5 }">
              可售 {{ availableStock(item) }} 件
            </span>
            <small>总计 {{ item.stockQuantity }} · 锁定 {{ item.lockedStock }}</small>
          </div>

          <div class="admin-table-cell">
            <span class="admin-bilingual-badge" :class="hasBilingual(item) ? 'is-ready' : 'is-missing'">
              {{ hasBilingual(item) ? 'EN 已译' : '缺译文' }}
            </span>
            <small v-if="item.inspirationArtifactSlug">灵感：{{ item.inspirationArtifactSlug }}</small>
          </div>

          <div class="admin-actions-wrap">
            <div class="admin-actions">
              <button
                v-if="!item.deleted"
                type="button"
                class="admin-text-button admin-text-button--compact"
                :data-testid="`product-restock-trigger-${item.id}`"
                @click="beginRestock(item)"
              >
                {{ restockingId === item.id ? '收起补货' : '快捷补货' }}
              </button>
              <AdminActionButton v-if="!item.deleted" action="edit" :data-testid="`product-edit-${item.id}`" @click="openEdit(item)">
                编辑
              </AdminActionButton>
              <AdminActionButton
                v-if="!item.deleted && item.status !== 'PUBLISHED'"
                action="shelf"
                :disabled="mutating"
                @click="mutate(`/admin/products/${item.id}/on-shelf`, 'POST', '商品已上架。')"
              >
                上架
              </AdminActionButton>
              <AdminActionButton
                v-if="!item.deleted && item.status === 'PUBLISHED'"
                action="unshelf"
                :disabled="mutating"
                @click="requestConfirm('确认下架商品？', `${item.name} 将从河洛文创商城下架。`, '确认下架', `/admin/products/${item.id}/off-shelf`, 'POST', '商品已下架。')"
              >
                下架
              </AdminActionButton>
              <AdminActionButton
                v-if="!item.deleted"
                action="delete"
                :disabled="mutating"
                @click="requestConfirm('确认删除商品？', `${item.name} 将移入回收站。`, '移入回收站', `/admin/products/${item.id}`, 'DELETE', '商品已移入回收站。')"
              >
                删除
              </AdminActionButton>
              <AdminActionButton
                v-if="item.deleted"
                action="restore"
                :disabled="mutating"
                @click="mutate(`/admin/products/${item.id}/restore`, 'POST', '商品已从回收站恢复。')"
              >
                恢复
              </AdminActionButton>
            </div>

            <div v-if="restockingId === item.id" class="admin-restock-inline" :data-testid="`product-restock-bar-${item.id}`">
              <input v-model.number="restockQty" type="number" :min="item.lockedStock" aria-label="新库存数量" />
              <button type="button" class="admin-text-button admin-text-button--compact" :data-testid="`product-restock-plus10-${item.id}`" :disabled="mutating" @click="submitRestock(item, item.stockQuantity + 10)">
                +10
              </button>
              <button type="button" class="admin-text-button admin-text-button--compact" :disabled="mutating" @click="submitRestock(item, item.stockQuantity + 20)">
                +20
              </button>
              <button type="button" class="admin-primary-btn admin-primary-btn--compact" :disabled="mutating" @click="submitRestock(item)">
                保存
              </button>
            </div>
          </div>
        </article>

        <nav v-if="totalPages > 1" class="admin-pagination" aria-label="商品分页">
          <button type="button" :disabled="loading || page === 1" @click="page -= 1; load()">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="loading || page === totalPages" @click="page += 1; load()">下一页</button>
        </nav>
      </div>
    </section>

    <div v-if="drawerOpen" class="admin-drawer-backdrop" @click.self="closeDrawer">
      <aside class="admin-drawer admin-drawer--wide" data-testid="admin-product-drawer" role="region" :aria-label="drawerTitle">
        <header class="admin-drawer__head">
          <div class="admin-drawer__title">
            <h2>{{ drawerTitle }}</h2>
          </div>
          <button type="button" class="admin-drawer__close" aria-label="关闭商品抽屉" @click="closeDrawer">×</button>
        </header>

        <div class="admin-drawer__body">
          <InlineStatus v-if="error" :message="error" kind="error" />
          <form ref="formElement" class="admin-drawer-form" :inert="mutating" @submit.prevent="save">
            <div class="admin-form-grid">
              <label><span>商品 SKU</span><input v-model.trim="form.sku" required maxlength="64" /></label>
              <label><span>URL 标识（Slug）</span><input v-model.trim="form.slug" pattern="[a-z0-9-]{3,180}" required /></label>
            </div>

            <div class="admin-form-grid">
              <label><span>中文名称</span><input v-model.trim="form.name" required maxlength="150" /></label>
              <label><span>英文名称 <em>可选</em></span><input v-model.trim="form.nameEn" maxlength="300" /></label>
            </div>

            <div class="admin-form-grid">
              <label><span>销售单价（¥）</span><input v-model="form.price" type="number" min="0.01" step="0.01" required /></label>
              <label>
                <span>总库存 <em v-if="editingProduct">已锁 {{ editingProduct.lockedStock }} 件</em></span>
                <input v-model.number="form.stockQuantity" type="number" :min="editingProduct?.lockedStock ?? 0" required />
              </label>
            </div>

            <div class="admin-form-grid">
              <label>
                <span>所属分类编码</span>
                <select v-model="form.categoryCode">
                  <option value="">不限定分类</option>
                  <option v-for="cat in categories" :key="cat.code" :value="cat.code">
                    {{ cat.name }}（{{ cat.code }}）
                  </option>
                </select>
              </label>
              <label>
                <span>灵感关联文物 <em>文创溯源展示</em></span>
                <select v-model="form.inspirationArtifactSlug">
                  <option value="">暂不关联</option>
                  <option v-for="art in artifacts" :key="art.id" :value="art.slug">
                    {{ art.title }}（{{ art.slug }}）
                  </option>
                </select>
              </label>
            </div>

            <label><span>封面图片路径</span><input v-model.trim="form.coverImageUrl" maxlength="500" /></label>
            <label><span>中文摘要</span><textarea v-model.trim="form.summary" rows="2" maxlength="500" /></label>
            <label><span>英文摘要 <em>可选</em></span><textarea v-model.trim="form.summaryEn" rows="2" maxlength="1000" /></label>
            <label><span>中文商品故事</span><textarea v-model.trim="form.description" rows="3" /></label>
            <label><span>英文商品故事 <em>可选</em></span><textarea v-model.trim="form.descriptionEn" rows="3" /></label>

            <div class="admin-form-actions">
              <FluidButton type="submit" block :loading="mutating">{{ editingProduct ? '保存商品修改' : '创建商品草稿' }}</FluidButton>
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
      title="还有未保存的商品修改"
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
