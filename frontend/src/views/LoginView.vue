<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Hide, View } from '@element-plus/icons-vue'
import { apiRequest } from '../lib/api'
import { safeReturnTo, useAuthStore } from '../stores/auth'
import { useLocale } from '../stores/locale'
import { useTheme } from '../stores/theme'
import { createGsapContext, revealSequence, shouldRunGsapReveal } from '../lib/gsap'
import InlineStatus from '../components/InlineStatus.vue'
import FluidButton from '../components/FluidButton.vue'
import { gsap } from 'gsap'

const auth = useAuthStore()
const { t, locale } = useLocale()
const { isDark } = useTheme()
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
    gsap.fromTo(
      '[data-motion="auth-story-media"] img',
      { autoAlpha: 0, scale: 1.035 },
      { autoAlpha: 1, scale: 1, duration: 0.65, ease: 'power3.out', clearProps: 'opacity,visibility,transform' },
    )
    revealSequence('[data-motion="auth-story"] > *', { stagger: 0.06, delay: 0.08 })
    revealSequence('[data-motion="auth-panel"] > *', { stagger: 0.045, delay: 0.14 })
  })
}

onMounted(setupEntrance)
onBeforeUnmount(() => gsapContext?.revert())

watch(mode, async () => {
  await nextTick()
  if (!shouldRunGsapReveal() || !root.value) return
  const fields = root.value.querySelectorAll('[data-motion="auth-panel"] form label')
  if (!fields.length) return
  gsap.fromTo(
    fields,
    { autoAlpha: 0, y: 6 },
    { autoAlpha: 1, y: 0, duration: 0.26, stagger: 0.032, ease: 'power3.out', clearProps: 'opacity,visibility,transform' },
  )
})

const pavilionMedia = computed(() => (
  isDark.value
    ? {
      src: '/media/editorial/login-pavilion-dark-v3.webp',
      srcset: '/media/responsive/login-pavilion-dark-v3-640w.webp 640w, /media/editorial/login-pavilion-dark-v3.webp 896w',
      plateNo: 'PLATE II · NOCTURNE PAVILION',
    }
    : {
      src: '/media/editorial/login-pavilion-light-v3.webp',
      srcset: '/media/responsive/login-pavilion-light-v3-640w.webp 640w, /media/editorial/login-pavilion-light-v3.webp 896w',
      plateNo: 'PLATE I · DAYLIGHT PAVILION',
    }
))

const title = computed(() => ({
  login: t.value.auth.login,
  register: t.value.auth.register,
  forgot: t.value.auth.forgot,
  reset: t.value.auth.reset,
})[mode.value])

const modeIntro = computed(() => {
  const en = locale.value === 'en-US'
  if (mode.value === 'register') {
    return en
      ? 'Create a personal visitor archive to keep bookings, simulated store orders, and your curatorial notes together.'
      : '建立专属观展档案，同步保存你的线下预约票根与河洛文创模拟订单。'
  }
  if (mode.value === 'forgot') {
    return en
      ? 'Enter your username and bound email address to request a password reset link.'
      : '填写账号用户名与已绑定邮箱，系统将核验并发送密码重置链接。'
  }
  if (mode.value === 'reset') {
    return en
      ? 'Enter the reset token from your email and choose a new password of at least 8 characters.'
      : '填入邮件中的重置令牌并设置不少于 8 位的新密码。'
  }
  return t.value.auth.intro
})

