<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../stores/theme'
import { useAdminNavCounts } from '../composables/useAdminNavCounts'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

interface CommandEntry {
  id: string
  group: '页面直达' | '高频动作'
  title: string
  subtitle: string
  keywords: string
  badge?: number
  run: () => void | Promise<void>
}

const router = useRouter()
const { isDark, toggle } = useTheme()
const { counts } = useAdminNavCounts()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

function close() {
  emit('update:open', false)
}

function go(path: string) {
  close()
  void router.push(path)
}

const commands = computed<CommandEntry[]>(() => [
  { id: 'nav-dashboard', group: '页面直达', title: '运营看板', subtitle: '网站人流、预约承载与文创营收图表', keywords: 'dashboard analytics pv uv chart 看板 统计', run: () => go('/admin') },
  { id: 'nav-artifacts', group: '页面直达', title: '馆藏文物', subtitle: '文物档案、双语译文与发布状态', keywords: 'artifacts 藏品 文物', run: () => go('/admin/artifacts') },
  { id: 'nav-articles', group: '页面直达', title: '文化专题', subtitle: '图录文章编辑与 68ch 预览', keywords: 'articles 专题 文章', run: () => go('/admin/articles') },
  { id: 'nav-exhibits', group: '页面直达', title: '3D 数字展项', subtitle: 'GLB 模型、双语字段与光学展柜管理', keywords: 'exhibits 3d glb 模型 展项', run: () => go('/admin/exhibits') },
  { id: 'nav-categories', group: '页面直达', title: '展陈分类', subtitle: '分类编码、权重排序与中英文描述', keywords: 'categories taxonomy 分类', run: () => go('/admin/categories') },
  { id: 'nav-appointments', group: '页面直达', title: '预约与现场核销', subtitle: '前厅快核台、全库检索与入馆名单导出', keywords: 'appointments checkin csv 预约 核销', badge: counts.pendingAppointments, run: () => go('/admin/appointments') },
  { id: 'nav-slots', group: '页面直达', title: '排班与时段日历', subtitle: '自然月排班调度、批量生成与临时闭馆', keywords: 'slots calendar schedule 排班 时段 日历', run: () => go('/admin/slots') },
  { id: 'nav-products', group: '页面直达', title: '文创商品', subtitle: '文创价格、行内补货与灵感文物关联', keywords: 'products stock sku 文创 商品 库存', badge: counts.lowStockProducts, run: () => go('/admin/products') },
  { id: 'nav-orders', group: '页面直达', title: '商城订单', subtitle: '订单明细时间轴、履约标记与订单导出', keywords: 'orders payment 订单 商城 支付', badge: counts.paidOrders, run: () => go('/admin/orders') },
  { id: 'nav-users', group: '页面直达', title: '观众账号', subtitle: '注册观众检索、启禁用与密码重置', keywords: 'users accounts 观众 用户', run: () => go('/admin/users') },
  { id: 'nav-guide', group: '页面直达', title: '洛笙 AI 治理', subtitle: '向导运行模式、每日配额与知识缓存', keywords: 'guide luosheng ai 洛笙 治理', run: () => go('/admin/guide') },
  { id: 'nav-logs', group: '页面直达', title: '审计日志', subtitle: '按模块、操作人与日期追踪后台动作', keywords: 'logs audit 审计 日志', run: () => go('/admin/logs') },
  { id: 'act-theme', group: '高频动作', title: isDark.value ? '切换到浅色工作台' : '切换到深色工作台', subtitle: '即时切换双主题外观', keywords: 'theme dark light 主题 深色 浅色', run: () => { toggle(); close() } },
  { id: 'act-low-stock', group: '高频动作', title: '查看低库存文创商品（≤5 件）', subtitle: '直达商品页低库存预警视图并快捷补货', keywords: 'low stock restock 补货 预警', badge: counts.lowStockProducts, run: () => go('/admin/products?lowStock=1') },
  { id: 'act-today-checkin', group: '高频动作', title: '前往前厅快核与今日名单导出', subtitle: '打开现场核销台与 CSV 名单导出', keywords: 'checkin export 核销 导出', run: () => go('/admin/appointments') },
  { id: 'act-batch-slots', group: '高频动作', title: '排班日历与批量开放排班', subtitle: '查看当月承载力并调整场次状态', keywords: 'batch slots 批量排班 闭馆', run: () => go('/admin/slots') },
  { id: 'act-front', group: '高频动作', title: '返回数字博物馆前台', subtitle: '前往观众公开游览首页', keywords: 'home public 前台 首页', run: () => go('/') },
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands.value
  return commands.value.filter(item =>
    item.title.toLowerCase().includes(q)
    || item.subtitle.toLowerCase().includes(q)
    || item.keywords.toLowerCase().includes(q)
    || item.group.toLowerCase().includes(q))
})

function execute(entry?: CommandEntry) {
  if (!entry) return
  void entry.run()
}

function onDialogKeydown(event: KeyboardEvent) {
  const list = filtered.value
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (!list.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % list.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + list.length) % list.length
  } else if (event.key === 'Enter') {
    event.preventDefault()
    execute(list[activeIndex.value] ?? list[0])
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    emit('update:open', !props.open)
  } else if (event.key === 'Escape' && props.open) {
    event.preventDefault()
    close()
  }
}

watch(query, () => {
  activeIndex.value = 0
})

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <div
    v-if="open"
    class="admin-cmd-backdrop"
    data-testid="admin-command-palette"
    role="dialog"
    aria-modal="true"
    aria-label="后台快捷指令栏"
    @click.self="close"
    @keydown="onDialogKeydown"
  >
    <div class="admin-cmd-dialog">
      <div class="admin-cmd-input-row">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          data-testid="admin-command-input"
          placeholder="搜索后台模块或快捷操作（如：订单、补货、3D、核销、深色）…"
          aria-label="搜索快捷指令"
        />
        <kbd>ESC</kbd>
      </div>

      <div v-if="filtered.length === 0" class="admin-cmd-empty">
        未找到与「{{ query }}」匹配的页面或动作。
      </div>

      <ul v-else class="admin-cmd-list" role="listbox" aria-label="快捷指令候选">
        <li v-for="(item, idx) in filtered" :key="item.id">
          <button
            type="button"
            role="option"
            class="admin-cmd-item"
            :class="{ 'is-active': idx === activeIndex }"
            :aria-selected="idx === activeIndex"
            :data-testid="`admin-cmd-${item.id}`"
            @mouseenter="activeIndex = idx"
            @click="execute(item)"
          >
            <div class="admin-cmd-item__copy">
              <span class="admin-cmd-item__group">{{ item.group }}</span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.subtitle }}</small>
            </div>
            <div class="admin-cmd-item__right">
              <em v-if="item.badge && item.badge > 0" class="admin-cmd-badge">{{ item.badge }}</em>
              <span class="admin-cmd-enter">↵</span>
            </div>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
