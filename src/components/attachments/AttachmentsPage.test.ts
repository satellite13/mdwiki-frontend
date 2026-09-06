import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttachmentsPage from './AttachmentsPage.vue'

const { listAttachments, uploadAttachment, deleteAttachment } = vi.hoisted(() => ({
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}))

vi.mock('@/api/attachments', () => ({
  listAttachments: (...a: unknown[]) => listAttachments(...a),
  uploadAttachment: (...a: unknown[]) => uploadAttachment(...a),
  deleteAttachment: (...a: unknown[]) => deleteAttachment(...a),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isEditor: true }),
}))

vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({
    alert: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}))

function sample(id: string, name: string) {
  return {
    id,
    originalName: name,
    storedName: name,
    contentType: 'text/plain',
    sizeBytes: 10,
    uploadedBy: 'u',
    pageId: null,
    url: `/api/uploads/${name}`,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

describe('AttachmentsPage', () => {
  beforeEach(() => {
    listAttachments.mockReset()
    listAttachments.mockResolvedValue({
      items: [sample('1', 'a.txt')],
      total: 25,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads first page with size 20', async () => {
    mount(AttachmentsPage)
    await flushPromises()
    expect(listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 20 })
    )
  })

  it('resets to page 0 when search query changes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AttachmentsPage)
    await flushPromises()
    listAttachments.mockClear()
    await wrapper.get('[data-testid="attachments-search"]').setValue('note')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, q: 'note', size: 20 })
    )
  })

  it('disables next on last page and prev on first', async () => {
    listAttachments.mockResolvedValue({ items: [sample('1', 'a.txt')], total: 1 })
    const wrapper = mount(AttachmentsPage)
    await flushPromises()
    expect(wrapper.get('[data-testid="attachments-prev"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="attachments-next"]').attributes('disabled')).toBeDefined()
  })

  it('shows no-results when q set and items empty', async () => {
    vi.useFakeTimers()
    listAttachments.mockResolvedValue({ items: [], total: 0 })
    const wrapper = mount(AttachmentsPage)
    await flushPromises()
    await wrapper.get('[data-testid="attachments-search"]').setValue('zzz')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(wrapper.text()).toContain('attachments.noResults')
  })
})
