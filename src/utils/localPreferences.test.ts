import { beforeEach, describe, expect, it } from 'vitest'
import { readJson, readString, removePref, writeJson, writeString } from './localPreferences'

beforeEach(() => {
  window.localStorage.clear()
})

describe('localPreferences — strings', () => {
  it('reads null for missing keys', () => {
    expect(readString('absent')).toBeNull()
  })

  it('round-trips string values', () => {
    writeString('theme', 'dark')
    expect(readString('theme')).toBe('dark')
  })

  it('removes values', () => {
    writeString('theme', 'dark')
    removePref('theme')
    expect(readString('theme')).toBeNull()
  })
})

describe('localPreferences — JSON', () => {
  it('returns fallback for missing keys', () => {
    expect(readJson('absent', [] as string[])).toEqual([])
  })

  it('parses valid JSON and returns typed value', () => {
    writeJson('list', ['a', 'b'])
    expect(readJson<string[]>('list', [])).toEqual(['a', 'b'])
  })

  it('returns fallback when stored value is malformed JSON', () => {
    window.localStorage.setItem('bad', '{not-json')
    expect(readJson<string[]>('bad', ['default'])).toEqual(['default'])
  })

  it('returns fallback when guard rejects the parsed value', () => {
    writeJson('list', { not: 'an array' })
    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every((x) => typeof x === 'string')
    expect(readJson<string[]>('list', [], isStringArray)).toEqual([])
  })

  it('accepts value through guard', () => {
    writeJson('list', ['x', 'y'])
    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every((x) => typeof x === 'string')
    expect(readJson<string[]>('list', [], isStringArray)).toEqual(['x', 'y'])
  })
})
