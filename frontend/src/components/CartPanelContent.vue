<script setup lang="ts">
import { computed } from 'vue'
import { Delete, Lock, Minus, Plus } from '@element-plus/icons-vue'
import { RouterLink } from 'vue-router'
import FluidButton from './FluidButton.vue'
import InlineStatus from './InlineStatus.vue'
import { fallbackProductCover, resolveProductPresentation } from '../lib/productPresentation'
import { mediaSrcset } from '../lib/responsiveMedia'
import { useLocale } from '../stores/locale'

interface CartItem {
  id: number
  productId: number
  quantity: number
  name: string
  slug?: string
  price: string
  availableStock: number
  coverImageUrl: string
}

const props = defineProps<{
  loggedIn: boolean
  items: CartItem[]
  itemCount: number
  total: string
  email: string
  checkoutState: 'idle' | 'loading' | 'success' | 'error'
  pendingOrder?: { id: number; orderNo: string } | null
  pendingCheckout?: boolean
  message?: string
  error?: string
  inputId?: string
  pendingItemIds?: number[]
  mutating?: boolean
  cartLoading?: boolean
  cartLoadError?: string
  announceFeedback?: boolean
}>()

const controlsLocked = computed(() => props.checkoutState === 'loading' || props.pendingCheckout || props.mutating || Boolean(props.pendingItemIds?.length))
const { locale } = useLocale()

const copy = computed(() => locale.value === 'en-US' ? {
  signInTitle: 'Sign in to use your bag',
  signInText: 'Save curated objects and complete a simulated museum-store order.',
  signIn: 'Sign in',
  pendingTitle: 'Payment still pending',
  order: 'Order',
  pendingOrderText: 'Continue the mock payment without creating another order.',
  checkingOrder: 'We are checking the previous order. Continue checkout without creating a duplicate.',
  retry: 'Continue mock payment',
  completed: 'Order completed',
  empty: 'Your bag is empty',
  completedText: 'Choose another Heluo-inspired object whenever you are ready.',
  emptyText: 'Select an object from the gallery to bring Heluo craft into daily life.',
  browse: 'Continue browsing',
  quantity: 'quantity',
  decrease: 'Decrease quantity',
  increase: 'Increase quantity',
  remove: 'Remove',
  removeTitle: 'Remove item',
  email: 'Order notification email',
  emailHint: 'For simulated payment confirmation',
  subtotal: 'Subtotal',
  delivery: 'Delivery',
  deliveryText: 'Simulated order · no shipping',
  total: 'Total',
  unit: 'items',
  paying: 'Completing mock payment',
  pay: 'Confirm and mock pay',
  paymentNote: 'This demonstration creates no real charge or delivery.',
} : {
  signInTitle: '登录后使用购物袋',
  signInText: '保存心仪文创，完成模拟下单与支付体验。',
  signIn: '前往登录',
  pendingTitle: '订单待完成支付',
  order: '订单号',
  pendingOrderText: '请继续模拟支付，不会重新创建订单。',
  checkingOrder: '正在确认先前提交的订单。请继续结算，不会创建重复订单。',
  retry: '继续模拟支付',
  completed: '订单已完成',
  empty: '购物袋还是空的',
  completedText: '可以继续挑选下一件河洛文创。',
  emptyText: '从左侧陈列中挑选一件器物，带入日常。',
  browse: '继续浏览文创',
  quantity: '数量',
  decrease: '减少数量',
  increase: '增加数量',
  remove: '移除',
  removeTitle: '移除商品',
  email: '订单通知邮箱',
  emailHint: '用于接收模拟支付结果',
  subtotal: '商品小计',
  delivery: '配送说明',
  deliveryText: '模拟订单，无实物物流',
  total: '合计',
  unit: '件',
  paying: '正在完成模拟支付',
  pay: '确认并模拟支付',
  paymentNote: '演示结算不会产生真实扣款或物流。',
})

const cartName = (name: string) => locale.value === 'en-US'
  ? ({ '河流纹茶杯套装': 'River-pattern Teacup Set', '河洛水系丝巾': 'Heluo River-system Scarf', '河图纹笔记本': 'River-map Pattern Notebook' }[name] ?? name)
  : name

const loadingCopy = computed(() => locale.value === 'en-US' ? {
  loading: 'Loading your shopping bag',
  failed: 'Your shopping bag could not be loaded',
  retry: 'Reload shopping bag',
} : {
  loading: '正在加载购物袋',
  failed: '购物袋暂时无法加载',
  retry: '重新加载购物袋',
})

