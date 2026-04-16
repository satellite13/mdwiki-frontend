<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as pagesApi from '@/api/pages'
import MarkdownEditor from '@/components/editor/MarkdownEditor.vue'

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
    <div class="field" v-if="isNew"><label>Slug</label><input v-model="slugInput" placeholder="auto-generated from title" class="slug-input" /></div>
    <div class="field"><label>Content</label><MarkdownEditor v-model="content" /></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="actions">
      <button class="btn-primary save-btn" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
      <button v-if="!isNew" class="btn-danger" @click="remove">Delete</button>
      <button class="btn-secondary" @click="router.back()">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.page-edit {
  max-width: 780px;
}

.page-edit h1 {
  font-family: var(--font-body);
  margin-bottom: 28px;
}

.field {
  margin-bottom: 20px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.slug-input {
  font-family: var(--font-mono);
  font-size: 13px;
}

.error {
  color: var(--color-danger);
  margin-bottom: 12px;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 28px;
}

.save-btn {
  padding: 10px 28px;
}
</style>
