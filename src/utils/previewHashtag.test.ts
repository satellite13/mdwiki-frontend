import { describe, expect, it } from 'vitest'
import { previewHashtagName } from './previewHashtag'

describe('previewHashtagName', () => {
  it('reads data-tag from the hashtag host', () => {
    const host = document.createElement('span')
    host.className = 'hashtag'
    host.dataset.tag = 'orchestration'
    host.textContent = '#orchestration'
    expect(previewHashtagName(host)).toBe('orchestration')
  })

  it('walks up from a nested click target', () => {
    const host = document.createElement('span')
    host.className = 'hashtag'
    host.dataset.tag = 'agents'
    const inner = document.createElement('em')
    inner.textContent = '#agents'
    host.appendChild(inner)
    expect(previewHashtagName(inner)).toBe('agents')
  })

  it('returns null outside a hashtag', () => {
    const p = document.createElement('p')
    p.textContent = '#not-a-chip'
    expect(previewHashtagName(p)).toBeNull()
  })
})
