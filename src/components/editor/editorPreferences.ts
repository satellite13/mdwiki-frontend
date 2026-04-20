import { readString, writeString } from '@/utils/localPreferences'

export type EditorMode = 'editor' | 'split' | 'preview'

const EDITOR_MODE_LS_KEY = 'mdwiki-editor-mode'
const SPLIT_RATIO_LS_KEY = 'mdwiki-editor-split-ratio'

const MIN_RATIO = 25
const MAX_RATIO = 75
const DEFAULT_RATIO = 50

export function readEditorModePref(): EditorMode {
  const value = readString(EDITOR_MODE_LS_KEY)
  if (value === 'editor' || value === 'split' || value === 'preview') return value
  return 'split'
}

export function writeEditorModePref(value: EditorMode): void {
  writeString(EDITOR_MODE_LS_KEY, value)
}

export function readSplitRatioPref(): number {
  const raw = Number(readString(SPLIT_RATIO_LS_KEY) || String(DEFAULT_RATIO))
  if (Number.isFinite(raw)) return Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw))
  return DEFAULT_RATIO
}

export function writeSplitRatioPref(value: number): void {
  writeString(SPLIT_RATIO_LS_KEY, String(Math.round(value)))
}

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RATIO
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value))
}

export { DEFAULT_RATIO as DEFAULT_SPLIT_RATIO }
