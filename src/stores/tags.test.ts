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
  it('adds a tag to the tree filter once', () => {
    const store = useTagStore()
    store.addTagFilter('agents')
    store.addTagFilter('agents')
    store.addTagFilter('orchestration')
    expect(store.selectedTags).toEqual(['agents', 'orchestration'])
  })

  it('expands the tags panel when adding a filter from preview', () => {
    const store = useTagStore()
    store.tagsCollapsed = true
    store.addTagFilter('agents')
    expect(store.tagsCollapsed).toBe(false)
  })
})
