<script lang="ts">
// Keep writes ordered when a pending request outlives a route instance.
let cartQueue = Promise.resolve()
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { ShoppingBag } from '@element-plus/icons-vue'
import { apiGet, apiRequest } from '../lib/api'
import { localizeProductName, localizeProductSummary } from '../lib/contentLocale'
import { resolveProductPresentation } from '../lib/productPresentation'
import { mediaSizes, mediaSrcset } from '../lib/responsiveMedia'
import { createGsapContext, revealFigures, revealSequence, shouldRunGsapReveal } from '../lib/gsap'
import { useAuthStore } from '../stores/auth'
import { useLocale } from '../stores/locale'
import { audioSystem } from '../lib/audioSystem'
import BottomSheet from '../components/BottomSheet.vue'
import CartPanelContent, { type CompletedOrderReceipt } from '../components/CartPanelContent.vue'
import FluidButton from '../components/FluidButton.vue'
import InlineStatus from '../components/InlineStatus.vue'
import ProductProvenanceDrawer from '../components/ProductProvenanceDrawer.vue'

interface Product {
  id: number
  slug: string
  name: string
  nameEn?: string | null
  summary: string
  summaryEn?: string | null
  price: string
  availableStock: number
  coverImageUrl: string
  categoryCode?: string | null
  inspirationArtifactSlug?: string | null
}

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

interface Order {
  id: number
  orderNo: string
  payableAmount: string
  status?: string
  expiresAt?: string
}

interface PendingCheckout {
  userId: number
  cartItemIds: number[]
  notificationEmail: string
  checkoutKey: string
  paymentKey: string
  order?: Order
  itemsSnapshot?: Array<{ name: string; slug?: string; quantity: number; price: string }>
  totalSnapshot?: string
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const products = ref<Product[]>([])
type ProductCategory = 'all' | 'objects' | 'textiles' | 'paper'
const activeCategory = ref<ProductCategory>('all')
const productCategory = (product: Product): ProductCategory => {
  if (product.categoryCode === 'TEXTILE' || product.slug === 'heluo-silk-scarf') return 'textiles'
  if (product.categoryCode === 'STATIONERY' || product.slug === 'river-map-notebook') return 'paper'
  return 'objects'
}
const visibleProducts = computed(() => activeCategory.value === 'all' ? products.value : products.value.filter(product => productCategory(product) === activeCategory.value))
const provenanceProduct = ref<Product | null>(null)
const provenanceOpen = computed(() => provenanceProduct.value !== null)
const cart = ref<CartItem[]>([])
const loading = ref(true)
const productError = ref('')
const cartError = ref('')
const cartLoading = ref(true)
const actionError = ref('')
const message = ref('')
const email = ref('')
const mobileCartOpen = ref(false)
const mobileCartSnapPoint = ref<'medium' | 'full'>('medium')
const checkoutState = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const completedReceipt = ref<CompletedOrderReceipt | null>(null)
const addingProductId = ref<number | null>(null)
const pendingCheckout = ref<PendingCheckout | null>(null)
const pendingAddResumeHandled = ref(false)
const pendingCartActions = ref<number[]>([])
let cartMutationFailed = false

const cartBusy = computed(() => pendingCartActions.value.length > 0 || addingProductId.value !== null)
const total = computed(() => cart.value.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0).toFixed(2))
const itemCount = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0))
const pendingOrder = computed(() => pendingCheckout.value?.order ?? null)
const hasPendingCheckout = computed(() => pendingCheckout.value !== null)
const cartPanelError = computed(() => actionError.value || cartError.value)
const { t, locale } = useLocale()

