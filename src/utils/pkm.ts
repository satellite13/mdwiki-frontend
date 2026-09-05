export function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function localIsoDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isCaptureShortcut(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== 'n' || !event.shiftKey || (!event.metaKey && !event.ctrlKey)) return false
  const target = event.target
  if (!(target instanceof Element)) return true
  const htmlTarget = target as HTMLElement
  if (htmlTarget.isContentEditable || htmlTarget.contentEditable === 'true') return false
  return !target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
}
