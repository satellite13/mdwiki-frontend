<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const links = [
  { to: '/admin/users', labelKey: 'admin.openUsersSettings' },
  { to: '/admin/properties', labelKey: 'admin.openProperties' },
  { to: '/admin/embedding', labelKey: 'admin.openEmbeddingSettings' },
  { to: '/admin/trash', labelKey: 'admin.openTrash' },
] as const
</script>

<template>
  <div class="admin-nav" :aria-label="t('admin.sections')">
    <router-link
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="admin-nav-link"
    >
      {{ t(link.labelKey) }}
    </router-link>
  </div>
</template>

<style scoped>
.admin-nav {
  display: flex;
  gap: 6px;
  width: fit-content;
  max-width: 100%;
  flex-wrap: wrap;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  margin-bottom: 16px;
}

.admin-nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 13px;
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.admin-nav-link:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-bg-hover);
}

.admin-nav-link.router-link-exact-active {
  color: var(--color-primary);
  font-weight: 600;
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

@media (max-width: 767px) {
  .admin-nav {
    width: 100%;
  }

  .admin-nav-link {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>
