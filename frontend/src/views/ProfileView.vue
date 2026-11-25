<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCuratorialBookmarks } from '../stores/curatorialBookmarks'
import InlineStatus from '../components/InlineStatus.vue'
import FluidButton from '../components/FluidButton.vue'
import { useLocale } from '../stores/locale'
import { useTheme } from '../stores/theme'
import { audioSystem } from '../lib/audioSystem'
import { createGsapContext, revealSequence, shouldRunGsapReveal } from '../lib/gsap'

const ProfileAppointments = defineAsyncComponent(() => import('../components/ProfileAppointments.vue'))
const ProfileOrders = defineAsyncComponent(() => import('../components/ProfileOrders.vue'))

const auth = useAuthStore()
const bookmarks = useCuratorialBookmarks()
const router = useRouter()
const { locale } = useLocale()
const { isDark } = useTheme()
const pavilionMedia = computed(() => (
  isDark.value
    ? {
      src: '/media/editorial/login-pavilion-dark-v3.webp',
      srcset: '/media/responsive/login-pavilion-dark-v3-640w.webp 640w, /media/editorial/login-pavilion-dark-v3.webp 896w',
      caption: 'NOCTURNE PAVILION · 01',
    }
    : {
      src: '/media/editorial/login-pavilion-light-v3.webp',
      srcset: '/media/responsive/login-pavilion-light-v3-640w.webp 640w, /media/editorial/login-pavilion-light-v3.webp 896w',
      caption: 'DAYLIGHT PAVILION · 01',
    }
))
const exportingNotebook = ref(false)
const notebookPreviewItems = computed(() => bookmarks.items.value.slice(0, 4))

async function exportNotebookFromProfile() {
  if (exportingNotebook.value || bookmarks.count.value === 0) return
  exportingNotebook.value = true
  try {
    const { downloadCuratorialNotebookPng } = await import('../lib/curatorialNotebookExport')
    await downloadCuratorialNotebookPng(bookmarks.items.value, locale.value)
  } finally {
    exportingNotebook.value = false
  }
}
const copy = computed(() => locale.value === 'zh-CN' ? {
  storyAria: '个人中心导航',
  storyTitle: '你的河洛参观档案。',
  booking: '预约一次参观',
  orders: '浏览河洛文创',
  storyEyebrow: 'VISITOR ARCHIVE · 个人档案',
  storyIntro: '记录你的线上探索、线下相见，以及从馆藏延伸出的日常选择。',
  quickLinksAria: '个人中心快捷入口',
  context: '账户与参观信息',
  title: '个人中心',
  nickname: '昵称',
  email: '邮箱',
  phone: '手机号',
  save: '保存资料',
  logout: '退出登录',
  fieldsTitle: '基本资料',
  fieldsHint: '用于预约通知与订单联系，请保持信息准确。',
  saved: '个人资料已保存。',
  saveError: '保存失败。',
} : {
  storyAria: 'Profile navigation',
  storyTitle: 'Your Heluo visitor archive.',
  booking: 'Book a visit',
  orders: 'Browse museum store',
  storyEyebrow: 'VISITOR ARCHIVE · PROFILE',
  storyIntro: 'Keep a quiet record of what you explored, where you went, and what you brought into daily life.',
  quickLinksAria: 'Profile shortcuts',
  context: 'ACCOUNT & VISIT DETAILS',
  title: 'Profile',
  nickname: 'Display name',
  email: 'Email',
  phone: 'Phone',
  save: 'Save profile',
  logout: 'Sign out',
  fieldsTitle: 'Contact details',
  fieldsHint: 'Used for visit notifications and order contact. Keep them current.',
  saved: 'Your profile has been saved.',
  saveError: 'Unable to save your profile.',
})

const nickname = ref('')
const email = ref('')
const phone = ref('')
const message = ref('')
const error = ref('')
const saving = ref(false)
const recordsSentinel = ref<HTMLElement | null>(null)
const recordsReady = ref(false)
const root = ref<HTMLElement | null>(null)
let recordsObserver: IntersectionObserver | undefined
let gsapContext: ReturnType<typeof createGsapContext>

