import { createRouter, createWebHistory, type RouterScrollBehavior } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { installInkTransitions } from '../lib/inkTransitions'

const HomeView = () => import('../views/HomeView.vue')
const ExploreView = () => import('../views/ExploreView.vue')
const ExhibitsView = () => import('../views/ExhibitsView.vue')
const AppointmentView = () => import('../views/AppointmentView.vue')
const ContentDetailView = () => import('../views/ContentDetailView.vue')
const LoginView = () => import('../views/LoginView.vue')
const ProfileView = () => import('../views/ProfileView.vue')
const ExhibitDetailView = () => import('../views/ExhibitDetailView.vue')
const ShopView = () => import('../views/ShopView.vue')

const AdminDashboardView = () => import('../views/AdminDashboardView.vue')
const AdminContentView = () => import('../views/AdminContentView.vue')
const AdminOperationsView = () => import('../views/AdminOperationsView.vue')
const AdminCategoriesView = () => import('../views/AdminCategoriesView.vue')
const AdminGuideView = () => import('../views/AdminGuideView.vue')
const AdminSlotsView = () => import('../views/AdminSlotsView.vue')
const AdminAppointmentsView = () => import('../views/AdminAppointmentsView.vue')
const AdminExhibitsView = () => import('../views/AdminExhibitsView.vue')
const AdminProductsView = () => import('../views/AdminProductsView.vue')
const AdminOrdersView = () => import('../views/AdminOrdersView.vue')
const AdminLogsView = () => import('../views/AdminLogsView.vue')
const AdminUsersView = () => import('../views/AdminUsersView.vue')

const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
  { path: '/explore', name: 'explore', component: ExploreView, meta: { title: '探索馆藏' } },
  { path: '/artifacts/:slug', name: 'artifact-detail', component: ContentDetailView, meta: { title: '文物故事' } },
  { path: '/articles/:slug', name: 'article-detail', component: ContentDetailView, meta: { title: '文化专题' } },
  { path: '/exhibits', name: 'exhibits', component: ExhibitsView, meta: { title: '数字展厅' } },
  { path: '/exhibits/:slug', name: 'exhibit-detail', component: ExhibitDetailView, meta: { title: '3D 数字展项' } },
  { path: '/appointment', name: 'appointment', component: AppointmentView, meta: { title: '预约参观' } },
  { path: '/shop', name: 'shop', component: ShopView, meta: { title: '河洛文创' } },
  { path: '/login', name: 'login', component: LoginView, meta: { title: '账户登录' } },
  { path: '/reset-password', name: 'reset-password', component: LoginView, meta: { title: '重置密码' } },
  { path: '/profile', name: 'profile', component: ProfileView, meta: { title: '个人中心', requiresAuth: true } },

  // Admin 2.0 routes (all lazily loaded)
  { path: '/admin', name: 'admin', component: AdminDashboardView, meta: { title: '运营看板', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/content', redirect: '/admin/artifacts', meta: { requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/artifacts', name: 'admin-artifacts', component: AdminContentView, props: { lockedTab: 'artifacts' }, meta: { title: '馆藏文物', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/articles', name: 'admin-articles', component: AdminContentView, props: { lockedTab: 'articles' }, meta: { title: '文化专题', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/exhibits', name: 'admin-exhibits', component: AdminExhibitsView, meta: { title: '3D 数字展项', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/categories', name: 'admin-categories', component: AdminCategoriesView, meta: { title: '展陈分类', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/appointments', name: 'admin-appointments', component: AdminAppointmentsView, meta: { title: '预约与核销', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/slots', name: 'admin-slots', component: AdminSlotsView, meta: { title: '排班与时段', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/products', name: 'admin-products', component: AdminProductsView, meta: { title: '文创商品', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/orders', name: 'admin-orders', component: AdminOrdersView, meta: { title: '商城订单', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/users', name: 'admin-users', component: AdminUsersView, meta: { title: '观众账号', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/guide', name: 'admin-guide', component: AdminGuideView, meta: { title: '洛笙 AI 治理', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/logs', name: 'admin-logs', component: AdminLogsView, meta: { title: '审计日志', requiresAuth: true, role: 'ADMIN' } },
  { path: '/admin/operations', name: 'admin-operations', component: AdminOperationsView, meta: { title: '运营管理', requiresAuth: true, role: 'ADMIN' } },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: '页面不存在' } },
]

export const ROUTE_TRANSITION_MS = 16
export const routeScrollBehavior: RouterScrollBehavior = (to, from, savedPosition) => {
  if (savedPosition) return savedPosition
  if (to.hash) return { el: to.hash, top: 96, behavior: 'auto' }
  if (to.path === from.path) return false
  return new Promise((resolve) => {
    window.setTimeout(() => resolve({ left: 0, top: 0 }), ROUTE_TRANSITION_MS)
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: routeScrollBehavior,
})

router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiredRole = to.matched.find((record) => record.meta.role)?.meta.role
  if (!requiresAuth && !requiredRole) return true
  const auth = useAuthStore()
  await auth.initialize()
  if (auth.token && auth.initializationError) return true
  if (!auth.loggedIn) return { name: 'login', query: { returnTo: to.fullPath } }
  if (requiredRole && !auth.user?.roles.includes(String(requiredRole))) return { name: 'home' }
  return true
})

export default router

installInkTransitions(router)