const shopTitle = computed(() => locale.value === 'zh-CN' ? '器物的纹样，进入每天的生活。' : 'Bring the patterns of objects into everyday life.')
const shopCopy = computed(() => locale.value === 'en-US' ? {
  eyebrow: 'HELUO DESIGN STORE',
  categories: 'Product categories',
  all: 'All objects',
  category: 'Objects for daily life',
  apparel: 'Wearable textiles',
  paper: 'River-map stationery',
  unavailable: 'No products in this category yet',
  loadFailed: 'The collection could not be loaded',
  retryProducts: 'Try again',
  adding: 'Adding…',
  pending: 'Finish pending order',
  openCart: 'Open bag',
  bag: 'Shopping Bag',
  unit: 'items',
  soldOut: 'Sold out',
  lowStock: 'Limited',
} : {
  eyebrow: '河洛文创商店',
  categories: '商品分类',
  all: '全部文创',
  category: '器物日用',
  apparel: '穿戴织物',
  paper: '纸上河图',
  unavailable: '当前分类暂无在售文创',
  loadFailed: '文创商品暂时无法加载',
  retryProducts: '重新加载',
  adding: '正在加入…',
  pending: '待支付订单未完成',
  openCart: '打开购物袋',
  bag: '购物袋',
  unit: '件',
  soldOut: '暂缺',
  lowStock: '余量紧张',
})

const displayProduct = (product: Product) => {
  const normalized = resolveProductPresentation(product)
  return {
    ...normalized,
    name: localizeProductName(product, locale.value),
    summary: localizeProductSummary(product, locale.value) || normalized.summary,
  }
}

function syncRouteProvenanceItem() {
  const requestedSlug = typeof route?.query?.item === 'string' ? route.query.item.trim() : ''
  if (!requestedSlug) return
  const matched = products.value.find((item) => item.slug === requestedSlug)
  if (matched) provenanceProduct.value = matched
}

function useFallbackProductImage(event: Event, product: Product) {
  const image = event.currentTarget as HTMLImageElement
  const fallback = resolveProductPresentation({ slug: product.slug, name: product.name }).coverImageUrl
  if (fallback && image.src !== new URL(fallback, window.location.href).href) image.src = fallback
}

const stockUnit = (stock: number) => locale.value === 'en-US' && stock === 1 ? 'item' : t.value.shopText.items

let productRequestId = 0
let storefrontCued = false

async function loadProducts() {
  const requestId = ++productRequestId
  loading.value = true
  productError.value = ''
  try {
    const result = await apiGet<Product[]>('/products')
    if (requestId === productRequestId) {
      products.value = result
      syncRouteProvenanceItem()
    }
    if (requestId === productRequestId && result.length && !storefrontCued) {
      storefrontCued = true
      void audioSystem.playNarrative('discovery', { volume: 0.22 })
    }
  } catch (reason) {
    if (requestId === productRequestId) productError.value = reason instanceof Error ? reason.message : '商品加载失败。'
  } finally {
    if (requestId === productRequestId) loading.value = false
  }
}

async function retryProducts() { await loadProducts() }

async function closeCartForBrowsing() {
  mobileCartOpen.value = false
  await nextTick()
  document.getElementById('shop-products')?.focus({ preventScroll: true })
}

async function openProfileOrders() {
  mobileCartOpen.value = false
  if (router && typeof router.push === 'function') {
    await router.push('/profile')
  }
}

async function loadCart() {
  if (!auth.loggedIn) { cartLoading.value = false; return }
  cartLoading.value = true
  cartError.value = ''
  const token = auth.token
  try {
    await queueCartMutation(async () => {
      const result = await apiGet<CartItem[]>('/cart', token)
      if (auth.token !== token) return
      cart.value = result
      email.value ||= auth.user?.email ?? ''
    })
  } catch (reason) {
    cartError.value = reason instanceof Error ? reason.message : '购物袋加载失败，请稍后重试。'
  } finally {
    cartLoading.value = false
  }
}

function queueCartMutation(operation: () => Promise<void>) {
  const token = auth.token
  const next = cartQueue.then(async () => {
    if (auth.token !== token) throw new Error(locale.value === 'en-US' ? 'Your account changed. Reload the shopping bag.' : '账户已变更，请重新加载购物袋。')
    await operation()
  })
  cartQueue = next.catch(() => undefined)
  return next
}

function resetActionFeedback() {
  message.value = ''
  actionError.value = ''
}

function checkoutInProgress() { return checkoutState.value === 'loading' }

