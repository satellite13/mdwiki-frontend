import { EventSourcePolyfill } from 'event-source-polyfill'

/**
 * SSE-подписка на события дерева. Токен уходит в заголовке Authorization
 * (нативный EventSource заголовки не умеет — поэтому polyfill), а не в query:
 * иначе JWT попадает в access-логи и историю браузера.
 */
export function createTreeEventsSource(token: string): EventSource {
  return new EventSourcePolyfill('/api/events/tree', {
    headers: { Authorization: `Bearer ${token}` }
  })
}
