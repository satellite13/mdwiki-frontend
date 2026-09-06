import { DOMWrapper, mount } from '@vue/test-utils'
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

function getByTestId(testId: string) {
  const el = document.querySelector(`[data-testid="${testId}"]`)
  if (!el) throw new Error(`Unable to find [data-testid="${testId}"]`)
  return new DOMWrapper(el)
}

function findByTestId(testId: string) {
  const el = document.querySelector(`[data-testid="${testId}"]`)
  return el ? new DOMWrapper(el) : null
}

describe('AppSelect', () => {
  it('opens list and selects a single value', async () => {
    const wrapper = mountSelect({ placeholder: 'Pick' })
    await getByTestId('app-select-trigger').trigger('click')
    await getByTestId('app-select-option-a').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['a'])
    wrapper.unmount()
  })

  it('filters options when searchable', async () => {
    const wrapper = mountSelect({ searchable: true, modelValue: '' })
    await getByTestId('app-select-trigger').trigger('click')
    await getByTestId('app-select-search').setValue('bet')
    expect(findByTestId('app-select-option-a')).toBeNull()
    expect(findByTestId('app-select-option-b')).not.toBeNull()
    wrapper.unmount()
  })

  it('toggles values in multiple mode without closing', async () => {
    const wrapper = mountSelect({ multiple: true, modelValue: [] })
    await getByTestId('app-select-trigger').trigger('click')
    await getByTestId('app-select-option-a').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a']])
    expect(findByTestId('app-select-list')).not.toBeNull()
    await getByTestId('app-select-option-b').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']])
    wrapper.unmount()
  })

  it('supports keyboard open and choose', async () => {
    const wrapper = mountSelect({ modelValue: null })
    await getByTestId('app-select-trigger').trigger('keydown', { key: 'ArrowDown' })
    await getByTestId('app-select-list').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('does not open when disabled', async () => {
    const wrapper = mountSelect({ disabled: true })
    await getByTestId('app-select-trigger').trigger('click')
    expect(findByTestId('app-select-list')).toBeNull()
    wrapper.unmount()
  })

  it('uses non-focusable tabindex when disabled', () => {
    const wrapper = mountSelect({ disabled: true })
    expect(getByTestId('app-select-trigger').attributes('tabindex')).toBe('-1')
    wrapper.unmount()
  })

  it('teleports list to body and closes on outside click', async () => {
    const wrapper = mountSelect({ modelValue: null })
    await getByTestId('app-select-trigger').trigger('click')
    const list = document.querySelector('[data-testid="app-select-list"]')
    expect(list).not.toBeNull()
    expect(list?.parentElement).toBe(document.body)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(findByTestId('app-select-list')).toBeNull()
    wrapper.unmount()
  })

  it('exposes aria-activedescendant for the active option', async () => {
    const wrapper = mountSelect({ modelValue: null })
    const trigger = getByTestId('app-select-trigger')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    const list = getByTestId('app-select-list')
    const activeId = list.attributes('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(trigger.attributes('aria-activedescendant')).toBe(activeId)
    expect(document.getElementById(activeId!)).not.toBeNull()
    wrapper.unmount()
  })
})
