<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as captures from '@/api/captures'
import type { CaptureResponse } from '@/types'
import { useCaptureSubmit } from '@/composables/useCaptureSubmit'

defineProps<{ panelId: string; labelledBy: string }>()
const emit = defineEmits<{ captured: [CaptureResponse] }>()

const { t } = useI18n()
const title = ref('')
const url = ref('')
const note = ref('')

const { busy, error, run: submit } = useCaptureSubmit({
  execute: async () => {
    const { data } = await captures.captureUrl({
      url: url.value,
      note: note.value || undefined,
      title: title.value || undefined,
    })
    return data
  },
  failureMessage: () => t('pkm.captureFailed'),
  reset: () => {
    title.value = ''
    url.value = ''
    note.value = ''
  },
  onCaptured: (data) => emit('captured', data),
})
</script>

<template>
  <form :id="panelId" class="capture-form" role="tabpanel" :aria-labelledby="labelledBy" @submit.prevent="submit">
    <label>{{ t('pkm.titleOptional') }}<input v-model="title" maxlength="500" /></label>
    <label>{{ t('pkm.url') }}<input v-model="url" type="url" required /></label>
    <label>{{ t('pkm.noteOptional') }}<textarea v-model="note" rows="5" /></label>
    <button class="btn-primary" type="submit" :disabled="busy">
      {{ busy ? t('common.saving') : t('pkm.capture') }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>

<style src="./capture-form.css"></style>
