import { describe, expect, it } from 'vitest'
import type { FolderTreeNode } from '@/types'
import { countPagesInFolder, folderContainsPageSlug } from './folderTree'

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
})
