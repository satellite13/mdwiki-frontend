import { describe, expect, it } from 'vitest'
import {
  normalizePageSlug,
  normalizeWikilinkKey,
  slugToDefaultTitle,
  titleForStubPage
} from './pageSlug'

describe('pageSlug utils', () => {
  it('normalizes wikilink key without transliteration', () => {
    expect(normalizeWikilinkKey('  Привет, Мир!  ')).toBe('привет-мир')
  })

  it('normalizes page slug with transliteration', () => {
    expect(normalizePageSlug('  Идея подключить Hindsight  ')).toBe('ideya-podklyuchit-hindsight')
  })

  it('builds title from slug', () => {
    expect(slugToDefaultTitle('project-roadmap-q2')).toBe('Project Roadmap Q2')
  })

  it('keeps route spelling for single-segment stub title', () => {
    expect(titleForStubPage('Hindsight', 'hindsight')).toBe('Hindsight')
  })

  it('falls back to normalized slug title for multi-segment route', () => {
    expect(titleForStubPage('my-new-page', 'my-new-page')).toBe('My New Page')
  })
})
