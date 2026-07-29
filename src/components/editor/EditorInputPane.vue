<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import EditorFindBar from '@/components/editor/EditorFindBar.vue'
import { buildFindHighlightHtml } from '@/utils/editorFind'

type WikilinkItem = {
  title: string
  slug: string
}

const props = defineProps<{
  modelValue: string
  wikilinkOpen: boolean
  wikilinkItems: WikilinkItem[]
  wikilinkSelected: number
  wikilinkMenuStyle?: Record<string, string | number>
  findOpen: boolean
  findQuery: string
  findStatusLabel: string
  findMatchIndices: number[]
  findActiveIndex: number
}>()

const emit = defineEmits<{
  input: [event: Event]
  keydown: [event: KeyboardEvent]
  click: [event: MouseEvent]
  keyup: [event: KeyboardEvent]
  scroll: [event: Event]
  blur: [event: FocusEvent]
  selectWikilink: [index: number]
  'update:findQuery': [value: string]
  findNext: []
  findPrev: []
  findClose: []
}>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)
const highlightEl = ref<HTMLElement | null>(null)

const findNeedle = computed(() => props.findQuery.trim())
const showFindHighlight = computed(
  () => props.findOpen && findNeedle.value.length > 0 && props.findMatchIndices.length > 0
)

const findHighlightHtml = computed(() => {
  if (!showFindHighlight.value) return ''
  return buildFindHighlightHtml(
    props.modelValue,
    props.findMatchIndices,
    findNeedle.value.length,
    props.findActiveIndex
  )
})

function syncHighlightScroll() {
  const source = textareaEl.value
  const target = highlightEl.value
  if (!source || !target) return
  target.scrollTop = source.scrollTop
  target.scrollLeft = source.scrollLeft
}

function onScroll(event: Event) {
  syncHighlightScroll()
  emit('scroll', event)
}

watch(
  [showFindHighlight, findHighlightHtml, () => props.findActiveIndex],
  async () => {
    await nextTick()
    syncHighlightScroll()
  }
)

defineExpose({
  textareaEl
})
</script>

<template>
  <div class="editor-pane">
    <EditorFindBar
      :open="findOpen"
      :query="findQuery"
      :status-label="findStatusLabel"
      @update:query="emit('update:findQuery', $event)"
      @next="emit('findNext')"
      @prev="emit('findPrev')"
      @close="emit('findClose')"
    />
    <div class="editor-input-stack">
      <pre
        v-if="showFindHighlight"
        ref="highlightEl"
        class="find-highlight-layer"
        aria-hidden="true"
        v-html="findHighlightHtml"
      />
      <textarea
        ref="textareaEl"
        class="markdown-input"
        :class="{ 'has-find-highlight': showFindHighlight }"
        :value="modelValue"
        spellcheck="false"
        @input="emit('input', $event)"
        @keydown="emit('keydown', $event)"
        @click="emit('click', $event)"
        @keyup="emit('keyup', $event)"
        @scroll="onScroll"
        @blur="emit('blur', $event)"
      />
    </div>
    <Teleport to="body">
      <div v-if="wikilinkOpen" class="wikilink-suggestions" :style="wikilinkMenuStyle">
        <button
          v-for="(item, idx) in wikilinkItems"
          :key="item.slug"
          type="button"
          class="wikilink-suggestion-item"
          :class="{ active: idx === wikilinkSelected }"
          @mousedown.prevent="emit('selectWikilink', idx)"
        >
          <span>{{ item.title }}</span>
          <small>{{ item.slug }}</small>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.editor-pane {
  min-height: 0;
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  overflow: hidden;
  position: relative;
}

.editor-input-stack {
  position: relative;
  height: 100%;
  min-height: 0;
}

.find-highlight-layer,
.markdown-input {
  width: 100%;
  height: 100%;
  margin: 0;
  border: none;
  border-radius: 0;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  padding: 14px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-wrap: break-word;
  tab-size: 4;
  box-sizing: border-box;
}

.find-highlight-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: auto;
  pointer-events: none;
  color: var(--color-text);
  background: var(--color-bg);
}

.markdown-input {
  position: relative;
  z-index: 1;
  resize: none;
  background: transparent;
  color: var(--color-text);
  overflow: auto;
}

.markdown-input.has-find-highlight {
  color: transparent;
  -webkit-text-fill-color: transparent;
  caret-color: var(--color-text);
  background: transparent;
}

.find-highlight-layer :deep(.find-match) {
  color: inherit;
  background: color-mix(in srgb, var(--color-primary, #0969da) 22%, transparent);
  border-radius: 2px;
}

.find-highlight-layer :deep(.find-match-active) {
  background: color-mix(in srgb, var(--color-warning, #d97706) 55%, transparent);
  outline: 1px solid color-mix(in srgb, var(--color-warning, #d97706) 80%, transparent);
}

.wikilink-suggestions {
  position: fixed;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  z-index: 200;
  max-height: 240px;
  overflow: auto;
  padding: 4px;
}

.wikilink-suggestion-item {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
}

.wikilink-suggestion-item small {
  color: var(--color-text-muted);
}

.wikilink-suggestion-item.active,
.wikilink-suggestion-item:hover {
  background: var(--color-bg-hover);
}
</style>
