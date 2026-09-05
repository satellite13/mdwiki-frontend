<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFolderStore } from '@/stores/folders'
import * as captures from '@/api/captures'
import type { CaptureResponse } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const auth = useAuthStore()
const folders = useFolderStore()
const tab = ref<'text' | 'url' | 'image'>('text')
const title = ref('')
const text = ref('')
const url = ref('')
const note = ref('')
const caption = ref('')
const file = ref<File | null>(null)
const busy = ref(false)
const error = ref('')
const result = ref<CaptureResponse | null>(null)

function choose(next: typeof tab.value) {
  tab.value = next
  error.value = ''
}

function onTabKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  const values = ['text', 'url', 'image'] as const
  const delta = event.key === 'ArrowRight' ? 1 : -1
  const next = values[(values.indexOf(tab.value) + delta + values.length) % values.length]
  choose(next)
  const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabs?.[values.indexOf(next)]?.focus()
}

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function submit() {
  if (!auth.isEditor || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const response = tab.value === 'text'
      ? await captures.captureText({ text: text.value, title: title.value || undefined })
      : tab.value === 'url'
        ? await captures.captureUrl({ url: url.value, note: note.value || undefined, title: title.value || undefined })
        : await captures.captureImage(file.value!, caption.value || undefined, title.value || undefined)
    result.value = response.data
    title.value = ''
    if (tab.value === 'text') text.value = ''
    if (tab.value === 'url') { url.value = ''; note.value = '' }
    if (tab.value === 'image') { file.value = null; caption.value = '' }
    await folders.fetchTree(true)
  } catch (cause) {
    error.value = getApiErrorMessage(cause, t('pkm.captureFailed'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="pkm-page">
    <h1>{{ t('pkm.inbox') }}</h1>
    <p v-if="!auth.isEditor" class="notice">{{ t('pkm.readerCapture') }}</p>
    <template v-else>
      <div class="tabs" role="tablist" :aria-label="t('pkm.captureType')">
        <button v-for="kind in (['text', 'url', 'image'] as const)" :key="kind" role="tab"
          :id="`capture-tab-${kind}`" :aria-controls="`capture-panel-${kind}`"
          :aria-selected="tab === kind" :tabindex="tab === kind ? 0 : -1" @click="choose(kind)" @keydown="onTabKey">
          {{ t(`pkm.${kind}`) }}
        </button>
      </div>
      <form :id="`capture-panel-${tab}`" role="tabpanel" :aria-labelledby="`capture-tab-${tab}`"
        @submit.prevent="submit">
        <label>{{ t('pkm.titleOptional') }}<input v-model="title" maxlength="500" /></label>
        <label v-if="tab === 'text'">{{ t('pkm.text') }}<textarea v-model="text" required rows="10" /></label>
        <template v-if="tab === 'url'">
          <label>{{ t('pkm.url') }}<input v-model="url" type="url" required /></label>
          <label>{{ t('pkm.noteOptional') }}<textarea v-model="note" rows="5" /></label>
        </template>
        <template v-if="tab === 'image'">
          <label>{{ t('pkm.image') }}<input type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
            required @change="onFile" /></label>
          <p v-if="file">{{ file.name }} · {{ Math.ceil(file.size / 1024) }} KB</p>
          <label>{{ t('pkm.captionOptional') }}<input v-model="caption" /></label>
        </template>
        <button class="btn-primary" type="submit" :disabled="busy || (tab === 'image' && !file)">
          {{ busy ? t('common.saving') : t('pkm.capture') }}
        </button>
      </form>
    </template>
    <p class="result" aria-live="polite">
      <span v-if="error" role="alert">{{ error }}</span>
      <router-link v-else-if="result" :to="`/page/${result.page.slug}`">{{ t('pkm.captured', { title: result.page.title }) }}</router-link>
    </p>
  </main>
</template>

<style scoped>
.pkm-page{max-width:720px;margin:auto;padding:24px;width:100%}h1{margin-top:0}.tabs{display:flex;gap:8px;margin:16px 0}.tabs button{min-height:44px;padding:0 18px}.tabs [aria-selected=true]{color:var(--color-primary);border-color:var(--color-primary)}form{display:grid;gap:16px}label{display:grid;gap:6px}textarea{resize:vertical}.btn-primary{min-height:44px}.notice,.result{color:var(--color-text-muted)}[role=alert]{color:var(--color-danger)}@media(max-width:767px){.pkm-page{padding:16px}.tabs button{flex:1;padding:0 8px}}
</style>
