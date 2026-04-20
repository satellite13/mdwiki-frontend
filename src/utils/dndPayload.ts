export interface PageDndPayload {
  type: 'page'
  slug: string
}

export interface FolderDndPayload {
  type: 'folder'
  id: string
}

export type TreeDndPayload = PageDndPayload | FolderDndPayload

interface RawDndPayload {
  type?: string
  slug?: string
  id?: string
}

export function serializeDndPayload(payload: TreeDndPayload): string {
  return JSON.stringify(payload)
}

export function parseDndPayload(raw: string | null | undefined): TreeDndPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as RawDndPayload
    if (parsed?.type === 'page' && typeof parsed.slug === 'string' && parsed.slug) {
      return { type: 'page', slug: parsed.slug }
    }
    if (parsed?.type === 'folder' && typeof parsed.id === 'string' && parsed.id) {
      return { type: 'folder', id: parsed.id }
    }
  } catch {
    // ignore malformed JSON
  }
  return null
}
