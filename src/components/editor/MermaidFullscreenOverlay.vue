<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ svgHtml: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const overlayRef = ref<HTMLElement | null>(null)
let previousOverflow = ''

function close() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  close()
}

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown, true)
  overlayRef.value?.querySelector<HTMLButtonElement>('button')?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <div
    ref="overlayRef"
    class="mermaid-fs-overlay"
    @click.self="close"
  >
    <div
      class="mermaid-fs-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="t('editor.mermaidFullscreen')"
    >
      <button
        type="button"
        class="mermaid-fs-close"
        :aria-label="t('common.close')"
        :title="t('common.close')"
        @click="close"
      >
        <span class="material-symbols-outlined notranslate" translate="no">close</span>
      </button>
      <div class="mermaid-fs-stage" @click.self="close" v-html="props.svgHtml" />
    </div>
  </div>
</template>

<style scoped>
.mermaid-fs-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  background: color-mix(in srgb, var(--color-bg) 18%, rgba(15, 17, 21, 0.78));
  padding: 1rem;
}

.mermaid-fs-dialog {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mermaid-fs-close {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}

.mermaid-fs-close:hover {
  background: var(--color-bg-hover);
}

.mermaid-fs-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3.5rem 1.25rem 1.25rem;
}

.mermaid-fs-stage :deep(svg) {
  display: block;
  max-width: none;
  height: auto;
  margin: auto;
  background: var(--color-bg);
  border-radius: 8px;
  padding: 1rem;
}
</style>