const story = computed(() => locale.value === 'en-US' ? {
  aria: 'Account features',
  alt: 'Contemporary travertine and basalt pavilion of Heluo Digital Museum over a reflecting pool',
  folioLeft: 'HELUO PAVILION · LUOYANG',
  folioRight: '34°37′N · 112°27′E',
  kicker: 'VISITOR ARCHIVE',
  title: 'Carry online discovery\ninto your next visit.',
  items: [
    'Save your visitor profile & viewing archive',
    'Submit and track timed-entry bookings',
    'Manage store editions & simulated orders',
  ],
  context: 'VISITOR PASS · HELUO MUSEUM',
  seal: 'HL',
  usernamePlaceholder: 'e.g. heluo_visitor',
  nicknamePlaceholder: 'Name shown on your pass',
  emailPlaceholder: 'name@example.com',
  phonePlaceholder: 'Optional contact number',
  passwordPlaceholder: 'At least 8 characters',
  tokenPlaceholder: 'Paste your reset token',
  colophon: 'Concept digital museum · Visit bookings and store checkout use simulated flows.',
  backExplore: 'Return to collection',
  modeTabsAria: 'Account mode',
} : {
  aria: '账户功能说明',
  alt: '河洛数字博物馆当代建筑展馆与静水倒影实景概念图',
  folioLeft: '河洛展馆 · 洛阳',
  folioRight: '34°37′N · 112°27′E',
  kicker: 'VISITOR ARCHIVE · 观展通行档案',
  title: '把线上探索，\n接到下一次相见。',
  items: [
    '保存个人参观信息与观展档案',
    '提交并实时查看入馆预约与藏书票',
    '管理河洛文创订单与模拟出库笺',
  ],
  context: 'VISITOR PASS · 河洛数字博物馆账户',
  seal: '河洛',
  usernamePlaceholder: '3–32 位字母、数字或下划线',
  nicknamePlaceholder: '将显示于个人档案与入馆票根',
  emailPlaceholder: 'name@example.com',
  phonePlaceholder: '选填 · 便于预约联系',
  passwordPlaceholder: '请输入至少 8 位密码',
  tokenPlaceholder: '请粘贴邮件中的重置令牌',
  colophon: '概念数字博物馆 · 预约与文创结算均为本地模拟演示流程',
  backExplore: '返回探索馆藏',
  modeTabsAria: '账户操作切换',
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
      await auth.register({
        username: username.value,
        password: password.value,
        nickname: nickname.value,
        email: email.value || undefined,
        phone: phone.value || undefined,
      })
      message.value = locale.value === 'en-US'
        ? 'Account created. Sign in with your username and password.'
        : '账号创建成功，请使用用户名和密码登录。'
      mode.value = 'login'
    } else if (mode.value === 'forgot') {
      await apiRequest('/auth/password-reset/request', 'POST', { username: username.value, email: email.value })
      message.value = locale.value === 'en-US'
        ? 'If the account and email match, a reset link has been sent. Check your inbox.'
        : '若账号与已绑定邮箱匹配，重置链接已发送，请查收邮件。'
    } else {
      await apiRequest('/auth/password-reset/confirm', 'POST', { resetToken: resetToken.value, newPassword: password.value })
      message.value = locale.value === 'en-US'
        ? 'Password updated. Please sign in again.'
        : '密码已更新，请重新登录。'
      mode.value = 'login'
    }
  } catch (reason) {
    error.value = reason instanceof Error
      ? reason.message
      : (locale.value === 'en-US' ? 'Submission failed. Please try again.' : '提交失败，请稍后重试。')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section ref="root" class="auth-page task-auth-page" data-motion-page="login">
    <!-- 55% Full-Bleed Architectural Pavilion Plate (Daylight Limestone / Nocturne Basalt) -->
    <aside class="auth-story" data-motion="auth-story-media" :aria-label="story.aria">
      <img
        :src="pavilionMedia.src"
        :srcset="pavilionMedia.srcset"
        sizes="(max-width: 920px) 100vw, 55vw"
        :alt="story.alt"
        decoding="async"
        fetchpriority="high"
      />
      <div class="auth-story__scrim" aria-hidden="true"></div>

      <div class="auth-story__folio" aria-hidden="true">
        <span class="font-mono">{{ story.folioLeft }}</span>
        <span class="font-mono">{{ story.folioRight }}</span>
      </div>

      <div class="auth-story__copy" data-motion="auth-story">
        <div class="auth-story__eyebrow">
          <span class="auth-story__rule" aria-hidden="true"></span>
          <p class="auth-story__kicker font-mono">{{ story.kicker }}</p>
        </div>
        <h2>{{ story.title }}</h2>
        <ul>
          <li v-for="(item, idx) in story.items" :key="item">
            <span class="font-mono">0{{ idx + 1 }}</span>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>
    </aside>

    <!-- 45% Museum Pass Editorial Form Canvas -->
    <section class="auth-panel" data-motion="auth-panel">
      <div class="auth-panel__inner">
        <div class="auth-card">
          <header class="auth-card__head">
            <div class="auth-card__brand">
              <span class="auth-seal" aria-hidden="true">{{ story.seal }}</span>
              <p class="auth-context font-mono">{{ story.context }}</p>
            </div>

            <div
              v-if="mode === 'login' || mode === 'register'"
              class="auth-mode-tabs"
              role="tablist"
              :aria-label="story.modeTabsAria"
            >
              <button
                type="button"
                role="tab"
                :aria-selected="mode === 'login'"
                :class="{ 'is-active': mode === 'login' }"
                @click="switchMode('login')"
              >
                {{ t.auth.login }}
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="mode === 'register'"
                :class="{ 'is-active': mode === 'register' }"
                @click="switchMode('register')"
              >
                {{ t.auth.register }}
              </button>
            </div>

            <h1>{{ title }}</h1>
            <p class="auth-intro">{{ modeIntro }}</p>
          </header>

          <InlineStatus v-if="message" kind="success" :message="message" />
          <InlineStatus v-if="error" kind="error" :message="error" />

          <form class="auth-form" @submit.prevent="submit">
            <label v-if="mode !== 'reset'">
              <span>{{ t.auth.username }}</span>
              <input
                v-model.trim="username"
                minlength="3"
                maxlength="32"
                pattern="[A-Za-z0-9_]+"
                required
                autocomplete="username"
                :placeholder="story.usernamePlaceholder"
              />
            </label>

            <label v-if="mode === 'register'">
              <span>{{ t.auth.nickname }}</span>
              <input
                v-model.trim="nickname"
                maxlength="50"
                required
                autocomplete="nickname"
                :placeholder="story.nicknamePlaceholder"
              />
            </label>

            <label v-if="mode === 'register' || mode === 'forgot'">
              <span>{{ t.auth.email }}<small v-if="mode === 'register'"> {{ t.auth.emailOptional }}</small></span>
              <input
                v-model.trim="email"
                type="email"
                :required="mode === 'forgot'"
                autocomplete="email"
                :placeholder="story.emailPlaceholder"
              />
            </label>

            <label v-if="mode === 'register'">
              <span>{{ t.auth.phoneOptional }}</span>
              <input
                v-model.trim="phone"
                maxlength="20"
                autocomplete="tel"
                :placeholder="story.phonePlaceholder"
              />
            </label>

            <label v-if="mode === 'reset'">
              <span>{{ t.auth.token }}</span>
              <input
                v-model.trim="resetToken"
                required
                :placeholder="story.tokenPlaceholder"
              />
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
                  :placeholder="story.passwordPlaceholder"
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
            <button v-if="mode !== 'login'" type="button" @click="switchMode('login')">← {{ t.auth.back }}</button>
            <button v-if="mode === 'login'" type="button" @click="switchMode('register')">{{ t.auth.create }}</button>
            <button v-if="mode === 'login'" type="button" @click="switchMode('forgot')">{{ t.auth.forgotAction }}</button>
          </div>
        </div>

        <footer class="auth-colophon">
          <p>{{ story.colophon }}</p>
          <RouterLink class="auth-colophon__back" to="/explore">← {{ story.backExplore }}</RouterLink>
        </footer>
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

/* ── Left 55%: Architectural Pavilion Plate with Precision Optical Scrim ── */
.auth-story {
  position: sticky;
  top: var(--header-height);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: calc(100dvh - var(--header-height));
  min-height: 600px;
  overflow: hidden;
  background: var(--surface-darkroom);
}

.auth-story img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 42%;
}

