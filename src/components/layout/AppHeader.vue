<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useEditorUiStore } from '@/stores/editorUi'
import { useI18n } from 'vue-i18n'
import { getLocale, toggleLocale } from '@/i18n'
import ThemeModeIcon from './ThemeModeIcon.vue'
import MdwikiMark from './MdwikiMark.vue'
import { isCaptureShortcut } from '@/utils/pkm'

type HeaderNavLink = {
  key: string
  to: RouteLocationRaw
  label: string
  icon: string
  title?: string
}

const { t } = useI18n()
const auth = useAuthStore()
const themeStore = useThemeStore()
const editorUi = useEditorUiStore()
const { mobileNavOpen } = storeToRefs(editorUi)
const router = useRouter()
const route = useRoute()
const searchQuery = ref('')

const graphLinkTo = computed(() => {
  if (route.name === 'page' && typeof route.params.slug === 'string' && route.params.slug.length > 0) {
    return { name: 'wiki-graph', query: { highlight: route.params.slug } }
  }
  return { name: 'wiki-graph' }
})

// Группы по смыслу: захват → личная библиотека → работа → структура.
// Профиль / админ / тема / выход — иконки справа.
const navLinks = computed<HeaderNavLink[]>(() => [
  { key: 'daily', to: '/daily', label: t('pkm.today'), icon: 'today' },
  { key: 'recent', to: '/recent', label: t('pkm.recent'), icon: 'history' },
  { key: 'favorites', to: '/favorites', label: t('pkm.favorites'), icon: 'star' },
  { key: 'search-library', to: '/saved-searches', label: t('header.searchNav'), icon: 'saved_search' },
  { key: 'views', to: '/views', label: t('views.title'), icon: 'view_list' },
  { key: 'tasks', to: '/tasks', label: t('header.tasks'), icon: 'task_alt' },
  { key: 'attachments', to: '/attachments', label: t('header.attachments'), icon: 'attach_file' },
  { key: 'discovery', to: '/links/unlinked', label: t('pkm.discovery'), icon: 'explore' },
  { key: 'graph', to: graphLinkTo.value, label: t('header.graph'), icon: 'hub', title: t('header.graphTitle') },
])

const themeTitle = computed(() => {
  const m = themeStore.mode
  return m === 'light' ? t('header.themeLight') : m === 'dark' ? t('header.themeDark') : t('header.themeSystem')
})

const localeLabel = computed(() => (getLocale() === 'ru' ? 'RU' : 'EN'))
const localeTitle = computed(() => t('header.languageCurrent', { language: localeLabel.value }))

function isNavLinkActive(link: HeaderNavLink) {
  if (typeof link.to === 'string') {
    return route.path === link.to || (link.to !== '/' && route.path.startsWith(`${link.to}/`))
  }
  return 'name' in link.to && link.to.name != null && route.name === link.to.name
}

function toggleTheme() {
  themeStore.toggle()
}

