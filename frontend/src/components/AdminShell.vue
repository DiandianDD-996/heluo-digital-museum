<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import MuseumBrandSeal from './MuseumBrandSeal.vue'
import AdminCommandPalette from './AdminCommandPalette.vue'
import { useTheme } from '../stores/theme'
import { useAdminNavCounts } from '../composables/useAdminNavCounts'

export type AdminSection =
  | 'dashboard'
  | 'artifacts'
  | 'articles'
  | 'exhibits'
  | 'categories'
  | 'appointments'
  | 'slots'
  | 'products'
  | 'orders'
  | 'users'
  | 'guide'
  | 'logs'
  | 'content'
  | 'operations'

interface NavItem {
  id: AdminSection
  to: string
  label: string
  sub: string
  badgeKey?: 'pendingAppointments' | 'lowStockProducts' | 'paidOrders'
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const props = defineProps<{ title: string; description: string; section: AdminSection }>()

const SIDEBAR_STORAGE_KEY = 'heluo.admin.sidebarCollapsed'
const route = useRoute()
const { isDark, toggle } = useTheme()
const { counts, refresh } = useAdminNavCounts()

const collapsed = ref(false)
const mobileNavOpen = ref(false)
const commandOpen = ref(false)

const navGroups: NavGroup[] = [
  {
    key: 'overview',
    label: '馆务总览',
    items: [
      { id: 'dashboard', to: '/admin', label: '运营看板', sub: '人流与趋势' },
    ],
  },
  {
    key: 'curation',
    label: '策展与典藏',
    items: [
      { id: 'artifacts', to: '/admin/artifacts', label: '馆藏文物', sub: '档案与双语' },
      { id: 'articles', to: '/admin/articles', label: '文化专题', sub: '图录与文章' },
      { id: 'exhibits', to: '/admin/exhibits', label: '3D 数字展项', sub: '点云与光学' },
      { id: 'categories', to: '/admin/categories', label: '展陈分类', sub: '分类与排序' },
    ],
  },
  {
    key: 'visits',
    label: '参观与预约',
    items: [
      { id: 'appointments', to: '/admin/appointments', label: '预约与核销', sub: '审核与入馆', badgeKey: 'pendingAppointments' },
      { id: 'slots', to: '/admin/slots', label: '排班与时段', sub: '容量与开放' },
    ],
  },
  {
    key: 'commerce',
    label: '文创与交易',
    items: [
      { id: 'products', to: '/admin/products', label: '文创商品', sub: '库存与上下架', badgeKey: 'lowStockProducts' },
      { id: 'orders', to: '/admin/orders', label: '商城订单', sub: '支付与履约', badgeKey: 'paidOrders' },
    ],
  },
  {
    key: 'governance',
    label: '系统与治理',
    items: [
      { id: 'users', to: '/admin/users', label: '观众账号', sub: '状态与重置' },
      { id: 'guide', to: '/admin/guide', label: '洛笙 AI 治理', sub: '配额与模式' },
      { id: 'logs', to: '/admin/logs', label: '审计日志', sub: '关键操作记录' },
    ],
  },
]

const effectiveSection = computed<AdminSection>(() => {
  if (props.section === 'content') return 'artifacts'
  if (props.section === 'operations') return 'users'
  return props.section
})

const currentBreadcrumb = computed(() => {
  for (const group of navGroups) {
    const found = group.items.find(item => item.id === effectiveSection.value)
    if (found) return { group: group.label, item: found.label }
  }
  return { group: '管理工作台', item: props.title }
})

function badgeFor(item: NavItem): number {
  if (!item.badgeKey) return 0
  return counts[item.badgeKey] ?? 0
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed.value ? '1' : '0')
  } catch {
    // Ignore storage errors
  }
}

function closeMobileNav() {
  mobileNavOpen.value = false
}

function onShellKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mobileNavOpen.value) {
    mobileNavOpen.value = false
  }
}

watch(() => route.fullPath, () => {
  mobileNavOpen.value = false
})

onMounted(() => {
  try {
    collapsed.value = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  } catch {
    collapsed.value = false
  }
  void refresh()
  window.addEventListener('keydown', onShellKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onShellKeydown)
})
</script>

