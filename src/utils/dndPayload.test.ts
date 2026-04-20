import { describe, expect, it } from 'vitest'
import { parseDndPayload, serializeDndPayload } from './dndPayload'

describe('dndPayload', () => {
  it('round-trips page payload', () => {
    const raw = serializeDndPayload({ type: 'page', slug: 'my-note' })
    expect(parseDndPayload(raw)).toEqual({ type: 'page', slug: 'my-note' })
  })

  it('round-trips folder payload', () => {
    const raw = serializeDndPayload({ type: 'folder', id: 'uuid-1' })
    expect(parseDndPayload(raw)).toEqual({ type: 'folder', id: 'uuid-1' })
  })

  it('returns null for empty or missing input', () => {
    expect(parseDndPayload('')).toBeNull()
    expect(parseDndPayload(null)).toBeNull()
    expect(parseDndPayload(undefined)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseDndPayload('{oops')).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    expect(parseDndPayload(JSON.stringify({ type: 'page' }))).toBeNull()
    expect(parseDndPayload(JSON.stringify({ type: 'folder' }))).toBeNull()
    expect(parseDndPayload(JSON.stringify({ type: 'unknown', slug: 'x' }))).toBeNull()
  })

  it('rejects payloads with non-string slug/id', () => {
    expect(parseDndPayload(JSON.stringify({ type: 'page', slug: 123 }))).toBeNull()
    expect(parseDndPayload(JSON.stringify({ type: 'folder', id: null }))).toBeNull()
  })
})
