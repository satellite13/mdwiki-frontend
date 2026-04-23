import {
  clampNumber,
  readClampedNumberPref,
  writeClampedNumberPref
} from '@/utils/numericPreference'

const DOCUMENTS_SIDEBAR_WIDTH_LS_KEY = 'mdwiki-documents-sidebar-width'

const MIN_WIDTH = 220
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 260
const WIDTH_CONFIG = {
  min: MIN_WIDTH,
  max: MAX_WIDTH,
  fallback: DEFAULT_WIDTH
}

export function readDocumentsSidebarWidthPref(): number {
  return readClampedNumberPref(DOCUMENTS_SIDEBAR_WIDTH_LS_KEY, WIDTH_CONFIG)
}

export function writeDocumentsSidebarWidthPref(value: number): void {
  writeClampedNumberPref(DOCUMENTS_SIDEBAR_WIDTH_LS_KEY, value, WIDTH_CONFIG)
}

export function clampDocumentsSidebarWidth(value: number): number {
  return clampNumber(value, WIDTH_CONFIG)
}

export { DEFAULT_WIDTH as DEFAULT_DOCUMENTS_SIDEBAR_WIDTH }
