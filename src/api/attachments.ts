import client from './client'
import type { Attachment } from '@/types'

export function listAttachments(page = 0, size = 50) {
  return client.get<Attachment[]>('/attachments', { params: { page, size } })
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
