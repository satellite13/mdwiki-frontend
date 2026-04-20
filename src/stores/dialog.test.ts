import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDialogStore } from './dialog'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useDialogStore', () => {
  it('opens alert and resolves on submit', async () => {
    const store = useDialogStore()
    const promise = store.alert('hello')
    expect(store.active?.kind).toBe('alert')
    store.submitAlert()
    await expect(promise).resolves.toBeUndefined()
    expect(store.active).toBeNull()
  })

  it('queues multiple dialogs and opens them in order', async () => {
    const store = useDialogStore()
    const first = store.confirm('one')
    const second = store.alert('two')
    expect(store.active?.kind).toBe('confirm')
    store.submitConfirm(true)
    await expect(first).resolves.toBe(true)
    expect(store.active?.kind).toBe('alert')
    store.submitAlert()
    await expect(second).resolves.toBeUndefined()
  })

  it('confirm forwards boolean result', async () => {
    const store = useDialogStore()
    const promise = store.confirm('sure?', { danger: true })
    expect(store.active?.kind).toBe('confirm')
    store.submitConfirm(false)
    await expect(promise).resolves.toBe(false)
  })

  it('prompt forwards value and supports cancellation', async () => {
    const store = useDialogStore()
    const p1 = store.prompt('name', 'default')
    store.submitPrompt('Alice')
    await expect(p1).resolves.toBe('Alice')

    const p2 = store.prompt('nickname')
    store.submitPrompt(null)
    await expect(p2).resolves.toBeNull()
  })

  it('choice resolves selected option and supports cancellation', async () => {
    const store = useDialogStore()
    const p1 = store.choice('Delete mode?', [
      { value: 'soft', label: 'Soft' },
      { value: 'hard', label: 'Hard', danger: true }
    ])
    store.submitChoice('hard')
    await expect(p1).resolves.toBe('hard')

    const p2 = store.choice('Delete mode?', [{ value: 'soft', label: 'Soft' }])
    store.submitChoice(null)
    await expect(p2).resolves.toBeNull()
  })

  it('submit functions are no-op when mismatched dialog kind is active', async () => {
    const store = useDialogStore()
    const promise = store.alert('hi')
    store.submitConfirm(true)
    store.submitPrompt('x')
    store.submitChoice('hard')
    expect(store.active?.kind).toBe('alert')
    store.submitAlert()
    await expect(promise).resolves.toBeUndefined()
  })
})
