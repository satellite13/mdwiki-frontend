<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBackendVersion, type BackendVersion } from '@/api/version'

const { t } = useI18n()
const frontendVersion = __APP_VERSION_TAG__
const backend = ref<BackendVersion | null>(null)
const backendError = ref(false)
const collapsed = ref(true)

const backendFull = computed(() => {
  if (backend.value) {
    return backend.value.versionTag || `${backend.value.version} (${backend.value.gitSha})`
  }
  if (backendError.value) return t('common.backendVersionUnavailable')
  return '…'
})

/** Короткий ярлык для узкого сайдбара; полный тег — в title. */
function shortVersion(tag: string): string {
  if (!tag || tag === '…') return tag
  if (tag === t('common.backendVersionUnavailable')) return tag
  // v0.1.19-23-g58c8db4-fe-235856 → v0.1.19 · 23-g58c8db4
  const match = tag.match(/^(v?\d+\.\d+\.\d+)(?:-(\d+)-g([0-9a-f]+))?(.*)$/i)
  if (!match) return tag.length > 22 ? `${tag.slice(0, 20)}…` : tag
  const [, base, commits, sha, rest] = match
  const dirty = /dirty/i.test(rest || '')
  const core = commits && sha ? `${base} · ${commits}-g${sha.slice(0, 7)}` : base!
  return dirty ? `${core} · dirty` : core!
}

onMounted(async () => {
  try {
    backend.value = (await getBackendVersion()).data
  } catch {
    backendError.value = true
  }
})
</script>

<template>
  <footer class="sidebar-versions" :class="{ collapsed }" :aria-label="t('common.versionsTitle')">
    <button
      type="button"
      class="versions-toggle"
      :aria-expanded="!collapsed"
      :aria-controls="'sidebar-versions-body'"
      @click="collapsed = !collapsed"
    >
      <span class="versions-mark" aria-hidden="true" />
      <span class="versions-title">{{ t('common.versionsTitle') }}</span>
      <span :class="['versions-chevron', { collapsed }]" aria-hidden="true">▾</span>
    </button>

    <ul v-show="!collapsed" id="sidebar-versions-body" class="version-list">
      <li
        class="version-row"
        :title="`${t('common.frontendVersion')}: ${frontendVersion}`"
      >
        <span class="version-icon ui" aria-hidden="true">
          <span class="material-symbols-outlined notranslate" translate="no">web</span>
        </span>
        <div class="version-meta">
          <span class="version-name">{{ t('common.frontendShort') }}</span>
          <span class="version-value">{{ shortVersion(frontendVersion) }}</span>
        </div>
      </li>
      <li
        class="version-row"
        :class="{ error: backendError, loading: !backend && !backendError }"
        :title="`${t('common.backendVersion')}: ${backendFull}`"
      >
        <span class="version-icon api" aria-hidden="true">
          <span class="material-symbols-outlined notranslate" translate="no">dns</span>
        </span>
        <div class="version-meta">
          <span class="version-name">{{ t('common.backendShort') }}</span>
          <span class="version-value">{{ shortVersion(backendFull) }}</span>
        </div>
      </li>
    </ul>
  </footer>
</template>

<style scoped>
.sidebar-versions {
  margin-top: auto;
  flex-shrink: 0;
  padding: 8px 10px 10px;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-bg-tertiary) 55%, transparent) 0%,
      var(--color-bg-secondary) 40%
    );
}

.sidebar-versions.collapsed {
  padding-bottom: 8px;
}

.versions-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  margin: 0;
  padding: 4px 2px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
}

.versions-toggle:hover .versions-title,
.versions-toggle:hover .versions-chevron {
  color: var(--color-text-muted);
}

.versions-mark {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
  flex-shrink: 0;
}

.versions-title {
  flex: 1;
  min-width: 0;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-faint);
}

.versions-chevron {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-faint);
  transition: transform 0.15s ease;
}

.versions-chevron.collapsed {
  transform: rotate(-90deg);
}

.version-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-bg) 72%, transparent);
}

.version-row.loading .version-value {
  opacity: 0.55;
}

.version-row.error {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
}

.version-row.error .version-value {
  color: var(--color-danger);
}

.version-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 7px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.version-icon.api {
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-bg-tertiary) 80%, var(--color-border));
}

.version-icon .material-symbols-outlined {
  font-size: 16px;
  line-height: 1;
}

.version-meta {
  display: grid;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.version-name {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.version-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.3;
  color: var(--color-text);
}

@media (prefers-reduced-motion: no-preference) {
  .version-row {
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .version-row:hover {
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
    background: var(--color-bg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .versions-chevron {
    transition: none;
  }
}
</style>
