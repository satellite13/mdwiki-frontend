import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppDialogHost from './AppDialogHost.vue'
import { useDialogStore } from '@/stores/dialog'

let wrapper: VueWrapper | null = null

function buttons(): HTMLButtonElement[] {
  return Array.from(document.body.querySelectorAll<HTMLButtonElement>('.dialog-panel button'))
}

function clickByText(label: string) {
  const btn = buttons().find((b) => {
    const explicit = b.querySelector('.dialog-choice-label')?.textContent?.trim()
    if (explicit) return explicit === label
    return b.textContent?.trim() === label
  })
  if (!btn) throw new Error(`button "${label}" not found`)
  btn.click()
}

beforeEach(() => {
  setActivePinia(createPinia())
  wrapper = mount(AppDialogHost, { attachTo: document.body })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('AppDialogHost', () => {
  it('renders nothing when there is no active dialog', () => {
    expect(document.body.querySelector('.dialog-root')).toBeNull()
  })

  it('renders alert and resolves on OK', async () => {
    const store = useDialogStore()
    const promise = store.alert('Alert message')
    await flushPromises()

    expect(document.body.querySelector('.dialog-message')?.textContent).toBe('Alert message')
    expect(buttons().length).toBe(1)

    buttons()[0].click()
    await expect(promise).resolves.toBeUndefined()
    await flushPromises()
    expect(document.body.querySelector('.dialog-root')).toBeNull()
  })

  it('confirm resolves true on primary button and false on cancel', async () => {
    const store = useDialogStore()

    const ok = store.confirm('Sure?')
    await flushPromises()
    const label = buttons()[1].textContent?.trim()
    expect(label).toBeTruthy()
    clickByText(label!)
    await expect(ok).resolves.toBe(true)
    await flushPromises()

    const cancelPromise = store.confirm('Sure?')
    await flushPromises()
    const cancelLabel = buttons()[0].textContent?.trim()
    expect(cancelLabel).toBeTruthy()
    clickByText(cancelLabel!)
    await expect(cancelPromise).resolves.toBe(false)
  })

  it('prompt returns current input on submit and null on cancel', async () => {
    const store = useDialogStore()

    const promise = store.prompt('Name?', 'Alice')
    await flushPromises()
    const input = document.body.querySelector<HTMLInputElement>('.dialog-input')!
    expect(input.value).toBe('Alice')
    input.value = 'Bob'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    const submit = buttons()[1]
    submit.click()
    await expect(promise).resolves.toBe('Bob')
    await flushPromises()

    const cancelPromise = store.prompt('Nickname?')
    await flushPromises()
    const cancel = buttons()[0]
    cancel.click()
    await expect(cancelPromise).resolves.toBeNull()
  })

  it('Escape cancels confirm dialog', async () => {
    const store = useDialogStore()
    const promise = store.confirm('Sure?')
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(promise).resolves.toBe(false)
  })

  it('choice returns selected value and null on escape', async () => {
    const store = useDialogStore()

    const selected = store.choice('Delete mode?', [
      { value: 'soft', label: 'Soft' },
      { value: 'hard', label: 'Hard', danger: true }
    ])
    await flushPromises()
    clickByText('Hard')
    await expect(selected).resolves.toBe('hard')
    await flushPromises()

    const cancelled = store.choice('Delete mode?', [{ value: 'soft', label: 'Soft' }])
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(cancelled).resolves.toBeNull()
  })
})
