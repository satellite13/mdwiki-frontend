import { flushPromises, mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import LibraryPage from './LibraryPage.vue'

const route = reactive({ name: 'recent' })
const getRecent = vi.fn()
const getFavorites = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/api/library', () => ({
  getRecent: (...args: unknown[]) => getRecent(...args),
  getFavorites: (...args: unknown[]) => getFavorites(...args)
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
  })

  it('does not let delayed recent overwrite favorites', async () => {
    const oldRequest = deferred<{ data: Array<{ page: { id: string; slug: string; title: string }; lastOpenedAt: string; openCount: number }> }>()
    getRecent.mockReturnValue(oldRequest.promise)
    getFavorites.mockResolvedValue({ data: [{ page: { id: 'f', slug: 'favorite', title: 'Favorite' }, favoritedAt: '2026-09-02T00:00:00Z' }] })
    const wrapper = mount(LibraryPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await nextTick()
    route.name = 'favorites'
    await flushPromises()
    oldRequest.resolve({ data: [{ page: { id: 'r', slug: 'recent', title: 'Recent' }, lastOpenedAt: '2026-09-01T00:00:00Z', openCount: 1 }] })
    await flushPromises()

    expect(wrapper.text()).toContain('Favorite')
    expect(wrapper.text()).not.toContain('Recent')
  })
})
