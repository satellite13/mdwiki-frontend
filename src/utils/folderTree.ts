import type { FolderTreeNode } from '@/types'

export function countPagesInFolder(node: FolderTreeNode): number {
  let count = 0
  for (const child of node.children) {
    if (child.type === 'page') count++
    else if (child.type === 'folder') count += countPagesInFolder(child)
  }
  return count
}

export function folderContainsPageSlug(node: FolderTreeNode, slug: string): boolean {
  for (const child of node.children) {
    if (child.type === 'page' && child.slug === slug) return true
    if (child.type === 'folder' && folderContainsPageSlug(child, slug)) return true
  }
  return false
}
