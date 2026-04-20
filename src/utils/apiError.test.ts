import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { getApiErrorMessage, isApiErrorWithStatus } from './apiError'

function makeAxiosError(status: number, data: unknown, message = 'request failed'): AxiosError {
  const headers = new AxiosHeaders()
  return new AxiosError(
    message,
    String(status),
    { headers, url: '/x', method: 'get' },
    null,
    { status, statusText: 'error', headers, config: { headers, url: '/x' }, data }
  )
}

describe('getApiErrorMessage', () => {
  it('returns server-provided message when present', () => {
    const err = makeAxiosError(400, { message: 'Invalid input' })
    expect(getApiErrorMessage(err, 'fallback')).toBe('Invalid input')
  })

  it('ignores empty server message and falls back to error.message', () => {
    const err = makeAxiosError(500, { message: '  ' }, 'network down')
    expect(getApiErrorMessage(err, 'fallback')).toBe('network down')
  })

  it('returns fallback when axios error lacks message and payload', () => {
    const err = makeAxiosError(500, null, '')
    expect(getApiErrorMessage(err, 'fallback text')).toBe('fallback text')
  })

  it('uses message from a plain Error instance', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('uses fallback for unknown non-error values', () => {
    expect(getApiErrorMessage('stringy', 'fallback')).toBe('fallback')
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
})

describe('isApiErrorWithStatus', () => {
  it('detects matching axios error status', () => {
    expect(isApiErrorWithStatus(makeAxiosError(404, null), 404)).toBe(true)
  })

  it('returns false for mismatched status', () => {
    expect(isApiErrorWithStatus(makeAxiosError(500, null), 404)).toBe(false)
  })

  it('returns false for non-axios errors', () => {
    expect(isApiErrorWithStatus(new Error('boom'), 404)).toBe(false)
    expect(isApiErrorWithStatus(null, 404)).toBe(false)
  })
})
