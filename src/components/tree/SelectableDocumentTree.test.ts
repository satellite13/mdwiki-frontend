import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { FolderTreeNode } from '@/types'
import SelectableDocumentTree from './SelectableDocumentTree.vue'

const tree: FolderTreeNode[] = [
  {
    id: 'folder-a',
    name: 'Docs',
    type: 'folder',
    children: [{ id: 'page-1', name: 'One', type: 'page', slug: 'one', children: [] }]
  }
]

describe('SelectableDocumentTree', () => {
  it('renders a checkbox beside each name in multi mode', async () => {
    const wrapper = mount(SelectableDocumentTree, {
      props: { nodes: tree, selected: new Set<string>() }
    })

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    expect(wrapper.get('label.tree-row').text()).toContain('Docs')
    expect(wrapper.find('button.tree-row').exists()).toBe(false)

    await checkboxes[0].trigger('change')
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['folder-a'])
  })
})
