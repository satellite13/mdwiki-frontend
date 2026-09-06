import client from './client'
import type { Attachment } from '@/types'

export type AttachmentListResult = {
  items: Attachment[]
  total: number
}

export async function listAttachments(options: {
  page?: number
  size?: number
  q?: string
  pageId?: string
  signal?: AbortSignal
} = {}): Promise<AttachmentListResult> {
  const { page = 0, size = 20, q, pageId, signal } = options
  const res = await client.get<Attachment[]>('/attachments', {
    params: {
      page,
      size,
      ...(q && q.trim() ? { q: q.trim() } : {}),
      ...(pageId ? { pageId } : {}),
    },
    signal,
  })
  const header = res.headers['x-total-count']
  const total =
    header != null && header !== ''
      ? Number(header)
      : res.data.length
  return { items: res.data, total: Number.isFinite(total) ? total : res.data.length }
}

export function uploadAttachment(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return client.post<Attachment>('/attachments', formData, {
    transformRequest: [
      (data, headers) => {
        if (data instanceof FormData) {
          delete (headers as Record<string, unknown>)['Content-Type']
        }
        return data
      }
    ]
  })
}

export function deleteAttachment(id: string) {
  return client.delete<void>(`/attachments/${id}`)
}
