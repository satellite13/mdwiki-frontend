import client from './client'
import type { FolderTreeNode } from '@/types'

export function getFolderTree() {
  return client.get<FolderTreeNode[]>('/folders/tree')
}

export function createFolder(name: string, parentId?: string) {
  return client.post('/folders', { name, parentId })
}

export function renameFolder(id: string, name: string) {
  return client.put(`/folders/${id}`, { name })
}

export function moveFolder(id: string, parentId: string | null) {
  return client.put(`/folders/${id}/move`, { parentId })
}

export function deleteFolder(id: string) {
  return client.delete(`/folders/${id}`)
}
