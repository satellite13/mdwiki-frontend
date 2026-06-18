/** Индексы начала всех вхождений [query] в [text] (без учёта регистра). */
export function findMatchIndices(text: string, query: string): number[] {
  const needle = query.trim()
  if (!needle) return []
  const lower = text.toLowerCase()
  const q = needle.toLowerCase()
  const indices: number[] = []
  let pos = 0
  while (pos < lower.length) {
    const idx = lower.indexOf(q, pos)
    if (idx === -1) break
    indices.push(idx)
    pos = idx + q.length
  }
  return indices
}

/** Индекс совпадения для «следующего» от [cursor] с циклом. */
export function nextMatchIndex(matches: number[], cursor: number, current: number): number {
  if (matches.length === 0) return -1
  if (current >= 0 && current < matches.length) {
    const at = matches[current]
    if (at === cursor) {
      return (current + 1) % matches.length
    }
  }
  const found = matches.findIndex((start) => start >= cursor)
  return found === -1 ? 0 : found
}

/** Индекс совпадения для «предыдущего» от [cursor] с циклом. */
export function prevMatchIndex(matches: number[], cursor: number, current: number): number {
  if (matches.length === 0) return -1
  if (current >= 0 && current < matches.length) {
    const at = matches[current]
    if (at === cursor) {
      return (current - 1 + matches.length) % matches.length
    }
  }
  let found = -1
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i] < cursor) {
      found = i
      break
    }
  }
  return found === -1 ? matches.length - 1 : found
}

export function scrollTextareaSelectionIntoView(el: HTMLTextAreaElement): void {
  const { selectionStart } = el
  const style = window.getComputedStyle(el)
  const lineHeight = Number.parseFloat(style.lineHeight) || 20
  const paddingTop = Number.parseFloat(style.paddingTop) || 0
  const linesBefore = el.value.slice(0, selectionStart).split('\n').length
  const target = Math.max(0, (linesBefore - 4) * lineHeight + paddingTop)
  el.scrollTop = target
}
