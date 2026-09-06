import client from './client'
import type { CaptureResponse } from '@/types'

export const captureText = (payload: { text: string; title?: string }) =>
  client.post<CaptureResponse>('/captures/text', payload)

export const captureUrl = (payload: { url: string; note?: string; title?: string }) =>
  client.post<CaptureResponse>('/captures/url', payload)

export function captureImage(file: File, caption?: string, title?: string) {
  const form = new FormData()
  form.append('file', file)
  if (caption) form.append('caption', caption)
  if (title) form.append('title', title)
  return client.post<CaptureResponse>('/captures/image', form, {
    transformRequest: [
      (data, headers) => {
        if (data instanceof FormData) delete (headers as Record<string, unknown>)['Content-Type']
        return data
      }
    ]
  })
}
