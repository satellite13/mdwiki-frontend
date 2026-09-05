import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from './MarkdownEditor.vue'
import { i18n } from '@/i18n'

vi.mock('@/services/pageIndex', () => ({
  getPages: vi.fn().mockResolvedValue([])
}))
vi.mock('@/api/annotations', () => ({
  listAnnotations: vi.fn().mockResolvedValue({ data: [] })
}))

const EditorToolbarStub = {
  props: ['readonly', 'historyActions', 'modeSwitchActions'],
  template: `
    <div class="editor-toolbar-stub" :data-readonly="String(readonly)">
      <button
        v-for="action in historyActions"
        :key="action.key"
        :class="'history-' + action.key"
        @click="action.onClick"
      />
      <button
        v-for="action in modeSwitchActions"
        :key="action.key"
        :class="action.key"
        @click="action.onClick"
      />
      <button v-if="!readonly" class="formatting-control" />
    </div>
  `
}

const PreviewPaneStub = {
  props: ['findOpen'],
  emits: ['mouseup'],
  template: '<div class="preview-pane-stub" :data-find-open="String(findOpen)"><button class="preview-mouseup" @mouseup="$emit(\'mouseup\', $event)" /></div>'
}

const ReadingToolbarStub = {
  emits: ['find', 'exportMarkdown', 'exportPdf', 'exit'],
  template: `
    <div class="reading-toolbar-stub">
      <button class="reading-find" @click="$emit('find')" />
      <button class="reading-export-md" @click="$emit('exportMarkdown')" />
      <button class="reading-export-pdf" @click="$emit('exportPdf')" />
      <button class="reading-exit" @click="$emit('exit')" />
    </div>
  `
}

function mountReadonly() {
  return mount(MarkdownEditor, {
    props: {
      modelValue: '# Read only',
      readingTitle: 'Read only',
      readonly: true
    },
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        EditorToolbar: EditorToolbarStub,
        EditorPreviewPane: PreviewPaneStub,
        EditorInputPane: { template: '<textarea class="editor-input-stub" />' },
        ReadingToolbar: ReadingToolbarStub,
        AnnotationPanel: true,
        AnnotationPopup: true,
        AnnotationComment: true,
        VerticalPaneResizer: true,
        RouterLink: { template: '<a><slot /></a>' }
      }
    }
  })
}

describe('MarkdownEditor readonly', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it.each(['editor', 'split'])('ignores saved %s mode and exposes only readonly controls', async (savedMode) => {
    window.localStorage.setItem('mdwiki-editor-mode', savedMode)
    const wrapper = mountReadonly()
    await flushPromises()

    expect(wrapper.emitted('mode-change')?.[0]).toEqual(['preview'])
    expect(wrapper.find('.editor-input-stub').exists()).toBe(false)
    expect(wrapper.find('.formatting-control').exists()).toBe(false)
    expect(wrapper.find('.history-save').exists()).toBe(false)
    expect(wrapper.find('.history-find').exists()).toBe(true)
    expect(wrapper.find('.mode-editor').exists()).toBe(false)
    expect(wrapper.find('.mode-split').exists()).toBe(false)
    expect(wrapper.find('.mode-preview').exists()).toBe(true)
    expect(wrapper.find('.mode-reading').exists()).toBe(true)
  })

  it('blocks save and annotation creation while keeping reading find and exports', async () => {
    window.localStorage.setItem('mdwiki-editor-mode', 'preview')
    const wrapper = mountReadonly()
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(wrapper.emitted('save')).toBeUndefined()

    await wrapper.get('.mode-reading').trigger('click')
    await flushPromises()
    expect(wrapper.find('.reading-find').exists()).toBe(true)
    expect(wrapper.find('.reading-export-md').exists()).toBe(true)
    expect(wrapper.find('.reading-export-pdf').exists()).toBe(true)
    await wrapper.get('.reading-export-md').trigger('click')
    expect(wrapper.emitted('exportMarkdown')).toHaveLength(1)

    window.getSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      toString: () => 'Read only',
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 10 }) }),
      removeAllRanges: vi.fn()
    })
    await wrapper.get('.preview-mouseup').trigger('mouseup')
    expect(wrapper.find('.annotation-floating-btn').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'AnnotationPopup' }).exists()).toBe(false)

    await wrapper.get('.reading-exit').trigger('click')
    await flushPromises()
    expect(wrapper.find('.mode-preview').exists()).toBe(true)
  })
})
