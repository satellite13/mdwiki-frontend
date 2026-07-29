<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{
  open: boolean
  query: string
  statusLabel: string
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  next: []
  prev: []
  close: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
)

function onInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    if (event.shiftKey) emit('prev')
    else emit('next')
  }
}
</script>

<template>
  <div v-if="open" class="editor-find-bar" role="search" :aria-label="t('editor.findTitle')">
    <span class="material-symbols-outlined notranslate find-icon" translate="no">search</span>
    <input
      ref="inputRef"
      class="find-input"
      type="search"
      :value="query"
      :placeholder="t('editor.findPlaceholder')"
      autocomplete="off"
      spellcheck="false"
      @input="onInput"
      @keydown="onKeydown"
    />
    <span class="find-status" :class="{ empty: statusLabel === 'no-results' }">
      {{ statusLabel === 'no-results' ? t('editor.findNoResults') : statusLabel }}
    </span>
    <button type="button" class="find-btn" :title="t('editor.findPrev')" :aria-label="t('editor.findPrev')" @click="emit('prev')">
      <span class="material-symbols-outlined notranslate" translate="no">keyboard_arrow_up</span>
    </button>
    <button type="button" class="find-btn" :title="t('editor.findNext')" :aria-label="t('editor.findNext')" @click="emit('next')">
      <span class="material-symbols-outlined notranslate" translate="no">keyboard_arrow_down</span>
    </button>
    <button type="button" class="find-btn" :title="t('editor.findClose')" :aria-label="t('editor.findClose')" @click="emit('close')">
      <span class="material-symbols-outlined notranslate" translate="no">close</span>
    </button>
  </div>
</template>

<style scoped>
.editor-find-bar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  box-shadow: var(--shadow);
  max-width: min(420px, calc(100% - 20px));
}

.find-icon {
  font-size: 18px;
  color: var(--color-text-muted);
}

.find-input {
  flex: 1 1 140px;
  min-width: 100px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
}

.find-input::-webkit-search-cancel-button {
  display: none;
}

.find-status {
  flex: 0 0 auto;
  min-width: 3.5rem;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.find-status.empty {
  min-width: auto;
  color: var(--color-warning, #d97706);
}

.find-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.find-btn:hover {
  background: var(--color-bg-hover);
}
</style>
