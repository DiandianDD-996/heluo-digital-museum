<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, apiRequest } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { setAdminNavCounts } from '../composables/useAdminNavCounts'
import { buildDemoPreviewOverlay, type DashboardAnalyticsPayload } from '../lib/adminDemoAnalytics'
import AdminShell from '../components/AdminShell.vue'
import InlineStatus from '../components/InlineStatus.vue'
import KpiSparklineCard from '../components/admin/charts/KpiSparklineCard.vue'
import AreaTrendChart from '../components/admin/charts/AreaTrendChart.vue'
import AppointmentFlowChart from '../components/admin/charts/AppointmentFlowChart.vue'
import CapacityHorizonChart from '../components/admin/charts/CapacityHorizonChart.vue'
import RankedBarChart from '../components/admin/charts/RankedBarChart.vue'
import type { DonutSegment } from '../components/admin/charts/DonutStatusChart.vue'
import OrderRatioBar from '../components/admin/charts/OrderRatioBar.vue'
import SlotRadialCompassChart from '../components/admin/charts/SlotRadialCompassChart.vue'
import SalesTrendChart from '../components/admin/charts/SalesTrendChart.vue'
import { formatCompactNumber, formatCurrency } from '../components/admin/charts/chartGeometry'

type RangeDays = 7 | 30 | 90
type DataMode = 'auto' | 'demo' | 'real'

interface GuideOverview {
  enabled: boolean
  usedToday: number
  dailyLimit: number
  inFlight: number
  runtimeMode: 'NORMAL' | 'DETERMINISTIC' | 'PAUSED'
}

const auth = useAuthStore()
const router = useRouter()

const rangeDays = ref<RangeDays>(30)
const dataMode = ref<DataMode>('auto')
const loading = ref(true)
const mutatingDemo = ref(false)
const error = ref('')
const notice = ref('')
const rawAnalytics = ref<DashboardAnalyticsPayload | null>(null)
const guideOverview = ref<GuideOverview | null>(null)

let abortController: AbortController | undefined
let loadSeq = 0

const effectiveDemoMode = computed(() => {
  if (dataMode.value === 'demo') return true
  if (dataMode.value === 'real') return false
  // Auto mode shows demo preview only when real site traffic has not been collected yet
  return !(rawAnalytics.value?.hasRealTraffic ?? false)
})

const viewData = computed<DashboardAnalyticsPayload | null>(() => {
  const base = rawAnalytics.value
  if (!base) return null
  return effectiveDemoMode.value ? buildDemoPreviewOverlay(base) : base
})

const orderDonutSegments = computed<DonutSegment[]>(() => {
  const counts = viewData.value?.orderStatusCounts ?? {}
  return [
    { key: 'COMPLETED', label: '已完成', value: counts.COMPLETED ?? 0, tone: 'series3' },
    { key: 'PAID', label: '待履约（已支付）', value: counts.PAID ?? 0, tone: 'series1' },
    { key: 'PENDING_PAYMENT', label: '待支付', value: counts.PENDING_PAYMENT ?? 0, tone: 'series4' },
    { key: 'CANCELLED', label: '超时/已取消', value: counts.CANCELLED ?? 0, tone: 'danger' },
  ]
})

const todoItems = computed(() => {
  const d = viewData.value
  if (!d) return []
  return [
    {
      label: '待确认入馆预约',
      count: d.todoCounts.pendingAppointments,
      hint: d.todoCounts.pendingAppointments > 0 ? '建议优先核对并确认观众预约' : '当前无待审核预约',
      to: '/admin/appointments',
      tone: d.todoCounts.pendingAppointments > 0 ? 'warning' : 'ok',
    },
    {
      label: '已支付待完成订单',
      count: d.todoCounts.paidOrders,
      hint: d.todoCounts.paidOrders > 0 ? '文创订单已模拟支付，等待标记完成' : '暂无积压订单',
      to: '/admin/orders',
      tone: d.todoCounts.paidOrders > 0 ? 'info' : 'ok',
    },
    {
      label: '低库存文创商品（≤5 件）',
      count: d.todoCounts.lowStockProducts,
      hint: d.lowStockProducts[0] ? `${d.lowStockProducts[0].name} 仅余 ${d.lowStockProducts[0].availableStock} 件` : '全线商品库存充足',
      to: '/admin/products',
      tone: d.todoCounts.lowStockProducts > 0 ? 'danger' : 'ok',
    },
    {
      label: '待发布草稿与缺译文内容',
      count: d.todoCounts.draftContents + d.todoCounts.missingEnContents,
      hint: `草稿 ${d.todoCounts.draftContents} 篇 · 缺英文译文 ${d.todoCounts.missingEnContents} 篇`,
      to: '/admin/artifacts',
      tone: (d.todoCounts.draftContents + d.todoCounts.missingEnContents) > 0 ? 'muted' : 'ok',
    },
  ]
})

