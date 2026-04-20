import client from './client'
import type { FolderTreeNode } from '@/types'

export function getFolderTree() {
  return client.get<FolderTreeNode[]>('/folders/tree')
}

export function createFolder(name: string, parentId?: string) {
  return client.post<void>('/folders', { name, parentId })
}

export function renameFolder(id: string, name: string) {
  return client.put<void>(`/folders/${id}`, { name })
}

export function moveFolder(id: string, parentId: string | null) {
  return client.put<void>(`/folders/${id}/move`, { parentId })
}

export function deleteFolder(id: string) {
  return client.delete<void>(`/folders/${id}`)
}
