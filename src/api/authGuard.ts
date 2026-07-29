import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { setUnauthorizedHandler } from '@/api/client'

let redirectingToLogin = false

/** 401 из API → logout + редирект на /login с сохранением текущего пути в query. */
export function setupAuthGuard() {
  setUnauthorizedHandler(async () => {
    useAuthStore().logout()

    const currentPath = router.currentRoute.value.fullPath
    if (!redirectingToLogin && currentPath !== '/login') {
      redirectingToLogin = true
      try {
        await router.replace({ path: '/login', query: { redirect: currentPath } })
      } finally {
        redirectingToLogin = false
      }
    }
  })
}
