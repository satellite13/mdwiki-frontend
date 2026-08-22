import { describe, expect, it } from 'vitest'
import type { FolderTreeNode } from '@/types'
import {
  bundleExportPayload,
  bundleNodeState,
  countPagesInFolder,
  folderContainsPageSlug,
  toggleBundleSelection
} from './folderTree'

const sampleFolder: FolderTreeNode = {
  id: 'folder-a',
  name: 'Docs',
  type: 'folder',
  children: [
    { id: 'page-1', name: 'One', type: 'page', slug: 'one', children: [] },
    {
      id: 'folder-b',
      name: 'Nested',
      type: 'folder',
      children: [{ id: 'page-2', name: 'Two', type: 'page', slug: 'two', children: [] }]
    }
  ]
}

describe('folderTree utils', () => {
  it('countPagesInFolder counts nested pages', () => {
    expect(countPagesInFolder(sampleFolder)).toBe(2)
  })

  it('folderContainsPageSlug finds slug in subtree', () => {
    expect(folderContainsPageSlug(sampleFolder, 'two')).toBe(true)
    expect(folderContainsPageSlug(sampleFolder, 'missing')).toBe(false)
  })

  it('checking a folder selects the whole subtree', () => {
    const tree = [sampleFolder]
    const selected = toggleBundleSelection(tree, new Set(), 'folder-a')
    expect(bundleNodeState(sampleFolder, selected)).toBe('checked')
    expect(bundleExportPayload(tree, selected)).toEqual({
      pageSlugs: [],
      folderIds: ['a']
    })
  })

  it('unchecking one page makes the folder indeterminate', () => {
    const tree = [sampleFolder]
    let selected = toggleBundleSelection(tree, new Set(), 'folder-a')
    selected = toggleBundleSelection(tree, selected, 'page-2')
    expect(bundleNodeState(sampleFolder, selected)).toBe('indeterminate')
    expect(bundleNodeState(sampleFolder.children[1], selected)).toBe('unchecked')
    expect(bundleExportPayload(tree, selected)).toEqual({
      pageSlugs: ['one'],
      folderIds: []
    })
  })

  it('checking all pages checks the parent folder', () => {
    const tree = [sampleFolder]
    let selected = toggleBundleSelection(tree, new Set(), 'page-1')
    selected = toggleBundleSelection(tree, selected, 'folder-b')
    expect(bundleNodeState(sampleFolder, selected)).toBe('checked')
    expect(bundleExportPayload(tree, selected).folderIds).toEqual(['a'])
  })
})
