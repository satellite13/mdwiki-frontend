import client from './client'
import type { FavoritePage, RecentPage, SavedSearch, SavedView } from '@/types'

export const touchRecent = (pageId: string) => client.put<void>(`/me/recent-pages/${pageId}`)
export const getRecent = (limit = 20, signal?: AbortSignal) =>
  client.get<RecentPage[]>('/me/recent-pages', { params: { limit }, signal })
export const getFavorites = (signal?: AbortSignal) =>
  client.get<FavoritePage[]>('/me/favorites', { signal })
export const addFavorite = (pageId: string) => client.put<void>(`/me/favorites/${pageId}`)
export const removeFavorite = (pageId: string) => client.delete<void>(`/me/favorites/${pageId}`)

export const listFavoriteSearches = (signal?: AbortSignal) =>
  client.get<SavedSearch[]>('/me/favorite-searches', { signal })
export const addFavoriteSearch = (id: string) =>
  client.put<void>(`/me/favorite-searches/${id}`)
export const removeFavoriteSearch = (id: string) =>
  client.delete<void>(`/me/favorite-searches/${id}`)

export const listFavoriteViews = (signal?: AbortSignal) =>
  client.get<SavedView[]>('/me/favorite-views', { signal })
export const addFavoriteView = (id: string) =>
  client.put<void>(`/me/favorite-views/${id}`)
export const removeFavoriteView = (id: string) =>
  client.delete<void>(`/me/favorite-views/${id}`)
