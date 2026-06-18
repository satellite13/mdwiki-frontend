import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { useWikilinkAutocomplete } from '@/composables/useWikilinkAutocomplete'
import type { PageListItem } from '@/types'

const pages: PageListItem[] = [
  {
    id: '1',
    slug: 'alpha',
    title: 'Alpha Page',
    tags: [],
    folderId: null,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    slug: 'beta',
    title: 'Beta Page',
    tags: [],
    folderId: null,
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

vi.mock('@/services/pageIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/pageIndex')>()
  return {
    ...actual,
    getPages: vi.fn(async () => pages),
    getCachedPages: vi.fn(() => pages),
  }
})

function createTextarea(value: string, cursor: number): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  el.value = value
  el.setSelectionRange(cursor, cursor)
  document.body.appendChild(el)
  return el
}

describe('useWikilinkAutocomplete', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('opens suggestions after typing [[', async () => {
    const el = createTextarea('See [[al', 8)
    const source = ref('See [[al')
    const api = useWikilinkAutocomplete({
      getEditor: () => el,
      getSource: () => source.value,
      getContainerRect: () => null,
    })

    await api.refresh()
    await nextTick()

    expect(api.open.value).toBe(true)
    expect(api.items.value.map((p) => p.slug)).toEqual(['alpha'])
    el.remove()
  })

  it('opens suggestions for empty query right after [[', async () => {
    const el = createTextarea('See [[', 6)
    const source = ref('See [[')
    const api = useWikilinkAutocomplete({
      getEditor: () => el,
      getSource: () => source.value,
      getContainerRect: () => null,
    })

    await api.refresh()
    await nextTick()

    expect(api.open.value).toBe(true)
    expect(api.items.value.length).toBe(2)
    el.remove()
  })

  it('closes when wikilink is completed', async () => {
    const el = createTextarea('See [[alpha]]', 13)
    const source = ref('See [[alpha]]')
    const api = useWikilinkAutocomplete({
      getEditor: () => el,
      getSource: () => source.value,
      getContainerRect: () => null,
    })

    await api.refresh()
    await nextTick()

    expect(api.open.value).toBe(false)
    el.remove()
  })
})
