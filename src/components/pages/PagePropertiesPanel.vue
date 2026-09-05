<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import * as propertiesApi from '@/api/properties'
import type { Page, PageProperties } from '@/types'

const props = defineProps<{ page: Page, editable: boolean, flushPendingSave: () => Promise<boolean> }>()
const emit = defineEmits<{ updated: [page: Page] }>()
const data = ref<PageProperties | null>(null)
const busy = ref(false)
const error = ref('')

async function load() {
  data.value = null
  error.value = ''
  try { data.value = (await propertiesApi.getPageProperties(props.page.slug)).data }
  catch { error.value = 'Could not load properties' }
}
watch(() => `${props.page.slug}:${props.page.updatedAt}`, load, { immediate: true })
const known = computed(() => data.value?.definitions ?? [])
function textValue(key: string) { const value = data.value?.values[key]; return Array.isArray(value) ? value.join(', ') : String(value ?? '') }
async function save(key: string, event: Event) {
  if (!props.editable || busy.value) return
  const value = (event.target as HTMLInputElement).value
  busy.value = true; error.value = ''
  try {
    if (!await props.flushPendingSave()) throw new Error('page is stale')
    const { data: page } = await propertiesApi.patchPageProperties(props.page.slug, props.page.updatedAt, value ? [{ op: 'SET', key, value }] : [{ op: 'REMOVE', key }])
    emit('updated', page as Page)
    await load()
  } catch { error.value = 'Property was not saved; refresh and retry.' }
  finally { busy.value = false }
}
</script>

<template>
  <aside class="page-properties" aria-label="Page properties">
    <h2>Properties</h2>
    <p v-if="error" role="alert">{{ error }}</p>
    <dl v-if="data">
      <template v-for="definition in known" :key="definition.id">
        <dt>{{ definition.displayName }}</dt>
        <dd>
          <input v-if="editable" :value="textValue(definition.key)" :disabled="busy" :aria-label="definition.displayName" @change="save(definition.key, $event)">
          <span v-else>{{ textValue(definition.key) || '—' }}</span>
        </dd>
      </template>
      <template v-for="(value, key) in data.unknown" :key="key">
        <dt>{{ key }}</dt><dd><span :aria-label="`${key} (read only)`">{{ value }}</span></dd>
      </template>
    </dl>
  </aside>
</template>

<style scoped>
.page-properties { margin: .75rem 0; padding: .75rem; border: 1px solid var(--color-border, #ddd); border-radius: .5rem; }
h2 { margin: 0 0 .5rem; font-size: 1rem; }
dl { display: grid; grid-template-columns: minmax(7rem, 1fr) 2fr; gap: .4rem .75rem; margin: 0; }
dt { font-weight: 600; } input { width: 100%; } @media (max-width: 600px) { dl { grid-template-columns: 1fr; gap: .15rem; } dd { margin: 0 0 .5rem; } }
</style>
