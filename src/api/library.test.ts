import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, put, delete: del } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('./client', () => ({ default: { get, put, delete: del } }))

import {
  addFavoriteSearch,
  addFavoriteView,
  listFavoriteSearches,
  listFavoriteViews,
  removeFavoriteSearch,
  removeFavoriteView,
} from './library'

describe('favorite searches/views API', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    del.mockReset()
  })

  it('lists and toggles favorite searches', async () => {
    get.mockResolvedValue({ data: [{ id: 's1', favorited: true }] })
    put.mockResolvedValue({ data: undefined })
    del.mockResolvedValue({ data: undefined })

    await listFavoriteSearches()
    expect(get).toHaveBeenCalledWith('/me/favorite-searches', { signal: undefined })

    await addFavoriteSearch('s1')
    expect(put).toHaveBeenCalledWith('/me/favorite-searches/s1')

    await removeFavoriteSearch('s1')
    expect(del).toHaveBeenCalledWith('/me/favorite-searches/s1')
  })

  it('lists and toggles favorite views', async () => {
    get.mockResolvedValue({ data: [{ id: 'v1', favorited: true }] })
    put.mockResolvedValue({ data: undefined })
    del.mockResolvedValue({ data: undefined })

    await listFavoriteViews()
    expect(get).toHaveBeenCalledWith('/me/favorite-views', { signal: undefined })

    await addFavoriteView('v1')
    expect(put).toHaveBeenCalledWith('/me/favorite-views/v1')

    await removeFavoriteView('v1')
    expect(del).toHaveBeenCalledWith('/me/favorite-views/v1')
  })
})
