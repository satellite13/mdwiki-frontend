<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GraphPanel from '@/components/graph/GraphPanel.vue'

const route = useRoute()

const highlight = computed(() => {
  const q = route.query.highlight
  if (typeof q === 'string' && q.length > 0) return q
  if (Array.isArray(q) && typeof q[0] === 'string') return q[0]
  return null
})
</script>

<template>
  <div class="wiki-graph-page">
    <GraphPanel :variant="'wiki'" :highlight-slug="highlight" />
  </div>
</template>

<style scoped>
/* Заполняем main по высоте (у main flex column + min-height: 0) */
.wiki-graph-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: -24px -32px;
  width: calc(100% + 64px);
  height: 100%;
}

@media (max-width: 1023px) {
  .wiki-graph-page {
    margin: -16px -20px;
    width: calc(100% + 40px);
  }
}

@media (max-width: 767px) {
  .wiki-graph-page {
    margin: -12px -14px;
    width: calc(100% + 28px);
  }
}
</style>
