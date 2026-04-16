<script setup lang="ts">
import { onMounted } from 'vue'
import { usePageStore } from '@/stores/pages'

const pageStore = usePageStore()
onMounted(() => { pageStore.fetchPages() })
</script>

<template>
  <div class="page-list-page">
    <h1>Pages</h1>
    <div v-if="pageStore.loading" class="state-placeholder">Loading...</div>
    <div v-else-if="pageStore.pages.length === 0" class="state-placeholder">No pages yet. Create your first page!</div>
    <ul v-else class="page-cards">
      <li v-for="(page, index) in pageStore.pages" :key="page.id" class="page-card" :style="{ animationDelay: `${Math.min(index, 15) * 0.05}s` }">
        <router-link :to="`/page/${page.slug}`">
          <h3>{{ page.title }}</h3>
          <div class="page-meta">
            <span class="page-slug">{{ page.slug }}</span>
            <span v-for="tag in page.tags" :key="tag" class="tag">#{{ tag }}</span>
          </div>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.page-list-page h1 {
  font-family: var(--font-heading);
  margin-bottom: 28px;
}

.page-cards {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius);
  padding: 18px 20px;
  transition: all 0.2s ease;
  animation: fadeInUpStagger 0.4s ease both;
}

.page-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-left-color: var(--color-primary-hover);
}

.page-card a {
  text-decoration: none;
  color: inherit;
}

.page-card h3 {
  font-family: var(--font-heading);
  font-size: 1.05rem;
  margin-bottom: 6px;
  color: var(--color-text);
}

.page-meta {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: var(--color-text-muted);
  align-items: center;
}

.page-slug {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  padding: 1px 6px;
  border-radius: 3px;
}

.tag {
  color: var(--color-tag);
  font-weight: 500;
}

</style>
