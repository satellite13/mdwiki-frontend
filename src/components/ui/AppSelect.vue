<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { i18n } from '@/i18n'

export type AppSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  options: AppSelectOption[]
  modelValue: string | string[] | null
  multiple?: boolean
  searchable?: boolean
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  ariaLabel?: string
}>(), {
  multiple: false,
  searchable: false,
  disabled: false,
  clearable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | null]
  change: [value: string | string[] | null]
}>()

const rootRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const open = ref(false)
const searchQuery = ref('')
const activeIndex = ref(-1)
const listId = `app-select-list-${Math.random().toString(36).slice(2, 9)}`
/** Optimistic multi selection until parent syncs modelValue. */
const localMulti = ref<string[]>([])

const t = (key: string, values?: Record<string, unknown>) =>
  i18n.global.t(key, values as Record<string, unknown>)

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((opt) => opt.label.toLowerCase().includes(q))
})

const selectedValues = computed(() => {
  if (props.multiple) return localMulti.value
  if (props.modelValue == null) return []
  return [String(props.modelValue)]
})

watch(
  () => props.modelValue,
  (value) => {
    if (props.multiple) {
      localMulti.value = Array.isArray(value) ? [...value] : []
    }
  },
  { immediate: true, deep: true },
)

const hasSelection = computed(() => {
  if (props.multiple) return selectedValues.value.length > 0
  return props.modelValue != null && props.modelValue !== ''
})

const displayLabel = computed(() => {
  if (props.multiple) {
    const values = selectedValues.value
    if (values.length === 0) return props.placeholder || ''
    const labels = values
      .map((v) => props.options.find((o) => o.value === v)?.label)
      .filter((label): label is string => Boolean(label))
    if (labels.length === 0) return t('common.selectedCount', { n: values.length })
    if (labels.length <= 2) return labels.join(', ')
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  }
  if (props.modelValue == null || props.modelValue === '') {
    const emptyOpt = props.options.find((o) => o.value === props.modelValue)
    if (props.modelValue === '' && emptyOpt) return emptyOpt.label
    return props.placeholder || ''
  }
  return props.options.find((o) => o.value === props.modelValue)?.label
    ?? String(props.modelValue)
})

const showPlaceholder = computed(() => {
  if (props.multiple) return selectedValues.value.length === 0
  if (props.modelValue == null) return true
  if (props.modelValue === '') {
    return !props.options.some((o) => o.value === '')
  }
  return false
})

function optionTestId(value: string) {
  return value === '' ? 'app-select-option-empty' : `app-select-option-${value}`
}

function isSelected(value: string) {
  return selectedValues.value.includes(value)
}

function emitValue(value: string | string[] | null) {
  emit('update:modelValue', value)
  emit('change', value)
}

function close() {
  open.value = false
  searchQuery.value = ''
  activeIndex.value = -1
}

function openList() {
  if (props.disabled || open.value) return
  open.value = true
  activeIndex.value = filteredOptions.value.findIndex((o) => !o.disabled)
  nextTick(() => {
    if (props.searchable) searchRef.value?.focus()
    else listRef.value?.focus()
  })
}

function toggleOpen() {
  if (props.disabled) return
  if (open.value) close()
  else openList()
}

function selectOption(option: AppSelectOption) {
  if (option.disabled) return

  if (props.multiple) {
    const current = [...localMulti.value]
    const idx = current.indexOf(option.value)
    if (idx >= 0) current.splice(idx, 1)
    else current.push(option.value)
    localMulti.value = current
    emitValue(current)
    return
  }

  emitValue(option.value)
  close()
}

function clearSelection(event: Event) {
  event.stopPropagation()
  event.preventDefault()
  if (props.disabled) return
  if (props.multiple) {
    localMulti.value = []
    emitValue([])
  } else {
    emitValue(null)
  }
}

function moveActive(delta: number) {
  const opts = filteredOptions.value
  if (opts.length === 0) return
  let next = activeIndex.value
  for (let i = 0; i < opts.length; i++) {
    next = (next + delta + opts.length) % opts.length
    if (!opts[next]?.disabled) {
      activeIndex.value = next
      return
    }
  }
}

function jumpActive(toEnd: boolean) {
  const opts = filteredOptions.value
  if (opts.length === 0) return
  if (toEnd) {
    for (let i = opts.length - 1; i >= 0; i--) {
      if (!opts[i]?.disabled) {
        activeIndex.value = i
        return
      }
    }
  } else {
    for (let i = 0; i < opts.length; i++) {
      if (!opts[i]?.disabled) {
        activeIndex.value = i
        return
      }
    }
  }
}

function activateCurrent() {
  const option = filteredOptions.value[activeIndex.value]
  if (option) selectOption(option)
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!open.value) {
        openList()
        if (event.key === 'ArrowUp') jumpActive(true)
      } else if (event.key === 'Enter' || event.key === ' ') {
        activateCurrent()
      } else if (event.key === 'ArrowDown') {
        moveActive(1)
      } else {
        moveActive(-1)
      }
      break
    case 'Escape':
      if (open.value) {
        event.preventDefault()
        close()
      }
      break
    case 'Tab':
      if (open.value) close()
      break
  }
}

function onListKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveActive(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      moveActive(-1)
      break
    case 'Home':
      event.preventDefault()
      jumpActive(false)
      break
    case 'End':
      event.preventDefault()
      jumpActive(true)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      activateCurrent()
      break
    case 'Escape':
      event.preventDefault()
      close()
      break
    case 'Tab':
      close()
      break
  }
}

function onSearchKeydown(event: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape'].includes(event.key)) {
    onListKeydown(event)
  } else if (event.key === 'Tab') {
    close()
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node | null
  if (!target || !rootRef.value) return
  if (!rootRef.value.contains(target)) close()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
  }
}

watch(filteredOptions, (opts) => {
  if (!open.value) return
  if (activeIndex.value >= opts.length) {
    activeIndex.value = opts.findIndex((o) => !o.disabled)
  } else if (activeIndex.value < 0) {
    activeIndex.value = opts.findIndex((o) => !o.disabled)
  } else if (opts[activeIndex.value]?.disabled) {
    activeIndex.value = opts.findIndex((o) => !o.disabled)
  }
})

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div ref="rootRef" class="app-select" :class="{ open, disabled }">
    <div
      class="app-select-trigger"
      data-testid="app-select-trigger"
      role="combobox"
      tabindex="0"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      :aria-label="ariaLabel"
      :aria-disabled="disabled || undefined"
      @click="toggleOpen"
      @keydown="onTriggerKeydown"
    >
      <span class="app-select-value" :class="{ placeholder: showPlaceholder }">
        {{ displayLabel }}
      </span>
      <span class="app-select-actions">
        <button
          v-if="clearable && hasSelection && !disabled"
          type="button"
          class="app-select-clear"
          :aria-label="t('common.clearSelection')"
          @click="clearSelection"
        >
          <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">close</span>
        </button>
        <span class="app-select-chevron material-symbols-outlined notranslate" translate="no" aria-hidden="true">
          expand_more
        </span>
      </span>
    </div>

    <div
      v-if="open"
      :id="listId"
      ref="listRef"
      class="app-select-popover"
      data-testid="app-select-list"
      role="listbox"
      :aria-multiselectable="multiple || undefined"
      tabindex="-1"
      @keydown="onListKeydown"
    >
      <div v-if="searchable" class="app-select-search-wrap">
        <input
          ref="searchRef"
          type="text"
          class="app-select-search"
          data-testid="app-select-search"
          :placeholder="t('common.search')"
          :value="searchQuery"
          @input="searchQuery = ($event.target as HTMLInputElement).value"
          @keydown="onSearchKeydown"
          @click.stop
        >
      </div>

      <ul class="app-select-options" role="presentation">
        <li
          v-for="(option, index) in filteredOptions"
          :key="`${option.value}::${index}`"
          role="option"
          class="app-select-option"
          :class="{
            active: index === activeIndex,
            selected: isSelected(option.value),
            disabled: option.disabled,
          }"
          :data-testid="optionTestId(option.value)"
          :aria-selected="isSelected(option.value)"
          :aria-disabled="option.disabled || undefined"
          @click.stop="selectOption(option)"
          @mouseenter="!option.disabled && (activeIndex = index)"
        >
          <span v-if="multiple" class="app-select-check" aria-hidden="true">
            {{ isSelected(option.value) ? '✓' : '' }}
          </span>
          {{ option.label }}
        </li>
      </ul>

      <div v-if="filteredOptions.length === 0" class="app-select-empty">
        {{ t('common.noMatchingOptions') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-select {
  position: relative;
  width: 100%;
  font-family: var(--font-body);
}

.app-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.app-select-trigger:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.12);
}

.app-select-trigger:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.12);
}

.app-select.disabled .app-select-trigger {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-value.placeholder {
  color: var(--color-text-faint, #94a3b8);
}

.app-select-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.app-select-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-faint, #94a3b8);
  cursor: pointer;
  border-radius: var(--radius);
}

.app-select-clear:hover {
  color: var(--color-text);
}

.app-select-clear .material-symbols-outlined,
.app-select-chevron {
  font-size: 20px;
  line-height: 1;
}

.app-select.open .app-select-chevron {
  transform: rotate(180deg);
}

.app-select-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 40;
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.app-select-search-wrap {
  position: sticky;
  top: 0;
  padding: 8px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  z-index: 1;
}

.app-select-search {
  width: 100%;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
  font-family: var(--font-body);
}

.app-select-search:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.12);
}

.app-select-options {
  list-style: none;
  margin: 0;
  padding: 4px;
}

.app-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  color: var(--color-text);
  font-size: 14px;
}

.app-select-option:hover,
.app-select-option.active {
  background: rgba(13, 148, 136, 0.08);
}

.app-select-option.selected {
  font-weight: 600;
}

.app-select-option.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.app-select-check {
  width: 1em;
  flex-shrink: 0;
  color: var(--color-primary);
}

.app-select-empty {
  padding: 12px 10px;
  color: var(--color-text-faint, #94a3b8);
  font-size: 13px;
  text-align: center;
}
</style>
