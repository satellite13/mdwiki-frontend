<script setup lang="ts">
defineProps<{
  dragging: boolean
  ariaLabel: string
}>()

const emit = defineEmits<{
  mousedown: [event: MouseEvent]
  dblclick: []
}>()
</script>

<template>
  <div
    class="vertical-pane-resizer"
    :class="{ dragging }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="ariaLabel"
    @mousedown="emit('mousedown', $event)"
    @dblclick="emit('dblclick')"
  />
</template>

<style scoped>
.vertical-pane-resizer {
  width: 8px;
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.vertical-pane-resizer::before {
  content: '';
  width: 4px;
  height: 56px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 85%, transparent);
  transition: background 0.12s ease, transform 0.12s ease;
}

.vertical-pane-resizer:hover::before,
.vertical-pane-resizer.dragging::before {
  background: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  transform: scaleX(1.15);
}
</style>