function pendingCheckoutStorageKey(userId: number) { return `heluo.pending-checkout.${userId}` }
function restorePendingCheckout() {
  const userId = auth.user?.id
  if (!userId) return
  try {
    const saved = JSON.parse(localStorage.getItem(pendingCheckoutStorageKey(userId)) ?? 'null') as PendingCheckout | null
    if (saved?.userId === userId && saved.cartItemIds.length && saved.checkoutKey && saved.paymentKey) pendingCheckout.value = saved
  } catch {
    localStorage.removeItem(pendingCheckoutStorageKey(userId))
  }
}
function persistPendingCheckout(attempt: PendingCheckout) {
  pendingCheckout.value = attempt
  localStorage.setItem(pendingCheckoutStorageKey(attempt.userId), JSON.stringify(attempt))
}
function clearPendingCheckout() {
  const userId = auth.user?.id
  if (userId) localStorage.removeItem(pendingCheckoutStorageKey(userId))
  pendingCheckout.value = null
}

async function add(product: Product) {
  await auth.initialize()
  if (!auth.loggedIn) {
    const returnTo = router.resolve({ name: 'shop', query: { intent: 'add-to-cart', productId: String(product.id) } }).fullPath
    await router.push({ name: 'login', query: { returnTo, intent: 'add-to-cart', productId: String(product.id) } })
    return
  }
  if (pendingCheckout.value || checkoutState.value === 'loading') {
    resetActionFeedback()
    actionError.value = locale.value === 'en-US' ? 'Finish the pending order before adding another product.' : '请先完成当前待支付订单，再继续添加商品。'
    return
  }
  if (addingProductId.value !== null) return
  if (!cartBusy.value) cartMutationFailed = false
  resetActionFeedback()
  addingProductId.value = product.id
  try {
    await queueCartMutation(async () => {
      cart.value = await apiRequest<CartItem[]>('/cart/items', 'POST', { productId: product.id, quantity: 1 }, auth.token)
    })
    cartError.value = ''
    completedReceipt.value = null
    message.value = locale.value === 'en-US' ? `${displayProduct(product).name} was added to your bag.` : `已将“${product.name}”加入购物袋。`
    if (!checkoutInProgress()) checkoutState.value = 'idle'
  } catch (reason) {
    cartMutationFailed = true
    actionError.value = reason instanceof Error ? reason.message : '加入购物车失败。'
  } finally {
    addingProductId.value = null
  }
}

async function resumePendingAdd() {
  if (pendingAddResumeHandled.value || !auth.loggedIn || route?.query?.intent !== 'add-to-cart') return
  const productId = String(route?.query?.productId ?? '')
  if (!/^\d+$/.test(productId)) return
  const product = products.value.find((item) => String(item.id) === productId)
  if (!product) return
  pendingAddResumeHandled.value = true
  await add(product)
  await router.replace({ name: 'shop' })
}

async function change(item: CartItem, quantity: number) {
  if (pendingCheckout.value || checkoutState.value === 'loading' || pendingCartActions.value.includes(item.id)) return
  if (!cartBusy.value) cartMutationFailed = false
  pendingCartActions.value = [...pendingCartActions.value, item.id]
  resetActionFeedback()
  try {
    await queueCartMutation(async () => {
      cart.value = await apiRequest<CartItem[]>(`/cart/items/${item.id}`, 'PATCH', { quantity }, auth.token)
    })
    cartError.value = ''
  } catch (reason) {
    cartMutationFailed = true
    actionError.value = reason instanceof Error ? reason.message : '数量更新失败。'
  } finally {
    pendingCartActions.value = pendingCartActions.value.filter((id) => id !== item.id)
  }
}

async function remove(item: CartItem) {
  if (pendingCheckout.value || checkoutState.value === 'loading' || pendingCartActions.value.includes(item.id)) return
  if (!cartBusy.value) cartMutationFailed = false
  pendingCartActions.value = [...pendingCartActions.value, item.id]
  resetActionFeedback()
  try {
    await queueCartMutation(async () => {
      cart.value = await apiRequest<CartItem[]>(`/cart/items/${item.id}`, 'DELETE', undefined, auth.token)
    })
    cartError.value = ''
    message.value = locale.value === 'en-US' ? 'The item was removed.' : `已移除“${item.name}”。`
  } catch (reason) {
    cartMutationFailed = true
    actionError.value = reason instanceof Error ? reason.message : '移除商品失败。'
  } finally {
    pendingCartActions.value = pendingCartActions.value.filter((id) => id !== item.id)
  }
}