function onSearch() {
  if (searchQuery.value.trim()) {
    editorUi.closeMobileOverlays()
    router.push({ name: 'search', query: { q: searchQuery.value, mode: 'hybrid' } })
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

function onGlobalKeydown(event: KeyboardEvent) {
  if (auth.isEditor && isCaptureShortcut(event)) {
    event.preventDefault()
    void router.push('/inbox')
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))
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
        v-if="auth.isEditor"
        to="/inbox"
        class="quick-capture"
        :aria-label="t('pkm.quickCapture')"
        :title="t('pkm.quickCaptureShortcut')"
        @click="onNavClick"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">add</span>
      </router-link>
      <router-link
        v-for="link in navLinks"
        :key="link.key"
        :to="link.to"
        class="nav-link"
        :class="{ 'is-active': isNavLinkActive(link) }"
        :data-nav-key="link.key"
        :aria-label="link.label"
        :aria-current="isNavLinkActive(link) ? 'page' : undefined"
        :title="link.title ?? link.label"
        @click="onNavClick"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">
          {{ link.icon }}
        </span>
        <span v-if="isNavLinkActive(link)" class="nav-link-label">{{ link.label }}</span>
      </router-link>
      <router-link
        to="/profile"
        class="theme-toggle header-icon-link"
        :class="{ 'is-active': route.path.startsWith('/profile') }"
        :title="t('profile.title')"
        :aria-label="t('profile.title')"
        @click="onNavClick"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">person</span>
      </router-link>
      <router-link
        v-if="auth.isAdmin"
        to="/admin/users"
        class="theme-toggle header-icon-link"
        :class="{ 'is-active': route.path.startsWith('/admin') }"
        :title="t('header.admin')"
        :aria-label="t('header.admin')"
        @click="onNavClick"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">settings</span>
      </router-link>
      <button
        type="button"
        class="theme-toggle locale-toggle"
        :title="localeTitle"
        :aria-label="localeTitle"
        @click="toggleLocale()"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">language</span>
      </button>
      <button class="theme-toggle" @click="toggleTheme()" :title="themeTitle">
        <ThemeModeIcon :mode="themeStore.mode" />
      </button>
      <button
        type="button"
        class="theme-toggle logout-icon"
        :title="t('header.logout')"
        :aria-label="t('header.logout')"
        @click="logout"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">logout</span>
      </button>
    </nav>

    <div class="header-actions-mobile show-mobile-only">
      <router-link
        v-if="auth.isEditor"
        to="/inbox"
        class="quick-capture"
        :aria-label="t('pkm.quickCapture')"
        :title="t('pkm.quickCaptureShortcut')"
        @click="onNavClick"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">add</span>
      </router-link>
      <router-link
        to="/profile"
        class="theme-toggle header-icon-link"
        :class="{ 'is-active': route.path.startsWith('/profile') }"
        :title="t('profile.title')"
        :aria-label="t('profile.title')"
        @click="onNavClick"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">person</span>
      </router-link>
      <router-link
        v-if="auth.isAdmin"
        to="/admin/users"
        class="theme-toggle header-icon-link"
        :class="{ 'is-active': route.path.startsWith('/admin') }"
        :title="t('header.admin')"
        :aria-label="t('header.admin')"
        @click="onNavClick"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">settings</span>
      </router-link>
      <button
        type="button"
        class="theme-toggle locale-toggle"
        :title="localeTitle"
        :aria-label="localeTitle"
        @click="toggleLocale()"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">language</span>
      </button>
      <button class="theme-toggle" @click="toggleTheme()" :title="themeTitle">
        <ThemeModeIcon :mode="themeStore.mode" />
      </button>
      <button
        type="button"
        class="theme-toggle logout-icon"
        :title="t('header.logout')"
        :aria-label="t('header.logout')"
        @click="logout"
      >
        <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">logout</span>
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
          :key="link.key"
          :to="link.to"
          class="mobile-nav-link"
          :data-nav-key="link.key"
          :aria-current="isNavLinkActive(link) ? 'page' : undefined"
          @click="onNavClick"
        >
          <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">
            {{ link.icon }}
          </span>
          <span class="mobile-nav-label">{{ link.label }}</span>
        </router-link>
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

.quick-capture {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  color: #fff;
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  text-decoration: none;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}

.quick-capture:hover {
  color: #fff;
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  text-decoration: none;
}

.quick-capture .material-symbols-outlined {
  font-size: 22px;
  line-height: 1;
  font-weight: 600;
}

.quick-capture.router-link-active {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.quick-capture:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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
  justify-content: center;
  gap: 0;
  width: 34px;
  min-width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--color-text-muted);
  text-decoration: none;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.nav-link .material-symbols-outlined {
  font-size: 19px;
  line-height: 1;
}

.nav-link:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-bg-hover);
  text-decoration: none;
}

.nav-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.nav-link.router-link-active,
.nav-link.is-active {
  width: auto;
  gap: 5px;
  padding: 0 9px;
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.nav-link-label {
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
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

a.theme-toggle {
  text-decoration: none;
}

a.theme-toggle:hover {
  text-decoration: none;
  color: var(--color-text);
}

.icon-btn:hover,
.theme-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.header-icon-link.is-active,
.header-icon-link.router-link-active {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.logout-icon:hover {
  color: var(--color-danger, #cf222e);
  border-color: color-mix(in srgb, var(--color-danger, #cf222e) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger, #cf222e) 8%, transparent);
}

.icon-btn .material-symbols-outlined,
.theme-toggle .material-symbols-outlined {
  font-size: 20px;
  line-height: 1;
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
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 8px;
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

.mobile-nav-link .material-symbols-outlined {
  width: 22px;
  color: var(--color-text-muted);
  font-size: 20px;
  line-height: 1;
  text-align: center;
  flex-shrink: 0;
}

.mobile-nav-link:hover {
  background: var(--color-bg-hover);
  text-decoration: none;
}

.mobile-nav-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
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

@media (max-width: 1023px) {
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
  .hide-mobile {
    display: none !important;
  }

  .show-mobile-only {
    display: flex !important;
  }
}
</style>
