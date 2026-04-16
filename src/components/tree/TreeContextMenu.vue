<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  x: number
  y: number
  items: { label: string; action: string; danger?: boolean }[]
}>()

const emit = defineEmits<{
  action: [action: string]
  close: []
}>()

const menuRef = ref<HTMLElement>()

function onClick(action: string) {
  emit('action', action)
  emit('close')
}

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside, true)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="menuRef"
    class="context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <button
      v-for="item in items"
      :key="item.action"
      :class="['menu-item', { danger: item.danger }]"
      @click="onClick(item.action)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  font-size: 13px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text);
  cursor: pointer;
}

.menu-item:hover {
  background: var(--color-bg-hover, #f0f0f0);
}

.menu-item.danger {
  color: var(--color-danger);
}
</style>
