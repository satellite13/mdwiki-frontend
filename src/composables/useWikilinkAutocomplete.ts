import { ref, type Ref } from 'vue'
import { getPages } from '@/services/pageIndex'
import { normalizePageSlug } from '@/utils/pageSlug'
import { caretCoordsInTextarea } from '@/components/editor/textareaCaret'
import type { PageListItem } from '@/types'

const MAX_SUGGESTIONS = 8

export interface WikilinkAutocompleteOptions {
  getEditor: () => HTMLTextAreaElement | null
  getSource: () => string
  getContainerRect: () => DOMRect | null
}

export interface WikilinkAutocompleteApi {
  open: Ref<boolean>
  items: Ref<PageListItem[]>
  selected: Ref<number>
  from: Ref<number>
  to: Ref<number>
  menuStyle: Ref<Record<string, string>>
  close(): void
  refresh(): Promise<void>
  moveDown(): void
  moveUp(): void
  selectIndex(index: number): PageListItem | null
  updatePosition(): void
}

export function useWikilinkAutocomplete(options: WikilinkAutocompleteOptions): WikilinkAutocompleteApi {
  const open = ref(false)
  const items = ref<PageListItem[]>([])
  const selected = ref(0)
  const from = ref(0)
  const to = ref(0)
  const menuStyle = ref<Record<string, string>>({
    left: '8px',
    top: '8px',
    width: '320px'
  })

  let requestId = 0

  function close(): void {
    open.value = false
    items.value = []
    selected.value = 0
  }

  function updatePosition(): void {
    const el = options.getEditor()
    if (!el) return
    const pos = el.selectionStart
    const caret = caretCoordsInTextarea(el, pos)
    const shell = options.getContainerRect()
    const vw = window.innerWidth
    const maxRight = shell ? shell.right - 8 : vw - 8
    const minLeft = shell ? shell.left + 8 : 8
    const width = 320
    const left = Math.min(Math.max(caret.left, minLeft), Math.max(minLeft, maxRight - width))
    const preferTop = caret.top + caret.height + 8
    const maxBottom = shell ? shell.bottom - 8 : window.innerHeight - 8
    const top = preferTop + 180 > maxBottom ? Math.max((shell?.top || 8) + 8, caret.top - 190) : preferTop
    menuStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
  }

  async function refresh(): Promise<void> {
    const el = options.getEditor()
    if (!el) return
    const cursor = el.selectionStart
    const source = options.getSource().slice(0, cursor)
    const openIdx = source.lastIndexOf('[[')
    if (openIdx === -1) return close()
    const chunk = source.slice(openIdx + 2)
    if (chunk.includes(']') || chunk.includes('\n')) return close()
    from.value = openIdx
    to.value = cursor
    const query = chunk.trim().toLowerCase()
    const reqId = ++requestId
    const pages = await getPages()
    if (reqId !== requestId) return
    const filtered = query
      ? pages.filter((item) =>
          item.title.toLowerCase().includes(query) ||
          item.slug.toLowerCase().includes(query) ||
          normalizePageSlug(item.title).includes(query)
        )
      : pages
    items.value = filtered
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }))
      .slice(0, MAX_SUGGESTIONS)
    selected.value = 0
    open.value = items.value.length > 0
    updatePosition()
  }

  function moveDown(): void {
    selected.value = Math.min(selected.value + 1, items.value.length - 1)
  }

  function moveUp(): void {
    selected.value = Math.max(selected.value - 1, 0)
  }

  function selectIndex(index: number): PageListItem | null {
    return items.value[index] ?? null
  }

  return {
    open,
    items,
    selected,
    from,
    to,
    menuStyle,
    close,
    refresh,
    moveDown,
    moveUp,
    selectIndex,
    updatePosition
  }
}
