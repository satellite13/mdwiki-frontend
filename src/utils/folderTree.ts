import type { FolderTreeNode } from '@/types'
import { stripFolderPrefix } from '@/utils/folderId'

export type BundleCheckState = 'checked' | 'unchecked' | 'indeterminate'

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

export function collectSubtreeIds(node: FolderTreeNode): string[] {
  const ids = [node.id]
  for (const child of node.children) {
    ids.push(...collectSubtreeIds(child))
  }
  return ids
}

export function findTreeNode(nodes: FolderTreeNode[], id: string): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findTreeNode(node.children, id)
    if (nested) return nested
  }
  return null
}

export function findParentNodeId(nodes: FolderTreeNode[], id: string): string | null {
  for (const node of nodes) {
    if (node.children.some((child) => child.id === id)) return node.id
    const nested = findParentNodeId(node.children, id)
    if (nested) return nested
  }
  return null
}

export function bundleNodeState(node: FolderTreeNode, selected: Set<string>): BundleCheckState {
  if (node.type === 'page') return selected.has(node.id) ? 'checked' : 'unchecked'
  const ids = collectSubtreeIds(node)
  const selectedCount = ids.filter((id) => selected.has(id)).length
  if (selectedCount === 0) return 'unchecked'
  if (selectedCount === ids.length) return 'checked'
  return 'indeterminate'
}

export function toggleBundleSelection(
  tree: FolderTreeNode[],
  selected: Set<string>,
  nodeId: string
): Set<string> {
  const node = findTreeNode(tree, nodeId)
  if (!node) return new Set(selected)
  const next = new Set(selected)
  const subtree = collectSubtreeIds(node)
  const turningOn = bundleNodeState(node, selected) !== 'checked'
  if (turningOn) {
    for (const id of subtree) next.add(id)
    let parentId = findParentNodeId(tree, nodeId)
    while (parentId) {
      const parent = findTreeNode(tree, parentId)
      if (!parent) break
      const allChecked = parent.children.every((child) => bundleNodeState(child, next) === 'checked')
      if (!allChecked) break
      next.add(parentId)
      parentId = findParentNodeId(tree, parentId)
    }
  } else {
    for (const id of subtree) next.delete(id)
    let parentId = findParentNodeId(tree, nodeId)
    while (parentId) {
      next.delete(parentId)
      parentId = findParentNodeId(tree, parentId)
    }
  }
  return next
}

export function bundleExportPayload(
  tree: FolderTreeNode[],
  selected: Set<string>
): { pageSlugs: string[]; folderIds: string[] } {
  const pageSlugs: string[] = []
  const folderIds: string[] = []

  function walk(nodes: FolderTreeNode[], parentFullySelected: boolean) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        const fully = bundleNodeState(node, selected) === 'checked'
        if (fully && !parentFullySelected) {
          folderIds.push(stripFolderPrefix(node.id))
        }
        walk(node.children, parentFullySelected || fully)
      } else if (node.slug && selected.has(node.id) && !parentFullySelected) {
        pageSlugs.push(node.slug)
      }
    }
  }

  walk(tree, false)
  return { pageSlugs, folderIds }
}
