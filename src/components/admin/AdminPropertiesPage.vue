<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as api from '@/api/properties'
import type { PropertyDefinition, PropertyType } from '@/types'
const definitions = ref<PropertyDefinition[]>([])
const key = ref(''); const displayName = ref(''); const type = ref<PropertyType>('TEXT'); const error = ref('')
async function load() { try { definitions.value = (await api.listPropertyDefinitions()).data } catch { error.value = 'Could not load property definitions' } }
async function create() { try { await api.createPropertyDefinition({ key: key.value, displayName: displayName.value, type: type.value, config: type.value.includes('SELECT') ? { options: [] } : {}, required: false }); key.value=''; displayName.value=''; await load() } catch { error.value='Could not save property definition' } }
async function remove(id: string) { await api.deletePropertyDefinition(id); await load() }
onMounted(load)
</script>
<template><main class="admin-properties"><h1>Properties</h1><p v-if="error" role="alert">{{ error }}</p>
  <form @submit.prevent="create"><label>Key <input v-model="key" required pattern="[A-Za-z][A-Za-z0-9_-]*"></label><label>Name <input v-model="displayName" required></label>
    <label>Type <select v-model="type"><option v-for="item in ['TEXT','NUMBER','BOOLEAN','DATE','DATETIME','URL','SELECT','MULTI_SELECT','PAGE_REF']" :key="item">{{ item }}</option></select></label><button>Create</button></form>
  <table><caption>Property definitions</caption><thead><tr><th>Name</th><th>Key</th><th>Type</th><th>Action</th></tr></thead><tbody><tr v-for="item in definitions" :key="item.id"><td>{{item.displayName}}</td><td>{{item.key}}</td><td>{{item.type}}</td><td><button :aria-label="`Delete ${item.displayName}`" @click="remove(item.id)">Delete</button></td></tr></tbody></table>
</main></template>
<style scoped>.admin-properties{max-width:60rem;padding:1rem}form{display:flex;gap:.5rem;flex-wrap:wrap}label{display:grid;gap:.2rem}table{width:100%;margin-top:1rem;border-collapse:collapse}th,td{text-align:left;padding:.5rem;border-bottom:1px solid #ddd}@media(max-width:600px){.admin-properties{padding:.75rem}}</style>
