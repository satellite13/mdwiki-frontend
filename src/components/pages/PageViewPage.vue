<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import * as pagesApi from '@/api/pages'
import type { Page, Backlink } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const page = ref<Page | null>(null)
const backlinks = ref<Backlink[]>([])
const loading = ref(true)

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
      <router-link v-if="auth.isEditor" :to="`/page/${page.slug}/edit`" class="btn-primary">Edit</router-link>
    </div>
    <div class="page-tags" v-if="page.tags.length">
      <span v-for="tag in page.tags" :key="tag" class="tag">#{{ tag }}</span>
    </div>
    <div class="page-content" v-html="page.contentHtml || page.contentMd" />
    <div class="backlinks" v-if="backlinks.length">
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
  <div v-else-if="loading" class="loading">Loading...</div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-tags { display: flex; gap: 8px; margin-bottom: 16px; }
.tag { color: var(--color-tag); font-size: 14px; }
.page-content { line-height: 1.8; margin-bottom: 32px; }
.backlinks { border-top: 1px solid var(--color-border); padding-top: 16px; margin-top: 32px; }
.backlinks h3 { font-size: 14px; color: var(--color-text-muted); margin-bottom: 8px; }
.backlinks ul { list-style: none; }
.backlinks li { padding: 2px 0; }
.page-footer { color: var(--color-text-muted); font-size: 13px; margin-top: 24px; }
.loading { color: var(--color-text-muted); padding: 40px 0; text-align: center; }
</style>
