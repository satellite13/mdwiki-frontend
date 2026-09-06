import { flushPromises, mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import LibraryPage from './LibraryPage.vue'

const route = reactive({ name: 'recent' })
const getRecent = vi.fn()
const getFavorites = vi.fn()
const listFavoriteSearches = vi.fn()
const listFavoriteViews = vi.fn()
const listSavedSearches = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/api/library', () => ({
  getRecent: (...args: unknown[]) => getRecent(...args),
  getFavorites: (...args: unknown[]) => getFavorites(...args),
  listFavoriteSearches: (...args: unknown[]) => listFavoriteSearches(...args),
  listFavoriteViews: (...args: unknown[]) => listFavoriteViews(...args),
}))
vi.mock('@/api/savedSearches', () => ({
  listSavedSearches: (...args: unknown[]) => listSavedSearches(...args),
}))
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((ok) => { resolve = ok })
  return { promise, resolve }
}

describe('LibraryPage stale requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.name = 'recent'
    listFavoriteSearches.mockResolvedValue({ data: [] })
    listFavoriteViews.mockResolvedValue({ data: [] })
  })

  it('does not let delayed recent overwrite favorites', async () => {
    const oldRequest = deferred<{ data: Array<{ page: { id: string; slug: string; title: string }; lastOpenedAt: string; openCount: number }> }>()
    getRecent.mockReturnValue(oldRequest.promise)
    getFavorites.mockResolvedValue({ data: [{ page: { id: 'f', slug: 'favorite', title: 'Favorite' }, favoritedAt: '2026-09-02T00:00:00Z' }] })
    listFavoriteSearches.mockResolvedValue({
      data: [{
        id: 's1',
        name: 'My search',
        queryText: 'wiki',
        mode: 'HYBRID',
        tags: [],
        minScore: null,
        sort: 'RELEVANCE',
        favorited: true,
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      }],
    })
    listFavoriteViews.mockResolvedValue({
      data: [{
        id: 'v1',
        name: 'Starred view',
        type: 'LIST',
        filters: [],
        sort: [],
        grouping: null,
        layout: {},
        favorited: true,
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      }],
    })
    const wrapper = mount(LibraryPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await nextTick()
    route.name = 'favorites'
    await flushPromises()
    oldRequest.resolve({ data: [{ page: { id: 'r', slug: 'recent', title: 'Recent' }, lastOpenedAt: '2026-09-01T00:00:00Z', openCount: 1 }] })
    await flushPromises()

    expect(wrapper.text()).toContain('Favorite')
    expect(wrapper.text()).toContain('My search')
    expect(wrapper.text()).toContain('Starred view')
    expect(wrapper.text()).not.toContain('Recent')
    expect(listSavedSearches).not.toHaveBeenCalled()
    expect(listFavoriteSearches).toHaveBeenCalled()
    expect(listFavoriteViews).toHaveBeenCalled()
  })

  it('hides empty favorite sections and does not call listSavedSearches', async () => {
    route.name = 'favorites'
    getFavorites.mockResolvedValue({ data: [] })
    listFavoriteSearches.mockResolvedValue({ data: [] })
    listFavoriteViews.mockResolvedValue({ data: [] })
    const wrapper = mount(LibraryPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()

    expect(wrapper.text()).toContain(i18n.global.t('pkm.emptyList'))
    expect(wrapper.text()).not.toContain(i18n.global.t('savedSearches.title'))
    expect(wrapper.text()).not.toContain(i18n.global.t('views.title'))
    expect(listSavedSearches).not.toHaveBeenCalled()
  })
})