/* Keep the travertine pavilion / nocturnal glowing vestibule crisp & luminous; anchor scrim over reflecting pool */
.auth-story__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      oklch(12% 0.008 238 / 0.26) 0%,
      transparent 18%,
      transparent 46%,
      oklch(10% 0.008 238 / 0.72) 73%,
      oklch(8% 0.006 238 / 0.94) 100%
    );
  pointer-events: none;
}

:global(html[data-theme="dark"]) .auth-story__scrim {
  background:
    linear-gradient(90deg, transparent 74%, var(--surface-canvas) 100%),
    linear-gradient(
      180deg,
      oklch(10% 0.006 238 / 0.24) 0%,
      transparent 20%,
      transparent 52%,
      oklch(9% 0.006 238 / 0.76) 76%,
      oklch(8% 0.006 238 / 0.96) 100%
    );
}

.auth-story__folio {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1.75rem, 4.5vw, 3.75rem) 0;
}

.auth-story__folio span {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  border: 1px solid oklch(96% 0.006 86 / 0.22);
  border-radius: var(--radius-pill);
  background: oklch(11% 0.008 238 / 0.42);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: oklch(95% 0.006 86);
}

.auth-story__copy {
  position: relative;
  z-index: 2;
  display: grid;
  gap: var(--space-4);
  max-width: 540px;
  padding: clamp(2rem, 4.5vw, 3.75rem);
  color: var(--ink-on-dark);
}

/* Anchor the darkening to the text so different image crops cannot brighten its backdrop. */
.auth-story__copy::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: -1rem -2rem 0 0;
  background: linear-gradient(180deg,
    transparent,
    oklch(10% 0.008 238 / 0.82) 2.5rem,
    oklch(10% 0.008 238 / 0.35) 100%);
  mask-image: linear-gradient(90deg, var(--ink-on-dark) calc(100% - 2rem), transparent);
  pointer-events: none;
}

.auth-story__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.auth-story__rule {
  width: 24px;
  height: 1px;
  background: oklch(82% 0.068 78);
}

.auth-story__kicker {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.16em;
  color: oklch(82% 0.068 78);
}

.auth-story__copy h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 3.1vw, 2.85rem);
  font-weight: 600;
  line-height: 1.24;
  letter-spacing: 0.01em;
  white-space: pre-line;
  color: var(--ink-on-dark);
  text-shadow: 0 2px 18px oklch(6% 0.006 238 / 0.42);
}

