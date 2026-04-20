import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/folders', () => ({
  getFolderTree: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  moveFolder: vi.fn(),
  deleteFolder: vi.fn()
}))

import * as foldersApi from '@/api/folders'
import type { FolderTreeNode } from '@/types'
import { useFolderStore } from './folders'

const mockedGetTree = vi.mocked(foldersApi.getFolderTree)
const mockedCreate = vi.mocked(foldersApi.createFolder)
const mockedRename = vi.mocked(foldersApi.renameFolder)
const mockedMove = vi.mocked(foldersApi.moveFolder)
const mockedDelete = vi.mocked(foldersApi.deleteFolder)

function mockTreeResponse(tree: FolderTreeNode[]) {
  mockedGetTree.mockResolvedValue({ data: tree } as Awaited<ReturnType<typeof foldersApi.getFolderTree>>)
}

beforeEach(() => {
  window.localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockedCreate.mockResolvedValue({ data: undefined } as Awaited<ReturnType<typeof foldersApi.createFolder>>)
  mockedRename.mockResolvedValue({ data: undefined } as Awaited<ReturnType<typeof foldersApi.renameFolder>>)
  mockedMove.mockResolvedValue({ data: undefined } as Awaited<ReturnType<typeof foldersApi.moveFolder>>)
  mockedDelete.mockResolvedValue({ data: undefined } as Awaited<ReturnType<typeof foldersApi.deleteFolder>>)
})

describe('useFolderStore', () => {
  it('hydrates expandedFolders from localStorage', () => {
    window.localStorage.setItem('expandedFolders', JSON.stringify(['a', 'b']))
    const store = useFolderStore()
    expect(store.isExpanded('a')).toBe(true)
    expect(store.isExpanded('c')).toBe(false)
  })

  it('falls back to empty set on malformed stored value', () => {
    window.localStorage.setItem('expandedFolders', '{bad-json')
    const store = useFolderStore()
    expect(store.isExpanded('a')).toBe(false)
  })

  it('toggles folders and persists them', () => {
    const store = useFolderStore()
    store.toggleFolder('x')
    expect(store.isExpanded('x')).toBe(true)
    expect(JSON.parse(window.localStorage.getItem('expandedFolders') || '[]')).toContain('x')
    store.toggleFolder('x')
    expect(store.isExpanded('x')).toBe(false)
  })

  it('fetchTree caches and forces refetch on demand', async () => {
    mockTreeResponse([{ id: 'f1', name: 'F1', children: [], pages: [] } as unknown as FolderTreeNode])
    const store = useFolderStore()
    await store.fetchTree()
    await store.fetchTree()
    expect(mockedGetTree).toHaveBeenCalledTimes(1)
    await store.fetchTree(true)
    expect(mockedGetTree).toHaveBeenCalledTimes(2)
  })

  it('createFolder strips folder- prefix from parent id', async () => {
    mockTreeResponse([])
    const store = useFolderStore()
    await store.createFolder('New', 'folder-parent-uuid')
    expect(mockedCreate).toHaveBeenCalledWith('New', 'parent-uuid')
    expect(mockedGetTree).toHaveBeenCalledTimes(1)
  })

  it('renameFolder strips prefix before calling API', async () => {
    mockTreeResponse([])
    const store = useFolderStore()
    await store.renameFolder('folder-abc', 'Renamed')
    expect(mockedRename).toHaveBeenCalledWith('abc', 'Renamed')
  })

  it('moveFolder handles null parent and strips prefixes', async () => {
    mockTreeResponse([])
    const store = useFolderStore()
    await store.moveFolder('folder-x', null)
    expect(mockedMove).toHaveBeenCalledWith('x', null)
    await store.moveFolder('folder-y', 'folder-z')
    expect(mockedMove).toHaveBeenCalledWith('y', 'z')
  })

  it('deleteFolder propagates API errors', async () => {
    mockedDelete.mockRejectedValueOnce(new Error('boom'))
    const store = useFolderStore()
    await expect(store.deleteFolder('folder-1')).rejects.toThrow('boom')
  })

  it('notifyTreeDragEnd increments generation counter', () => {
    const store = useFolderStore()
    const before = store.treeDragGeneration
    store.notifyTreeDragEnd()
    expect(store.treeDragGeneration).toBe(before + 1)
  })
})
