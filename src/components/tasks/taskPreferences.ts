import { readString, writeString } from '@/utils/localPreferences'

const ASK_COMMENT_LS_KEY = 'mdwiki-task-ask-comment'

/** Default true: keep the completion comment dialog (current behavior). */
export function readTaskAskCommentPref(): boolean {
  const value = readString(ASK_COMMENT_LS_KEY)
  if (value === '0') return false
  if (value === '1') return true
  return true
}

export function writeTaskAskCommentPref(value: boolean): void {
  writeString(ASK_COMMENT_LS_KEY, value ? '1' : '0')
}
