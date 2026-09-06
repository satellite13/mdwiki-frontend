import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('./client', () => ({ default: { get, post: vi.fn(), delete: vi.fn() } }))

import { listAttachments } from './attachments'

describe('listAttachments', () => {
  beforeEach(() => get.mockReset())

  it('returns items and total from X-Total-Count', async () => {
    get.mockResolvedValue({
      data: [{ id: '1', originalName: 'a.png' }],
      headers: { 'x-total-count': '42' },
    })
    const result = await listAttachments({ page: 0, size: 20, q: 'a' })
    expect(get).toHaveBeenCalledWith('/attachments', {
      params: { page: 0, size: 20, q: 'a' },
      signal: undefined,
    })
    expect(result).toEqual({
      items: [{ id: '1', originalName: 'a.png' }],
      total: 42,
    })
  })

  it('falls back to items.length when header missing', async () => {
    get.mockResolvedValue({ data: [{ id: '1' }, { id: '2' }], headers: {} })
    const result = await listAttachments({ page: 0, size: 20 })
    expect(result.total).toBe(2)
  })
})
