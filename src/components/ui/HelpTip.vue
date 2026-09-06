<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({})
const popupId = `help-tip-${Math.random().toString(36).slice(2, 9)}`

function updatePopupPosition() {
  const trigger = rootRef.value
  const popup = popupRef.value
  if (!trigger || !popup) return
  const rect = trigger.getBoundingClientRect()
  const gap = 6
  const width = Math.min(22 * 16, window.innerWidth - 16)
  let left = props.align === 'right' ? rect.right - width : rect.left
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
  let top = rect.bottom + gap
  const spaceBelow = window.innerHeight - rect.bottom - gap
  const spaceAbove = rect.top - gap
  const height = popup.offsetHeight || 160
  if (spaceBelow < height && spaceAbove > spaceBelow) {
    top = Math.max(8, rect.top - gap - height)
  }
  popupStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    zIndex: '200',
  }
}

function bindPositionListeners() {
  window.addEventListener('scroll', updatePopupPosition, true)
  window.addEventListener('resize', updatePopupPosition)
}

function unbindPositionListeners() {
  window.removeEventListener('scroll', updatePopupPosition, true)
  window.removeEventListener('resize', updatePopupPosition)
}

function toggle(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocumentPointer(event: Event) {
  if (!open.value) return
  const target = event.target as Node | null
  if (!target) return
  if (rootRef.value?.contains(target)) return
  if (popupRef.value?.contains(target)) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
  }
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    updatePopupPosition()
    bindPositionListeners()
  } else {
    unbindPositionListeners()
    popupStyle.value = {}
  }
})

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer, true)
  document.addEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer, true)
  document.removeEventListener('keydown', onKeydown, true)
  unbindPositionListeners()
})
</script>

<template>
  <span ref="rootRef" class="help-tip" @click.stop>
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
    <Teleport to="body">
      <div
        v-if="open"
        :id="popupId"
        ref="popupRef"
        class="help-tip-popup"
        role="dialog"
        :aria-label="label || t('common.help')"
        :style="popupStyle"
      >
        <div class="help-tip-content">
          <slot />
        </div>
        <button type="button" class="help-tip-close" @click="close">
          {{ t('common.close') }}
        </button>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.help-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  align-self: center;
  flex-shrink: 0;
  /* Не участвует в baseline-выравнивании соседнего текста */
  line-height: 0;
  vertical-align: middle;
}

.help-tip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  /* Масштаб от шрифта родителя (h1 / label / h2) */
  width: 1.15em;
  height: 1.15em;
  min-width: 1.15em;
  min-height: 1.15em;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-secondary, transparent);
  color: var(--color-text-muted);
  cursor: pointer;
}

.help-tip-trigger .material-symbols-outlined {
  font-size: 0.72em;
  line-height: 1;
  display: block;
  font-weight: 400;
}

.help-tip-trigger:hover,
.help-tip-trigger[aria-expanded='true'] {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg));
}
</style>

<style>
.help-tip-popup {
  box-sizing: border-box;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  box-shadow: var(--shadow, 0 8px 24px rgba(0, 0, 0, 0.12));
}

.help-tip-content {
  display: grid;
  gap: 0.55rem;
  color: var(--color-text);
  font-size: 0.875rem;
  line-height: 1.45;
}

.help-tip-content p {
  margin: 0;
}

.help-tip-content a {
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
