<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import * as propertiesApi from '@/api/properties'
import { useI18n } from 'vue-i18n'
import type { Page, PageListItem, PageProperties, PropertyDefinition } from '@/types'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'

const props = defineProps<{ page: Page, editable: boolean, flushPendingSave: () => Promise<boolean> }>()
const emit = defineEmits<{ updated: [page: Page] }>()
const { t } = useI18n()
const data = ref<PageProperties | null>(null)
const pageReferences = ref<PageListItem[]>([])
const busy = ref(false)
const error = ref('')
const collapsed = ref(true)
let requestGeneration = 0
let loadController: AbortController | null = null

async function load() {
  const generation = ++requestGeneration
  const slug = props.page.slug
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  data.value = null
  error.value = ''
  try {
    const result = await propertiesApi.getPageProperties(slug, controller.signal)
    if (generation === requestGeneration && props.page.slug === slug) data.value = result.data
  } catch (cause) {
    if (controller.signal.aborted || generation !== requestGeneration || props.page.slug !== slug) return
    error.value = getApiErrorMessage(cause, t('properties.loadFailed'))
  }
}
watch(() => `${props.page.slug}:${props.page.updatedAt}`, load, { immediate: true })
const known = computed(() => data.value?.definitions ?? [])
const fieldCount = computed(() => known.value.length + Object.keys(data.value?.unknown ?? {}).length)
function textValue(key: string) {
  const value = data.value?.values[key]
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function datetimeLocalValue(key: string) {
  const value = textValue(key)
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}
function valueFor(definition: PropertyDefinition, event: Event): unknown {
  const element = event.target as HTMLInputElement | HTMLSelectElement
  if (definition.type === 'BOOLEAN') return (element as HTMLInputElement).checked
  if (definition.type === 'NUMBER') return Number(element.value)
  if (definition.type === 'MULTI_SELECT') return Array.from((element as HTMLSelectElement).selectedOptions).map(option => option.value)
  if (definition.type === 'DATETIME') {
    if (!element.value) return ''
    const date = new Date(`${element.value}Z`)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }
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
  } catch (cause) {
    if (isApiErrorWithStatus(cause, 409)) error.value = t('properties.conflict')
    else if (isApiErrorWithStatus(cause, 422)) error.value = getApiErrorMessage(cause, t('properties.invalidValue'))
    else error.value = getApiErrorMessage(cause, t('properties.saveFailed'))
  }
  finally { busy.value = false }
}
</script>

<template>
  <aside class="page-properties" :aria-label="t('properties.title')">
    <button
      type="button"
      class="properties-toggle"
      :aria-expanded="!collapsed"
      :aria-controls="'page-properties-body'"
      :aria-label="t('properties.toggle')"
      :title="collapsed ? t('properties.expand') : t('properties.collapse')"
      @click="collapsed = !collapsed"
    >
      <span class="properties-title">{{ t('properties.title') }}</span>
      <span v-if="fieldCount" class="properties-count">{{ fieldCount }}</span>
      <span :class="['properties-chevron', { collapsed }]">▾</span>
    </button>
    <div v-show="!collapsed" id="page-properties-body" class="properties-body">
      <p class="properties-hint">{{ t('properties.hint') }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <button v-if="error === t('properties.conflict')" type="button" @click="load">{{ t('properties.reload') }}</button>
      <dl v-if="data">
        <template v-for="definition in known" :key="definition.id">
          <dt>{{ definition.displayName }}</dt>
          <dd>
            <template v-if="editable">
              <input v-if="['TEXT', 'URL', 'DATE', 'DATETIME'].includes(definition.type)" :type="definition.type === 'DATETIME' ? 'datetime-local' : definition.type.toLowerCase()" :value="definition.type === 'DATETIME' ? datetimeLocalValue(definition.key) : textValue(definition.key)" :disabled="busy" :aria-label="definition.displayName" @change="save(definition, $event)">
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
          <dt>{{ key }}</dt><dd><span :aria-label="t('properties.readOnly', { key })">{{ typeof value === 'object' ? JSON.stringify(value) : value }}</span></dd>
        </template>
      </dl>
      <datalist id="page-references"><option v-for="item in pageReferences" :key="item.id" :value="item.slug">{{ item.title }}</option></datalist>
    </div>
  </aside>
</template>

<style scoped>
.page-properties { margin: .75rem 0; padding: .5rem .75rem; border: 1px solid var(--color-border, #ddd); border-radius: .5rem; }
.properties-toggle {
  display: flex;
  align-items: center;
  gap: .5rem;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: .25rem 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.properties-title { margin: 0; font-size: 1rem; font-weight: 600; }
.properties-count {
  margin-left: .15rem;
  padding: .05rem .4rem;
  border-radius: 999px;
  background: var(--color-bg-secondary, #f3f3f3);
  color: var(--color-text-muted, #666);
  font-size: .75rem;
}
.properties-chevron { margin-left: auto; transition: transform .15s ease; }
.properties-chevron.collapsed { transform: rotate(-90deg); }
.properties-body { padding: 0 0 .35rem; }
.properties-hint { margin: 0 0 .65rem; color: var(--color-text-muted, #666); font-size: .85rem; line-height: 1.4; }
dl { display: grid; grid-template-columns: minmax(7rem, 1fr) 2fr; gap: .4rem .75rem; margin: 0; }
dt { font-weight: 600; } input { width: 100%; }
@media (max-width: 600px) { dl { grid-template-columns: 1fr; gap: .15rem; } dd { margin: 0 0 .5rem; } }
</style>
