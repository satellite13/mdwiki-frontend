import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import type { UserRole } from '@/types'
import { readString, writeString, removePref } from '@/utils/localPreferences'

const TOKEN_KEY = 'token'
const USERNAME_KEY = 'username'
const ROLE_KEY = 'role'

const VALID_ROLES: readonly UserRole[] = ['READER', 'EDITOR', 'ADMIN']

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value)
}

function readStoredRole(): UserRole | null {
  const raw = readString(ROLE_KEY)
  return isUserRole(raw) ? raw : null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readString(TOKEN_KEY))
  const username = ref<string | null>(readString(USERNAME_KEY))
  const role = ref<UserRole | null>(readStoredRole())

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'ADMIN')
  const isEditor = computed(() => role.value === 'EDITOR' || role.value === 'ADMIN')

  function setAuth(t: string, u: string, r: UserRole) {
    token.value = t
    username.value = u
    role.value = r
    writeString(TOKEN_KEY, t)
    writeString(USERNAME_KEY, u)
    writeString(ROLE_KEY, r)
  }

  async function login(user: string, password: string) {
    const { data } = await authApi.login(user, password)
    setAuth(data.token, data.username, data.role)
  }

  async function register(user: string, email: string, password: string) {
    const { data } = await authApi.register(user, email, password)
    setAuth(data.token, data.username, data.role)
  }

  function logout() {
    token.value = null
    username.value = null
    role.value = null
    removePref(TOKEN_KEY)
    removePref(USERNAME_KEY)
    removePref(ROLE_KEY)
  }

  return { token, username, role, isAuthenticated, isAdmin, isEditor, login, register, logout }
})
