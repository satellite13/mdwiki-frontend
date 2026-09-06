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
const text = ref('')

const { busy, error, run: submit } = useCaptureSubmit({
  execute: async () => {
    const { data } = await captures.captureText({
      text: text.value,
      title: title.value || undefined,
    })
    return data
  },
  failureMessage: () => t('pkm.captureFailed'),
  reset: () => {
    title.value = ''
    text.value = ''
  },
  onCaptured: (data) => emit('captured', data),
})
</script>

<template>
  <form :id="panelId" class="capture-form" role="tabpanel" :aria-labelledby="labelledBy" @submit.prevent="submit">
    <label>{{ t('pkm.titleOptional') }}<input v-model="title" maxlength="500" /></label>
    <label>{{ t('pkm.text') }}<textarea v-model="text" required rows="10" /></label>
    <button class="btn-primary" type="submit" :disabled="busy">
      {{ busy ? t('common.saving') : t('pkm.capture') }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>

<style src="./capture-form.css"></style>
