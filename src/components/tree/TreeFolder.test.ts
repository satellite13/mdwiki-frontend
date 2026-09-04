import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import type { FolderTreeNode } from '@/types'
import TreeFolder from './TreeFolder.vue'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isEditor: true })
}))

vi.mock('@/stores/folders', () => ({
  useFolderStore: () => ({
    isExpanded: () => false,
    toggleFolder: vi.fn()
  })
}))

vi.mock('@/composables/useTreeDnd', () => ({
  useTreeDropTarget: () => ({
    isDragOver: { value: false },
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn()
  }),
  useTreeDragSource: () => ({
    onDragStart: vi.fn(),
    onDragEnd: vi.fn()
  })
}))

const folder: FolderTreeNode = {
  id: 'folder-abc',
  name: 'Docs',
  type: 'folder',
  children: []
}

describe('TreeFolder', () => {
  it('emits rename when the rename button is clicked', async () => {
    i18n.global.locale.value = 'en'
    const wrapper = mount(TreeFolder, {
      props: {
        node: folder,
        depth: 0,
        activeSlug: null
      },
      global: { plugins: [i18n] }
    })

    await wrapper.get('button[title="Rename folder"]').trigger('click')
    expect(wrapper.emitted('rename')?.[0]).toEqual([folder])
  })
})
