import client from './client'
import type { BundleExportRequest, BundleImportResponse, BundlePreviewResponse } from '@/types'
import { stripFolderPrefix } from '@/utils/folderId'

export function previewBundle(body: BundleExportRequest) {
  return client.post<BundlePreviewResponse>('/bundles/preview', body)
}

export async function exportBundle(body: BundleExportRequest): Promise<void> {
  const { data } = await client.post<Blob>('/bundles/export', body, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = `mdwiki-bundle-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function importBundle(file: File, targetFolderId?: string | null) {
  const formData = new FormData()
  formData.append('file', file)
  if (targetFolderId) {
    formData.append('targetFolderId', stripFolderPrefix(targetFolderId))
  }
  return client.post<BundleImportResponse>('/bundles/import', formData, {
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
