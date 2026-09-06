<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import * as api from '@/api/dailyNotes'
import { isApiErrorWithStatus, getApiErrorMessage } from '@/utils/apiError'
import { localIsoDate, validIsoDate } from '@/utils/pkm'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
const loading = ref(true)
const error = ref('')
const missing = ref(false)
let controller: AbortController | null = null
let generation = 0

onBeforeUnmount(() => {
  generation++
  controller?.abort()
  controller = null
})

watch(() => route.params.date, async (raw) => {
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  const requestId = ++generation
  const current = () => requestId === generation && !requestController.signal.aborted
  const date = typeof raw === 'string' && raw ? raw : localIsoDate()
  loading.value = true
  error.value = ''
  missing.value = false
  if (!validIsoDate(date)) {
    loading.value = false
    error.value = t('pkm.invalidDate')
    return
  }
  try {
    const { data } = await api.getDailyNote(date, requestController.signal)
    if (current()) await router.replace(`/page/${data.page.slug}`)
  } catch (cause) {
    if (!current()) return
    if (isApiErrorWithStatus(cause, 404)) {
      if (!auth.isEditor) {
        missing.value = true
      } else {
        try {
          const { data } = await api.putDailyNote(date, requestController.signal)
          if (current()) await router.replace(`/page/${data.page.slug}`)
        } catch (createCause) {
          if (current()) error.value = getApiErrorMessage(createCause, t('pkm.dailyFailed'))
        }
      }
    } else if ((cause as { code?: string }).code !== 'ERR_CANCELED') {
      error.value = getApiErrorMessage(cause, t('pkm.dailyFailed'))
    }
  } finally {
    if (current()) loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <main class="pkm-state" aria-live="polite">
    <p v-if="loading">{{ t('common.loading') }}</p>
    <p v-else-if="missing">{{ t('pkm.dailyMissingReader') }}</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>.pkm-state{display:grid;place-items:center;height:100%;padding:24px;color:var(--color-text-muted)}</style>
