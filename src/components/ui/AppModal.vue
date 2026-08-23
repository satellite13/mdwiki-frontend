<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Переводится в aria-label на диалоге (prop не может называться aria-label — конфликт с DOM-атрибутом).
const props = withDefaults(defineProps<{ label: string; wide?: boolean; closeDisabled?: boolean }>(), {
  wide: false,
  closeDisabled: false
})
const emit = defineEmits<{ close: [] }>()

const modalRef = ref<HTMLElement | null>(null)

function requestClose() {
  if (!props.closeDisabled) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') requestClose()
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
  <div class="app-modal-overlay" @click.self="requestClose">
    <div
      ref="modalRef"
      :class="['app-modal', { wide }]"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(36, 41, 47, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.app-modal {
  width: min(520px, 100%);
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 12px 40px rgba(36, 41, 47, 0.15);
}

.app-modal.wide {
  width: min(640px, 100%);
  max-height: 85vh;
  overflow: auto;
}
</style>
