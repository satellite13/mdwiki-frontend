import client from './client'
import type { SavedView } from '@/types'

export const listViews = () => client.get<SavedView[]>('/me/views')
export const getView = (id: string) => client.get<SavedView>(`/me/views/${id}`)
export const createView = (input: unknown) => client.post<SavedView>('/me/views', input)
export const updateView = (id: string, input: unknown) => client.patch<SavedView>(`/me/views/${id}`, input)
export const deleteView = (id: string) => client.delete(`/me/views/${id}`)
export const runView = (id: string, cursor?: string, limit?: number) =>
  client.post(`/me/views/${id}/run`, undefined, { params: { cursor, limit } })
