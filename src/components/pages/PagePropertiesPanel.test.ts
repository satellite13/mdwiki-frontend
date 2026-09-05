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
    await wrapper.setProps({ page: { slug: 'b', updatedAt: '2026-01-01T00:00:00Z' } as never })
    resolveB({ data: { ...properties, values: { priority: 'B' } } })
    await flushPromises()
    resolveA({ data: { ...properties, values: { priority: 'A' } } })
    await flushPromises()

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('B')
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
    await flushPromises()

    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('')
    await input.setValue('')
    await input.trigger('change')

    expect(patchPageProperties).toHaveBeenCalledWith('page', '2026-01-01T00:00:00Z', [{ op: 'REMOVE', key: 'reminder' }])
  })
})