async function checkout() {
  if (!auth.user || checkoutState.value === 'loading') return
  checkoutState.value = 'loading'
  await cartQueue
  if (!pendingCheckout.value && (cartMutationFailed || cartError.value)) {
    await loadCart()
    cartMutationFailed = false
    actionError.value = locale.value === 'en-US' ? 'Review the updated bag before checking out again.' : '请核对更新后的购物袋，再重新确认结算。'
    checkoutState.value = 'error'
    return
  }
  let attempt = pendingCheckout.value
  if (!attempt) {
    if (!cart.value.length) { checkoutState.value = 'idle'; return }
    attempt = {
      userId: auth.user.id,
      cartItemIds: cart.value.map((item) => item.id),
      notificationEmail: email.value,
      checkoutKey: crypto.randomUUID(),
      paymentKey: crypto.randomUUID(),
      itemsSnapshot: cart.value.map((item) => ({
        name: item.name,
        slug: item.slug,
        quantity: item.quantity,
        price: item.price,
      })),
      totalSnapshot: total.value,
    }
    persistPendingCheckout(attempt)
  }
  resetActionFeedback()
  checkoutState.value = 'loading'
  try {
    const order = attempt.order ?? await apiRequest<Order>('/orders', 'POST', {
      cartItemIds: attempt.cartItemIds,
      notificationEmail: attempt.notificationEmail,
    }, auth.token, { 'Idempotency-Key': attempt.checkoutKey })
    attempt = { ...attempt, order }
    persistPendingCheckout(attempt)
    cart.value = []
    await apiRequest(`/orders/${order.id}/mock-payment`, 'POST', undefined, auth.token, { 'Idempotency-Key': attempt.paymentKey })
    const receiptSnapshot: CompletedOrderReceipt = {
      orderNo: order.orderNo,
      total: order.payableAmount || attempt.totalSnapshot || '0.00',
      issuedAt: new Date().toISOString(),
      items: attempt.itemsSnapshot ?? [],
    }
    clearPendingCheckout()
    completedReceipt.value = receiptSnapshot
    cartError.value = ''
    message.value = locale.value === 'en-US' ? `Mock payment completed. Order: ${order.orderNo}` : `模拟支付成功，订单号：${order.orderNo}`
    checkoutState.value = 'success'
    mobileCartSnapPoint.value = 'medium'
  } catch (reason) {
    if (attempt?.order) {
      try {
        const serverOrder = await apiGet<Order>(`/orders/${attempt.order.id}`, auth.token)
        if (serverOrder.status === 'PAID' || serverOrder.status === 'COMPLETED') {
          const receiptSnapshot: CompletedOrderReceipt = {
            orderNo: serverOrder.orderNo,
            total: serverOrder.payableAmount || attempt.totalSnapshot || '0.00',
            issuedAt: new Date().toISOString(),
            items: attempt.itemsSnapshot ?? [],
          }
          clearPendingCheckout()
          completedReceipt.value = receiptSnapshot
          cart.value = []
          cartError.value = ''
          message.value = locale.value === 'en-US' ? `Mock payment completed. Order: ${serverOrder.orderNo}` : `模拟支付成功，订单号：${serverOrder.orderNo}`
          checkoutState.value = 'success'
          mobileCartSnapPoint.value = 'medium'
          return
        } else if (serverOrder.status === 'CANCELLED') {
          clearPendingCheckout()
        } else {
          attempt = { ...attempt, order: serverOrder }
          persistPendingCheckout(attempt)
        }
      } catch { /* keep the recovery key when reconciliation also fails */ }
    }
    const nonRetryable = reason instanceof Error && 'status' in reason
      && typeof (reason as { status?: unknown }).status === 'number'
      && (reason as { status: number }).status >= 400 && (reason as { status: number }).status < 500
      && ![401, 403, 408, 429].includes((reason as { status: number }).status)
    if (nonRetryable) clearPendingCheckout()
    else if (attempt?.order) cart.value = []
    actionError.value = reason instanceof Error ? reason.message : '下单或支付失败。'
    checkoutState.value = 'error'
  }
}

const root = ref<HTMLElement | null>(null)
let gsapContext: ReturnType<typeof createGsapContext>

function setupEntrance() {
  if (!shouldRunGsapReveal() || !root.value) return
  gsapContext?.revert()
  gsapContext = createGsapContext(root.value, () => {
    revealSequence('[data-motion="shop-intro"] > *', { stagger: 0.06 })
    revealSequence('[data-motion="shop-panel"] > *', { stagger: 0.05, delay: 0.14 })
  })
}

