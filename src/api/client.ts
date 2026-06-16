import axios from 'axios'
import router from '@/router'
import { readString } from '@/utils/localPreferences'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})
let redirectingToLogin = false

client.interceptors.request.use((config) => {
  const token = readString('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

async function handleUnauthorized() {
  const { useAuthStore } = await import('@/stores/auth')
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
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      void handleUnauthorized()
    }
    return Promise.reject(error)
  }
)

export default client