const removeLabel = (name: string) => locale.value === 'en-US' ? `${copy.value.remove} ${cartName(name)}` : `${copy.value.remove}${cartName(name)}`
const cartImage = (item: CartItem) => resolveProductPresentation(item).coverImageUrl

function useFallbackImage(event: Event, item: CartItem) {
  const image = event.currentTarget as HTMLImageElement
  const fallback = fallbackProductCover(item)
  if (fallback && !image.src.endsWith(fallback)) image.src = fallback
}

const emit = defineEmits<{
  (event: 'update:email', value: string): void
  (event: 'change', item: CartItem, quantity: number): void
  (event: 'remove', item: CartItem): void
  (event: 'checkout'): void
  (event: 'reload'): void
  (event: 'browse'): void
}>()

function updateEmail(event: Event) {
  emit('update:email', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="cart-experience">
    <InlineStatus v-if="message" kind="success" :message="message" :announce="Boolean(announceFeedback)" />
    <InlineStatus v-if="error" kind="error" :message="error" :announce="Boolean(announceFeedback)" />

    <!-- Unauthenticated State -->
    <div v-if="!loggedIn" class="cart-empty-state">
      <svg class="cart-empty-state__art" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M16 22h32l-3 30H19L16 22Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        <path d="M24 22v-4a8 8 0 0 1 16 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M25 35c3.5-2.5 10.5-2.5 14 0" stroke="var(--accent-bronze)" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <h3>{{ copy.signInTitle }}</h3>
      <p>{{ copy.signInText }}</p>
      <RouterLink class="fluid-button fluid-button--primary fluid-button--block" :to="{ path: '/login', query: { returnTo: '/shop' } }">
        {{ copy.signIn }}
      </RouterLink>
    </div>

    <!-- Loading State -->
    <div v-else-if="cartLoading && !pendingCheckout" class="cart-empty-state" role="status">
      <p>{{ loadingCopy.loading }}</p>
    </div>

    <!-- Load Error State -->
    <div v-else-if="cartLoadError && !pendingCheckout" class="cart-empty-state">
      <h3>{{ loadingCopy.failed }}</h3>
      <FluidButton type="button" variant="secondary" block @click="emit('reload')">{{ loadingCopy.retry }}</FluidButton>
    </div>

    <!-- Empty or Pending Order Recovery State -->
    <div v-else-if="!items.length" class="cart-empty-state">
      <svg class="cart-empty-state__art" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M16 22h32l-3 30H19L16 22Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        <path d="M24 22v-4a8 8 0 0 1 16 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="32" cy="36" r="3" stroke="var(--accent-bronze)" stroke-width="1.5" />
      </svg>
      <template v-if="pendingCheckout">
        <h3>{{ copy.pendingTitle }}</h3>
        <p v-if="pendingOrder">{{ copy.order }}: <span class="font-mono">{{ pendingOrder.orderNo }}</span> · {{ copy.pendingOrderText }}</p>
        <p v-else>{{ copy.checkingOrder }}</p>
        <FluidButton type="button" block :loading="checkoutState === 'loading'" :state="checkoutState === 'error' ? 'error' : 'idle'" @click="emit('checkout')">
          {{ copy.retry }}
        </FluidButton>
      </template>
      <template v-else>
        <h3>{{ checkoutState === 'success' ? copy.completed : copy.empty }}</h3>
        <p>{{ checkoutState === 'success' ? copy.completedText : copy.emptyText }}</p>
        <a class="fluid-button fluid-button--secondary fluid-button--block" href="#shop-products" @click="emit('browse')">
          {{ copy.browse }}
        </a>
      </template>
    </div>

    <!-- Active Cart Items + Checkout -->
    <template v-else>
      <TransitionGroup name="cart-row" tag="div" class="cart-items" aria-live="polite">
        <article v-for="item in items" :key="item.id" class="cart-item">
          <img
            :src="cartImage(item)"
            :srcset="mediaSrcset(cartImage(item))"
            sizes="56px"
            :alt="item.name"
            loading="lazy"
            decoding="async"
            @error="useFallbackImage($event, item)"
          />
          <div class="cart-item__body">
            <span class="cart-item__name">{{ cartName(item.name) }}</span>
            <strong class="cart-item__price font-mono">¥ {{ item.price }}</strong>
            <div class="quantity" role="group" :aria-label="`${cartName(item.name)} ${copy.quantity}`">
              <button type="button" :disabled="item.quantity <= 1 || controlsLocked" :aria-label="copy.decrease" @click="emit('change', item, item.quantity - 1)">
                <Minus aria-hidden="true" />
              </button>
              <span aria-live="polite">{{ item.quantity }}</span>
              <button type="button" :disabled="item.quantity >= Math.min(10, item.availableStock) || controlsLocked" :aria-label="copy.increase" @click="emit('change', item, item.quantity + 1)">
                <Plus aria-hidden="true" />
              </button>
            </div>
          </div>
          <button
            class="remove-cart-item"
            type="button"
            :disabled="controlsLocked"
            :aria-label="removeLabel(item.name)"
            :title="copy.removeTitle"
            @click="emit('remove', item)"
          >
            <Delete aria-hidden="true" />
          </button>
        </article>
      </TransitionGroup>

      <form class="cart-order-form" @submit.prevent="emit('checkout')">
        <label class="cart-email-field" :for="props.inputId ?? 'cart-notification-email'">
          <span>{{ copy.email }} <small>{{ copy.emailHint }}</small></span>
          <input
            :id="props.inputId ?? 'cart-notification-email'"
            :value="email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            :disabled="checkoutState === 'loading' || pendingCheckout"
            required
            @input="updateEmail"
          />
        </label>

        <dl class="cart-order-summary">
          <div><dt>{{ copy.subtotal }}</dt><dd class="font-mono">¥ {{ total }}</dd></div>
          <div><dt>{{ copy.delivery }}</dt><dd>{{ copy.deliveryText }}</dd></div>
          <div class="cart-order-total">
            <dt>{{ copy.total }} <small>({{ itemCount }} {{ copy.unit }})</small></dt>
            <dd class="font-mono">¥ {{ total }}</dd>
          </div>
        </dl>

        <FluidButton
          type="submit"
          block
          size="lg"
          :disabled="mutating || Boolean(pendingItemIds?.length)"
          :loading="checkoutState === 'loading'"
          :state="checkoutState === 'success' ? 'success' : checkoutState === 'error' ? 'error' : 'idle'"
        >
          {{ checkoutState === 'loading' ? copy.paying : copy.pay }}
        </FluidButton>
        <p class="cart-payment-note"><Lock aria-hidden="true" /><span>{{ copy.paymentNote }}</span></p>
      </form>
    </template>
  </div>
</template>

<style scoped>
.cart-experience {
  display: grid;
  gap: var(--space-4);
}

.cart-empty-state {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.cart-empty-state__art {
  width: 52px;
  height: 52px;
  color: var(--ink-muted);
}

.cart-empty-state h3 {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--ink-primary);
}

.cart-empty-state p {
  max-width: 28ch;
  font-size: var(--text-sm);
  line-height: 1.65;
  color: var(--ink-muted);
}

/* ── Cart Items List ── */
.cart-items {
  display: grid;
  gap: var(--space-3);
}

.cart-item {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
}

.cart-item img {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-xs);
  object-fit: cover;
  background: var(--surface-plinth);
}

.cart-item__body {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.cart-item__name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-primary);
  line-height: 1.35;
}

