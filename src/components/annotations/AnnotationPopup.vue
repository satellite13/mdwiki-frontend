<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { createAnnotation } from '@/api/annotations'
import { getApiErrorMessage } from '@/utils/apiError'
import type { Annotation } from '@/types'

const props = defineProps<{
  selectedText: string
  anchorContext: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  created: [annotation: Annotation]
}>()

const comment = ref('')
const color = ref('#ffeb3b')
const saving = ref(false)
const error = ref('')

const COLOR_OPTIONS = [
  { value: '#ffeb3b', label: 'Yellow' },
  { value: '#a5d6a7', label: 'Green' },
  { value: '#ef9a9a', label: 'Red' },
  { value: '#90caf9', label: 'Blue' },
  { value: '#ce93d8', label: 'Purple' }
]

async function save() {
  saving.value = true
  error.value = ''
  try {
    const pageSlug = getPageSlugFromUrl()
    if (!pageSlug) {
      error.value = 'Could not determine page slug'
      return
    }
    const res = await createAnnotation(pageSlug, {
      highlightedText: props.selectedText,
      anchorContext: props.anchorContext,
      comment: comment.value || null,
      color: color.value,
      rangeStart: null,
      rangeEnd: null
    })
    emit('created', res.data)
    emit('close')
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Failed to create annotation')
  } finally {
    saving.value = false
  }
}

function getPageSlugFromUrl(): string | null {
  const path = window.location.pathname
  const match = path.match(/^\/page\/(.+)/)
  return match ? match[1] : null
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    class="annotation-popup"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop
  >
    <div class="popup-header">
      <span class="popup-title">Add annotation</span>
      <button type="button" class="popup-close" aria-label="Close" @click="emit('close')">
        <span class="material-symbols-outlined notranslate" translate="no">close</span>
      </button>
    </div>
    <div class="popup-body">
      <div class="popup-quote">
        <q>{{ selectedText }}</q>
      </div>
      <textarea
        v-model="comment"
        class="popup-comment"
        placeholder="Add a comment..."
        rows="3"
        autofocus
      />
      <div class="popup-colors">
        <button
          v-for="c in COLOR_OPTIONS"
          :key="c.value"
          type="button"
          class="color-swatch"
          :class="{ active: color === c.value }"
          :style="{ background: c.value }"
          :title="c.label"
          :aria-label="c.label"
          @click="color = c.value"
        />
      </div>
      <div v-if="error" class="popup-error">{{ error }}</div>
    </div>
    <div class="popup-footer">
      <button type="button" class="btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="btn-primary" :disabled="saving" @click="save">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.annotation-popup {
  position: fixed;
  z-index: 1000;
  width: 340px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  font-size: 13px;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}

.popup-title {
  font-weight: 600;
  font-size: 13px;
}

.popup-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
}

.popup-close .material-symbols-outlined {
  font-size: 16px;
  line-height: 1;
}

.popup-body {
  padding: 12px 14px;
}

.popup-quote {
  padding: 8px 10px;
  background: var(--color-bg-hover);
  border-left: 3px solid var(--color-primary);
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.5;
  max-height: 80px;
  overflow-y: auto;
}

.popup-quote q {
  font-style: italic;
}

.popup-comment {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
  box-sizing: border-box;
}

.popup-comment:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.popup-colors {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  transition: transform 0.15s;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.active {
  border-color: var(--color-text);
  transform: scale(1.15);
}

.popup-error {
  margin-top: 8px;
  color: #e53e3e;
  font-size: 12px;
}

.popup-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
}

.btn-primary,
.btn-secondary {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-bg-hover);
}

@media (max-width: 768px) {
  .annotation-popup {
    position: fixed;
    left: 16px !important;
    right: 16px;
    top: auto !important;
    bottom: 16px;
    width: auto;
  }
}
</style>
