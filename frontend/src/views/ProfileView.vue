<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import InlineStatus from '../components/InlineStatus.vue'
import FluidButton from '../components/FluidButton.vue'
import { useLocale } from '../stores/locale'
import { audioSystem } from '../lib/audioSystem'
import { createGsapContext, revealSequence, shouldRunGsapReveal } from '../lib/gsap'

const ProfileAppointments = defineAsyncComponent(() => import('../components/ProfileAppointments.vue'))
const ProfileOrders = defineAsyncComponent(() => import('../components/ProfileOrders.vue'))

const auth = useAuthStore()
const router = useRouter()
const { locale } = useLocale()
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
        <img src="/media/editorial/museum-exterior-watercolor.webp" alt="" />
        <span class="font-mono">HELUO / 01</span>
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
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--surface-plinth);
}

.profile-story__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-story__media span {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-xs);
  background: oklch(12% 0.01 165 / 0.72);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
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
