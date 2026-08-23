<script setup lang="ts">
import { ref, watch } from 'vue'
import { renderAnnotationComment } from './renderAnnotationComment'

const props = defineProps<{
  comment: string
  /** Без класса `.annotation-item-comment` — класс задаёт вызывающая сторона. */
  bare?: boolean
}>()

const html = ref('')
let renderSeq = 0

watch(
  () => props.comment,
  async (comment) => {
    const seq = ++renderSeq
    const rendered = await renderAnnotationComment(comment)
    if (seq === renderSeq) html.value = rendered
  },
  { immediate: true }
)
</script>

<template>
  <div :class="{ 'annotation-item-comment': !bare }" v-html="html" />
</template>