onMounted(async () => {
  setupEntrance()
  await auth.initialize()
  restorePendingCheckout()
  await Promise.all([loadProducts(), loadCart()])
  await resumePendingAdd()
})

watch(checkoutState, async (state) => {
  if (state === 'idle' || !shouldRunGsapReveal()) return
  await nextTick()
  const panel = root.value?.querySelectorAll<HTMLElement>('.cart-panel [role="status"], .cart-panel .state-panel')
  if (!panel?.length) return
  const { offset, duration } = revealFigures()
  gsap.fromTo(panel, { autoAlpha: 0, y: offset }, {
    autoAlpha: 1, y: 0, duration, ease: 'power3.out', clearProps: 'opacity,visibility,transform',
  })
})

onBeforeUnmount(() => gsapContext?.revert())
</script>

<template>
  <section ref="root" class="shop-page" data-motion-page="shop">
    <!-- Editorial Store Banner -->
    <header class="shop-intro" data-motion="shop-intro">
      <div class="shop-intro__head">
        <p class="eyebrow">{{ shopCopy.eyebrow }}</p>
        <h1>{{ shopTitle }}</h1>
        <p class="shop-intro__lead">{{ t.shopText.intro }}</p>
      </div>
      <div class="shop-category-nav" role="group" :aria-label="shopCopy.categories">
        <button type="button" :class="{ active: activeCategory === 'all' }" :aria-pressed="activeCategory === 'all'" @click="activeCategory = 'all'">{{ shopCopy.all }}</button>
        <button type="button" :class="{ active: activeCategory === 'objects' }" :aria-pressed="activeCategory === 'objects'" @click="activeCategory = 'objects'">{{ shopCopy.category }}</button>
        <button type="button" :class="{ active: activeCategory === 'textiles' }" :aria-pressed="activeCategory === 'textiles'" @click="activeCategory = 'textiles'">{{ shopCopy.apparel }}</button>
        <button type="button" :class="{ active: activeCategory === 'paper' }" :aria-pressed="activeCategory === 'paper'" @click="activeCategory = 'paper'">{{ shopCopy.paper }}</button>
      </div>
    </header>

    <!-- Two-Column Boutique Grid: 1fr Product Showcase + 360px Sticky Bag -->
    <div class="shop-mobile-bar">
      <div class="shop-mobile-bar__summary">
        <ShoppingBag class="shop-mobile-bar__icon" aria-hidden="true" />
        <span>{{ shopCopy.bag }}</span>
        <strong class="font-mono">{{ itemCount }} {{ shopCopy.unit }}</strong>
      </div>
      <button
        class="mobile-cart-trigger"
        type="button"
        :aria-label="`${shopCopy.openCart}, ${itemCount} ${shopCopy.unit}`"
        @click="mobileCartOpen = true"
      >
        <span>{{ shopCopy.openCart }}</span>
        <span class="mobile-cart-trigger__badge font-mono">{{ itemCount }}</span>
      </button>
    </div>

    <div class="shop-layout">
      <section class="shop-content">
        <InlineStatus v-if="message" kind="success" :message="message" :announce="!mobileCartOpen" />
        <InlineStatus v-else-if="cartPanelError" kind="error" :message="cartPanelError" :announce="!mobileCartOpen" />

        <div v-if="loading" class="state-panel">{{ t.shopText.loading }}</div>
        <section v-else-if="productError" class="state-panel state-panel--action shop-products-state">
          <h2>{{ shopCopy.loadFailed }}</h2>
          <p>{{ productError }}</p>
          <button class="fluid-button fluid-button--secondary" type="button" @click="retryProducts">{{ shopCopy.retryProducts }}</button>
        </section>
        <section v-else-if="visibleProducts.length === 0" class="state-panel state-panel--action shop-products-state">
          <h2>{{ shopCopy.unavailable }}</h2>
        </section>

        <div v-else id="shop-products" class="product-grid" tabindex="-1">
          <article v-for="(product, index) in visibleProducts" :key="product.id" class="product-card">
            <div v-pointer-surface="{ kind: 'product', maxTilt: 0.6 }" class="product-image">
              <img
                class="product-image__primary"
                :src="displayProduct(product).coverImageUrl"
                :srcset="mediaSrcset(displayProduct(product).coverImageUrl)"
                :sizes="mediaSizes"
                :alt="displayProduct(product).name"
                :loading="index === 0 ? 'eager' : 'lazy'"
                :fetchpriority="index === 0 ? 'high' : 'auto'"
                decoding="async"
                @error="useFallbackProductImage($event, product)"
              />
              <img
                v-if="displayProduct(product).detailImageUrl"
                class="product-image__detail"
                :src="displayProduct(product).detailImageUrl"
                :srcset="mediaSrcset(displayProduct(product).detailImageUrl)"
                :sizes="mediaSizes"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
              <span class="product-number font-mono" data-glass="compact">0{{ index + 1 }}</span>
              <span v-if="product.availableStock === 0" class="product-stock-badge product-stock-badge--out">{{ shopCopy.soldOut }}</span>
              <span v-else-if="product.availableStock <= 5" class="product-stock-badge">{{ shopCopy.lowStock }}</span>
              <button
                v-if="displayProduct(product).inspirationArtifactThumb"
                type="button"
                class="product-motif-chip"
                data-glass="dark"
                :aria-label="locale === 'en-US' ? `Open provenance: ${displayProduct(product).inspirationLabelEn}` : `查看溯源：${displayProduct(product).inspirationLabelZh}`"
                @click="provenanceProduct = product"
              >
                <img :src="displayProduct(product).inspirationArtifactThumb" alt="" aria-hidden="true" loading="lazy" decoding="async" />
                <span>{{ locale === 'en-US' ? displayProduct(product).inspirationLabelEn : displayProduct(product).inspirationLabelZh }}</span>
              </button>
            </div>

            <div class="product-copy">
              <h2>{{ displayProduct(product).name }}</h2>
              <p class="product-copy__summary">{{ displayProduct(product).summary }}</p>
              <div class="product-meta">
                <strong class="product-price font-mono">¥ {{ product.price }}</strong>
                <small>{{ t.shopText.remaining }} {{ product.availableStock }} {{ stockUnit(product.availableStock) }}</small>
              </div>
              <FluidButton
                block
                :disabled="product.availableStock === 0 || pendingCheckout !== null || (addingProductId !== null && addingProductId !== product.id)"
                :loading="addingProductId === product.id"
                @click="add(product)"
              >
                {{ addingProductId === product.id ? shopCopy.adding : pendingCheckout ? shopCopy.pending : t.shopText.add }}
              </FluidButton>
              <button
                type="button"
                class="product-provenance-btn"
                data-testid="open-provenance-btn"
                @click="provenanceProduct = product"
              >
                <span>{{ locale === 'en-US' ? 'Object Provenance & Notes' : '器物纹样溯源 · 策展手记' }}</span>
                <i aria-hidden="true">→</i>
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- Self-Sizing Sticky Shopping Bag (No giant empty white void) -->
      <aside class="cart-panel" data-motion="shop-panel" :aria-label="shopCopy.bag">
        <header class="cart-heading">
          <div class="cart-heading__title">
            <ShoppingBag class="cart-heading__icon" aria-hidden="true" />
            <h2>{{ shopCopy.bag }}</h2>
          </div>
          <span class="cart-count font-mono">{{ itemCount }} {{ shopCopy.unit }}</span>
        </header>
        <CartPanelContent
          :logged-in="auth.loggedIn"
          :items="cart"
          :item-count="itemCount"
          :total="total"
          :email="email"
          :checkout-state="checkoutState"
          :pending-order="pendingOrder"
          :completed-receipt="completedReceipt"
          :pending-checkout="hasPendingCheckout"
          :message="message"
          :error="cartPanelError"
          input-id="cart-notification-email-desktop"
          :announce-feedback="!mobileCartOpen"
          :cart-loading="cartLoading"
          :cart-load-error="cartError"
          :pending-item-ids="pendingCartActions"
          :mutating="cartBusy"
          @reload="loadCart"
          @update:email="email = $event"
          @change="change"
          @remove="remove"
          @checkout="checkout"
          @view-orders="openProfileOrders"
        />
      </aside>
    </div>

    <BottomSheet
      :open="mobileCartOpen"
      :title="`${shopCopy.bag} · ${itemCount} ${shopCopy.unit}`"
      :snap-point="mobileCartSnapPoint"
      @close="mobileCartOpen = false"
      @update:snap-point="mobileCartSnapPoint = $event"
    >
      <CartPanelContent
        :logged-in="auth.loggedIn"
        :items="cart"
        :item-count="itemCount"
        :total="total"
        :email="email"
        :checkout-state="checkoutState"
        :pending-order="pendingOrder"
        :completed-receipt="completedReceipt"
        :pending-checkout="hasPendingCheckout"
        :message="message"
        :error="cartPanelError"
        input-id="cart-notification-email-mobile"
        :cart-loading="cartLoading"
        :cart-load-error="cartError"
        :announce-feedback="true"
        :pending-item-ids="pendingCartActions"
        :mutating="cartBusy"
        @browse="closeCartForBrowsing"
        @reload="loadCart"
        @update:email="email = $event"
        @change="change"
        @remove="remove"
        @checkout="checkout"
        @view-orders="openProfileOrders"
      />
    </BottomSheet>

    <ProductProvenanceDrawer
      :open="provenanceOpen"
      :product="provenanceProduct"
      :adding="provenanceProduct !== null && addingProductId === provenanceProduct.id"
      :disabled="pendingCheckout !== null || (addingProductId !== null && addingProductId !== provenanceProduct?.id)"
      @close="provenanceProduct = null"
      @add="add"
    />
  </section>
