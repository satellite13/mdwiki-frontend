import client from './client'
import type { ApiKey, ApiKeyCreated } from '@/types'
export function listApiKeys() { return client.get<ApiKey[]>('/api-keys') }
export function createApiKey(name: string, expiresAt?: string) { return client.post<ApiKeyCreated>('/api-keys', { name, expiresAt }) }
export function deleteApiKey(id: string) { return client.delete(`/api-keys/${id}`) }
