import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/tags', () => ({
  listTags: vi.fn()
}))

import { useTagStore } from './tags'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useTagStore filter', () => {
  it('toggles a tag in the tree filter', () => {
    const store = useTagStore()
    store.toggleTagFilter('agents')
    store.toggleTagFilter('orchestration')
    expect(store.selectedTags).toEqual(['agents', 'orchestration'])
    store.toggleTagFilter('agents')
    expect(store.selectedTags).toEqual(['orchestration'])
  })

  it('expands the tags panel when toggling a filter from preview', () => {
    const store = useTagStore()
    store.tagsCollapsed = true
    store.toggleTagFilter('agents')
    expect(store.tagsCollapsed).toBe(false)
    store.tagsCollapsed = true
    store.toggleTagFilter('agents')
    expect(store.tagsCollapsed).toBe(false)
  })
})
