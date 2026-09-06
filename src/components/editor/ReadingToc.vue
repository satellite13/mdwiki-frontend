<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TocItem } from './tocTypes'

const { t } = useI18n()

const props = defineProps<{
  items: TocItem[]
  theme: 'white' | 'paper' | 'dark'
  variant?: 'sidebar' | 'sheet'
}>()

const emit = defineEmits<{
  select: [id: string]
  copy: [item: TocItem]
  close: []
}>()

function onSelect(id: string) {
  emit('select', id)
}
</script>

<template>
  <component
    :is="props.variant === 'sheet' ? 'div' : 'aside'"
    class="reading-toc"
    :class="`reading-toc--${props.theme}`"
  >
    <div class="reading-toc-title-row">
      <div class="reading-toc-title">{{ t('reading.toc') }}</div>
      <button
        v-if="props.variant === 'sheet'"
        type="button"
        class="reading-toc-close"
        :title="t('reading.closeToc')"
        :aria-label="t('reading.closeToc')"
        @click="emit('close')"
      >
        <span class="material-symbols-outlined notranslate" translate="no">close</span>
      </button>
    </div>
    <div
      v-for="item in props.items"
      :key="item.id"
      class="reading-toc-item"
      :style="{ paddingLeft: `${Math.max(0, item.level - 1) * 10 + 8}px` }"
    >
      <button type="button" class="reading-toc-select" @click="onSelect(item.id)">{{ item.text }}</button>
      <button type="button" class="reading-toc-copy" :aria-label="t('editor.copyAnchor')" @click="emit('copy', item)">
        <span class="material-symbols-outlined notranslate" translate="no">content_copy</span>
      </button>
    </div>
  </component>
</template>

<style scoped>
.reading-toc {
  position: sticky;
  top: 12px;
  align-self: start;
  max-height: calc(100vh - 110px);
  overflow: auto;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffffeb;
  padding: 8px;
}

.reading-toc--white {
  background: #ffffffeb;
  border-color: #d0d7de;
}

.reading-toc--paper {
  background: #f4eddccc;
  border-color: #d8cab1;
}

.reading-toc--dark {
  background: #171b22;
  border-color: #2b3442;
}

.reading-toc-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 6px 8px;
}

.reading-toc-title {
  font-size: 12px;
  color: #66768b;
}

.reading-toc--paper .reading-toc-title {
  color: #6d634e;
}

.reading-toc--dark .reading-toc-title {
  color: #9ca8bb;
}

.reading-toc-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #66768b;
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
  flex-shrink: 0;
}

.reading-toc-close:hover {
  background: #eef2f7;
}

.reading-toc--paper .reading-toc-close {
  color: #6d634e;
}

.reading-toc--paper .reading-toc-close:hover {
  background: #ebe2ce;
}

.reading-toc--dark .reading-toc-close {
  color: #9ca8bb;
}

.reading-toc--dark .reading-toc-close:hover {
  background: #202733;
}

.reading-toc-item {
  width: 100%;
  display:flex;align-items:center;background:transparent;
  color: #1f2937;
  text-align: left;
  font-size: 12px;
  line-height: 1.3;
  border-radius: 6px;
  padding: 5px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reading-toc-select{min-width:0;flex:1;border:0;background:transparent;color:inherit;text-align:left;overflow:hidden;text-overflow:ellipsis}.reading-toc-copy{width:28px;min-width:28px;height:28px;padding:0;border:0;background:transparent;color:inherit}.reading-toc-copy .material-symbols-outlined{font-size:16px}

.reading-toc--paper .reading-toc-item {
  color: #3f3a2d;
}

.reading-toc--dark .reading-toc-item {
  color: #e7ecf3;
}

.reading-toc-item:hover {
  background: #eef2f7;
}

.reading-toc--paper .reading-toc-item:hover {
  background: #ebe2ce;
}

.reading-toc--dark .reading-toc-item:hover {
  background: #202733;
}
</style>