</template>

<style scoped>
.shop-page {
  width: min(calc(100% - 4rem), var(--container-wide));
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(4rem, 7vw, 6rem);
  color: var(--ink-secondary);
}

/* ── Editorial Store Banner ── */
.shop-intro {
  display: grid;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
  border-bottom: 1px solid var(--border-hairline);
}

.shop-intro__head h1 {
  margin: var(--space-2) 0 var(--space-3);
  font-size: clamp(2.125rem, 3.4vw, 2.85rem);
  line-height: 1.18;
}

.shop-intro__lead {
  max-width: 58ch;
  font-size: var(--text-sm);
  line-height: 1.75;
  color: var(--ink-muted);
}

.shop-category-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-6);
}

.shop-category-nav button {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: var(--control-min);
  padding: 0 0.125rem;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--duration-ui) var(--ease-curatorial);
}

.shop-category-nav button::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent-seal);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--duration-ui) var(--ease-curatorial);
}

.shop-category-nav button:hover {
  color: var(--ink-primary);
}

.shop-category-nav button.active {
  color: var(--ink-primary);
  font-weight: 600;
}

.shop-category-nav button.active::after {
  transform: scaleX(1);
}

/* ── Two-Column Layout (1fr Products + 360px Sticky Bag) ── */
.shop-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: start;
  gap: clamp(1.75rem, 3vw, 2.5rem);
}

