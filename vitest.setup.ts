/**
 * Vitest setup: возвращает jsdom localStorage в глобальный контекст.
 *
 * Node 22+ объявляет экспериментальный глобальный `localStorage` (недоступный
 * без `--localstorage-file`). Из-за этого vitest'овский populateGlobal
 * отфильтровывает настоящий jsdom localStorage (`k in global` → true,
 * но ключа нет в списке переносимых), и в тестах `window.localStorage`
 * оказывается undefined. Здесь мы переносим localStorage из jsdom-окружения
 * обратно в globalThis.
 */
if (typeof globalThis.jsdom !== 'undefined' && globalThis.jsdom.window?.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: globalThis.jsdom.window.localStorage,
    writable: true,
    configurable: true
  })
}
