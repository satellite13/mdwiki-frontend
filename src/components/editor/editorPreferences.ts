import { readString, writeString } from '@/utils/localPreferences'
import {
  clampNumber,
  readClampedNumberPref,
  writeClampedNumberPref
} from '@/utils/numericPreference'

export type EditorMode = 'editor' | 'split' | 'preview' | 'reading'

const EDITOR_MODE_LS_KEY = 'mdwiki-editor-mode'
const SPLIT_RATIO_LS_KEY = 'mdwiki-editor-split-ratio'

const MIN_RATIO = 25
const MAX_RATIO = 75
const DEFAULT_RATIO = 50
const SPLIT_RATIO_CONFIG = {
  min: MIN_RATIO,
  max: MAX_RATIO,
  fallback: DEFAULT_RATIO
}

export function readEditorModePref(): EditorMode {
  const value = readString(EDITOR_MODE_LS_KEY)
  if (value === 'editor' || value === 'split' || value === 'preview' || value === 'reading') return value
  return 'split'
}

export function writeEditorModePref(value: EditorMode): void {
  writeString(EDITOR_MODE_LS_KEY, value)
}

export function readSplitRatioPref(): number {
  return readClampedNumberPref(SPLIT_RATIO_LS_KEY, SPLIT_RATIO_CONFIG)
}

export function writeSplitRatioPref(value: number): void {
  writeClampedNumberPref(SPLIT_RATIO_LS_KEY, value, SPLIT_RATIO_CONFIG)
}

export function clampSplitRatio(value: number): number {
  return clampNumber(value, SPLIT_RATIO_CONFIG)
}

export { DEFAULT_RATIO as DEFAULT_SPLIT_RATIO }
