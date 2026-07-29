<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="not-found-page">
    <h1>404</h1>
    <p class="hint">{{ t('notFound.title') }}</p>
    <router-link to="/" class="btn-secondary">{{ t('notFound.back') }}</router-link>
  </div>
</template>

<style scoped>
.not-found-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 16px;
  text-align: center;
}

.not-found-page h1 {
  font-size: 3rem;
  margin: 0;
}

.hint {
  color: var(--color-text-muted);
  margin: 0 0 8px;
}
</style>
