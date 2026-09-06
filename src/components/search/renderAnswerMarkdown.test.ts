import { describe, expect, it } from 'vitest'
import { renderAnswerMarkdown } from './renderAnswerMarkdown'

describe('renderAnswerMarkdown', () => {
  it('renders markdown citation markers and removes active HTML', () => {
    const html = renderAnswerMarkdown('**Fact** [1]\n\n<img src=x onerror=alert(1)>')
    expect(html).toContain('<strong>Fact</strong> [1]')
    expect(html).not.toContain('onerror')
  })
})
