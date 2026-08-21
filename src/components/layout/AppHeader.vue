<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useFolderStore } from '@/stores/folders'
import { useDialogStore } from '@/stores/dialog'
import { useEditorUiStore } from '@/stores/editorUi'
import { postWikiFullSync } from '@/api/sync'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import { getLocale, toggleLocale } from '@/i18n'
import ThemeModeIcon from './ThemeModeIcon.vue'
import MdwikiMark from './MdwikiMark.vue'

const { t } = useI18n()
const auth = useAuthStore()
const folderStore = useFolderStore()
const dialog = useDialogStore()
const themeStore = useThemeStore()
const editorUi = useEditorUiStore()
const { mobileNavOpen } = storeToRefs(editorUi)
const router = useRouter()
const route = useRoute()
const searchQuery = ref('')
const syncWikiLoading = ref(false)

async function onSyncWikiFromDisk() {
  const ok = await dialog.confirm(t('admin.syncWikiConfirm'), {
    title: t('admin.syncWikiTitle'),
    confirmLabel: t('admin.syncWikiButton')
  })
  if (!ok) return
  syncWikiLoading.value = true
  try {
    const { data } = await postWikiFullSync()
    await folderStore.fetchTree(true)
    await dialog.alert(t('admin.syncWikiDone', { added: data.added, updated: data.updated, removed: data.removed }))
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('admin.syncWikiFailed')))
  } finally {
    syncWikiLoading.value = false
  }
}

const graphLinkTo = computed(() => {
  if (route.name === 'page' && typeof route.params.slug === 'string' && route.params.slug.length > 0) {
    return { name: 'wiki-graph', query: { highlight: route.params.slug } }
  }
  return { name: 'wiki-graph' }
})

// Общие ссылки desktop- и mobile-навигации (Admin/sync/logout добавляются отдельно).
const navLinks = computed<{ to: RouteLocationRaw; label: string; title?: string }[]>(() => [
  { to: graphLinkTo.value, label: t('header.graph'), title: t('header.graphTitle') },
  { to: '/broken-links', label: t('header.brokenLinks') },
  { to: '/tasks', label: t('header.tasks') },
  { to: '/attachments', label: t('header.attachments') },
  { to: '/profile', label: auth.username ?? '' }
])

const themeTitle = computed(() => {
  const m = themeStore.mode
  return m === 'light' ? t('header.themeLight') : m === 'dark' ? t('header.themeDark') : t('header.themeSystem')
})

const localeLabel = computed(() => (getLocale() === 'ru' ? 'RU' : 'EN'))

function toggleTheme() {
  themeStore.toggle()
}

function onSearch() {
  if (searchQuery.value.trim()) {
    editorUi.closeMobileOverlays()
    router.push({ name: 'search', query: { q: searchQuery.value } })
  }
}

function logout() {
  editorUi.closeMobileOverlays()
  auth.logout()
  router.push({ name: 'login' })
}

function onNavClick() {
  editorUi.closeMobileOverlays()
}
</script>

