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

export type FolderDeletePageAction = 'delete' | 'move_to_root'

export function deleteFolder(id: string, pageAction: FolderDeletePageAction = 'delete') {
  const param = pageAction === 'move_to_root' ? 'MOVE_TO_ROOT' : 'DELETE'
  return client.delete<void>(`/folders/${id}`, { params: { pageAction: param } })
}
