import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn()
}))

import * as authApi from '@/api/auth'
import { useAuthStore } from './auth'

const mockedLogin = vi.mocked(authApi.login)
const mockedRegister = vi.mocked(authApi.register)

beforeEach(() => {
  window.localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useAuthStore', () => {
  it('starts unauthenticated when localStorage is empty', () => {
    const store = useAuthStore()
    expect(store.token).toBeNull()
    expect(store.username).toBeNull()
    expect(store.role).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isAdmin).toBe(false)
    expect(store.isEditor).toBe(false)
  })

  it('hydrates from localStorage and validates role', () => {
    window.localStorage.setItem('token', 't-1')
    window.localStorage.setItem('username', 'alice')
    window.localStorage.setItem('role', 'ADMIN')
    const store = useAuthStore()
    expect(store.token).toBe('t-1')
    expect(store.username).toBe('alice')
    expect(store.role).toBe('ADMIN')
    expect(store.isAdmin).toBe(true)
    expect(store.isEditor).toBe(true)
  })

  it('ignores invalid stored role', () => {
    window.localStorage.setItem('role', 'SUPERUSER')
    const store = useAuthStore()
    expect(store.role).toBeNull()
  })

  it('login persists token/username/role', async () => {
    mockedLogin.mockResolvedValueOnce({
      data: { token: 'tok', username: 'bob', role: 'EDITOR' }
    } as Awaited<ReturnType<typeof authApi.login>>)

    const store = useAuthStore()
    await store.login('bob', 'pw')

    expect(mockedLogin).toHaveBeenCalledWith('bob', 'pw')
    expect(store.token).toBe('tok')
    expect(store.role).toBe('EDITOR')
    expect(store.isEditor).toBe(true)
    expect(store.isAdmin).toBe(false)
    expect(window.localStorage.getItem('token')).toBe('tok')
    expect(window.localStorage.getItem('role')).toBe('EDITOR')
  })

  it('register stores returned credentials', async () => {
    mockedRegister.mockResolvedValueOnce({
      data: { token: 't', username: 'u', role: 'READER' }
    } as Awaited<ReturnType<typeof authApi.register>>)

    const store = useAuthStore()
    await store.register('u', 'u@x', 'pw')

    expect(mockedRegister).toHaveBeenCalledWith('u', 'u@x', 'pw')
    expect(store.isAuthenticated).toBe(true)
    expect(store.isEditor).toBe(false)
  })

  it('logout clears state and storage', () => {
    window.localStorage.setItem('token', 't')
    window.localStorage.setItem('username', 'x')
    window.localStorage.setItem('role', 'ADMIN')
    const store = useAuthStore()
    store.logout()

    expect(store.token).toBeNull()
    expect(store.role).toBeNull()
    expect(window.localStorage.getItem('token')).toBeNull()
    expect(window.localStorage.getItem('role')).toBeNull()
  })
})
