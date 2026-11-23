<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Hide, View } from '@element-plus/icons-vue'
import { apiRequest } from '../lib/api'
import { safeReturnTo, useAuthStore } from '../stores/auth'
import { useLocale } from '../stores/locale'
import { createGsapContext, revealSequence, shouldRunGsapReveal } from '../lib/gsap'
import InlineStatus from '../components/InlineStatus.vue'
import FluidButton from '../components/FluidButton.vue'
import { gsap } from 'gsap'

const auth = useAuthStore()
const { t, locale } = useLocale()
const route = useRoute()
const router = useRouter()
const mode = ref<'login' | 'register' | 'forgot' | 'reset'>(route.query.token ? 'reset' : 'login')
const username = ref('')
const password = ref('')
const passwordVisible = ref(false)
const nickname = ref('')
const email = ref('')
const phone = ref('')
const resetToken = ref(String(route.query.token ?? ''))
const message = ref('')
const error = ref('')
const submitting = ref(false)
const root = ref<HTMLElement | null>(null)
let gsapContext: gsap.Context | undefined

function setupEntrance() {
  if (!shouldRunGsapReveal() || !root.value) return
  gsapContext?.revert()
  gsapContext = createGsapContext(root.value, () => {
    gsap.fromTo('[data-motion="auth-story-media"] img', { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'power3.out', clearProps: 'opacity,visibility,transform' })
    revealSequence('[data-motion="auth-story"] > *', { stagger: 0.06, delay: 0.08 })
    revealSequence('[data-motion="auth-panel"] > *', { stagger: 0.045, delay: 0.16 })
  })
}

onMounted(setupEntrance)
onBeforeUnmount(() => gsapContext?.revert())

watch(mode, async () => {
  await nextTick()
  if (!shouldRunGsapReveal() || !root.value) return
  const fields = root.value.querySelectorAll('[data-motion="auth-panel"] form label')
  if (!fields.length) return
  gsap.fromTo(fields, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.035, ease: 'power3.out', clearProps: 'opacity,visibility,transform' })
})

const title = computed(() => ({ login: t.value.auth.login, register: t.value.auth.register, forgot: t.value.auth.forgot, reset: t.value.auth.reset })[mode.value])
const story = computed(() => locale.value === 'en-US' ? {
  aria: 'Account features',
  alt: 'Concept view of Heluo Digital Museum',
  title: 'Connect your online journey with your next visit.',
  items: ['Save your visitor profile', 'Submit and track visit bookings', 'Manage store orders and mock payments'],
  context: 'Heluo Digital Museum Account',
} : {
  aria: '账户功能说明',
  alt: '河洛数字博物馆建筑概念图',
  title: '把线上探索，接到下一次相见。',
  items: ['保存个人参观信息与档案', '提交并实时查看预约状态', '管理河洛文创订单与模拟支付'],
  context: '河洛数字博物馆账户',
})

