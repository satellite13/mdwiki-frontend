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
        :dark="props.readingTheme === 'dark'"
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
</style>
