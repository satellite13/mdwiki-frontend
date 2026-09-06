<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import type { CaptureResponse } from '@/types'
import InboxTextCapture from './InboxTextCapture.vue'
import InboxUrlCapture from './InboxUrlCapture.vue'
import InboxImageCapture from './InboxImageCapture.vue'

const { t } = useI18n()
const auth = useAuthStore()
const tab = ref<'text' | 'url' | 'image'>('text')
const result = ref<CaptureResponse | null>(null)

const kinds = ['text', 'url', 'image'] as const

function choose(next: typeof tab.value) {
  tab.value = next
}

function onTabKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  const delta = event.key === 'ArrowRight' ? 1 : -1
  const next = kinds[(kinds.indexOf(tab.value) + delta + kinds.length) % kinds.length]!
  choose(next)
  const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabs?.[kinds.indexOf(next)]?.focus()
}

function onCaptured(response: CaptureResponse) {
  result.value = response
}
</script>

<template>
  <div class="grouped-page">
    <div class="page-header">
      <div>
        <h1>{{ t('pkm.inbox') }}</h1>
        <p class="page-subtitle">{{ t('pkm.inboxSubtitle') }}</p>
      </div>
    </div>

    <p v-if="!auth.isEditor" class="empty-state">{{ t('pkm.readerCapture') }}</p>
    <template v-else>
      <div class="inbox-tabs" role="tablist" :aria-label="t('pkm.captureType')">
        <button
          v-for="kind in kinds"
          :id="`capture-tab-${kind}`"
          :key="kind"
          type="button"
          role="tab"
          :aria-controls="`capture-panel-${kind}`"
          :aria-selected="tab === kind"
          :tabindex="tab === kind ? 0 : -1"
          @click="choose(kind)"
          @keydown="onTabKey"
        >
          {{ t(`pkm.${kind}`) }}
        </button>
      </div>

      <section class="group-card inbox-card">
        <InboxTextCapture
          v-if="tab === 'text'"
          panel-id="capture-panel-text"
          labelled-by="capture-tab-text"
          @captured="onCaptured"
        />
        <InboxUrlCapture
          v-else-if="tab === 'url'"
          panel-id="capture-panel-url"
          labelled-by="capture-tab-url"
          @captured="onCaptured"
        />
        <InboxImageCapture
          v-else
          panel-id="capture-panel-image"
          labelled-by="capture-tab-image"
          @captured="onCaptured"
        />
      </section>
    </template>

    <div
      v-if="result"
      class="capture-success"
      role="status"
      aria-live="polite"
    >
      <div class="capture-success-body">
        <p class="capture-success-label">{{ t('pkm.captured') }}</p>
        <router-link class="capture-success-link" :to="`/page/${result.page.slug}`">
          {{ result.page.title }}
        </router-link>
      </div>
      <div class="capture-success-actions">
        <router-link class="btn-primary" :to="`/page/${result.page.slug}`">
          {{ t('pkm.capturedOpen') }}
        </router-link>
        <button type="button" class="btn-secondary" @click="result = null">
          {{ t('pkm.capturedDismiss') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inbox-tabs {
  display: inline-flex;
  gap: 3px;
  margin: 0 0 1.25rem;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary, color-mix(in srgb, var(--color-border) 18%, transparent));
}

.inbox-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.inbox-tabs button[aria-selected='true'] {
  background: var(--color-bg, #fff);
  color: var(--color-primary);
  box-shadow: var(--shadow, 0 1px 2px rgba(0, 0, 0, 0.08));
}

.inbox-card {
  padding: 1rem 1.1rem 1.15rem;
}

.capture-success {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem 1rem;
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg));
}

.capture-success-body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.capture-success-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.capture-success-link {
  color: var(--color-text);
  font-weight: 600;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.capture-success-link:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.capture-success-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.capture-success-actions .btn-primary,
.capture-success-actions .btn-secondary {
  min-height: 38px;
  text-decoration: none;
}

@media (max-width: 767px) {
  .inbox-tabs {
    display: flex;
    width: 100%;
  }

  .inbox-tabs button {
    flex: 1;
    padding: 0 8px;
  }

  .capture-success-actions {
    width: 100%;
  }

  .capture-success-actions .btn-primary,
  .capture-success-actions .btn-secondary {
    flex: 1;
    justify-content: center;
    text-align: center;
  }
}
</style>
