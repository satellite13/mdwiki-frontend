import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminPropertiesPage from './AdminPropertiesPage.vue'
import { i18n, setLocale } from '@/i18n'
import { getDocumentByTestId } from '@/test/dom'

const listPropertyDefinitions = vi.fn()
const createPropertyDefinition = vi.fn()
const updatePropertyDefinition = vi.fn()
vi.mock('@/api/properties', () => ({
  listPropertyDefinitions: (...args: unknown[]) => listPropertyDefinitions(...args),
  createPropertyDefinition: (...args: unknown[]) => createPropertyDefinition(...args),
  updatePropertyDefinition: (...args: unknown[]) => updatePropertyDefinition(...args),
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

    expect(wrapper.get('h1').text()).toContain('Свойства')
    expect(wrapper.get('h1 .help-tip-trigger').attributes('aria-label')).toBe('Свойства')
    expect(wrapper.get('[aria-label="Изменить Priority"]').attributes('aria-label')).toBe('Изменить Priority')
    expect(wrapper.get('[aria-label="Удалить Priority"]').attributes('aria-label')).toBe('Удалить Priority')
    setLocale('en')
  })

  it('shows options field for select types and sends parsed options', async () => {
    setLocale('en')
    const wrapper = mount(AdminPropertiesPage, { global: { plugins: [i18n] } })
    await flushPromises()

    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await getDocumentByTestId('app-select-option-MULTI_SELECT').trigger('click')
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

  it('loads an existing definition into the form and saves via patch', async () => {
    listPropertyDefinitions.mockResolvedValue({
      data: [{
        id: 'def-1',
        key: 'status',
        displayName: 'Status',
        type: 'SELECT',
        config: { options: ['todo', 'done'] },
        required: false,
        version: 3,
      }]
    })
    updatePropertyDefinition.mockResolvedValue({ data: {} })
    setLocale('en')
    const wrapper = mount(AdminPropertiesPage, { global: { plugins: [i18n] } })
    await flushPromises()

    await wrapper.get('[aria-label="Edit Status"]').trigger('click')
    expect(wrapper.get('input[placeholder="Status"]').element).toHaveProperty('value', 'Status')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toContain('todo')
    expect(wrapper.get('input[placeholder="status"]').attributes('disabled')).toBeDefined()

    await wrapper.get('input[placeholder="Status"]').setValue('Workflow status')
    await wrapper.get('textarea').setValue('todo, doing, done')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updatePropertyDefinition).toHaveBeenCalledWith('def-1', {
      key: 'status',
      displayName: 'Workflow status',
      type: 'SELECT',
      config: { options: ['todo', 'doing', 'done'] },
      required: false,
      expectedVersion: 3,
    })
    expect(createPropertyDefinition).not.toHaveBeenCalled()
  })
})
