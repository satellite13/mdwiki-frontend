import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppSelect from './AppSelect.vue'

const options = [
  { value: '', label: 'Choose…' },
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Charlie' },
]

function mountSelect(props: Record<string, unknown> = {}) {
  return mount(AppSelect, {
    props: {
      options,
      modelValue: null,
      ...props,
    },
    attachTo: document.body,
  })
}

describe('AppSelect', () => {
  it('opens list and selects a single value', async () => {
    const wrapper = mountSelect({ placeholder: 'Pick' })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-a"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['a'])
    wrapper.unmount()
  })

  it('filters options when searchable', async () => {
    const wrapper = mountSelect({ searchable: true, modelValue: '' })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-search"]').setValue('bet')
    expect(wrapper.find('[data-testid="app-select-option-a"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-select-option-b"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('toggles values in multiple mode without closing', async () => {
    const wrapper = mountSelect({ multiple: true, modelValue: [] })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-a"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a']])
    expect(wrapper.find('[data-testid="app-select-list"]').exists()).toBe(true)
    await wrapper.get('[data-testid="app-select-option-b"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']])
    wrapper.unmount()
  })

  it('supports keyboard open and choose', async () => {
    const wrapper = mountSelect({ modelValue: null })
    const trigger = wrapper.get('[data-testid="app-select-trigger"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('[data-testid="app-select-list"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('does not open when disabled', async () => {
    const wrapper = mountSelect({ disabled: true })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="app-select-list"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('exposes aria-activedescendant for the active option', async () => {
    const wrapper = mountSelect({ modelValue: null })
    const trigger = wrapper.get('[data-testid="app-select-trigger"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    const list = wrapper.get('[data-testid="app-select-list"]')
    const activeId = list.attributes('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(trigger.attributes('aria-activedescendant')).toBe(activeId)
    expect(document.getElementById(activeId!)).not.toBeNull()
    wrapper.unmount()
  })
})
