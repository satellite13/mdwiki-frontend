import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminPropertiesPage from './AdminPropertiesPage.vue'
import { i18n, setLocale } from '@/i18n'

const listPropertyDefinitions = vi.fn()
const createPropertyDefinition = vi.fn()
vi.mock('@/api/properties', () => ({
  listPropertyDefinitions: (...args: unknown[]) => listPropertyDefinitions(...args),
  createPropertyDefinition: (...args: unknown[]) => createPropertyDefinition(...args),
  deletePropertyDefinition: vi.fn()
}))

describe('AdminPropertiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPropertyDefinitions.mockResolvedValue({
      data: [{ id: 'priority', key: 'priority', displayName: 'Priority', type: 'TEXT', config: {} }]
    })
    createPropertyDefinition.mockResolvedValue({ data: {} })
  })

  it('localizes labels and gives every destructive action an accessible name', async () => {
    setLocale('ru')
    const wrapper = mount(AdminPropertiesPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Свойства')
    expect(wrapper.get('.data-table button[aria-label]').attributes('aria-label')).toBe('Удалить Priority')
    setLocale('en')
  })

  it('shows options field for select types and sends parsed options', async () => {
    setLocale('en')
    const wrapper = mount(AdminPropertiesPage, { global: { plugins: [i18n] } })
    await flushPromises()

    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-MULTI_SELECT"]').trigger('click')
    expect(wrapper.text()).toContain('Options')
    await wrapper.get('input[placeholder="status"]').setValue('stack')
    await wrapper.get('input[placeholder="Status"]').setValue('Stack')
    await wrapper.get('textarea').setValue('digital-twin, repos\ngitlab')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createPropertyDefinition).toHaveBeenCalledWith({
      key: 'stack',
      displayName: 'Stack',
      type: 'MULTI_SELECT',
      config: { options: ['digital-twin', 'repos', 'gitlab'] },
      required: false,
    })
  })
})
