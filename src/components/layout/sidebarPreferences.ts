import { readString, writeString } from '@/utils/localPreferences'

const DOCUMENTS_SIDEBAR_WIDTH_LS_KEY = 'mdwiki-documents-sidebar-width'

const MIN_WIDTH = 220
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 260

export function readDocumentsSidebarWidthPref(): number {
  const raw = Number(readString(DOCUMENTS_SIDEBAR_WIDTH_LS_KEY) || String(DEFAULT_WIDTH))
  return clampDocumentsSidebarWidth(raw)
}

export function writeDocumentsSidebarWidthPref(value: number): void {
  writeString(DOCUMENTS_SIDEBAR_WIDTH_LS_KEY, String(Math.round(clampDocumentsSidebarWidth(value))))
}

export function clampDocumentsSidebarWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))
}

export { DEFAULT_WIDTH as DEFAULT_DOCUMENTS_SIDEBAR_WIDTH }
