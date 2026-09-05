<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()
</script>

<template>
  <nav class="discovery-nav" :aria-label="t('pkm.discovery')">
    <router-link to="/links/unlinked" :aria-current="route.name === 'unlinked-mentions' ? 'page' : undefined">
      {{ t('pkm.unlinked') }}
    </router-link>
    <router-link to="/links/orphans" :aria-current="route.name === 'orphans' ? 'page' : undefined">
      {{ t('pkm.orphans') }}
    </router-link>
  </nav>
</template>

<style scoped>
.discovery-nav{display:flex;gap:8px;margin-bottom:20px}.discovery-nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:1px solid var(--color-border);border-radius:6px;text-decoration:none}.discovery-nav a[aria-current=page]{color:var(--color-primary);border-color:var(--color-primary);background:color-mix(in srgb,var(--color-primary) 10%,transparent)}
</style>
