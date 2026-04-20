/**
 * Тонкая обёртка над `localStorage` с безопасным парсингом и поглощением
 * исключений (Safari private mode, квота, заблокированные кук). Все
 * модули приложения, читающие/пишущие в `localStorage`, должны ходить
 * через этот модуль.
 */

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function readString(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeString(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value)
  } catch {
    /* storage unavailable — ignore */
  }
}

export function removePref(key: string): void {
  try {
    getStorage()?.removeItem(key)
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * Безопасно читает JSON: при отсутствии ключа или ошибке парсинга возвращает `fallback`.
 * Значение проходит через опциональный `guard`, если нужно ужесточить контракт.
 */
export function readJson<T>(key: string, fallback: T, guard?: (value: unknown) => value is T): T {
  const raw = readString(key)
  if (raw == null) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (guard && !guard(parsed)) return fallback
    return parsed as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeString(key, JSON.stringify(value))
  } catch {
    /* circular or non-serializable — ignore */
  }
}
