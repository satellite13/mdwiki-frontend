/**
 * Логи цепочки drag&drop дерева документов.
 * В dev включено по умолчанию. В production: в консоли выполните
 *   localStorage.setItem('mdwikiDndDebug', '1')
 * и перезагрузите страницу. Убрать: removeItem('mdwikiDndDebug').
 */
export function dndDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return localStorage.getItem('mdwikiDndDebug') === '1'
  } catch {
    return false
  }
}

export function dndLog(phase: string, detail: Record<string, unknown> = {}) {
  if (!dndDebugEnabled()) return
  console.log('[mdwiki-dnd]', phase, detail)
}

const dragOverLast = new Map<string, number>()

/** Не чаще раз в intervalMs на ключ (иначе dragover засыплет консоль). */
export function dndLogDragOverThrottled(key: string, detail: Record<string, unknown>, intervalMs = 300) {
  if (!dndDebugEnabled()) return
  const now = Date.now()
  const prev = dragOverLast.get(key) ?? 0
  if (now - prev < intervalMs) return
  dragOverLast.set(key, now)
  console.log('[mdwiki-dnd] dragover', key, detail)
}
