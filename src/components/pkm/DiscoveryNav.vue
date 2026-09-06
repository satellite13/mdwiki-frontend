<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()
</script>

<template>
  <nav class="discovery-nav" role="tablist" :aria-label="t('pkm.discovery')">
    <router-link
      to="/links/unlinked"
      role="tab"
      :aria-selected="route.name === 'unlinked-mentions'"
      :aria-current="route.name === 'unlinked-mentions' ? 'page' : undefined"
    >
      {{ t('pkm.unlinked') }}
    </router-link>
    <router-link
      to="/links/orphans"
      role="tab"
      :aria-selected="route.name === 'orphans'"
      :aria-current="route.name === 'orphans' ? 'page' : undefined"
    >
      {{ t('pkm.orphans') }}
    </router-link>
    <router-link
      to="/broken-links"
      role="tab"
      :aria-selected="route.name === 'broken-links'"
      :aria-current="route.name === 'broken-links' ? 'page' : undefined"
    >
      {{ t('header.brokenLinks') }}
    </router-link>
  </nav>
</template>

<style scoped>
.discovery-nav {
  display: inline-flex;
  flex-shrink: 0;
  gap: 3px;
  margin: 0;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.discovery-nav a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  color: var(--color-text-muted);
  text-decoration: none;
  font: inherit;
  white-space: nowrap;
}

.discovery-nav a[aria-current='page'],
.discovery-nav a[aria-selected='true'] {
  background: var(--color-bg);
  color: var(--color-primary);
  box-shadow: var(--shadow);
}

@media (max-width: 767px) {
  .discovery-nav {
    width: 100%;
  }

  .discovery-nav a {
    flex: 1;
    padding: 0 8px;
    font-size: 0.85rem;
  }
}
</style>
