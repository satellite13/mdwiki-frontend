<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import * as propertiesApi from '@/api/properties'
import { useI18n } from 'vue-i18n'
import type { Page, PageListItem, PageProperties, PropertyDefinition } from '@/types'

const props = defineProps<{ page: Page, editable: boolean, flushPendingSave: () => Promise<boolean> }>()
const emit = defineEmits<{ updated: [page: Page] }>()
const { t } = useI18n()
const data = ref<PageProperties | null>(null)
const pageReferences = ref<PageListItem[]>([])
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
function valueFor(definition: PropertyDefinition, event: Event): unknown {
  const element = event.target as HTMLInputElement | HTMLSelectElement
  if (definition.type === 'BOOLEAN') return (element as HTMLInputElement).checked
  if (definition.type === 'NUMBER') return Number(element.value)
  if (definition.type === 'MULTI_SELECT') return Array.from((element as HTMLSelectElement).selectedOptions).map(option => option.value)
  return element.value
}
function valid(definition: PropertyDefinition, value: unknown) {
  if (definition.type === 'NUMBER') return typeof value === 'number' && Number.isFinite(value)
  if (definition.type === 'URL') return typeof value === 'string' && (value === '' || (() => { try { new URL(value); return true } catch { return false } })())
  return true
}
async function save(definition: PropertyDefinition, event: Event) {
  if (!props.editable || busy.value) return
  const value = valueFor(definition, event)
  if (!valid(definition, value)) { error.value = t('properties.invalidValue'); return }
  busy.value = true; error.value = ''
  try {
    if (!await props.flushPendingSave()) throw new Error('page is stale')
    const remove = value === '' || (Array.isArray(value) && !value.length)
    const { data: page } = await propertiesApi.patchPageProperties(props.page.slug, props.page.updatedAt, remove ? [{ op: 'REMOVE', key: definition.key }] : [{ op: 'SET', key: definition.key, value }])
    emit('updated', page as Page)
    await load()
  } catch { error.value = t('properties.saveFailed') }
  finally { busy.value = false }
}
</script>

<template>
  <aside class="page-properties" :aria-label="t('properties.title')">
    <h2>{{ t('properties.title') }}</h2>
    <p v-if="error" role="alert">{{ error }}</p>
    <dl v-if="data">
      <template v-for="definition in known" :key="definition.id">
        <dt>{{ definition.displayName }}</dt>
        <dd>
          <template v-if="editable">
            <input v-if="['TEXT', 'URL', 'DATE', 'DATETIME'].includes(definition.type)" :type="definition.type === 'DATETIME' ? 'datetime-local' : definition.type.toLowerCase()" :value="textValue(definition.key)" :disabled="busy" :aria-label="definition.displayName" @change="save(definition, $event)">
            <input v-else-if="definition.type === 'NUMBER'" type="number" :value="textValue(definition.key)" :disabled="busy" :aria-label="definition.displayName" @change="save(definition, $event)">
            <input v-else-if="definition.type === 'BOOLEAN'" type="checkbox" :checked="data.values[definition.key] === true" :disabled="busy" :aria-label="definition.displayName" @change="save(definition, $event)">
            <select v-else-if="definition.type === 'SELECT'" :value="textValue(definition.key)" :disabled="busy" :aria-label="definition.displayName" @change="save(definition, $event)"><option value="">{{ t('properties.empty') }}</option><option v-for="option in (definition.config.options as string[] || [])" :key="option" :value="option">{{ option }}</option></select>
            <select v-else-if="definition.type === 'MULTI_SELECT'" multiple :value="data.values[definition.key] as string[]" :disabled="busy" :aria-label="definition.displayName" @change="save(definition, $event)"><option v-for="option in (definition.config.options as string[] || [])" :key="option" :value="option">{{ option }}</option></select>
            <input v-else list="page-references" :value="textValue(definition.key)" :disabled="busy" :aria-label="definition.displayName" @change="save(definition, $event)">
          </template>
          <span v-else>{{ textValue(definition.key) || t('properties.emptyValue') }}</span>
        </dd>
      </template>
      <template v-for="(value, key) in data.unknown" :key="key">
        <dt>{{ key }}</dt><dd><span :aria-label="t('properties.readOnly', { key })">{{ value }}</span></dd>
      </template>
    </dl>
    <datalist id="page-references"><option v-for="item in pageReferences" :key="item.id" :value="item.slug">{{ item.title }}</option></datalist>
  </aside>
</template>

<style scoped>
.page-properties { margin: .75rem 0; padding: .75rem; border: 1px solid var(--color-border, #ddd); border-radius: .5rem; }
h2 { margin: 0 0 .5rem; font-size: 1rem; }
dl { display: grid; grid-template-columns: minmax(7rem, 1fr) 2fr; gap: .4rem .75rem; margin: 0; }
dt { font-weight: 600; } input { width: 100%; } @media (max-width: 600px) { dl { grid-template-columns: 1fr; gap: .15rem; } dd { margin: 0 0 .5rem; } }
</style>
