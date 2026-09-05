<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  label?: string
  align?: 'left' | 'right'
}>(), {
  align: 'left'
})

const { t } = useI18n()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const popupId = `help-tip-${Math.random().toString(36).slice(2, 9)}`

function toggle(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocumentPointer(event: Event) {
  if (!open.value || !rootRef.value) return
  const target = event.target as Node | null
  if (target && rootRef.value.contains(target)) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer, true)
  document.addEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer, true)
  document.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <span ref="rootRef" class="help-tip" :class="[`align-${align}`]" @click.stop>
    <button
      type="button"
      class="help-tip-trigger"
      :aria-expanded="open"
      :aria-controls="open ? popupId : undefined"
      :aria-label="label || t('common.help')"
      :title="label || t('common.help')"
      @click="toggle"
    >
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">help</span>
    </button>
    <div
      v-if="open"
      :id="popupId"
      class="help-tip-popup"
      role="dialog"
      :aria-label="label || t('common.help')"
    >
      <div class="help-tip-content">
        <slot />
      </div>
      <button type="button" class="help-tip-close" @click="close">
        {{ t('common.close') }}
      </button>
    </div>
  </span>
</template>

<style scoped>
.help-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.help-tip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-secondary, transparent);
  color: var(--color-text-muted);
  cursor: pointer;
}

.help-tip-trigger .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}

.help-tip-trigger:hover,
.help-tip-trigger[aria-expanded='true'] {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg));
}

.help-tip-popup {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 40;
  width: min(22rem, calc(100vw - 2rem));
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  box-shadow: var(--shadow, 0 8px 24px rgba(0, 0, 0, 0.12));
}

.align-left .help-tip-popup {
  left: 0;
}

.align-right .help-tip-popup {
  right: 0;
}

.help-tip-content {
  display: grid;
  gap: 0.55rem;
  color: var(--color-text);
  font-size: 0.875rem;
  line-height: 1.45;
}

.help-tip-content :deep(p) {
  margin: 0;
}

.help-tip-content :deep(a) {
  color: var(--color-primary);
}

.help-tip-close {
  margin-top: 0.7rem;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
}

.help-tip-close:hover {
  color: var(--color-text);
  text-decoration: underline;
}
</style>
