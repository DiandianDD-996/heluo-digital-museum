<script setup lang="ts">
import '../styles/07-admin.css'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, apiRequest } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import AdminShell from '../components/AdminShell.vue'
import InlineStatus from '../components/InlineStatus.vue'
import DonutStatusChart, { type DonutSegment } from '../components/admin/charts/DonutStatusChart.vue'

type GuideRuntimeMode = 'NORMAL' | 'DETERMINISTIC' | 'PAUSED'

interface GuideOverview {
  enabled: boolean
  modelEnabled: boolean
  usedToday: number
  dailyLimit: number
  inFlight: number
  degradationCount: number
  redlineBlockCount: number
  runtimeMode: GuideRuntimeMode
  paused: boolean
  filePaused: boolean
}

const auth = useAuthStore()
const router = useRouter()

const loading = ref(true)
const mutating = ref(false)
const error = ref('')
const message = ref('')
const overview = ref<GuideOverview | null>(null)

const quotaSegments = computed<DonutSegment[]>(() => {
  const g = overview.value
  if (!g) return []
  const used = Math.min(g.usedToday, g.dailyLimit)
  const remaining = Math.max(0, g.dailyLimit - used)
  return [
    { key: 'used', label: '今日已调用', value: used, tone: used / Math.max(1, g.dailyLimit) > 0.8 ? 'danger' : 'series1' },
    { key: 'remaining', label: '剩余可用额度', value: remaining, tone: 'muted' },
  ]
})

const modeCards: Array<{ mode: GuideRuntimeMode; title: string; badge: string; desc: string }> = [
  {
    mode: 'NORMAL',
    title: '智能模型模式',
    badge: 'NORMAL',
    desc: '启用 DeepSeek 对话与只读馆藏工具调用，依据签名证据卡流式解答观众提问。',
  },
  {
    mode: 'DETERMINISTIC',
    title: '馆藏确定性兜底',
    badge: 'DETERMINISTIC',
    desc: '关闭外部大模型请求，完全由本地馆藏图谱与确定性知识模板直出回答，零外部费用。',
  },
  {
    mode: 'PAUSED',
    title: '暂停对外响应',
    badge: 'PAUSED',
    desc: '紧急熔断态：前台向导将礼貌提示馆员正在维护知识库，停止生成新对话。',
  },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    await auth.initialize()
    if (!auth.isAdmin) {
      await router.replace('/login')
      return
    }
    overview.value = await apiGet<GuideOverview>('/admin/guide/overview', auth.token)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '洛笙运行状态读取失败。'
  } finally {
    loading.value = false
  }
}

async function switchMode(mode: GuideRuntimeMode) {
  if (mutating.value || overview.value?.runtimeMode === mode) return
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    overview.value = await apiRequest<GuideOverview>('/admin/guide/runtime-mode', 'POST', { mode }, auth.token)
    message.value = mode === 'NORMAL'
      ? '洛笙已切换至智能模型模式。'
      : mode === 'DETERMINISTIC'
        ? '洛笙已切换至馆藏确定性兜底模式。'
        : '洛笙已暂停对外对话响应。'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '运行模式切换失败。'
  } finally {
    mutating.value = false
  }
}

async function invalidateCache() {
  if (mutating.value) return
  mutating.value = true
  error.value = ''
  message.value = ''
  try {
    await apiRequest('/admin/guide/cache/invalidate', 'POST', undefined, auth.token)
    message.value = '洛笙馆藏知识缓存已刷新，新发布文物与文章将立即生效。'
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '知识缓存刷新失败。'
  } finally {
    mutating.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <AdminShell
    v-if="auth.isAdmin"
    title="洛笙 AI 向导治理"
    description="监控智能导览今日配额、并发流、红线拦截，并支持毫秒级模式切换与知识库刷新。"
    section="guide"
  >
    <template #header-actions>
      <button
        type="button"
        class="admin-primary-btn"
        data-testid="guide-page-cache-invalidate"
        :disabled="mutating"
        @click="invalidateCache"
      >
        刷新馆藏知识缓存
      </button>
      <RouterLink class="admin-header-link" to="/admin">返回运营看板 →</RouterLink>
    </template>

    <InlineStatus :message="message" kind="success" />
    <InlineStatus :message="error" kind="error" />

    <div v-if="loading && !overview" class="state-panel">正在加载洛笙运行治理信息…</div>

    <div v-else-if="overview" class="admin-guide-workspace" data-testid="admin-guide-governance-page">
      <section class="admin-guide-hero-grid">
        <section class="admin-chart-card">
          <header class="admin-chart-card__head">
            <div>
              <span class="admin-chart-card__kicker font-mono">DAILY QUOTA CONSUMPTION</span>
              <h3>今日对话配额使用情况</h3>
              <p>
                公共端开关：<strong>{{ overview.enabled ? '已开启' : '未启用' }}</strong>
                · 外部模型：<strong>{{ overview.modelEnabled ? '已配置' : '只读直出' }}</strong>
                <template v-if="overview.filePaused"> · <em>检测到文件热暂停</em></template>
              </p>
            </div>
            <span class="admin-observability-tag" :class="{ 'is-paused': overview.paused || overview.runtimeMode === 'PAUSED' }">
              {{ overview.runtimeMode }}
            </span>
          </header>
          <DonutStatusChart :segments="quotaSegments" center-label="日限额配额" title="洛笙今日配额" />
        </section>

        <section class="admin-chart-card">
          <header class="admin-chart-card__head">
            <div>
              <span class="admin-chart-card__kicker font-mono">SAFETY &amp; CONCURRENCY</span>
              <h3>实时健康与合规指标</h3>
              <p>进程内实时追踪的并发流、降级回退与红线防护计数</p>
            </div>
          </header>
          <div class="admin-guide-stat-grid">
            <article>
              <span>今日调用 / 限额</span>
              <strong class="font-mono">{{ overview.usedToday }} / {{ overview.dailyLimit }}</strong>
              <small>按博物馆日历自然日重置</small>
            </article>
            <article>
              <span>当前并发流</span>
              <strong class="font-mono">{{ overview.inFlight }}</strong>
              <small>SSE 真流式活跃连接</small>
            </article>
            <article>
              <span>确定性降级次数</span>
              <strong class="font-mono">{{ overview.degradationCount }}</strong>
              <small>超限或超时自动安全回退</small>
            </article>
            <article>
              <span>红线合规拦截</span>
              <strong class="font-mono">{{ overview.redlineBlockCount }}</strong>
              <small>违禁与越界事实阻断</small>
            </article>
          </div>
        </section>
      </section>

      <section class="admin-chart-card" aria-label="运行模式切换">
        <header class="admin-chart-card__head">
          <div>
            <span class="admin-chart-card__kicker font-mono">RUNTIME GOVERNANCE</span>
            <h3>运行模式即时切换</h3>
            <p>所有切换立即生效并记录至后台审计日志</p>
          </div>
        </header>
        <div class="admin-guide-modes">
          <button
            v-for="item in modeCards"
            :key="item.mode"
            type="button"
            class="admin-guide-mode-card"
            :class="{ active: overview.runtimeMode === item.mode }"
            :disabled="mutating"
            :data-testid="`guide-page-mode-${item.mode.toLowerCase()}`"
            @click="switchMode(item.mode)"
          >
            <div class="admin-guide-mode-card__top">
              <strong>{{ item.title }}</strong>
              <span class="font-mono">{{ item.badge }}</span>
            </div>
            <p>{{ item.desc }}</p>
          </button>
        </div>
      </section>
    </div>
  </AdminShell>
</template>
