import { ref } from 'vue'
import { useFolderStore } from '@/stores/folders'
import { getApiErrorMessage } from '@/utils/apiError'

interface CaptureSubmitOptions<T> {
  execute: () => Promise<T>
  failureMessage: string | (() => string)
  reset?: () => void
  onCaptured?: (value: T) => void
}

export function useCaptureSubmit<T>(options: CaptureSubmitOptions<T>) {
  const folders = useFolderStore()
  const busy = ref(false)
  const error = ref('')

  async function run(): Promise<void> {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      const captured = await options.execute()
      options.reset?.()
      await folders.fetchTree(true)
      options.onCaptured?.(captured)
    } catch (cause) {
      const fallback = typeof options.failureMessage === 'function'
        ? options.failureMessage()
        : options.failureMessage
      error.value = getApiErrorMessage(cause, fallback)
    } finally {
      busy.value = false
    }
  }

  return { busy, error, run }
}
