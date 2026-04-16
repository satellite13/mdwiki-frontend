<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as pagesApi from '@/api/pages'
import TiptapEditor from '@/components/editor/TiptapEditor.vue'

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string | undefined)
const isNew = computed(() => !slug.value)

const title = ref('')
const slugInput = ref('')
const content = ref('')
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  if (slug.value) {
    const { data } = await pagesApi.getPage(slug.value)
    title.value = data.title
    slugInput.value = data.slug
    content.value = data.contentMd || ''
  }
})

async function save() {
  saving.value = true
  error.value = ''
  try {
    if (isNew.value) {
      const s = slugInput.value || title.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      await pagesApi.createPage(s, title.value, content.value)
      router.push(`/page/${s}`)
    } else {
      await pagesApi.updatePage(slug.value!, { title: title.value, contentMd: content.value })
      router.push(`/page/${slug.value}`)
    }
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Save failed'
  } finally { saving.value = false }
}

async function remove() {
  if (slug.value && confirm('Delete this page?')) {
    await pagesApi.deletePage(slug.value)
    router.push('/')
  }
}
</script>

<template>
  <div class="page-edit">
    <h1>{{ isNew ? 'New Page' : 'Edit Page' }}</h1>
    <div class="field"><label>Title</label><input v-model="title" required placeholder="Page title" /></div>
    <div class="field" v-if="isNew"><label>Slug</label><input v-model="slugInput" placeholder="auto-generated from title" /></div>
    <div class="field"><label>Content</label><TiptapEditor v-model="content" /></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="actions">
      <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
      <button v-if="!isNew" class="btn-danger" @click="remove">Delete</button>
      <button class="btn-secondary" @click="router.back()">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.page-edit h1 { margin-bottom: 24px; }
.field { margin-bottom: 16px; }
.field label { display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500; }
.error { color: var(--color-danger); margin-bottom: 12px; }
.actions { display: flex; gap: 12px; margin-top: 24px; }
</style>
