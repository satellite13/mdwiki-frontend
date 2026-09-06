import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCaptureSubmit } from './useCaptureSubmit'

const fetchTree = vi.fn()

vi.mock('@/stores/folders', () => ({
  useFolderStore: () => ({ fetchTree }),
}))

describe('useCaptureSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks duplicate submissions while a capture is pending', async () => {
    let resolveCapture!: (value: { id: string }) => void
    const execute = vi.fn(() => new Promise<{ id: string }>((resolve) => {
      resolveCapture = resolve
    }))
    const { busy, run } = useCaptureSubmit({
      execute,
      failureMessage: 'Capture failed',
    })

    const first = run()
    const second = run()

    expect(busy.value).toBe(true)
    expect(execute).toHaveBeenCalledTimes(1)

    resolveCapture({ id: 'capture' })
    await Promise.all([first, second])
    expect(busy.value).toBe(false)
  })

  it('resets fields, refreshes the tree, and emits the captured value after success', async () => {
    const reset = vi.fn()
    const onCaptured = vi.fn()
    const captured = { id: 'capture' }
    const { run } = useCaptureSubmit({
      execute: async () => captured,
      failureMessage: 'Capture failed',
      reset,
      onCaptured,
    })

    await run()

    expect(reset).toHaveBeenCalledOnce()
    expect(fetchTree).toHaveBeenCalledWith(true)
    expect(onCaptured).toHaveBeenCalledWith(captured)
  })

  it('keeps fields unchanged and exposes the error after failure', async () => {
    const reset = vi.fn()
    const onCaptured = vi.fn()
    const { error, run } = useCaptureSubmit({
      execute: async () => {
        throw new Error('Network unavailable')
      },
      failureMessage: 'Capture failed',
      reset,
      onCaptured,
    })

    await run()

    expect(reset).not.toHaveBeenCalled()
    expect(fetchTree).not.toHaveBeenCalled()
    expect(onCaptured).not.toHaveBeenCalled()
    expect(error.value).toBe('Network unavailable')
  })

  it('resolves the fallback message when each submission fails', async () => {
    let failureMessage = 'First locale'
    const { error, run } = useCaptureSubmit({
      execute: async () => {
        throw null
      },
      failureMessage: () => failureMessage,
    })

    await run()
    expect(error.value).toBe('First locale')

    failureMessage = 'Second locale'
    await run()
    expect(error.value).toBe('Second locale')
  })
})
