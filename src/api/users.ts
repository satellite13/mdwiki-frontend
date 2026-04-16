import client from './client'
import type { User } from '@/types'
export function listUsers() { return client.get<User[]>('/users') }
export function updateUserRole(userId: string, role: string) { return client.put<User>(`/users/${userId}/role`, { role }) }
