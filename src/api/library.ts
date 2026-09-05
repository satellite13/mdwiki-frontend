import client from './client'
import type { FavoritePage, RecentPage } from '@/types'

export const touchRecent = (pageId: string) => client.put<void>(`/me/recent-pages/${pageId}`)
export const getRecent = (limit = 20, signal?: AbortSignal) =>
  client.get<RecentPage[]>('/me/recent-pages', { params: { limit }, signal })
export const getFavorites = (signal?: AbortSignal) =>
  client.get<FavoritePage[]>('/me/favorites', { signal })
export const addFavorite = (pageId: string) => client.put<void>(`/me/favorites/${pageId}`)
export const removeFavorite = (pageId: string) => client.delete<void>(`/me/favorites/${pageId}`)
