import { describe, expect, it } from 'vitest'
import { stripFolderPrefix } from './folderId'

describe('stripFolderPrefix', () => {
  it('removes the folder- prefix', () => {
    expect(stripFolderPrefix('folder-abc123')).toBe('abc123')
  })

  it('leaves already-bare UUIDs untouched', () => {
    expect(stripFolderPrefix('abc123')).toBe('abc123')
  })

  it('does not strip a partial match', () => {
    expect(stripFolderPrefix('folderless-xyz')).toBe('folderless-xyz')
  })
})
