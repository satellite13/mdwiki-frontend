import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminPropertiesPage from './AdminPropertiesPage.vue'
import { i18n, setLocale } from '@/i18n'

const listPropertyDefinitions = vi.fn()
vi.mock('@/api/properties', () => ({
  listPropertyDefinitions: (...args: unknown[]) => listPropertyDefinitions(...args),
  createPropertyDefinition: vi.fn(),
  deletePropertyDefinition: vi.fn()
}))

describe('AdminPropertiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPropertyDefinitions.mockResolvedValue({ data: [{ id: 'priority', key: 'priority', displayName: 'Priority', type: 'TEXT' }] })
  })

  it('localizes labels and gives every destructive action an accessible name', async () => {
    setLocale('ru')
    const wrapper = mount(AdminPropertiesPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Свойства')
    expect(wrapper.get('button[aria-label]').attributes('aria-label')).toBe('Удалить Priority')
    setLocale('en')
  })
})
