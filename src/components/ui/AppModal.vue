<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Переводится в aria-label на диалоге (prop не может называться aria-label — конфликт с DOM-атрибутом).
defineProps<{ label: string }>()
const emit = defineEmits<{ close: [] }>()

const modalRef = ref<HTMLElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  const focusable = modalRef.value?.querySelector<HTMLElement>('input, textarea, select, button')
  focusable?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app-modal-overlay" @click.self="emit('close')">
    <div ref="modalRef" class="app-modal" role="dialog" aria-modal="true" :aria-label="label">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.app-modal {
  width: min(520px, 100%);
  background: var(--color-surface, #fff);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: var(--shadow, 0 8px 30px rgba(0, 0, 0, 0.12));
}
</style>
