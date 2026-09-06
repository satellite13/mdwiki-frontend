import { EventSourcePolyfill } from 'event-source-polyfill'

/** Must stay above API TreeEventsService heartbeat (15s). */
const SSE_HEARTBEAT_TIMEOUT_MS = 60_000

/**
 * SSE-подписка на события дерева. Токен уходит в заголовке Authorization
 * (нативный EventSource заголовки не умеет — поэтому polyfill), а не в query:
 * иначе JWT попадает в access-логи и историю браузера.
 */
export function createTreeEventsSource(token: string): EventSource {
  return new EventSourcePolyfill('/api/events/tree', {
    headers: { Authorization: `Bearer ${token}` },
    heartbeatTimeout: SSE_HEARTBEAT_TIMEOUT_MS,
  })
}
