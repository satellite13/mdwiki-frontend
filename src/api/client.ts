import axios from 'axios'
import router from '@/router'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})
let redirectingToLogin = false

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('role')
      const currentPath = router.currentRoute.value.fullPath
      if (!redirectingToLogin && currentPath !== '/login') {
        redirectingToLogin = true
        void router.replace({ path: '/login', query: { redirect: currentPath } }).finally(() => {
          redirectingToLogin = false
        })
      }
    }
    return Promise.reject(error)
  }
)

export default client
