<script setup lang="ts">
defineProps<{
  title: string
  ariaLabel: string
  icon: string
  active?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="icon-btn"
    :title="title"
    :aria-label="ariaLabel"
    :class="{ active }"
    :disabled="disabled"
    @click="emit('click')"
  >
    <span class="material-symbols-outlined notranslate" translate="no">{{ icon }}</span>
  </button>
</template>

<style scoped>
.icon-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: 6px;
  padding: 0;
}

.icon-btn .material-symbols-outlined {
  font-size: 20px;
  line-height: 1;
}

.icon-btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