.shop-content {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

/* ── Boutique Photography Product Cards ── */
.product-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}

.product-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
  box-shadow: var(--card-frame-sheen), var(--shadow-xs);
  overflow: hidden;
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              box-shadow var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-ui) var(--ease-curatorial);
}

.product-card:hover {
  border-color: color-mix(in oklch, var(--accent-bronze) 52%, var(--border-strong));
  box-shadow: var(--card-frame-sheen), var(--shadow-md);
  transform: translateY(-2px);
}

.product-image {
  position: relative;
  aspect-ratio: 4 / 5;
  background: var(--surface-spotlight), var(--surface-stone-band);
  overflow: hidden;
}

.product-image::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.16), inset 0 -1px 0 oklch(12% 0.01 72 / 0.12);
}

.product-image img.product-image__primary,
.product-image img.product-image__detail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 480ms var(--ease-curatorial), opacity 340ms var(--ease-curatorial);
}

.product-image img.product-image__detail {
  opacity: 0;
  transform: scale(1.04);
  pointer-events: none;
}

.product-card:hover .product-image img.product-image__primary {
  transform: scale(1.03);
}

@media (hover: hover) and (pointer: fine) {
  .product-card:hover .product-image img.product-image__detail,
  .product-card:focus-within .product-image img.product-image__detail {
    opacity: 1;
    transform: scale(1);
  }
}

