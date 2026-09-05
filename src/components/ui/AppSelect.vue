<script setup lang="ts">
defineProps<{
  options?: { value: string; label: string; disabled?: boolean }[]
  modelValue?: string | string[] | null
  multiple?: boolean
  searchable?: boolean
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  ariaLabel?: string
}>()
</script>

<template>
  <div />
</template>
