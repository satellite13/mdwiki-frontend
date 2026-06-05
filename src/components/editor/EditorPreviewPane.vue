<script setup lang="ts">
import { ref } from 'vue'
import ReadingToc from './ReadingToc.vue'
import type { TocItem } from './tocTypes'

type ReadingTheme = 'white' | 'paper' | 'dark'

const props = defineProps<{
  isReading: boolean
  readingTheme: ReadingTheme
  showToc: boolean
  readingTocItems: TocItem[]
  previewHtml: string
  readingPreviewStyle?: Record<string, string>
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
  scroll: [event: Event]
  selectHeading: [id: string]
}>()

const rootEl = ref<HTMLElement | null>(null)

function onSelectHeading(id: string) {
  emit('selectHeading', id)
}

defineExpose({
  rootEl
})
</script>

<template>
  <div
    ref="rootEl"
    class="preview-pane"
    :class="[
      { 'mode-reading': props.isReading },
      { 'reading-theme-white': props.isReading && props.readingTheme === 'white' },
      { 'reading-theme-paper': props.isReading && props.readingTheme === 'paper' },
      { 'reading-theme-dark': props.isReading && props.readingTheme === 'dark' }
    ]"
    @click="emit('click', $event)"
    @scroll="emit('scroll', $event)"
  >
    <div class="reading-layout" :class="{ 'with-toc': props.showToc }">
      <div class="preview-content markdown-body" :style="props.readingPreviewStyle" v-html="props.previewHtml" />
      <ReadingToc
        v-if="props.showToc"
        :items="props.readingTocItems"
        :theme="props.readingTheme"
        @select="onSelectHeading"
      />
    </div>
  </div>
</template>

<style scoped>
.preview-pane {
  min-height: 0;
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  overflow: auto;
  padding: 14px;
}

.preview-content {
  width: 100%;
}

.reading-layout {
  width: 100%;
}

.reading-layout.with-toc {
  display: grid;
  grid-template-columns: minmax(0, 920px) 240px;
  gap: 24px;
  align-items: start;
  justify-content: center;
}

.preview-pane.mode-reading {
  border: none;
  border-radius: 0;
  padding: 28px clamp(56px, 10vw, 220px);
  background: var(--color-bg);
  position: relative;
}

.preview-pane.mode-reading .preview-content {
  max-width: 920px;
  margin: 0 auto;
  line-height: 1.75;
}

/* In reading mode keep headings on baseline and shift body text slightly right. */
.preview-pane.mode-reading :deep(.markdown-body p),
.preview-pane.mode-reading :deep(.markdown-body ul),
.preview-pane.mode-reading :deep(.markdown-body ol),
.preview-pane.mode-reading :deep(.markdown-body blockquote),
.preview-pane.mode-reading :deep(.markdown-body pre),
.preview-pane.mode-reading :deep(.markdown-body table) {
  margin-left: 0.6rem;
}

.preview-pane :deep(.markdown-body h1),
.preview-pane :deep(.markdown-body h2),
.preview-pane :deep(.markdown-body h3),
.preview-pane :deep(.markdown-body h4),
.preview-pane :deep(.markdown-body h5),
.preview-pane :deep(.markdown-body h6) {
  text-decoration: none !important;
  border-bottom: none !important;
  padding-bottom: 0 !important;
}

.preview-pane :deep(.markdown-body h1 > a),
.preview-pane :deep(.markdown-body h2 > a),
.preview-pane :deep(.markdown-body h3 > a),
.preview-pane :deep(.markdown-body h4 > a),
.preview-pane :deep(.markdown-body h5 > a),
.preview-pane :deep(.markdown-body h6 > a) {
  text-decoration: none !important;
  border-bottom: none !important;
}

.preview-pane :deep(.markdown-body h1 > a:hover),
.preview-pane :deep(.markdown-body h2 > a:hover),
.preview-pane :deep(.markdown-body h3 > a:hover),
.preview-pane :deep(.markdown-body h4 > a:hover),
.preview-pane :deep(.markdown-body h5 > a:hover),
.preview-pane :deep(.markdown-body h6 > a:hover),
.preview-pane :deep(.markdown-body h1 > a:focus),
.preview-pane :deep(.markdown-body h2 > a:focus),
.preview-pane :deep(.markdown-body h3 > a:focus),
.preview-pane :deep(.markdown-body h4 > a:focus),
.preview-pane :deep(.markdown-body h5 > a:focus),
.preview-pane :deep(.markdown-body h6 > a:focus) {
  text-decoration: none !important;
  border-bottom: none !important;
}

.preview-pane.reading-theme-white {
  background: #ffffff;
}

.preview-pane.reading-theme-paper {
  background: #f6f1e3;
}

.preview-pane.reading-theme-dark {
  background: #0f1115;
  color: #e7ecf3;
}

@media (max-width: 1100px) {
  .reading-layout.with-toc {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .preview-pane {
    padding: 10px;
    border-radius: 6px;
  }

  .preview-pane.mode-reading {
    padding: 16px 14px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .preview-pane.mode-reading {
    padding: 20px clamp(20px, 5vw, 48px);
  }
}
</style>
