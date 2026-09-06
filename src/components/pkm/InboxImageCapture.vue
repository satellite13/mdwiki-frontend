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
const caption = ref('')
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

const ACCEPT =
  '.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp'

function isAcceptedImage(candidate: File): boolean {
  if (candidate.type.startsWith('image/')) {
    return /^(image\/(png|jpeg|gif|webp))$/.test(candidate.type)
  }
  return /\.(png|jpe?g|gif|webp)$/i.test(candidate.name)
}

function setFile(next: File | null) {
  file.value = next
  error.value = ''
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  setFile(input.files?.[0] ?? null)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragOver.value = false
  const dropped = event.dataTransfer?.files?.[0] ?? null
  if (!dropped) return
  if (!isAcceptedImage(dropped)) {
    error.value = t('pkm.imageTypeInvalid')
    return
  }
  setFile(dropped)
  if (fileInput.value) fileInput.value.value = ''
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

const { busy, error, run } = useCaptureSubmit({
  execute: async () => {
    const selectedFile = file.value
    if (!selectedFile) throw new Error(t('pkm.imageTypeInvalid'))
    const { data } = await captures.captureImage(
      selectedFile,
      caption.value || undefined,
      title.value || undefined,
    )
    return data
  },
  failureMessage: () => t('pkm.captureFailed'),
  reset: () => {
    title.value = ''
    caption.value = ''
    setFile(null)
    if (fileInput.value) fileInput.value.value = ''
  },
  onCaptured: (data) => emit('captured', data),
})

function submit() {
  if (!file.value) return
  return run()
}
</script>

<template>
  <form :id="panelId" class="capture-form" role="tabpanel" :aria-labelledby="labelledBy" @submit.prevent="submit">
    <label>{{ t('pkm.titleOptional') }}<input v-model="title" maxlength="500" /></label>
    <div
      :class="['upload-zone', { 'drag-over': dragOver }]"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
    >
      <p>
        {{ t('attachments.dropHint') }}
        <label class="file-label">
          <input
            ref="fileInput"
            type="file"
            :accept="ACCEPT"
            hidden
            @change="onFileInput"
          />
          {{ t('attachments.browse') }}
        </label>
      </p>
    </div>
    <p v-if="file" class="file-meta">{{ file.name }} · {{ Math.ceil(file.size / 1024) }} KB</p>
    <label>{{ t('pkm.captionOptional') }}<input v-model="caption" /></label>
    <button class="btn-primary" type="submit" :disabled="busy || !file">
      {{ busy ? t('common.saving') : t('pkm.capture') }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>

<style src="./capture-form.css"></style>
