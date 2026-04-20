import { onBeforeUnmount, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createTreeEventsSource } from '@/api/events'
import { readString } from '@/utils/localPreferences'

const RECONNECT_DELAY_MS = 3000
const REFRESH_DEBOUNCE_MS = 300

export interface UseTreeSseOptions {
  onTreeUpdated: () => void
}

/**
 * Инкапсулирует SSE-подключение для `tree-updated` событий.
 * Пере-подключается автоматически при onerror, дебаунсит вызовы handler.
 */
export function useTreeSse(options: UseTreeSseOptions): void {
  const auth = useAuthStore()
  let source: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let mounted = true

  function handleUpdate() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      options.onTreeUpdated()
    }, REFRESH_DEBOUNCE_MS)
  }

  function handleError() {
    disconnect()
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (mounted) connect()
    }, RECONNECT_DELAY_MS)
  }

  function connect() {
    const token = auth.token || readString('token')
    if (!token) return
    disconnect()
    source = createTreeEventsSource(token)
    source.addEventListener('tree-updated', handleUpdate)
    source.onerror = handleError
  }

  function disconnect() {
    if (!source) return
    source.removeEventListener('tree-updated', handleUpdate)
    source.onerror = null
    source.close()
    source = null
  }

  onMounted(() => {
    connect()
  })

  onBeforeUnmount(() => {
    mounted = false
    disconnect()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  })
}
