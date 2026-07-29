import axios from 'axios'
import { readString } from '@/utils/localPreferences'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

let unauthorizedHandler: (() => void | Promise<void>) | null = null

/**
 * Регистрирует обработчик 401 (logout + редирект на /login) из composition root.
 * Через хук, а не напрямую — иначе client → router → stores/auth → api/auth → client (цикл).
 */
export function setUnauthorizedHandler(handler: typeof unauthorizedHandler) {
  unauthorizedHandler = handler
}

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
      void unauthorizedHandler?.()
    }
    return Promise.reject(error)
  }
)

export default client
