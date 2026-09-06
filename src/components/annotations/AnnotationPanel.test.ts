import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AnnotationPanel from './AnnotationPanel.vue'
import { i18n } from '@/i18n'

const updateAnnotation = vi.fn()
vi.mock('@/api/annotations', () => ({
  deleteAnnotation: vi.fn(),
  updateAnnotation: (...args: unknown[]) => updateAnnotation(...args)
}))
vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({ confirm: vi.fn(), alert: vi.fn() })
}))

const annotation = {
  id: 'a1',
  pageId: 'p1',
  highlightedText: 'text',
  anchorContext: 'text context',
  comment: 'old',
  rangeStart: null,
  rangeEnd: null,
  color: '#ffeb3b',
  createdBy: 'editor',
  createdAt: '2026-09-05T10:00:00Z',
  updatedAt: '2026-09-05T10:00:00Z'
}

describe('AnnotationPanel', () => {
  it('hides edit and delete actions from readers', () => {
    const wrapper = mount(AnnotationPanel, {
      props: { annotations: [annotation], visible: true, canEdit: false },
      global: { plugins: [i18n] }
    })
    expect(wrapper.find('.annotation-item-edit').exists()).toBe(false)
    expect(wrapper.find('.annotation-item-delete').exists()).toBe(false)
  })

  it('edits comment and color and emits immutable replacement', async () => {
    const updated = { ...annotation, comment: 'new', color: '#90caf9' }
    updateAnnotation.mockResolvedValue({ data: updated })
    const wrapper = mount(AnnotationPanel, {
      props: { annotations: [annotation], visible: true, canEdit: true },
      global: { plugins: [i18n] }
    })

    await wrapper.get('.annotation-item-edit').trigger('click')
    await wrapper.get('.annotation-edit-comment').setValue('new')
    await wrapper.get('[data-color="#90caf9"]').trigger('click')
    await wrapper.get('.annotation-edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(updateAnnotation).toHaveBeenCalledWith('a1', { comment: 'new', color: '#90caf9' })
    expect(wrapper.emitted('updated')?.[0]).toEqual([updated])
  })

  it('sends an explicit clear operation for an empty comment', async () => {
    updateAnnotation.mockResolvedValue({ data: { ...annotation, comment: null } })
    const wrapper = mount(AnnotationPanel, {
      props: { annotations: [annotation], visible: true, canEdit: true },
      global: { plugins: [i18n] }
    })

    await wrapper.get('.annotation-item-edit').trigger('click')
    await wrapper.get('.annotation-edit-comment').setValue('   ')
    await wrapper.get('.annotation-edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(updateAnnotation).toHaveBeenCalledWith('a1', {
      clearComment: true,
      color: '#ffeb3b'
    })
  })

  it('exposes keyboard selection without nesting action buttons', async () => {
    const wrapper = mount(AnnotationPanel, {
      props: { annotations: [annotation], visible: true, canEdit: true },
      global: { plugins: [i18n] }
    })
    const select = wrapper.get<HTMLButtonElement>('.annotation-item-select')

    expect(select.element.tagName).toBe('BUTTON')
    expect(select.find('button').exists()).toBe(false)
    await select.trigger('keydown', { key: 'Enter' })
    await select.trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('select')).toEqual([[annotation], [annotation]])
  })

  it('gives every color option a localized accessible name and title', async () => {
    const wrapper = mount(AnnotationPanel, {
      props: { annotations: [annotation], visible: true, canEdit: true },
      global: { plugins: [i18n] }
    })
    await wrapper.get('.annotation-item-edit').trigger('click')

    for (const swatch of wrapper.findAll('.color-swatch')) {
      expect(swatch.attributes('aria-label')).toContain(swatch.attributes('data-color'))
      expect(swatch.attributes('title')).toBe(swatch.attributes('aria-label'))
    }
  })
})
