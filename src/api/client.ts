import axios from 'axios'
import router from '@/router'
import { readString, removePref } from '@/utils/localPreferences'

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

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removePref('token')
      removePref('username')
      removePref('role')
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
