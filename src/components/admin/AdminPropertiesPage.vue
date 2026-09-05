<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as api from '@/api/properties'
import type { PropertyDefinition, PropertyType } from '@/types'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const definitions = ref<PropertyDefinition[]>([])
const key = ref(''); const displayName = ref(''); const type = ref<PropertyType>('TEXT'); const error = ref('')
async function load() { try { definitions.value = (await api.listPropertyDefinitions()).data } catch { error.value = t('adminProperties.loadFailed') } }
async function create() { try { await api.createPropertyDefinition({ key: key.value, displayName: displayName.value, type: type.value, config: type.value.includes('SELECT') ? { options: [] } : {}, required: false }); key.value=''; displayName.value=''; await load() } catch { error.value=t('adminProperties.saveFailed') } }
async function remove(id: string) { await api.deletePropertyDefinition(id); await load() }
onMounted(load)
</script>
<template><main class="admin-properties"><h1>{{ t('adminProperties.title') }}</h1><p v-if="error" role="alert">{{ error }}</p>
  <form @submit.prevent="create"><label>{{ t('adminProperties.key') }} <input v-model="key" required pattern="[A-Za-z][A-Za-z0-9_-]*"></label><label>{{ t('adminProperties.name') }} <input v-model="displayName" required></label>
    <label>{{ t('adminProperties.type') }} <select v-model="type"><option v-for="item in ['TEXT','NUMBER','BOOLEAN','DATE','DATETIME','URL','SELECT','MULTI_SELECT','PAGE_REF']" :key="item">{{ item }}</option></select></label><button>{{ t('adminProperties.create') }}</button></form>
  <table><caption>{{ t('adminProperties.definitions') }}</caption><thead><tr><th>{{ t('adminProperties.name') }}</th><th>{{ t('adminProperties.key') }}</th><th>{{ t('adminProperties.type') }}</th><th>{{ t('adminProperties.action') }}</th></tr></thead><tbody><tr v-for="item in definitions" :key="item.id"><td>{{item.displayName}}</td><td>{{item.key}}</td><td>{{item.type}}</td><td><button :aria-label="t('adminProperties.deleteNamed', { name: item.displayName })" @click="remove(item.id)">{{ t('adminProperties.delete') }}</button></td></tr></tbody></table>
</main></template>
<style scoped>.admin-properties{max-width:60rem;padding:1rem}form{display:flex;gap:.5rem;flex-wrap:wrap}label{display:grid;gap:.2rem}table{width:100%;margin-top:1rem;border-collapse:collapse}th,td{text-align:left;padding:.5rem;border-bottom:1px solid #ddd}@media(max-width:600px){.admin-properties{padding:.75rem}}</style>