<template>
  <header class="app-header">
    <button
      type="button"
      class="icon-btn sidebar-toggle show-mobile-only"
      :aria-label="t('header.openDocuments')"
      @click="editorUi.toggleMobileSidebar()"
    >
      <span class="material-symbols-outlined notranslate" translate="no">menu</span>
    </button>

    <router-link to="/" class="logo" @click="onNavClick">
      <MdwikiMark class="logo-mark" />
      <span>MDWiki</span>
    </router-link>

    <form class="search-form" @submit.prevent="onSearch">
      <input v-model="searchQuery" :placeholder="t('header.searchPlaceholder')" type="search" />
    </form>

    <nav class="header-nav hide-mobile" :aria-label="t('header.mainNav')">
      <router-link
        v-for="link in navLinks"
        :key="link.label"
        :to="link.to"
        class="nav-link"
        :title="link.title"
        @click="onNavClick"
      >
        {{ link.label }}
      </router-link>
      <router-link
        v-if="auth.isAdmin"
        to="/admin/users"
        class="nav-link"
        :class="{ 'is-active': route.path.startsWith('/admin') }"
        @click="onNavClick"
      >
        {{ t('header.admin') }}
      </router-link>
      <button
        v-if="auth.isAdmin"
        type="button"
        class="sync-disk-btn hide-narrow"
        :disabled="syncWikiLoading"
        :title="t('admin.syncWikiTitle')"
        @click="onSyncWikiFromDisk"
      >
        {{ syncWikiLoading ? '…' : t('admin.syncWikiButton') }}
      </button>
      <button class="theme-toggle locale-toggle" @click="toggleLocale()" :title="t('header.language')">
        <span class="locale-label">{{ localeLabel }}</span>
      </button>
      <button class="theme-toggle" @click="toggleTheme()" :title="themeTitle">
        <ThemeModeIcon :mode="themeStore.mode" />
      </button>
      <button class="btn-secondary logout-btn hide-narrow" @click="logout">{{ t('header.logout') }}</button>
    </nav>

    <div class="header-actions-mobile show-mobile-only">
      <button class="theme-toggle locale-toggle" @click="toggleLocale()" :title="t('header.language')">
        <span class="locale-label">{{ localeLabel }}</span>
      </button>
      <button class="theme-toggle" @click="toggleTheme()" :title="themeTitle">
        <ThemeModeIcon :mode="themeStore.mode" />
      </button>
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('header.navMenu')"
        :aria-expanded="mobileNavOpen"
        @click="editorUi.toggleMobileNav()"
      >
        <span class="material-symbols-outlined notranslate" translate="no">more_vert</span>
      </button>
    </div>

    <Transition name="slide-down">
      <nav
        v-if="mobileNavOpen"
        class="mobile-nav-menu show-mobile-only"
        :aria-label="t('header.mobileNav')"
      >
        <div class="mobile-nav-title">
          <MdwikiMark class="logo-mark" />
          <span>MDWiki</span>
        </div>
        <router-link
          v-for="link in navLinks"
          :key="link.label"
          :to="link.to"
          class="mobile-nav-link"
          @click="onNavClick"
        >
          {{ link.label }}
        </router-link>
        <router-link
          v-if="auth.isAdmin"
          to="/admin/users"
          class="mobile-nav-link"
          @click="onNavClick"
        >
          {{ t('header.admin') }}
        </router-link>
        <button
          v-if="auth.isAdmin"
          type="button"
          class="mobile-nav-link mobile-nav-btn"
          :disabled="syncWikiLoading"
          @click="onSyncWikiFromDisk(); onNavClick()"
        >
          {{ syncWikiLoading ? '…' : t('admin.syncWikiButton') }}
        </button>
        <button type="button" class="mobile-nav-link mobile-nav-btn mobile-nav-logout" @click="logout">
          {{ t('header.logout') }}
        </button>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 16px;
  height: var(--app-header-height);
  background: color-mix(in srgb, var(--color-bg) 82%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 110;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.3px;
  transition: color 0.15s;
  flex-shrink: 0;
}

.logo-mark {
  width: 22px;
  height: 22px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.logo:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.logo:hover .logo-mark {
  color: var(--color-primary-hover);
}

.search-form {
  flex: 1;
  min-width: 0;
  max-width: 360px;
}

.search-form input {
  width: 100%;
  font-size: 13px;
  padding: 6px 12px;
  background: var(--color-bg-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius);
  transition: all 0.2s ease;
  outline: none;
}

.search-form input:focus {
  background: var(--color-bg);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 0;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.nav-link:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-bg-hover);
  text-decoration: none;
}

.nav-link:hover::after {
  width: 50%;
}

.nav-link.router-link-active,
.nav-link.is-active {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  font-weight: 600;
}

.nav-link.router-link-active::after,
.nav-link.is-active::after {
  width: 70%;
}

.icon-btn,
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.icon-btn:hover,
.theme-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.locale-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.icon-btn .material-symbols-outlined {
  font-size: 20px;
  line-height: 1;
}

.sync-disk-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.sync-disk-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-hover);
  border-color: var(--color-text-faint);
}

.sync-disk-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.header-actions-mobile {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.mobile-nav-menu {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0 10px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
  overflow: hidden;
}

.mobile-nav-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.3px;
  padding: 6px 4px 10px;
}

.mobile-nav-link {
  display: block;
  width: 100%;
  padding: 10px 4px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  border-radius: 6px;
  cursor: pointer;
}

.mobile-nav-link:hover {
  background: var(--color-bg-hover);
  text-decoration: none;
}

.mobile-nav-btn {
  font-family: inherit;
}

.mobile-nav-logout {
  color: var(--color-danger);
}

/* Mobile nav slide-down transition */
.slide-down-enter-active {
  transition: all 0.25s ease-out;
}

.slide-down-leave-active {
  transition: all 0.2s ease-in;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-width: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 400px;
}

@media (max-width: 767px) {
  .app-header {
    padding: 0 12px;
    gap: 8px;
    height: auto;
    min-height: var(--app-header-height);
  }

  .search-form {
    order: 3;
    flex: 1 1 100%;
    max-width: none;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .app-header {
    padding: 0 14px;
    gap: 12px;
  }

  .search-form {
    max-width: 280px;
  }

  .nav-link {
    padding: 0 8px;
    font-size: 11px;
  }
}
</style>
