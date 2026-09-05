import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PagePropertiesPanel from './PagePropertiesPanel.vue'
import { i18n } from '@/i18n'

const getPageProperties = vi.fn()
const patchPageProperties = vi.fn()
vi.mock('@/api/properties', () => ({
  getPageProperties: (...args: unknown[]) => getPageProperties(...args),
  patchPageProperties: (...args: unknown[]) => patchPageProperties(...args)
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAdmin: false })
}))

const properties = {
  definitions: [{ id: 'priority', key: 'priority', displayName: 'Priority', type: 'TEXT', config: {}, required: false }],
  values: { priority: 'low' },
  unknown: {}
}

describe('PagePropertiesPanel', () => {
  it('ignores a late response for the previously selected page', async () => {
    let resolveA!: (value: unknown) => void
    let resolveB!: (value: unknown) => void
    getPageProperties
      .mockReturnValueOnce(new Promise(resolve => { resolveA = resolve }))
      .mockReturnValueOnce(new Promise(resolve => { resolveB = resolve }))
    const wrapper = mount(PagePropertiesPanel, {
      props: {
        page: { slug: 'a', updatedAt: '2026-01-01T00:00:00Z' } as never,
        editable: true,
        flushPendingSave: vi.fn().mockResolvedValue(true)
      },
      global: { plugins: [i18n] }
    })
    await wrapper.get('.properties-toggle').trigger('click')
    await wrapper.setProps({ page: { slug: 'b', updatedAt: '2026-01-01T00:00:00Z' } as never })
    resolveB({ data: { ...properties, values: { priority: 'B' } } })
    await flushPromises()
    resolveA({ data: { ...properties, values: { priority: 'A' } } })
    await flushPromises()

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('B')
  })

  it('starts collapsed and expands on toggle', async () => {
    getPageProperties.mockResolvedValue({ data: properties })
    const wrapper = mount(PagePropertiesPanel, {
      props: {
        page: { slug: 'page', updatedAt: '2026-01-01T00:00:00Z' } as never,
        editable: true,
        flushPendingSave: vi.fn().mockResolvedValue(true)
      },
      global: { plugins: [i18n] }
    })
    await flushPromises()
    expect(wrapper.get('.properties-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#page-properties-body').attributes('style') || '').toContain('display: none')
    await wrapper.get('.properties-toggle').trigger('click')
    await flushPromises()
    expect(wrapper.get('.properties-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#page-properties-body').attributes('style') || '').not.toContain('display: none')
    expect(wrapper.find('dl').exists()).toBe(true)
  })

  it('renders UTC datetime values and removes an invalid local datetime without throwing', async () => {
    getPageProperties.mockResolvedValue({
      data: {
        ...properties,
        definitions: [{ id: 'reminder', key: 'reminder', displayName: 'Reminder', type: 'DATETIME', config: {}, required: false }],
        values: { reminder: 'not-a-date' }
      }
    })
    patchPageProperties.mockResolvedValue({ data: { slug: 'page', updatedAt: '2026-01-01T00:00:00Z' } })
    const wrapper = mount(PagePropertiesPanel, {
      props: {
        page: { slug: 'page', updatedAt: '2026-01-01T00:00:00Z' } as never,
        editable: true,
        flushPendingSave: vi.fn().mockResolvedValue(true)
      },
      global: { plugins: [i18n] }
    })
    await wrapper.get('.properties-toggle').trigger('click')
    await flushPromises()

    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('')
    await input.setValue('')
    await input.trigger('change')

    expect(patchPageProperties).toHaveBeenCalledWith('page', '2026-01-01T00:00:00Z', [{ op: 'REMOVE', key: 'reminder' }])
  })

  it('saves SELECT values through AppSelect', async () => {
    getPageProperties
      .mockResolvedValueOnce({
        data: {
          definitions: [{
            id: 'status',
            key: 'status',
            displayName: 'Status',
            type: 'SELECT',
            config: { options: ['todo', 'done'] },
            required: false
          }],
          values: { status: 'todo' },
          unknown: {}
        }
      })
      .mockResolvedValueOnce({
        data: {
          definitions: [{
            id: 'status',
            key: 'status',
            displayName: 'Status',
            type: 'SELECT',
            config: { options: ['todo', 'done'] },
            required: false
          }],
          values: { status: 'done' },
          unknown: {}
        }
      })
    patchPageProperties.mockResolvedValue({ data: { slug: 'page', updatedAt: '2026-01-02T00:00:00Z' } })
    const wrapper = mount(PagePropertiesPanel, {
      props: {
        page: { slug: 'page', updatedAt: '2026-01-01T00:00:00Z' } as never,
        editable: true,
        flushPendingSave: vi.fn().mockResolvedValue(true)
      },
      global: { plugins: [i18n] },
      attachTo: document.body
    })
    await wrapper.get('.properties-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-done"]').trigger('click')
    await flushPromises()

    expect(patchPageProperties).toHaveBeenCalledWith('page', '2026-01-01T00:00:00Z', [
      { op: 'SET', key: 'status', value: 'done' }
    ])
    wrapper.unmount()
  })

  it('saves MULTI_SELECT values through AppSelect and keeps parent model in sync', async () => {
    getPageProperties
      .mockResolvedValueOnce({
        data: {
          definitions: [{
            id: 'tags',
            key: 'tags',
            displayName: 'Tags',
            type: 'MULTI_SELECT',
            config: { options: ['a', 'b', 'c'] },
            required: false
          }],
          values: { tags: ['a'] },
          unknown: {}
        }
      })
      .mockResolvedValueOnce({
        data: {
          definitions: [{
            id: 'tags',
            key: 'tags',
            displayName: 'Tags',
            type: 'MULTI_SELECT',
            config: { options: ['a', 'b', 'c'] },
            required: false
          }],
          values: { tags: ['a', 'b'] },
          unknown: {}
        }
      })
    patchPageProperties.mockResolvedValue({ data: { slug: 'page', updatedAt: '2026-01-02T00:00:00Z' } })
    const wrapper = mount(PagePropertiesPanel, {
      props: {
        page: { slug: 'page', updatedAt: '2026-01-01T00:00:00Z' } as never,
        editable: true,
        flushPendingSave: vi.fn().mockResolvedValue(true)
      },
      global: { plugins: [i18n] },
      attachTo: document.body
    })
    await wrapper.get('.properties-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-b"]').trigger('click')
    await flushPromises()

    expect(patchPageProperties).toHaveBeenCalledWith('page', '2026-01-01T00:00:00Z', [
      { op: 'SET', key: 'tags', value: ['a', 'b'] }
    ])
    expect(wrapper.get('[data-testid="app-select-trigger"]').text()).toContain('a')
    expect(wrapper.get('[data-testid="app-select-trigger"]').text()).toContain('b')
    wrapper.unmount()
  })
})
