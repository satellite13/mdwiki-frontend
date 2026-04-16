<script setup lang="ts">
import { onMounted } from 'vue'
import { usePageStore } from '@/stores/pages'

const pageStore = usePageStore()
onMounted(() => { pageStore.fetchPages() })
</script>

<template>
  <div class="page-list-page">
    <h1>Pages</h1>
    <div v-if="pageStore.loading" class="loading">Loading...</div>
    <div v-else-if="pageStore.pages.length === 0" class="empty">No pages yet. Create your first page!</div>
    <ul v-else class="page-cards">
      <li v-for="page in pageStore.pages" :key="page.id" class="page-card">
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
.page-list-page h1 { margin-bottom: 24px; }
.page-cards { list-style: none; display: flex; flex-direction: column; gap: 12px; }
.page-card { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; transition: box-shadow 0.15s; }
.page-card:hover { box-shadow: var(--shadow); }
.page-card a { text-decoration: none; color: inherit; }
.page-card h3 { margin-bottom: 4px; }
.page-meta { display: flex; gap: 8px; font-size: 13px; color: var(--color-text-muted); }
.tag { color: var(--color-tag); }
.loading, .empty { color: var(--color-text-muted); padding: 40px 0; text-align: center; }
</style>