<template>
  <section
    class="admin-workspace"
    :class="[`admin-workspace--${section}`, { 'is-sidebar-collapsed': collapsed }]"
  >
    <!-- Mobile compact top bar -->
    <div class="admin-mobile-bar">
      <button
        type="button"
        class="admin-mobile-bar__menu"
        aria-label="打开后台导航菜单"
        :aria-expanded="mobileNavOpen"
        @click="mobileNavOpen = true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        <span>导航</span>
      </button>
      <div class="admin-mobile-bar__title">
        <MuseumBrandSeal class="admin-mobile-bar__seal" />
        <span>{{ currentBreadcrumb.item }}</span>
      </div>
      <button
        class="theme-toggle admin-mobile-bar__theme"
        data-glass="compact"
        type="button"
        :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
        :aria-pressed="isDark"
        @click="toggle"
      >
        <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" /></svg>
      </button>
    </div>

    <div v-if="mobileNavOpen" class="admin-sidebar-backdrop" @click="closeMobileNav" />

    <aside
      class="admin-sidebar"
      :class="{ 'is-collapsed': collapsed, 'is-mobile-open': mobileNavOpen }"
      :data-glass="isDark ? 'dark' : 'light'"
      aria-label="后台管理导航"
    >
      <div class="admin-sidebar__top">
        <RouterLink class="admin-sidebar__brand" to="/admin" :title="collapsed ? '河洛数字博物馆 · 管理工作台' : undefined">
          <MuseumBrandSeal class="admin-sidebar__seal" />
          <span v-show="!collapsed"><b>河洛博物馆</b><small>管理工作台 v2</small></span>
        </RouterLink>
        <button
          type="button"
          class="admin-sidebar__collapse"
          :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
          :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleCollapsed"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="collapsed" d="m9 6 6 6-6 6" />
            <path v-else d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          class="admin-sidebar__mobile-close"
          aria-label="关闭导航菜单"
          @click="closeMobileNav"
        >
          ×
        </button>
      </div>

      <button
        type="button"
        class="admin-command-trigger"
        data-testid="admin-command-trigger"
        :title="collapsed ? '快捷指令 (Ctrl+K)' : undefined"
        @click="commandOpen = true"
      >
        <span class="admin-command-trigger__icon" aria-hidden="true">⌘</span>
        <span v-if="!collapsed" class="admin-command-trigger__label">快捷指令</span>
        <kbd v-if="!collapsed" class="admin-command-trigger__kbd">Ctrl K</kbd>
      </button>

      <nav class="admin-sidebar__nav">
        <div v-for="group in navGroups" :key="group.key" class="admin-nav-group">
          <span v-show="!collapsed" class="admin-nav-group__label">{{ group.label }}</span>
          <div class="admin-nav-group__list">
            <RouterLink
              v-for="item in group.items"
              :key="item.id"
              :to="item.to"
              class="admin-nav-item"
              :class="{ active: effectiveSection === item.id }"
              :title="collapsed ? `${item.label} · ${item.sub}` : undefined"
              :aria-label="item.label"
              :data-testid="`admin-nav-${item.id}`"
              @click="closeMobileNav"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path v-if="item.id === 'dashboard'" d="M4 13h7V4H4zm9 7h7v-9h-7zM4 20h7v-5H4zm9-16v5h7V4z" />
                <path v-else-if="item.id === 'artifacts'" d="M6 4.5h9.5L19 8v11.5H6zM15 4.5V8h4M9 11h7M9 14.5h7M9 18h4" />
                <path v-else-if="item.id === 'articles'" d="M5 5.5h14v13H5zM8.5 9.5h7M8.5 13h7M8.5 16.5h4.5" />
                <path v-else-if="item.id === 'exhibits'" d="M12 3.5 19.5 7.8v8.4L12 20.5l-7.5-4.3V7.8zM12 12l7.5-4.2M12 12v8.5M12 12 4.5 7.8" />
                <path v-else-if="item.id === 'categories'" d="M4 6h7v5H4zm9 0h7v5h-7zM4 13h7v5H4zm9 0h7v5h-7z" />
                <path v-else-if="item.id === 'appointments'" d="M5 7.5h14v11.5H5zM8 4.5v3M16 4.5v3M5 11h14M9.5 15l1.8 1.8 3.5-3.5" />
                <path v-else-if="item.id === 'slots'" d="M12 6v6l4 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
                <path v-else-if="item.id === 'products'" d="M6 8h12l-1 11H7zM9 8V6.5a3 3 0 0 1 6 0V8" />
                <path v-else-if="item.id === 'orders'" d="M6 4.5h12v15l-3-1.8-3 1.8-3-1.8-3 1.8zM9 9h6M9 12.5h6" />
                <path v-else-if="item.id === 'users'" d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 7.5a6.5 6.5 0 0 1 13 0" />
                <path v-else-if="item.id === 'guide'" d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path v-else d="M5 6h14M5 12h14M5 18h9" />
              </svg>
              <span v-show="!collapsed" class="admin-nav-item__copy">
                <b>{{ item.label }}</b>
              </span>
              <em
                v-if="badgeFor(item) > 0"
                class="admin-nav-badge"
                :class="{ 'is-dot': collapsed }"
                :aria-label="`${item.label}待处理 ${badgeFor(item)} 项`"
              >
                <template v-if="!collapsed">{{ badgeFor(item) > 99 ? '99+' : badgeFor(item) }}</template>
              </em>
            </RouterLink>
          </div>
        </div>
      </nav>

      <RouterLink class="admin-sidebar__exit" to="/" :title="collapsed ? '返回博物馆前台' : undefined">
        <span aria-hidden="true">←</span>
        <span v-show="!collapsed">返回博物馆前台</span>
      </RouterLink>
    </aside>

    <section class="admin-main">
      <div class="admin-context-rail">
        <span>河洛工作台</span>
        <i></i>
        <span>{{ currentBreadcrumb.group }}</span>
        <i></i>
        <b>{{ currentBreadcrumb.item }}</b>
      </div>
      <header class="admin-page-header" data-glass="light">
        <div class="admin-title-lockup">
          <h1>{{ title }}</h1>
          <span>{{ description }}</span>
        </div>
        <div class="admin-header-actions">
          <button
            class="theme-toggle"
            data-glass="compact"
            data-glass-interactive
            type="button"
            :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
            :aria-pressed="isDark"
            @click="toggle"
          >
            <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" /></svg>
            <span>{{ isDark ? '浅色' : '深色' }}</span>
          </button>
          <slot name="header-actions" />
        </div>
      </header>
      <slot />
    </section>

    <AdminCommandPalette v-model:open="commandOpen" />
  </section>
</template>
