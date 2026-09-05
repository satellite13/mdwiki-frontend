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
        { path: 'page/:slug/history', name: 'page-history', component: () => import('@/components/pages/PageHistory.vue') },
        { path: 'search', name: 'search', component: () => import('@/components/search/SearchPage.vue') },
        { path: 'saved-searches', name: 'saved-searches', component: () => import('@/components/search/SavedSearchesPage.vue') },
        { path: 'views', name: 'views', component: () => import('@/components/pages/ViewsPage.vue') },
        { path: 'views/:id', name: 'view', component: () => import('@/components/pages/ViewsPage.vue'), props: true },
        { path: 'graph', name: 'wiki-graph', component: () => import('@/components/graph/WikiGraphPage.vue') },
        { path: 'broken-links', name: 'broken-links', component: () => import('@/components/links/BrokenLinksPage.vue') },
        { path: 'inbox', name: 'inbox', component: () => import('@/components/pkm/InboxPage.vue') },
        { path: 'daily/:date?', name: 'daily', component: () => import('@/components/pkm/DailyNotePage.vue') },
        { path: 'recent', name: 'recent', component: () => import('@/components/pkm/LibraryPage.vue') },
        { path: 'favorites', name: 'favorites', component: () => import('@/components/pkm/LibraryPage.vue') },
        { path: 'links/unlinked', name: 'unlinked-mentions', component: () => import('@/components/pkm/UnlinkedMentionsPage.vue') },
        { path: 'links/orphans', name: 'orphans', component: () => import('@/components/pkm/OrphansPage.vue') },
        { path: 'tasks', name: 'open-tasks', component: () => import('@/components/tasks/OpenTasksPage.vue') },
        { path: 'attachments', name: 'attachments', component: () => import('@/components/attachments/AttachmentsPage.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/components/profile/ProfilePage.vue') },
        { path: 'admin/users', name: 'admin-users', component: () => import('@/components/admin/AdminUsersPage.vue'), meta: { requiresAdmin: true } },
        { path: 'admin/embedding', name: 'admin-embedding', component: () => import('@/components/admin/AdminEmbeddingSettingsPage.vue'), meta: { requiresAdmin: true } },
        { path: 'admin/trash', name: 'admin-trash', component: () => import('@/components/admin/AdminTrashPage.vue'), meta: { requiresAdmin: true } },
        { path: 'admin/properties', name: 'admin-properties', component: () => import('@/components/admin/AdminPropertiesPage.vue'), meta: { requiresAdmin: true } },
        { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/components/pages/NotFoundPage.vue') }
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
