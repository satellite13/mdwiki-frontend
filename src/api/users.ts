import client from './client'
import type { User, UserRole } from '@/types'

export function listUsers() {
  return client.get<User[]>('/users')
}

export function updateUserRole(userId: string, role: UserRole) {
  return client.put<User>(`/users/${userId}/role`, { role })
}

export function deleteUser(userId: string) {
  return client.delete<void>(`/users/${userId}`)
}
