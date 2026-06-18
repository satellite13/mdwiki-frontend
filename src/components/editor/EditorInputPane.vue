<script setup lang="ts">
import { ref } from 'vue'
import EditorFindBar from '@/components/editor/EditorFindBar.vue'

type WikilinkItem = {
  title: string
  slug: string
}

defineProps<{
  modelValue: string
  wikilinkOpen: boolean
  wikilinkItems: WikilinkItem[]
  wikilinkSelected: number
  wikilinkMenuStyle?: Record<string, string | number>
  findOpen: boolean
  findQuery: string
  findStatusLabel: string
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
    <textarea
      ref="textareaEl"
      class="markdown-input"
      :value="modelValue"
      spellcheck="false"
      @input="emit('input', $event)"
      @keydown="emit('keydown', $event)"
      @click="emit('click', $event)"
      @keyup="emit('keyup', $event)"
      @scroll="emit('scroll', $event)"
      @blur="emit('blur', $event)"
    />
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

.markdown-input {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  padding: 14px;
  overflow: auto;
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
