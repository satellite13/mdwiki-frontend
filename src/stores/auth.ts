import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'

type UserRole = 'READER' | 'EDITOR' | 'ADMIN'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const username = ref<string | null>(localStorage.getItem('username'))
  const role = ref<UserRole | null>(localStorage.getItem('role') as UserRole | null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'ADMIN')
  const isEditor = computed(() => role.value === 'EDITOR' || role.value === 'ADMIN')

  function setAuth(t: string, u: string, r: UserRole) {
    token.value = t; username.value = u; role.value = r
    localStorage.setItem('token', t); localStorage.setItem('username', u); localStorage.setItem('role', r)
  }

  async function login(user: string, password: string) {
    const { data } = await authApi.login(user, password)
    setAuth(data.token, data.username, data.role as UserRole)
  }

  async function register(user: string, email: string, password: string) {
    const { data } = await authApi.register(user, email, password)
    setAuth(data.token, data.username, data.role as UserRole)
  }

  function logout() {
    token.value = null; username.value = null; role.value = null
    localStorage.removeItem('token'); localStorage.removeItem('username'); localStorage.removeItem('role')
  }

  return { token, username, role, isAuthenticated, isAdmin, isEditor, login, register, logout }
})
