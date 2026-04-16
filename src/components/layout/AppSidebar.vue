<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePageStore } from '@/stores/pages'
import { useTagStore } from '@/stores/tags'

const pageStore = usePageStore()
const tagStore = useTagStore()
const selectedTag = ref<string | null>(null)

const filteredPages = computed(() => {
  if (!selectedTag.value) return pageStore.pages
  return pageStore.pages.filter(p => p.tags.includes(selectedTag.value!))
})

function selectTag(tag: string | null) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}

onMounted(() => {
  pageStore.fetchPages()
  tagStore.fetchTags()
})
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-section">
      <h3>Tags</h3>
      <div class="tag-list">
        <button v-for="tag in tagStore.tags" :key="tag.id"
          :class="['tag-chip', { active: selectedTag === tag.name }]"
          @click="selectTag(tag.name)">
          #{{ tag.name }}
        </button>
      </div>
    </div>
    <div class="sidebar-section">
      <h3>Pages</h3>
      <ul class="page-list">
        <li v-for="page in filteredPages" :key="page.id">
          <router-link :to="`/page/${page.slug}`">{{ page.title }}</router-link>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.sidebar { width: 260px; border-right: 1px solid var(--color-border); padding: 16px; overflow-y: auto; height: calc(100vh - 57px); }
.sidebar-section { margin-bottom: 24px; }
.sidebar-section h3 { font-size: 12px; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 8px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-chip { font-size: 12px; padding: 2px 8px; border-radius: 12px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-tag); }
.tag-chip.active { background: var(--color-tag); color: white; border-color: var(--color-tag); }
.page-list { list-style: none; }
.page-list li { padding: 4px 0; }
.page-list a { font-size: 14px; }
</style>
