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
  Promise.all([pageStore.fetchPages(), tagStore.fetchTags()])
})
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-section">
      <h3 class="section-header">Tags</h3>
      <div class="tag-list">
        <button v-for="tag in tagStore.tags" :key="tag.id"
          :class="['tag-chip', { active: selectedTag === tag.name }]"
          @click="selectTag(tag.name)">
          #{{ tag.name }}
        </button>
      </div>
    </div>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">
      <h3 class="section-header">Pages</h3>
      <ul class="page-list">
        <li v-for="page in filteredPages" :key="page.id">
          <router-link :to="`/page/${page.slug}`" class="page-link">{{ page.title }}</router-link>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background: #262626;
  padding: 20px 16px;
  overflow-y: auto;
  height: calc(100vh - 60px);
  border-right: 1px solid #3a3a3a;
}

.sidebar::-webkit-scrollbar {
  width: 4px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: #777;
}

.sidebar-section {
  margin-bottom: 8px;
}

.section-header {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #666666;
  margin-bottom: 12px;
  padding: 0 4px;
}

.sidebar-divider {
  height: 1px;
  background: #3a3a3a;
  margin: 16px 4px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 4px;
}

.tag-chip {
  font-size: 12px;
  font-family: var(--font-mono);
  padding: 3px 10px;
  border-radius: var(--radius);
  background: #2d2d2d;
  border: 1px solid transparent;
  color: #e5a00d;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tag-chip:hover {
  background: #333333;
}

.tag-chip.active {
  background: #e5a00d;
  color: #1e1e1e;
  border-color: #e5a00d;
}

.page-list {
  list-style: none;
  padding: 0 4px;
}

.page-list li {
  margin-bottom: 2px;
}

.page-link {
  display: block;
  font-size: 14px;
  color: #999999;
  text-decoration: none;
  padding: 5px 10px;
  border-left: 2px solid transparent;
  border-radius: 0 var(--radius) var(--radius) 0;
  transition: all 0.15s ease;
}

.page-link:hover {
  color: #dcddde;
  background: #333333;
  text-decoration: none;
}

.page-link.router-link-active {
  color: #dcddde;
  border-left-color: var(--color-primary);
  background: rgba(124, 58, 237, 0.1);
}
</style>
