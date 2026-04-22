import client from './client'
import type { EmbeddingSettings } from '@/types'

export interface UpdateEmbeddingSettingsPayload {
  provider: 'openai' | 'ollama' | 'lmstudio'
  model: string
}

export function getEmbeddingSettings() {
  return client.get<EmbeddingSettings>('/admin/embedding-settings')
}

export function updateEmbeddingSettings(payload: UpdateEmbeddingSettingsPayload) {
  return client.put<EmbeddingSettings>('/admin/embedding-settings', payload)
}
