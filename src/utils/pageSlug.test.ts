import { describe, expect, it } from 'vitest'
import {
  normalizePageSlug,
  normalizeWikilinkKey,
  slugToDefaultTitle,
  titleForStubPage
} from './pageSlug'

describe('normalizeWikilinkKey', () => {
  it('lowercases, trims and collapses separators without transliteration', () => {
    expect(normalizeWikilinkKey('  Привет, Мир!  ')).toBe('привет-мир')
  })

  it('keeps latin alphanumerics and removes punctuation', () => {
    expect(normalizeWikilinkKey('Hello   World!!')).toBe('hello-world')
  })

  it('drops leading/trailing hyphens', () => {
    expect(normalizeWikilinkKey('---foo---bar---')).toBe('foo-bar')
  })

  it('returns empty string for input with only separators', () => {
    expect(normalizeWikilinkKey('   ,,, --- ')).toBe('')
  })
})

describe('normalizePageSlug', () => {
  it('transliterates cyrillic and builds a kebab slug', () => {
    expect(normalizePageSlug('  Идея подключить Hindsight  ')).toBe('ideya-podklyuchit-hindsight')
  })

  it('collapses consecutive separators and strips diacritics', () => {
    expect(normalizePageSlug('Café — naïve   résumé')).toBe('cafe-naive-resume')
  })

  it('maps German ß to ss', () => {
    expect(normalizePageSlug('Straße')).toBe('strasse')
  })

  it('yields empty string for purely non-letter input', () => {
    expect(normalizePageSlug('!!!---???')).toBe('')
  })
})

describe('slugToDefaultTitle', () => {
  it('title-cases hyphenated slug parts', () => {
    expect(slugToDefaultTitle('project-roadmap-q2')).toBe('Project Roadmap Q2')
  })

  it('handles single-word slug', () => {
    expect(slugToDefaultTitle('ideas')).toBe('Ideas')
  })

  it('returns original string when slug is empty-ish', () => {
    expect(slugToDefaultTitle('')).toBe('')
  })
})

describe('titleForStubPage', () => {
  it('preserves single-segment route spelling', () => {
    expect(titleForStubPage('Hindsight', 'hindsight')).toBe('Hindsight')
  })

  it('falls back to normalized title for multi-segment slug', () => {
    expect(titleForStubPage('my-new-page', 'my-new-page')).toBe('My New Page')
  })

  it('falls back when route spelling does not match normalization', () => {
    expect(titleForStubPage('Privet', 'privet-mir')).toBe('Privet Mir')
  })
})