.auth-story__copy ul {
  display: grid;
  gap: 0.65rem;
  margin: var(--space-1) 0 0;
  padding: var(--space-4) 0 0;
  list-style: none;
  border-top: 1px solid oklch(94% 0.008 86 / 0.22);
}

.auth-story__copy li {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: oklch(94% 0.006 86 / 0.92);
}

.auth-story__copy li span:first-child {
  font-size: var(--text-xs);
  font-weight: 600;
  color: oklch(82% 0.068 78);
}

/* ── Right 45%: Elevated Museum Folio Account Portal ── */
.auth-panel {
  position: relative;
  display: grid;
  place-items: center;
  padding: clamp(2rem, 4.5vw, 3.5rem) clamp(1.5rem, 4vw, 3.25rem);
  background: var(--surface-canvas);
  border-left: 1px solid var(--border-hairline);
}

:global(html[data-theme="dark"]) .auth-panel {
  border-left-color: transparent;
}

.auth-panel__inner {
  display: grid;
  gap: var(--space-5);
  width: min(100%, 440px);
}

.auth-card {
  display: grid;
  gap: var(--space-5);
  padding: clamp(1.75rem, 3.2vw, 2.5rem);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
  box-shadow: var(--card-frame-sheen), var(--shadow-sm);
}

.auth-card__head {
  display: grid;
  gap: var(--space-3);
}

.auth-card__brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.auth-seal {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 0.28rem;
  border: 1px solid color-mix(in oklch, var(--accent-seal) 72%, var(--border-strong));
  border-radius: 4px;
  background: color-mix(in oklch, var(--accent-seal) 8%, transparent);
  color: var(--accent-seal);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
}

.auth-context {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--accent-bronze);
}

.auth-mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
}

.auth-mode-tabs button {
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial),
              border-color var(--duration-fast) var(--ease-curatorial),
              box-shadow var(--duration-fast) var(--ease-curatorial);
}

.auth-mode-tabs button:hover:not(.is-active) {
  color: var(--ink-primary);
}

.auth-mode-tabs button.is-active {
  background: var(--surface-elevated);
  border-color: var(--border-strong);
  color: var(--ink-primary);
  box-shadow: var(--shadow-xs);
}

.auth-card h1 {
  margin: var(--space-1) 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 2.5vw, 2.15rem);
  line-height: 1.2;
  color: var(--ink-primary);
}

.auth-intro {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--ink-secondary);
  text-wrap: pretty;
}

.auth-form {
  display: grid;
  gap: var(--space-4);
}

.auth-form label {
  display: grid;
  gap: 0.4rem;
}

.auth-form label > span:first-child {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ink-primary);
}

.auth-form label small {
  font-weight: 400;
  color: var(--ink-muted);
}

.auth-form input {
  width: 100%;
  min-height: 46px;
  padding: 0 0.875rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--ink-primary);
  font-size: var(--text-sm);
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial),
              box-shadow var(--duration-fast) var(--ease-curatorial);
}

.auth-form input::placeholder {
  color: var(--ink-muted);
}

.auth-form input:focus {
  outline: none;
  border-color: var(--accent-bronze);
  background: var(--surface-canvas);
  box-shadow: var(--focus-ring);
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
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}

.password-toggle:hover {
  color: var(--ink-primary);
  background: var(--surface-elevated);
}

.password-toggle svg {
  width: 17px;
  height: 17px;
}

.auth-switch {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
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

.auth-colophon {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  padding-inline: 0.25rem;
  font-size: var(--text-xs);
  line-height: 1.6;
  color: var(--ink-muted);
}

.auth-colophon p {
  margin: 0;
}

.auth-colophon__back {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--ink-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.auth-colophon__back:hover {
  color: var(--ink-primary);
}

@media (pointer: coarse) {
  .auth-page :is(.auth-mode-tabs button, .password-toggle) {
    min-block-size: var(--control-min);
    min-inline-size: var(--control-min);
  }

  .auth-page .auth-form input {
    min-block-size: 48px;
    font-size: max(16px, 1rem);
  }

  .auth-page .password-field input {
    padding-inline-end: calc(var(--control-min) + var(--space-4));
  }
}

@media (max-width: 920px) {
  .task-auth-page {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .auth-story {
    position: relative;
    top: auto;
    height: auto;
    min-height: 300px;
  }

  .auth-story__folio {
    padding: var(--space-4) var(--space-5) 0;
  }

  .auth-story__copy {
    padding: var(--space-5);
    gap: var(--space-3);
  }

  .auth-story__copy ul {
    display: none;
  }

  .auth-panel {
    border-left: 0;
    padding: var(--space-6) var(--space-4) var(--space-10);
  }

  .auth-card {
    padding: var(--space-5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-mode-tabs button,
  .auth-form input {
    transition: none;
  }
}
</style>
