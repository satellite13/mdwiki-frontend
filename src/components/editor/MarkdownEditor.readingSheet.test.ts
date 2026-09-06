import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MarkdownEditor from './MarkdownEditor.vue'
import { i18n } from '@/i18n'

vi.mock('@/services/pageIndex', () => ({
  getPages: vi.fn().mockResolvedValue([])
}))
vi.mock('@/api/annotations', () => ({
  listAnnotations: vi.fn().mockResolvedValue({ data: [] })
}))
vi.mock('./useReadingToc', () => ({
  useReadingToc: () => ({
    readingTocItems: ref([{ id: 'h1', text: 'Title', level: 1 }]),
    buildReadingToc: vi.fn(),
    scrollToHeading: vi.fn()
  })
}))

const PreviewPaneStub = {
  props: ['findOpen', 'showToc'],
  emits: ['mouseup'],
  template:
    '<div class="preview-pane-stub" :data-show-toc="String(showToc)" :data-find-open="String(findOpen)"><button class="preview-mouseup" @mouseup="$emit(\'mouseup\', $event)" /></div>'
}

const ReadingToolbarStub = {
  props: ['tocVisible', 'annotationsVisible'],
  emits: ['find', 'exportMarkdown', 'exportPdf', 'exit', 'update:tocVisible', 'update:annotationsVisible'],
  template: `
    <div class="reading-toolbar-stub">
      <button
        class="reading-toc"
        @click="$emit('update:tocVisible', !tocVisible)"
      />
      <button
        class="reading-annotations"
        @click="$emit('update:annotationsVisible', !annotationsVisible)"
      />
      <button class="reading-find" @click="$emit('find')" />
      <button class="reading-export-md" @click="$emit('exportMarkdown')" />
      <button class="reading-export-pdf" @click="$emit('exportPdf')" />
      <button class="reading-exit" @click="$emit('exit')" />
    </div>
  `
}

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
    </div>
  `
}

async function mountReadingEditor(innerWidth: number): Promise<VueWrapper> {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth })
  window.dispatchEvent(new Event('resize'))

  const wrapper = mount(MarkdownEditor, {
    props: {
      modelValue: '# Title\n\n## Section\n\nBody',
      pageSlug: 'demo',
      readingTitle: 'Demo',
      readonly: false
    },
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        EditorToolbar: EditorToolbarStub,
        EditorPreviewPane: PreviewPaneStub,
        EditorInputPane: { template: '<textarea class="editor-input-stub" />' },
        ReadingToolbar: ReadingToolbarStub,
        ReadingBottomSheet: false,
        ReadingToc: {
          props: ['variant', 'items'],
          emits: ['select', 'copy', 'close'],
          template: '<aside class="reading-toc-stub" :data-variant="variant" />'
        },
        AnnotationPanel: {
          props: ['visible'],
          template: '<div class="annotation-panel-stub" v-if="visible" />'
        },
        AnnotationPopup: true,
        AnnotationComment: true,
        VerticalPaneResizer: true,
        RouterLink: { template: '<a><slot /></a>' }
      }
    }
  })

  await flushPromises()
  const readingBtn = wrapper.find('.mode-reading')
  if (readingBtn.exists()) await readingBtn.trigger('click')
  await flushPromises()
  return wrapper
}

describe('MarkdownEditor reading sheet', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it('mutually excludes toc and annotations visibility', async () => {
    const wrapper = await mountReadingEditor(1200)

    expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('true')

    await wrapper.get('.reading-annotations').trigger('click')
    await flushPromises()

    expect(wrapper.find('.annotation-panel-stub').exists()).toBe(true)
    expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('false')

    await wrapper.get('.reading-toc').trigger('click')
    await flushPromises()

    expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('true')
    expect(wrapper.find('.annotation-panel-stub').exists()).toBe(false)

    wrapper.unmount()
  })

  it('mounts toc in bottom sheet on narrow reading width', async () => {
    const wrapper = await mountReadingEditor(900)
    await flushPromises()

    expect(wrapper.find('[data-testid="reading-bottom-sheet"]').exists()).toBe(true)
    expect(wrapper.find('.reading-toc-stub').attributes('data-variant')).toBe('sheet')
    expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('false')

    await wrapper.get('.reading-annotations').trigger('click')
    await flushPromises()

    const sheet = wrapper.get('[data-testid="reading-bottom-sheet"]')
    expect(sheet.find('.annotation-panel-stub').exists()).toBe(true)
    expect(wrapper.find('.reading-toc-stub').exists()).toBe(false)

    wrapper.unmount()
  })

  it('keeps toc in preview pane on wide reading width', async () => {
    const wrapper = await mountReadingEditor(1200)
    await flushPromises()

    expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('true')
    expect(wrapper.find('.reading-toc-stub[data-variant="sheet"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reading-bottom-sheet"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