function setupEntrance() {
  if (!shouldRunGsapReveal() || !root.value) return
  gsapContext?.revert()
  gsapContext = createGsapContext(root.value, () => {
    revealSequence('[data-motion="profile-story"] > *', { stagger: 0.06 })
    revealSequence('[data-motion="profile-panel"] > *', { stagger: 0.04, delay: 0.12 })
  })
}

function observeRecords() {
  if (typeof IntersectionObserver === 'undefined' || !recordsSentinel.value) {
    recordsReady.value = true
    return
  }
  recordsObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    recordsReady.value = true
    recordsObserver?.disconnect()
    recordsObserver = undefined
  })
  recordsObserver.observe(recordsSentinel.value)
}

async function loadProfile() {
  await auth.initialize()
  if (!auth.user) {
    if (auth.token && auth.initializationError) return
    await router.replace({ path: '/login', query: { returnTo: '/profile' } })
    return
  }
  nickname.value = auth.user.nickname
  email.value = auth.user.email
  phone.value = auth.user.phone
  await nextTick()
  observeRecords()
}

onMounted(loadProfile)
onMounted(setupEntrance)
onBeforeUnmount(() => {
  recordsObserver?.disconnect()
  gsapContext?.revert()
})

watch(recordsReady, async (ready) => {
  if (!ready) return
  void audioSystem.playNarrative('opening', { volume: 0.24 })
  if (!shouldRunGsapReveal()) return
  await nextTick()
  revealSequence('[data-motion="profile-records"] > *', { stagger: 0.08 })
})

async function save() {
  if (saving.value) return
  saving.value = true
  message.value = ''
  error.value = ''
  try {
    await auth.updateProfile({ nickname: nickname.value, email: email.value || undefined, phone: phone.value || undefined })
    message.value = copy.value.saved
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : copy.value.saveError
  } finally {
    saving.value = false
  }
}

async function logout() {
  await auth.logout()
  await router.push('/')
}
</script>

