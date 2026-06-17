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
        { path: '', name: 'workspace', component: () => import('@/components/pages/WorkspacePage.vue') },
        { path: 'page/:slug', name: 'page', component: () => import('@/components/pages/WorkspacePage.vue'), props: true },
        { path: 'search', name: 'search', component: () => import('@/components/search/SearchPage.vue') },
        { path: 'graph', name: 'wiki-graph', component: () => import('@/components/graph/WikiGraphPage.vue') },
        { path: 'broken-links', name: 'broken-links', component: () => import('@/components/links/BrokenLinksPage.vue') },
        { path: 'attachments', name: 'attachments', component: () => import('@/components/attachments/AttachmentsPage.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/components/profile/ProfilePage.vue') },
        { path: 'admin/users', name: 'admin-users', component: () => import('@/components/admin/AdminUsersPage.vue'), meta: { requiresAdmin: true } },
        { path: 'admin/embedding', name: 'admin-embedding', component: () => import('@/components/admin/AdminEmbeddingSettingsPage.vue'), meta: { requiresAdmin: true } }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login' }
  if (to.meta.guest && auth.isAuthenticated) return { name: 'workspace' }
  if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'workspace' }
})

export default router