.product-motif-chip {
  position: absolute;
  left: var(--space-3);
  bottom: var(--space-3);
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: calc(100% - var(--space-6));
  min-height: 36px;
  padding: 0.25rem 0.65rem 0.25rem 0.3rem;
  border-radius: var(--radius-pill);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              transform var(--duration-fast) var(--ease-curatorial);
}

.product-motif-chip:hover {
  border-color: var(--accent-bronze);
  transform: translateY(-1px);
}

.product-motif-chip img {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  object-fit: contain;
  border-radius: 50%;
  padding: 2px;
  background: var(--surface-vitrine);
}

.product-motif-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-number {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-primary);
}

.product-stock-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-pill);
  background: var(--status-warning-bg);
  color: var(--status-warning);
  font-size: var(--text-xs);
  font-weight: 600;
}

.product-stock-badge--out {
  background: var(--status-negative-bg);
  color: var(--status-negative);
}

.product-image__note {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: var(--space-5) var(--space-4) var(--space-3);
  background: linear-gradient(180deg, transparent, oklch(12% 0.006 74 / 0.82));
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
  line-height: 1.55;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-ui) var(--ease-curatorial);
}

@media (hover: hover) and (pointer: fine) {
  .product-card:hover .product-image__note {
    opacity: 1;
    transform: translateY(0);
  }
}

.product-copy {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) var(--space-5);
}

.product-copy h2 {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  line-height: 1.35;
  color: var(--ink-primary);
}

.product-copy__summary {
  font-size: var(--text-xs);
  line-height: 1.65;
  color: var(--ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  padding: var(--space-3) 0 var(--space-2);
}

.product-price {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--ink-primary);
}

.product-meta small {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

/* ── Sticky Self-Sizing Bag Panel ── */
.cart-panel {
  position: sticky;
  top: calc(var(--header-height) + var(--space-5));
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
  box-shadow: var(--card-frame-sheen), var(--shadow-sm);
}

.cart-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
}

.cart-heading__title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.cart-heading__icon {
  width: 18px;
  height: 18px;
  color: var(--accent-bronze);
}

.cart-heading h2 {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--ink-primary);
}

.cart-count {
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-secondary);
}

/* ── Mobile Bag Bar (Docked in Flow / Sticky Subheader — Zero Card Occlusion) ── */
.product-provenance-btn {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  padding: 0 0.875rem;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--ink-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial);
}

.product-provenance-btn:hover {
  border-color: var(--accent-bronze);
  color: var(--ink-primary);
  background: color-mix(in oklab, var(--accent-bronze) 8%, var(--surface-subtle));
}

.product-provenance-btn i {
  font-style: normal;
  color: var(--accent-bronze);
}

.shop-mobile-bar {
  display: none;
}

.mobile-cart-trigger {
  display: none;
}

/* ── Responsive ── */
@media (max-width: 1200px) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .shop-layout {
    grid-template-columns: 1fr;
  }

  .cart-panel {
    display: none;
  }

  .shop-intro {
    margin-bottom: var(--space-4);
  }

  .shop-mobile-bar {
    position: sticky;
    top: 58px;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--surface-canvas) 94%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: var(--shadow-xs);
  }

  .shop-mobile-bar__summary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    font-size: var(--text-sm);
    color: var(--ink-secondary);
  }

  .shop-mobile-bar__summary strong {
    color: var(--ink-primary);
    font-weight: 600;
  }

  .shop-mobile-bar__icon {
    width: 17px;
    height: 17px;
    color: var(--accent-bronze);
    flex-shrink: 0;
  }

  .mobile-cart-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    padding: 0 0.95rem;
    border: 1px solid var(--accent-jade);
    border-radius: var(--radius-pill);
    background: var(--accent-jade);
    color: var(--accent-jade-ink);
    font-size: var(--text-xs);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
  }

  .mobile-cart-trigger__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: var(--radius-pill);
    background: color-mix(in oklch, var(--accent-jade-ink) 20%, transparent);
    font-size: var(--text-xs);
  }
}

@media (max-width: 760px) {
  .shop-page {
    width: calc(100% - 2rem);
    padding-top: var(--space-6);
  }

  .shop-category-nav {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
  }

  .shop-category-nav button {
    justify-content: center;
    font-size: var(--text-xs);
    padding-inline: 2px;
  }

  .product-grid {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }

  .product-image {
    aspect-ratio: 4 / 3;
  }
}
</style>