async function loadDashboard() {
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
    const includeDemo = dataMode.value === 'demo'
    const opts = { signal: controller.signal }
    let [analytics, guide] = await Promise.all([
      apiGet<DashboardAnalyticsPayload>(`/admin/dashboard/analytics?days=${rangeDays.value}&includeDemo=${includeDemo}`, auth.token, opts),
      apiGet<GuideOverview>('/admin/guide/overview', auth.token, opts).catch(() => null),
    ])
    if (seq !== loadSeq) return
    if (dataMode.value === 'auto' && !analytics.hasRealTraffic && analytics.hasDemoTraffic) {
      analytics = await apiGet<DashboardAnalyticsPayload>(
        `/admin/dashboard/analytics?days=${rangeDays.value}&includeDemo=true`,
        auth.token,
        opts,
      )
      if (seq !== loadSeq) return
    }
    rawAnalytics.value = analytics
    guideOverview.value = guide
    setAdminNavCounts(analytics.todoCounts)
  } catch (reason) {
    if (seq === loadSeq) {
      error.value = reason instanceof Error ? reason.message : '运营看板数据加载失败。'
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function selectRange(days: RangeDays) {
  if (rangeDays.value === days) return
  rangeDays.value = days
  void loadDashboard()
}

function selectDataMode(mode: 'demo' | 'real') {
  dataMode.value = mode
  void loadDashboard()
}

async function seedDemoData() {
  if (mutatingDemo.value) return
  mutatingDemo.value = true
  error.value = ''
  notice.value = ''
  try {
    await apiRequest('/admin/dashboard/demo-analytics/seed', 'POST', undefined, auth.token)
    dataMode.value = 'demo'
    notice.value = '已向本地数据库注入 90 天博物馆演示访问数据。'
    await loadDashboard()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '演示数据写入失败。'
  } finally {
    mutatingDemo.value = false
  }
}

async function clearDemoData() {
  if (mutatingDemo.value) return
  mutatingDemo.value = true
  error.value = ''
  notice.value = ''
  try {
    await apiRequest('/admin/dashboard/demo-analytics', 'DELETE', undefined, auth.token)
    dataMode.value = 'real'
    notice.value = '已清空演示访问样本，当前完全展示真实统计。'
    await loadDashboard()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '清理演示样本失败。'
  } finally {
    mutatingDemo.value = false
  }
}

function openSlotsForDate(visitDate: string) {
  void router.push({ path: '/admin/slots', query: { date: visitDate } })
}

onMounted(() => {
  void loadDashboard()
})

onBeforeUnmount(() => {
  ++loadSeq
  abortController?.abort()
})
</script>

<template>
  <AdminShell
    v-if="auth.isAdmin"
    title="馆务运营看板"
    description="实时洞察全馆网站人流、入馆预约承载、文创营收与待办事项。"
    section="dashboard"
  >
    <template #header-actions>
      <div class="dashboard-controls" role="group" aria-label="统计周期与口径控制">
        <div class="dashboard-segmented" data-testid="dashboard-range-switch" role="group" aria-label="时间范围">
          <button type="button" :class="{ active: rangeDays === 7 }" @click="selectRange(7)">近 7 天</button>
          <button type="button" :class="{ active: rangeDays === 30 }" @click="selectRange(30)">近 30 天</button>
          <button type="button" :class="{ active: rangeDays === 90 }" @click="selectRange(90)">近 90 天</button>
        </div>
        <div class="dashboard-segmented" data-testid="dashboard-mode-switch" role="group" aria-label="数据口径">
          <button type="button" :class="{ active: effectiveDemoMode }" @click="selectDataMode('demo')">演示预览</button>
          <button type="button" :class="{ active: !effectiveDemoMode }" @click="selectDataMode('real')">真实统计</button>
        </div>
      </div>
    </template>

    <InlineStatus :message="notice" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <!-- Quiet single-line data mode micro-strip -->
    <div v-if="viewData" class="dashboard-mode-banner" :class="{ 'is-demo': effectiveDemoMode }" data-testid="dashboard-mode-banner">
      <div class="dashboard-mode-banner__text">
        <span class="dashboard-mode-pill">{{ effectiveDemoMode ? 'DEMO PREVIEW · 演示预览' : 'LIVE TELEMETRY · 真实统计' }}</span>
        <p v-if="effectiveDemoMode">
          {{ rawAnalytics?.hasDemoTraffic ? '展示数据库演示样本（不计入真实账目），可随时切回真实统计' : '展示本地预览样本，上线后自动汇集真实访问与业务数据' }}
        </p>
        <p v-else>
          近 {{ rangeDays }} 天全量真实统计 · 已开放 {{ viewData.kpis.totalPublishedArtifacts }} 件文物与 {{ viewData.kpis.totalPublishedExhibits }} 件 3D 展项
        </p>
      </div>
      <div class="dashboard-mode-banner__actions">
        <button
          v-if="effectiveDemoMode && !rawAnalytics?.hasDemoTraffic"
          type="button"
          class="admin-text-button admin-text-button--compact"
          :disabled="mutatingDemo"
          @click="seedDemoData"
        >
          写入 90 天样本
        </button>
        <button
          v-if="rawAnalytics?.hasDemoTraffic"
          type="button"
          class="admin-text-button admin-text-button--compact"
          :disabled="mutatingDemo"
          @click="clearDemoData"
        >
          清空演示样本
        </button>
      </div>
    </div>

    <div v-if="loading && !viewData" class="state-panel">正在汇总馆务运营指标与趋势图表…</div>

    <div v-else-if="viewData" class="dashboard-bento">
      <!-- Row 1: 4 KPI Sparkline Cards -->
      <section class="dashboard-kpi-grid" aria-label="核心运营指标">
        <KpiSparklineCard
          :label="`近 ${rangeDays} 天网站浏览量`"
          :value="formatCompactNumber(viewData.kpis.periodPv)"
          :subtext="`独立访客 ${formatCompactNumber(viewData.kpis.periodUv)} UV`"
          :current-total="viewData.kpis.periodPv"
          :previous-total="viewData.kpis.prevPeriodPv"
          :series="viewData.trafficSeries.map(d => d.pv)"
          tone="jade"
          variant="line"
        />
        <KpiSparklineCard
          :label="`近 ${rangeDays} 天预约人次`"
          :value="`${formatCompactNumber(viewData.kpis.periodVisitors)} 人`"
          :subtext="`核销率 ${viewData.kpis.checkInRate}% · ${viewData.kpis.periodAppointments} 笔预约`"
          :current-total="viewData.kpis.periodAppointments"
          :previous-total="viewData.kpis.prevPeriodAppointments"
          :series="viewData.appointmentSeries.map(d => d.bookedPeople)"
          tone="patina"
          variant="gauge"
          :gauge-value="viewData.kpis.checkInRate"
        />
        <KpiSparklineCard
          :label="`近 ${rangeDays} 天文创营收`"
          :value="formatCurrency(viewData.kpis.periodSalesAmount)"
          :subtext="`成交 ${viewData.kpis.periodPaidOrders} 笔（模拟支付）`"
          :current-total="Number.parseFloat(viewData.kpis.periodSalesAmount)"
          :previous-total="Number.parseFloat(viewData.kpis.prevPeriodSalesAmount)"
          :series="viewData.salesSeries.map(d => Number.parseFloat(d.salesAmount) || 0)"
          tone="bronze"
          variant="bars"
        />
        <KpiSparklineCard
          label="注册观众总数"
          :value="`${formatCompactNumber(viewData.kpis.totalUsers)} 人`"
          :subtext="`近 ${rangeDays} 天新增 ${viewData.kpis.newUsersCount} 位观众`"
          :current-total="viewData.kpis.newUsersCount"
          :previous-total="viewData.kpis.prevNewUsersCount"
          :series="viewData.trafficSeries.map(d => d.uv)"
          tone="slate"
          variant="dots"
        />
      </section>

      <!-- Row 2: Site Traffic Chart (7 cols) + Today's Actionable Todo Rail (5 cols) -->
      <section class="dashboard-row dashboard-row--7-5">
        <AreaTrendChart :data="viewData.trafficSeries" />

        <section class="admin-chart-card admin-todo-card" aria-label="馆务待办与预警">
          <header class="admin-chart-card__head">
            <div class="admin-chart-card__title-group">
              <h3>馆务待办与快捷入口</h3>
              <p>点击任一项直达对应管理台处理</p>
            </div>
          </header>

          <ul class="admin-todo-list">
            <li v-for="item in todoItems" :key="item.label">
              <RouterLink :to="item.to" class="admin-todo-row">
                <div class="admin-todo-row__copy">
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.hint }}</span>
                </div>
                <div class="admin-todo-row__right">
                  <em class="admin-todo-count" :class="`tone--${item.tone}`">{{ item.count }}</em>
                  <span aria-hidden="true">→</span>
                </div>
              </RouterLink>
            </li>
          </ul>

          <div v-if="guideOverview" class="admin-guide-mini">
            <div>
              <strong>洛笙向导 · {{ guideOverview.runtimeMode === 'NORMAL' ? '智能模型运行中' : guideOverview.runtimeMode === 'DETERMINISTIC' ? '馆藏兜底模式' : '已暂停对外' }}</strong>
              <small>今日配额 {{ guideOverview.usedToday }} / {{ guideOverview.dailyLimit }} · 并发 {{ guideOverview.inFlight }}</small>
            </div>
            <RouterLink to="/admin/guide" class="admin-text-button admin-text-button--compact">前往治理 →</RouterLink>
          </div>
        </section>
      </section>

      <!-- Row 3: Appointment Flow (7 cols) + 14-day Capacity Horizon (5 cols) -->
      <section class="dashboard-row dashboard-row--7-5">
        <AppointmentFlowChart :data="viewData.appointmentSeries" />
        <CapacityHorizonChart :days="viewData.upcomingSlots" @select-day="openSlotsForDate" />
      </section>

      <!-- Row 4: Top Content Ranking (6 cols) + Commerce Revenue & Order Status (6 cols) -->
      <section class="dashboard-row dashboard-row--6-6">
        <RankedBarChart :items="viewData.topContent" />

        <section class="admin-chart-card" aria-label="文创经营与订单分布">
          <header class="admin-chart-card__head">
            <div class="admin-chart-card__title-group">
              <h3>文创营收与订单状态分布</h3>
              <p>模拟支付趋势与全量订单生命周期占比</p>
            </div>
            <RouterLink to="/admin/orders" class="admin-chart-hint">订单台账 →</RouterLink>
          </header>
          <SalesTrendChart :data="viewData.salesSeries" />
          <div class="admin-chart-divider" aria-hidden="true"></div>
          <OrderRatioBar :segments="orderDonutSegments" title="订单生命周期占比" />
        </section>
      </section>

      <!-- Row 5: Darkroom Radial Compass + Curatorial Asset Overview -->
      <section v-if="viewData.slotTimeDistribution.length > 0" class="dashboard-row dashboard-row--6-6">
        <SlotRadialCompassChart :items="viewData.slotTimeDistribution" :range-days="rangeDays" />

        <section class="admin-chart-card admin-quick-desk" aria-label="馆藏资产概览">
          <header class="admin-chart-card__head">
            <div class="admin-chart-card__title-group">
              <h3>馆藏数字资产总览</h3>
              <p>已公开展示在数字博物馆前台的策展内容规模</p>
            </div>
          </header>
          <div class="admin-asset-stats">
            <RouterLink to="/admin/artifacts" class="admin-asset-stat">
              <strong>{{ viewData.kpis.totalPublishedArtifacts }}</strong>
              <span>公开馆藏文物</span>
              <small>含双语图录档案 →</small>
            </RouterLink>
            <RouterLink to="/admin/articles" class="admin-asset-stat">
              <strong>{{ viewData.kpis.totalPublishedArticles }}</strong>
              <span>公开文化专题</span>
              <small>68ch 深度长文 →</small>
            </RouterLink>
            <RouterLink to="/admin/exhibits" class="admin-asset-stat">
              <strong>{{ viewData.kpis.totalPublishedExhibits }}</strong>
              <span>3D 数字展项</span>
              <small>点云与斜射光 →</small>
            </RouterLink>
            <RouterLink to="/admin/categories" class="admin-asset-stat">
              <strong>分类</strong>
              <span>展陈分类体系</span>
              <small>维护中英文导航 →</small>
            </RouterLink>
          </div>
        </section>
      </section>
    </div>
  </AdminShell>
</template>