<template>
  <section ref="root" class="auth-page profile-page" data-motion-page="profile">
    <!-- Visitor Archive Sidebar / Header Card -->
    <aside class="profile-story" data-motion="profile-story" :aria-label="copy.storyAria">
      <div class="profile-story__media" aria-hidden="true">
        <img
          :src="pavilionMedia.src"
          :srcset="pavilionMedia.srcset"
          sizes="(max-width: 960px) 100vw, 340px"
          width="896"
          height="1200"
          decoding="sync"
          alt=""
        />
        <span class="profile-story__scrim"></span>
        <span class="profile-story__plate font-mono">{{ pavilionMedia.caption }}</span>
      </div>
      <div class="profile-story__copy">
        <p class="eyebrow">{{ copy.storyEyebrow }}</p>
        <h2>{{ copy.storyTitle }}</h2>
        <p class="profile-story__intro">{{ copy.storyIntro }}</p>
        <nav class="profile-story__links" :aria-label="copy.quickLinksAria">
          <RouterLink to="/appointment"><span class="font-mono">01</span>{{ copy.booking }} <b aria-hidden="true">↗</b></RouterLink>
          <RouterLink to="/shop"><span class="font-mono">02</span>{{ copy.orders }} <b aria-hidden="true">↗</b></RouterLink>
        </nav>
      </div>
    </aside>

    <!-- Main Archive Folder -->
    <div v-if="auth.user" class="profile-main">
      <section class="profile-account-panel" data-motion="profile-panel">
        <header class="profile-account-heading">
          <div class="profile-account-id">
            <span class="profile-account-mark" aria-hidden="true">{{ (auth.user.nickname || auth.user.username).slice(0, 1) }}</span>
            <div>
              <p class="eyebrow">{{ copy.context }}</p>
              <h1>{{ auth.user.nickname || auth.user.username }}</h1>
              <p class="profile-identity font-mono">@{{ auth.user.username }} · {{ auth.user.roles.join(' / ') }}</p>
            </div>
          </div>
          <button class="fluid-button fluid-button--secondary fluid-button--sm" type="button" @click="logout">{{ copy.logout }}</button>
        </header>

        <InlineStatus v-if="message" kind="success" :message="message" />
        <InlineStatus v-if="error" kind="error" :message="error" />

        <div class="profile-form-intro">
          <strong>{{ copy.fieldsTitle }}</strong>
          <span>{{ copy.fieldsHint }}</span>
        </div>

        <form class="profile-form" @submit.prevent="save">
          <label><span>{{ copy.nickname }}</span><input v-model.trim="nickname" required maxlength="50" /></label>
          <label><span>{{ copy.email }}</span><input v-model.trim="email" type="email" /></label>
          <label><span>{{ copy.phone }}</span><input v-model.trim="phone" maxlength="20" /></label>
          <div class="profile-form__submit">
            <FluidButton type="submit" :loading="saving" :disabled="saving">{{ copy.save }}</FluidButton>
          </div>
        </form>
      </section>

      <!-- Embedded Viewing Journal Album Summary Rail -->
      <section class="profile-notebook-rail" data-testid="profile-notebook-rail" :aria-label="locale === 'en-US' ? 'Viewing journal summary' : '我的观展手账画册摘要轨'">
        <header class="profile-notebook-rail__head">
          <div>
            <p class="eyebrow">{{ locale === 'en-US' ? 'THREAD-BOUND JOURNAL' : 'CURATORIAL JOURNAL · 线装手账' }}</p>
            <h2>{{ locale === 'en-US' ? 'My Viewing Notebook' : '我的观展手账画册' }}</h2>
          </div>
          <span class="profile-notebook-rail__count font-mono">
            {{ locale === 'en-US' ? `${bookmarks.count.value} plates` : `已收录 ${bookmarks.count.value} 件图版` }}
          </span>
        </header>

        <div v-if="notebookPreviewItems.length" class="profile-notebook-rail__strip">
          <RouterLink
            v-for="item in notebookPreviewItems"
            :key="`${item.kind}-${item.slug}`"
            class="profile-notebook-card"
            :to="item.path"
          >
            <div class="profile-notebook-card__thumb surface-vitrine">
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="" loading="lazy" decoding="async" />
              <span v-else class="font-mono">NO.</span>
            </div>
            <div class="profile-notebook-card__copy">
              <strong>{{ locale === 'en-US' ? (item.titleEn || item.title) : item.title }}</strong>
              <small>{{ item.note || (locale === 'en-US' ? (item.subtitleEn || item.subtitle || 'Saved plate') : (item.subtitle || '已收入画册')) }}</small>
            </div>
          </RouterLink>
        </div>
        <p v-else class="profile-notebook-rail__empty">
          {{ locale === 'en-US' ? 'Save artifacts or articles while browsing to assemble your thread-bound exhibition folio.' : '逛展时在文物或文章详情页点击「收入观展手账」，即可生成个人线装画册与长卷留念图。' }}
        </p>

        <div class="profile-notebook-rail__actions">
          <button
            type="button"
            class="fluid-button fluid-button--primary fluid-button--sm"
            data-testid="profile-open-notebook-btn"
            @click="bookmarks.openSheet()"
          >
            {{ locale === 'en-US' ? 'Open Thread-Bound Journal' : '翻阅线装观展手账' }}
          </button>
          <button
            v-if="bookmarks.count.value > 0"
            type="button"
            class="fluid-button fluid-button--secondary fluid-button--sm"
            data-testid="profile-export-notebook-btn"
            :disabled="exportingNotebook"
            @click="exportNotebookFromProfile"
          >
            {{ exportingNotebook ? (locale === 'en-US' ? 'Exporting PNG…' : '正在导出长图…') : (locale === 'en-US' ? 'Export Long-Scroll PNG' : '导出手账长图 PNG') }}
          </button>
          <RouterLink v-else class="fluid-button fluid-button--secondary fluid-button--sm" to="/explore">
            {{ locale === 'en-US' ? 'Browse collection →' : '去馆藏挑第一件 →' }}
          </RouterLink>
        </div>
      </section>

      <div class="profile-records" data-motion="profile-records">
        <span v-if="!recordsReady" ref="recordsSentinel" class="profile-records__sentinel" aria-hidden="true"></span>
        <template v-else><ProfileAppointments :token="auth.token" /><ProfileOrders :token="auth.token" /></template>
      </div>
    </div>

    <div v-else-if="auth.initializationError" class="profile-main state-panel state-panel--action">
      <InlineStatus kind="error" :message="auth.initializationError" />
      <button class="fluid-button fluid-button--secondary" type="button" @click="loadProfile">{{ locale === 'en-US' ? 'Retry account loading' : '重新加载账户' }}</button>
    </div>
  </section>