.cart-item__price {
  font-size: var(--text-sm);
  color: var(--accent-bronze);
}

.cart-item .quantity svg {
  width: 13px;
  height: 13px;
}

.remove-cart-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial);
}

.remove-cart-item:hover:not(:disabled) {
  color: var(--accent-seal);
  background: var(--status-negative-bg);
}

.remove-cart-item svg {
  width: 16px;
  height: 16px;
}

/* ── Checkout Form ── */
.cart-order-form {
  display: grid;
  gap: var(--space-4);
  padding-top: var(--space-2);
}

.cart-email-field {
  display: grid;
  gap: 0.375rem;
}

.cart-email-field span {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-primary);
}

.cart-email-field small {
  font-weight: 400;
  color: var(--ink-muted);
  margin-left: 0.25rem;
}

.cart-email-field input {
  width: 100%;
}

.cart-order-summary {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: var(--space-3) 0;
  border-block: 1px solid var(--border-hairline);
}

.cart-order-summary > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.cart-order-summary dt {
  color: var(--ink-muted);
}

.cart-order-summary dd {
  margin: 0;
  color: var(--ink-primary);
}

.cart-order-total {
  padding-top: var(--space-2);
  border-top: 1px dashed var(--border-hairline);
}

.cart-order-total dt {
  font-weight: 600;
  color: var(--ink-primary);
}

.cart-order-total dt small {
  font-weight: 400;
  color: var(--ink-muted);
}

.cart-order-total dd {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--ink-primary);
}

.cart-payment-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-xs);
  color: var(--ink-muted);
  line-height: 1.5;
}

.cart-payment-note svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.cart-row-enter-active,
.cart-row-leave-active {
  transition: opacity var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-ui) var(--ease-curatorial);
}

.cart-row-enter-from,
.cart-row-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
