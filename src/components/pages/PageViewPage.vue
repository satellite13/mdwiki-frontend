<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import * as pagesApi from '@/api/pages'
import type { Page, Backlink } from '@/types'
import { markdownToEditorHtml } from '@/utils/editorMarkdown'

const route = useRoute()
const auth = useAuthStore()
const page = ref<Page | null>(null)
const backlinks = ref<Backlink[]>([])
const loading = ref(true)

const renderedBodyHtml = computed(() => {
  const p = page.value
  if (!p) return ''
  const html = p.contentHtml?.trim()
  if (html) return html
  return markdownToEditorHtml(p.contentMd ?? '')
})

async function loadPage(slug: string) {
  loading.value = true
  try {
    const [pageRes, backlinksRes] = await Promise.all([
      pagesApi.getPage(slug),
      pagesApi.getBacklinks(slug)
    ])
    page.value = pageRes.data
    backlinks.value = backlinksRes.data
  } finally { loading.value = false }
}

onMounted(() => loadPage(route.params.slug as string))
watch(() => route.params.slug, (slug) => { if (slug) loadPage(slug as string) })
</script>

<template>
  <div class="page-view" v-if="!loading && page">
    <div class="page-header">
      <h1>{{ page.title }}</h1>
      <router-link v-if="auth.isEditor" :to="`/page/${page.slug}/edit`" class="edit-btn">Edit</router-link>
    </div>
    <div class="page-tags" v-if="page.tags.length">
      <span v-for="tag in page.tags" :key="tag" class="tag">#{{ tag }}</span>
    </div>
    <div class="page-content" v-html="renderedBodyHtml" />
    <div class="backlinks" v-if="backlinks.length">
      <div class="backlinks-rule">--- * ---</div>
      <h3>Backlinks</h3>
      <ul>
        <li v-for="bl in backlinks" :key="bl.slug">
          <router-link :to="`/page/${bl.slug}`">{{ bl.title }}</router-link>
        </li>
      </ul>
    </div>
    <div class="page-footer">
      <span>Created by {{ page.createdBy }} &middot; Updated {{ new Date(page.updatedAt).toLocaleDateString() }}</span>
    </div>
  </div>
  <div v-else-if="loading" class="state-placeholder">Loading...</div>
</template>

<style scoped>
.page-view {
  max-width: 720px;
  animation: fadeInUp 0.4s ease both;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.page-header h1 {
  font-family: var(--font-heading);
  font-size: 2rem;
  line-height: 1.25;
  flex: 1;
}

.edit-btn {
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  padding: 6px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  white-space: nowrap;
  margin-left: 16px;
  margin-top: 4px;
}

.edit-btn:hover {
  background: var(--color-primary);
  color: #fff;
  text-decoration: none;
}

.page-tags {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
}

.tag {
  color: var(--color-tag);
  font-size: 14px;
  font-weight: 500;
  background: rgba(139, 105, 20, 0.08);
  padding: 2px 10px;
  border-radius: 12px;
}

.page-content {
  line-height: 1.9;
  font-size: 16px;
  margin-bottom: 40px;
  color: var(--color-text);
}

.page-content :deep(h1),
.page-content :deep(h2),
.page-content :deep(h3) {
  font-family: var(--font-heading);
  margin-top: 2em;
  margin-bottom: 0.6em;
}

.page-content :deep(p) {
  margin-bottom: 1.2em;
}

.page-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-bg-secondary);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--color-text);
}

.page-content :deep(pre) {
  font-family: var(--font-mono);
  background: var(--color-bg-secondary);
  padding: 16px 20px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin-bottom: 1.2em;
  border: 1px solid var(--color-border);
  font-size: 14px;
}

.page-content :deep(a) {
  color: var(--color-wikilink);
}

.page-content :deep(blockquote) {
  border-left: 3px solid var(--color-primary);
  padding-left: 16px;
  color: var(--color-text-muted);
  font-style: italic;
  margin-bottom: 1.2em;
}

.backlinks {
  padding-top: 8px;
  margin-top: 40px;
}

.backlinks-rule {
  text-align: center;
  color: var(--color-border);
  font-size: 13px;
  letter-spacing: 4px;
  margin-bottom: 20px;
}

.backlinks h3 {
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-muted);
  margin-bottom: 10px;
}

.backlinks ul {
  list-style: none;
}

.backlinks li {
  padding: 4px 0;
}

.backlinks li a {
  color: var(--color-primary);
  font-size: 15px;
}

.page-footer {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

</style>
