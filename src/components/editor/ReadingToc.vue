<script setup lang="ts">
import type { TocItem } from './tocTypes'

const props = defineProps<{
  items: TocItem[]
  dark?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

function onSelect(id: string) {
  emit('select', id)
}
</script>

<template>
  <aside class="reading-toc" :class="{ dark: props.dark }">
    <div class="reading-toc-title">Оглавление</div>
    <button
      v-for="item in props.items"
      :key="item.id"
      type="button"
      class="reading-toc-item"
      :style="{ paddingLeft: `${Math.max(0, item.level - 1) * 10 + 8}px` }"
      @click="onSelect(item.id)"
    >
      {{ item.text }}
    </button>
  </aside>
</template>

<style scoped>
.reading-toc {
  position: sticky;
  top: 12px;
  align-self: start;
  max-height: calc(100vh - 110px);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-bg) 92%, transparent);
  padding: 8px;
}

.reading-toc.dark {
  background: #171b22;
  border-color: #2b3442;
}

.reading-toc-title {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 2px 6px 8px;
}

.reading-toc.dark .reading-toc-title {
  color: #9ca8bb;
}

.reading-toc-item {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  font-size: 12px;
  line-height: 1.3;
  border-radius: 6px;
  padding: 5px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reading-toc.dark .reading-toc-item {
  color: #e7ecf3;
}

.reading-toc-item:hover {
  background: var(--color-bg-hover);
}

@media (max-width: 1100px) {
  .reading-toc {
    position: static;
    max-height: 220px;
    margin-top: 8px;
  }
}
</style>
