import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/components/auth/LoginPage.vue'), meta: { guest: true } },
    { path: '/register', name: 'register', component: () => import('@/components/auth/RegisterPage.vue'), meta: { guest: true } },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'pages', component: () => import('@/components/pages/PageListPage.vue') },
        { path: 'page/:slug', name: 'page-view', component: () => import('@/components/pages/PageViewPage.vue'), props: true },
        { path: 'page/:slug/edit', name: 'page-edit', component: () => import('@/components/pages/PageEditPage.vue'), props: true, meta: { requiresEditor: true } },
        { path: 'new', name: 'page-new', component: () => import('@/components/pages/PageEditPage.vue'), meta: { requiresEditor: true } },
        { path: 'search', name: 'search', component: () => import('@/components/search/SearchPage.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/components/profile/ProfilePage.vue') },
        { path: 'admin/users', name: 'admin-users', component: () => import('@/components/admin/AdminUsersPage.vue'), meta: { requiresAdmin: true } }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login' }
  if (to.meta.guest && auth.isAuthenticated) return { name: 'pages' }
  if (to.meta.requiresEditor && !auth.isEditor) return { name: 'pages' }
  if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'pages' }
})

export default router
