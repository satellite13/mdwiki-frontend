<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/properties'
import type { PropertyDefinition, PropertyType } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import AdminNav from '@/components/admin/AdminNav.vue'
import HelpTip from '@/components/ui/HelpTip.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const { t } = useI18n()
const definitions = ref<PropertyDefinition[]>([])
const key = ref('')
const displayName = ref('')
const type = ref<PropertyType>('TEXT')
const optionsText = ref('')
const error = ref('')
const propertyTypes: PropertyType[] = [
  'TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'URL', 'SELECT', 'MULTI_SELECT', 'PAGE_REF'
]
const typeOptions = propertyTypes.map((item) => ({ value: item, label: item }))

const needsOptions = computed(() => type.value === 'SELECT' || type.value === 'MULTI_SELECT')

function parseOptions(raw: string): string[] {
  return [...new Set(
    raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )]
}

function optionsLabel(item: PropertyDefinition): string {
  const options = item.config?.options
  return Array.isArray(options) ? options.map(String).join(', ') : '—'
}

async function load() {
  try {
    definitions.value = (await api.listPropertyDefinitions()).data
    error.value = ''
  } catch (cause) {
    error.value = getApiErrorMessage(cause, t('adminProperties.loadFailed'))
  }
}

async function create() {
  try {
    const options = needsOptions.value ? parseOptions(optionsText.value) : []
    if (needsOptions.value && options.length === 0) {
      error.value = t('adminProperties.optionsRequired')
      return
    }
    await api.createPropertyDefinition({
      key: key.value,
      displayName: displayName.value,
      type: type.value,
      config: needsOptions.value ? { options } : {},
      required: false,
    })
    key.value = ''
    displayName.value = ''
    optionsText.value = ''
    error.value = ''
    await load()
  } catch (cause) {
    error.value = getApiErrorMessage(cause, t('adminProperties.saveFailed'))
  }
}

async function remove(id: string) {
  await api.deletePropertyDefinition(id)
  await load()
}

onMounted(load)
</script>

<template>
  <main class="admin-properties">
    <AdminNav />
    <div class="admin-title-row">
      <h1>{{ t('adminProperties.title') }}</h1>
      <HelpTip :label="t('adminProperties.title')">
        <p>{{ t('adminProperties.subtitle') }}</p>
      </HelpTip>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>

    <form class="create-form" @submit.prevent="create">
      <label>
        {{ t('adminProperties.key') }}
        <input v-model="key" required pattern="[A-Za-z][A-Za-z0-9_-]*" placeholder="status" />
      </label>
      <label>
        {{ t('adminProperties.name') }}
        <input v-model="displayName" required placeholder="Status" />
      </label>
      <label>
        {{ t('adminProperties.type') }}
        <AppSelect v-model="type" :options="typeOptions" :aria-label="t('adminProperties.type')" />
      </label>
      <label v-if="needsOptions" class="options-field">
        {{ t('adminProperties.options') }}
        <textarea
          v-model="optionsText"
          required
          rows="3"
          :placeholder="t('adminProperties.optionsPlaceholder')"
        />
        <span class="field-hint">{{ t('adminProperties.optionsHint') }}</span>
      </label>
      <button type="submit" class="btn-primary">{{ t('adminProperties.create') }}</button>
    </form>

    <table class="data-table">
      <caption>{{ t('adminProperties.definitions') }}</caption>
      <thead>
        <tr>
          <th>{{ t('adminProperties.name') }}</th>
          <th>{{ t('adminProperties.key') }}</th>
          <th>{{ t('adminProperties.type') }}</th>
          <th>{{ t('adminProperties.options') }}</th>
          <th>{{ t('adminProperties.action') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!definitions.length">
          <td colspan="5">{{ t('adminProperties.empty') }}</td>
        </tr>
        <tr v-for="item in definitions" :key="item.id">
          <td>{{ item.displayName }}</td>
          <td><code>{{ item.key }}</code></td>
          <td>{{ item.type }}</td>
          <td class="options-cell">{{ optionsLabel(item) }}</td>
          <td>
            <button
              type="button"
              class="btn-secondary"
              :aria-label="t('adminProperties.deleteNamed', { name: item.displayName })"
              @click="remove(item.id)"
            >
              {{ t('adminProperties.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.admin-properties {
  max-width: 60rem;
  padding: 0 0 2rem;
}

.admin-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.admin-title-row h1 {
  margin: 0;
}

.create-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: end;
  margin-bottom: 1.5rem;
}

.create-form label {
  display: grid;
  gap: 0.35rem;
  min-width: 10rem;
}

.create-form .options-field {
  flex: 1 1 100%;
  min-width: 100%;
}

.create-form input,
.create-form :deep(.app-select) {
  box-sizing: border-box;
  min-height: 44px;
}

.create-form textarea {
  box-sizing: border-box;
  min-height: 5.5rem;
  padding: 0.6rem 0.7rem;
  resize: vertical;
  font: inherit;
}

.field-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.create-form .btn-primary {
  min-height: 44px;
  height: 44px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table caption {
  text-align: left;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.options-cell {
  max-width: 18rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  word-break: break-word;
}

@media (max-width: 600px) {
  .create-form label {
    min-width: 100%;
  }
}
</style>