</template>

<style scoped>
.profile-page {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  align-items: start;
  gap: clamp(2rem, 4vw, 3.5rem);
  width: min(calc(100% - 4rem), var(--container-max));
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(4rem, 7vw, 6rem);
  color: var(--ink-secondary);
}

/* ── Left Visitor Archive Cover ── */
.profile-story {
  position: sticky;
  top: calc(var(--header-height) + var(--space-5));
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
  overflow: hidden;
}

.profile-story__media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--surface-darkroom);
}

.profile-story__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 42%;
}

.profile-story__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 38%,
    oklch(10% 0.008 238 / 0.56) 100%
  );
  pointer-events: none;
}

.profile-story__plate {
  position: absolute;
  left: var(--space-3);
  bottom: var(--space-3);
  z-index: 2;
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border: 1px solid oklch(96% 0.006 86 / 0.22);
  border-radius: var(--radius-pill);
  background: oklch(11% 0.008 238 / 0.48);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: oklch(95% 0.006 86);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
}

.profile-story__copy {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
}

.profile-story__copy h2 {
  font-size: var(--text-xl);
  line-height: 1.3;
}

.profile-story__intro {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-muted);
}

.profile-story__links {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-hairline);
}

.profile-story__links a {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--control-min);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-primary);
  transition: border-color var(--duration-fast) var(--ease-curatorial);
}

.profile-story__links a:hover {
  border-color: var(--accent-bronze);
}

.profile-story__links a span {
  font-size: var(--text-xs);
  color: var(--accent-bronze);
}

.profile-story__links a b {
  margin-left: auto;
  font-weight: 400;
  color: var(--ink-muted);
}

/* ── Main Archive Area ── */
.profile-main {
  display: grid;
  gap: var(--space-8);
  min-width: 0;
}

.profile-account-panel {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
}

.profile-account-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-hairline);
}

.profile-account-id {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.profile-account-mark {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  flex-shrink: 0;
}

.profile-account-heading h1 {
  margin: 2px 0;
  font-size: var(--text-2xl);
  line-height: 1.2;
}

.profile-identity {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.profile-form-intro {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.profile-form-intro strong {
  font-size: var(--text-sm);
  color: var(--ink-primary);
}

.profile-form-intro span {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.profile-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.profile-form label {
  display: grid;
  gap: 0.375rem;
}

.profile-form label > span {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-primary);
}

.profile-form input {
  width: 100%;
}

.profile-form__submit {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.profile-records {
  display: grid;
  gap: var(--space-6);
}

.profile-records__sentinel {
  display: block;
  height: 1px;
}

/* ── Embedded Viewing Journal Album Summary Rail ── */
.profile-notebook-rail {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
}

.profile-notebook-rail__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
}

.profile-notebook-rail__head h2 {
  margin: 0.25rem 0 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--ink-primary);
}

.profile-notebook-rail__count {
  padding: 0.2rem 0.65rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  font-size: var(--text-xs);
  color: var(--accent-bronze);
}

.profile-notebook-rail__strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
  gap: var(--space-3);
}

.profile-notebook-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 72px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  color: var(--ink-primary);
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              transform var(--duration-fast) var(--ease-curatorial);
}

.profile-notebook-card:hover {
  border-color: var(--accent-bronze);
  transform: translateY(-1px);
}

.profile-notebook-card__thumb {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: var(--radius-xs);
  overflow: hidden;
  padding: 3px;
}

.profile-notebook-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.profile-notebook-card__thumb span {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.profile-notebook-card__copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.profile-notebook-card__copy strong {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-notebook-card__copy small {
  font-size: var(--text-xs);
  color: var(--ink-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-notebook-rail__empty {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-muted);
}

.profile-notebook-rail__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

@media (max-width: 960px) {
  .profile-page {
    grid-template-columns: 1fr;
  }

  .profile-story {
    position: static;
  }

  .profile-form {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .profile-page {
    width: calc(100% - 2rem);
    padding-top: var(--space-6);
  }

  .profile-account-panel {
    padding: var(--space-5);
  }
}
</style>
