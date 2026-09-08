<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/properties'
import type { PropertyDefinition, PropertyType } from '@/types'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import AdminNav from '@/components/admin/AdminNav.vue'
import HelpTip from '@/components/ui/HelpTip.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const { t } = useI18n()
const definitions = ref<PropertyDefinition[]>([])
const editing = ref<PropertyDefinition | null>(null)
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

function optionsFromConfig(config: Record<string, unknown> | undefined): string {
  const options = config?.options
  return Array.isArray(options) ? options.map(String).join(', ') : ''
}

function optionsLabel(item: PropertyDefinition): string {
  const options = item.config?.options
  return Array.isArray(options) ? options.map(String).join(', ') : '—'
}

function resetForm() {
  editing.value = null
  key.value = ''
  displayName.value = ''
  type.value = 'TEXT'
  optionsText.value = ''
}

function startEditing(item: PropertyDefinition) {
  editing.value = item
  key.value = item.key
  displayName.value = item.displayName
  type.value = item.type
  optionsText.value = optionsFromConfig(item.config)
  error.value = ''
}

async function load() {
  try {
    definitions.value = (await api.listPropertyDefinitions()).data
    error.value = ''
  } catch (cause) {
    error.value = getApiErrorMessage(cause, t('adminProperties.loadFailed'))
  }
}

async function submit() {
  try {
    const options = needsOptions.value ? parseOptions(optionsText.value) : []
    if (needsOptions.value && options.length === 0) {
      error.value = t('adminProperties.optionsRequired')
      return
    }
    const payload = {
      key: key.value,
      displayName: displayName.value,
      type: type.value,
      config: needsOptions.value ? { options } : {},
      required: editing.value?.required ?? false,
    }
    if (editing.value) {
      await api.updatePropertyDefinition(editing.value.id, {
        ...payload,
        expectedVersion: editing.value.version,
      })
    } else {
      await api.createPropertyDefinition(payload)
    }
    resetForm()
    error.value = ''
    await load()
  } catch (cause) {
    if (editing.value && isApiErrorWithStatus(cause, 409)) {
      error.value = t('adminProperties.updateConflict')
      return
    }
    error.value = getApiErrorMessage(cause, t('adminProperties.saveFailed'))
  }
}

async function remove(id: string) {
  await api.deletePropertyDefinition(id)
  if (editing.value?.id === id) resetForm()
  await load()
}

onMounted(load)
</script>

<template>
  <main class="admin-properties">
    <AdminNav />
    <div class="title-row">
      <h1>
        {{ t('adminProperties.title') }}
        <HelpTip :label="t('adminProperties.title')">
          <p>{{ t('adminProperties.subtitle') }}</p>
        </HelpTip>
      </h1>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>

    <form class="create-form" @submit.prevent="submit">
      <label>
        {{ t('adminProperties.key') }}
        <input
          v-model="key"
          required
          pattern="[A-Za-z][A-Za-z0-9_-]*"
          placeholder="status"
          :disabled="!!editing"
        />
      </label>
      <label>
        {{ t('adminProperties.name') }}
        <input v-model="displayName" required placeholder="Status" />
      </label>
      <label>
        {{ t('adminProperties.type') }}
        <AppSelect
          v-model="type"
          :options="typeOptions"
          :aria-label="t('adminProperties.type')"
          :disabled="!!editing"
        />
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
      <p v-if="editing" class="field-hint immutable-hint">{{ t('adminProperties.immutableHint') }}</p>
      <div class="form-actions">
        <button
          v-if="editing"
          type="button"
          class="btn-secondary"
          @click="resetForm"
        >
          {{ t('adminProperties.cancel') }}
        </button>
        <button type="submit" class="btn-primary">
          {{ editing ? t('adminProperties.save') : t('adminProperties.create') }}
        </button>
      </div>
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
          <td class="actions-cell">
            <button
              type="button"
              class="btn-secondary"
              :aria-label="t('adminProperties.editNamed', { name: item.displayName })"
              @click="startEditing(item)"
            >
              {{ t('adminProperties.edit') }}
            </button>
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

.admin-properties .title-row {
  margin-bottom: 1.25rem;
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

.create-form .form-actions {
  display: flex;
  gap: 0.5rem;
  align-items: end;
}

.create-form .btn-primary,
.create-form .form-actions .btn-secondary {
  min-height: 44px;
  height: 44px;
}

.immutable-hint {
  flex: 1 1 100%;
  margin: 0;
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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
