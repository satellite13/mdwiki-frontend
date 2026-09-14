import { beforeEach, describe, expect, it } from 'vitest'
import { readTaskAskCommentPref, writeTaskAskCommentPref } from './taskPreferences'

describe('taskPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to asking for a comment when unset', () => {
    expect(readTaskAskCommentPref()).toBe(true)
  })

  it('reads and writes the preference', () => {
    writeTaskAskCommentPref(false)
    expect(window.localStorage.getItem('mdwiki-task-ask-comment')).toBe('0')
    expect(readTaskAskCommentPref()).toBe(false)

    writeTaskAskCommentPref(true)
    expect(window.localStorage.getItem('mdwiki-task-ask-comment')).toBe('1')
    expect(readTaskAskCommentPref()).toBe(true)
  })
})
