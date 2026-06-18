import client from './client'
import type { AuthResponse } from '@/types'

export function login(username: string, password: string) {
  return client.post<AuthResponse>('/auth/login', { username, password })
}

export function register(username: string, email: string, password: string) {
  return client.post<AuthResponse>('/auth/register', { username, email, password })
}

export function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return client.post('/auth/change-password', payload)
}
