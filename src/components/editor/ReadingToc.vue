<script setup lang="ts">
import type { TocItem } from './tocTypes'

const props = defineProps<{
  items: TocItem[]
  theme: 'white' | 'paper' | 'dark'
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

function onSelect(id: string) {
  emit('select', id)
}
</script>

<template>
  <aside class="reading-toc" :class="`reading-toc--${props.theme}`">
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

.reading-toc-title {
  font-size: 12px;
  color: #66768b;
  margin: 2px 6px 8px;
}

.reading-toc--paper .reading-toc-title {
  color: #6d634e;
}

.reading-toc--dark .reading-toc-title {
  color: #9ca8bb;
}

.reading-toc-item {
  width: 100%;
  border: none;
  background: transparent;
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

@media (max-width: 1100px) {
  .reading-toc {
    position: static;
    max-height: 220px;
    margin-top: 8px;
  }
}
</style>
