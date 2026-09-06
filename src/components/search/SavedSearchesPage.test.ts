import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SavedSearchesPage from './SavedSearchesPage.vue'
import { i18n } from '@/i18n'

const listSavedSearches = vi.fn()
const createSavedSearch = vi.fn()
const updateSavedSearch = vi.fn()
const deleteSavedSearch = vi.fn()
const addFavoriteSearch = vi.fn()
const removeFavoriteSearch = vi.fn()
const confirm = vi.fn()
const alert = vi.fn()

vi.mock('@/api/savedSearches', () => ({
  listSavedSearches: (...args: unknown[]) => listSavedSearches(...args),
  createSavedSearch: (...args: unknown[]) => createSavedSearch(...args),
  updateSavedSearch: (...args: unknown[]) => updateSavedSearch(...args),
  deleteSavedSearch: (...args: unknown[]) => deleteSavedSearch(...args),
}))
vi.mock('@/api/library', () => ({
  addFavoriteSearch: (...args: unknown[]) => addFavoriteSearch(...args),
  removeFavoriteSearch: (...args: unknown[]) => removeFavoriteSearch(...args),
}))
vi.mock('@/stores/dialog', () => ({ useDialogStore: () => ({ confirm, alert }) }))

const item = {
  id: 's1', name: 'Mine', queryText: 'query', mode: 'HYBRID', tags: ['one'],
  minScore: 0.5, sort: 'RELEVANCE', favorited: false, version: 3, createdAt: '', updatedAt: '',
}

function mountPage() {
  return mount(SavedSearchesPage, {
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } }
  })
}

describe('SavedSearchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSavedSearches.mockResolvedValue({ data: [item] })
    createSavedSearch.mockResolvedValue({ data: item })
    updateSavedSearch.mockResolvedValue({ data: item })
    deleteSavedSearch.mockResolvedValue({})
    addFavoriteSearch.mockResolvedValue({})
    removeFavoriteSearch.mockResolvedValue({})
    confirm.mockResolvedValue(true)
    alert.mockResolvedValue(undefined)
  })

  it('optimistically toggles favorite and rolls back on failure', async () => {
    let reject!: (reason: unknown) => void
    addFavoriteSearch.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
    const wrapper = mountPage(); await flushPromises()
    const btn = wrapper.get('.favorite-btn')
    expect(btn.attributes('aria-pressed')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(addFavoriteSearch).toHaveBeenCalledWith('s1')
    reject(new Error('failed'))
    await flushPromises()
    expect(btn.attributes('aria-pressed')).toBe('false')
    expect(alert).toHaveBeenCalled()
  })

  it('creates a complete private definition', async () => {
    const wrapper = mountPage(); await flushPromises()
    await wrapper.get('header button').trigger('click')
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('New')
    await inputs[1]!.setValue('λ query')
    await inputs[2]!.setValue('one, два')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(createSavedSearch).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New', queryText: 'λ query', tags: ['one', 'два']
    }))
  })

  it('updates with expectedVersion and deletes only after confirmation', async () => {
    const wrapper = mountPage(); await flushPromises()
    await wrapper.get('[aria-label="Edit saved search Mine"]').trigger('click')
    await wrapper.findAll('input')[0]!.setValue('Renamed')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(updateSavedSearch).toHaveBeenCalledWith('s1', expect.objectContaining({
      name: 'Renamed', expectedVersion: 3
    }))

    await wrapper.get('[aria-label="Delete saved search Mine"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(deleteSavedSearch).toHaveBeenCalledWith('s1')
  })
})
