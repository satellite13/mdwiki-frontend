<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '@/stores/dialog'
import { deleteAnnotation } from '@/api/annotations'
import type { Annotation } from '@/types'

const props = defineProps<{
  annotations: Annotation[]
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  deleted: [id: string]
}>()

const { t } = useI18n()
const dialog = useDialogStore()

const sortedAnnotations = computed(() =>
  [...props.annotations].sort((a, b) => (a.rangeStart ?? 0) - (b.rangeStart ?? 0))
)

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

async function onDelete(annotation: Annotation) {
  const confirmed = await dialog.confirm(
    t('annotations.deleteConfirm', { text: annotation.highlightedText.substring(0, 80) }),
    { danger: true }
  )
  if (confirmed) {
    await deleteAnnotation(annotation.id)
    emit('deleted', annotation.id)
  }
}
</script>

<template>
  <div v-if="visible" class="annotation-panel">
    <div class="annotation-panel-header">
      <h3>{{ t('annotations.panel', { count: annotations.length }) }}</h3>
      <button
        type="button"
        class="annotation-panel-close"
        :title="t('annotations.closePanel')"
        :aria-label="t('annotations.closePanel')"
        @click="emit('update:visible', false)"
      >
        <span class="material-symbols-outlined notranslate" translate="no">close</span>
      </button>
    </div>
    <div class="annotation-panel-body">
      <div v-if="annotations.length === 0" class="annotation-empty">
        {{ t('annotations.empty') }}
      </div>
      <div
        v-for="a in sortedAnnotations"
        :key="a.id"
        class="annotation-item"
        :style="{ borderLeftColor: a.color || '#ffeb3b' }"
      >
        <div class="annotation-item-text">
          <q>{{ a.highlightedText }}</q>
        </div>
        <div v-if="a.comment" class="annotation-item-comment">{{ a.comment }}</div>
        <div class="annotation-item-meta">
          <span class="annotation-item-author">{{ a.createdBy }}</span>
          <span class="annotation-item-date">{{ formatDate(a.createdAt) }}</span>
        </div>
        <button
          type="button"
          class="annotation-item-delete"
          :title="t('annotations.delete')"
          :aria-label="t('annotations.delete')"
          @click="onDelete(a)"
        >
          <span class="material-symbols-outlined notranslate" translate="no">delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.annotation-panel {
  width: 320px;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.annotation-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.annotation-panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.annotation-panel-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
}

.annotation-panel-close:hover {
  background: var(--color-bg-hover);
}

.annotation-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.annotation-empty {
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
}

.annotation-item {
  position: relative;
  padding: 10px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--color-border);
  border-left-width: 4px;
  border-radius: 6px;
  background: var(--color-bg);
}

.annotation-item-text q {
  font-style: italic;
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.5;
}

.annotation-item-comment {
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--color-bg-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.annotation-item-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-faint);
}

.annotation-item-author {
  font-weight: 500;
}

.annotation-item-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-faint);
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
}

.annotation-item-delete:hover {
  color: #e53e3e;
  background: color-mix(in srgb, #e53e3e 10%, transparent);
}

.annotation-item-delete .material-symbols-outlined {
  font-size: 16px;
  line-height: 1;
}

@media (max-width: 768px) {
  .annotation-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-height: 50vh;
    border-left: none;
    border-top: 1px solid var(--color-border);
    border-radius: 12px 12px 0 0;
    z-index: 1000;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  }
}
</style>