function switchMode(next: typeof mode.value) {
  mode.value = next
  passwordVisible.value = false
  message.value = ''
  error.value = ''
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  message.value = ''
  error.value = ''
  try {
    if (mode.value === 'login') {
      await auth.login(username.value, password.value)
      await router.push(safeReturnTo(route.query.returnTo, auth.isAdmin ? '/admin' : '/profile'))
    } else if (mode.value === 'register') {
      await auth.register({ username: username.value, password: password.value, nickname: nickname.value, email: email.value || undefined, phone: phone.value || undefined })
      message.value = locale.value === 'en-US' ? 'Account created. Sign in with your username and password.' : '账号创建成功，请使用用户名和密码登录。'
      mode.value = 'login'
    } else if (mode.value === 'forgot') {
      await apiRequest('/auth/password-reset/request', 'POST', { username: username.value, email: email.value })
      message.value = locale.value === 'en-US' ? 'If the account and email match, a reset link has been sent. Check your inbox.' : '若账号与已绑定邮箱匹配，重置链接已发送，请查收邮件。'
    } else {
      await apiRequest('/auth/password-reset/confirm', 'POST', { resetToken: resetToken.value, newPassword: password.value })
      message.value = locale.value === 'en-US' ? 'Password updated. Please sign in again.' : '密码已更新，请重新登录。'
      mode.value = 'login'
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : (locale.value === 'en-US' ? 'Submission failed. Please try again.' : '提交失败，请稍后重试。')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section ref="root" class="auth-page task-auth-page" data-motion-page="login">
    <!-- 55% Full-Bleed Architectural Visual with Safe Dark Scrim (> 7:1 contrast) -->
    <aside class="auth-story" data-motion="auth-story-media" :aria-label="story.aria">
      <img src="/media/editorial/museum-exterior-watercolor.webp" :alt="story.alt" />
      <div class="auth-story__scrim" aria-hidden="true"></div>
      <div class="auth-story__copy" data-motion="auth-story">
        <p class="auth-story__kicker font-mono">VISITOR ACCOUNT</p>
        <h2>{{ story.title }}</h2>
        <ul>
          <li v-for="(item, idx) in story.items" :key="item">
            <span class="font-mono">0{{ idx + 1 }}</span>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>
    </aside>

    <!-- 45% Pure Paper / Nocturne Centered Form Canvas -->
    <section class="auth-panel" data-motion="auth-panel">
      <div class="auth-panel__inner">
        <p class="auth-context">{{ story.context }}</p>
        <h1>{{ title }}</h1>
        <p class="auth-intro">{{ t.auth.intro }}</p>

        <InlineStatus v-if="message" kind="success" :message="message" />
        <InlineStatus v-if="error" kind="error" :message="error" />

        <form class="auth-form" @submit.prevent="submit">
          <label v-if="mode !== 'reset'">
            <span>{{ t.auth.username }}</span>
            <input v-model.trim="username" minlength="3" maxlength="32" pattern="[A-Za-z0-9_]+" required autocomplete="username" />
          </label>
          <label v-if="mode === 'register'">
            <span>{{ t.auth.nickname }}</span>
            <input v-model.trim="nickname" maxlength="50" required autocomplete="nickname" />
          </label>
          <label v-if="mode === 'register' || mode === 'forgot'">
            <span>{{ t.auth.email }}<small v-if="mode === 'register'"> {{ t.auth.emailOptional }}</small></span>
            <input v-model.trim="email" type="email" :required="mode === 'forgot'" autocomplete="email" />
          </label>
          <label v-if="mode === 'register'">
            <span>{{ t.auth.phoneOptional }}</span>
            <input v-model.trim="phone" maxlength="20" autocomplete="tel" />
          </label>
          <label v-if="mode === 'reset'">
            <span>{{ t.auth.token }}</span>
            <input v-model.trim="resetToken" required />
          </label>
          <label v-if="mode === 'login' || mode === 'register' || mode === 'reset'">
            <span>{{ t.auth.password }}</span>
            <span class="password-field">
              <input
                v-model="password"
                :type="passwordVisible ? 'text' : 'password'"
                :disabled="submitting"
                minlength="8"
                maxlength="72"
                required
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              />
              <button
                class="password-toggle"
                type="button"
                :aria-pressed="passwordVisible"
                :aria-label="locale === 'en-US' ? (passwordVisible ? 'Hide password' : 'Show password') : (passwordVisible ? '隐藏密码' : '显示密码')"
                :title="locale === 'en-US' ? (passwordVisible ? 'Hide password' : 'Show password') : (passwordVisible ? '隐藏密码' : '显示密码')"
                @click="passwordVisible = !passwordVisible"
              >
                <Hide v-if="passwordVisible" aria-hidden="true" />
                <View v-else aria-hidden="true" />
              </button>
            </span>
          </label>

          <FluidButton type="submit" block size="lg" :loading="submitting">
            {{ submitting ? t.auth.submitting : title }}
          </FluidButton>
        </form>

        <div class="auth-switch">
          <button v-if="mode !== 'login'" type="button" @click="switchMode('login')">{{ t.auth.back }}</button>
          <button v-if="mode === 'login'" type="button" @click="switchMode('register')">{{ t.auth.create }}</button>
          <button v-if="mode === 'login'" type="button" @click="switchMode('forgot')">{{ t.auth.forgotAction }}</button>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.task-auth-page {
  display: grid;
  grid-template-columns: 55fr 45fr;
  min-height: calc(100dvh - var(--header-height));
  background: var(--surface-canvas);
}

/* ── Left 55%: Full-Bleed Architectural Cover with High-Contrast Bottom Scrim ── */
.auth-story {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 560px;
  overflow: hidden;
  background: var(--surface-darkroom);
}

.auth-story img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-story__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    oklch(10% 0.012 165 / 0.14) 0%,
    oklch(10% 0.014 165 / 0.56) 48%,
    oklch(8% 0.014 165 / 0.90) 100%
  );
  pointer-events: none;
}

.auth-story__copy {
  position: relative;
  z-index: 2;
  display: grid;
  gap: var(--space-5);
  max-width: 520px;
  padding: clamp(2rem, 5vw, 4rem);
  color: var(--ink-on-dark);
}

.auth-story__kicker {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.16em;
  color: oklch(78% 0.092 75);
}

.auth-story__copy h2 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 3vw, 2.75rem);
  line-height: 1.2;
  color: var(--ink-on-dark);
}

.auth-story__copy ul {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid oklch(92% 0.015 88 / 0.18);
}

.auth-story__copy li {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: oklch(93% 0.010 88);
}

.auth-story__copy li span:first-child {
  font-size: var(--text-xs);
  color: oklch(78% 0.092 75);
}

/* ── Right 45%: Pure Editorial Form Canvas ── */
.auth-panel {
  display: grid;
  place-items: center;
  padding: clamp(2rem, 5vw, 4rem) clamp(1.5rem, 4vw, 3.5rem);
  background: var(--surface-canvas);
  border-left: 1px solid var(--border-hairline);
}

.auth-panel__inner {
  display: grid;
  gap: var(--space-4);
  width: min(100%, 400px);
}

.auth-context {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent-bronze);
}

.auth-panel h1 {
  font-size: clamp(1.75rem, 2.6vw, 2.25rem);
  line-height: 1.2;
}

.auth-intro {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-muted);
}

.auth-form {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-2);
}

.auth-form label {
  display: grid;
  gap: 0.375rem;
}

.auth-form label > span:first-child {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-primary);
}

.auth-form label small {
  font-weight: 400;
  color: var(--ink-muted);
}

.auth-form input {
  width: 100%;
}

.password-field {
  position: relative;
  display: grid;
}

.password-field input {
  padding-right: 48px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}

.password-toggle:hover {
  color: var(--ink-primary);
  background: var(--surface-subtle);
}

.password-toggle svg {
  width: 17px;
  height: 17px;
}

.auth-switch {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-hairline);
}

.auth-switch button {
  min-height: var(--control-min);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent-jade);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.auth-switch button:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

@media (max-width: 920px) {
  .task-auth-page {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .auth-story {
    min-height: 280px;
  }

  .auth-story__copy {
    padding: var(--space-6);
    gap: var(--space-3);
  }

  .auth-story__copy ul {
    display: none;
  }

  .auth-panel {
    border-left: 0;
    padding: var(--space-8) var(--space-4) var(--space-12);
  }
}
</style>
