<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReadingTheme } from '@/types'
import MdwikiMark from '@/components/layout/MdwikiMark.vue'

const { t } = useI18n()

const props = defineProps<{
  title?: string
  fontSize: number
  fontMin: number
  fontMax: number
  theme: ReadingTheme
  tocVisible: boolean
  annotationsVisible?: boolean
}>()

const emit = defineEmits<{
  'update:fontSize': [value: number]
  'update:theme': [value: ReadingTheme]
  'update:tocVisible': [value: boolean]
  'update:annotationsVisible': [value: boolean]
  find: []
  exit: []
  exportPdf: []
  exportMarkdown: []
}>()

const themeOptions = computed<Array<{ id: ReadingTheme; ariaLabel: string; title: string; className: string }>>(() => [
  { id: 'white', ariaLabel: t('reading.themeWhiteBg'), title: t('reading.themeWhite'), className: 'theme-white' },
  { id: 'paper', ariaLabel: t('reading.themePaperBg'), title: t('reading.themePaper'), className: 'theme-paper' },
  { id: 'dark', ariaLabel: t('reading.themeDarkBg'), title: t('reading.themeDark'), className: 'theme-dark' }
])

function onFontInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:fontSize', Number(target.value))
}

function setTheme(theme: ReadingTheme) {
  emit('update:theme', theme)
}

function toggleToc() {
  emit('update:tocVisible', !props.tocVisible)
}
</script>

<template>
  <router-link to="/" class="reading-logo">
    <MdwikiMark class="reading-logo-mark" />
    <span>MDWiki</span>
  </router-link>
  <div class="reading-title" :title="props.title || ''">{{ props.title || t('common.untitled') }}</div>
  <div class="reading-controls" :class="{ 'theme-dark': props.theme === 'dark' }">
    <input
      class="reading-font-slider"
      type="range"
      :value="props.fontSize"
      :min="props.fontMin"
      :max="props.fontMax"
      step="1"
      :aria-label="t('reading.fontSize')"
      :title="t('reading.fontSize')"
      @input="onFontInput"
    />
    <span class="reading-font-size">{{ props.fontSize }}px</span>
    <div class="reading-theme-swatches" role="radiogroup" :aria-label="t('reading.bgStyle')">
      <button
        v-for="option in themeOptions"
        :key="option.id"
        type="button"
        class="reading-theme-dot"
        :class="[option.className, { active: props.theme === option.id }]"
        :aria-label="option.ariaLabel"
        :title="option.title"
        @click="setTheme(option.id)"
      />
    </div>
    <button
      type="button"
      class="reading-toc-toggle"
      :class="{ active: props.tocVisible }"
      :title="t('reading.toc')"
      :aria-label="t('reading.toc')"
      @click="toggleToc"
    >
      <span class="material-symbols-outlined notranslate" translate="no">toc</span>
    </button>
    <button
      type="button"
      class="reading-annotations-toggle"
      :class="{ active: props.annotationsVisible }"
      :title="t('reading.annotations')"
      :aria-label="t('reading.annotations')"
      @click="emit('update:annotationsVisible', !(props.annotationsVisible ?? false))"
    >
      <span class="material-symbols-outlined notranslate" translate="no">chat_bubble</span>
    </button>
    <button
      type="button"
      class="reading-find-btn"
      :title="t('editor.findTitle')"
      :aria-label="t('editor.findTitle')"
      @click="emit('find')"
    >
      <span class="material-symbols-outlined notranslate" translate="no">search</span>
    </button>
    <button
      type="button"
      class="reading-export-btn"
      :title="t('export.mdButton')"
      :aria-label="t('export.mdButton')"
      @click="emit('exportMarkdown')"
    >
      <span class="material-symbols-outlined notranslate" translate="no">markdown</span>
    </button>
    <button
      type="button"
      class="reading-export-btn"
      :title="t('export.pdfButton')"
      :aria-label="t('export.pdfButton')"
      @click="emit('exportPdf')"
    >
      <span class="material-symbols-outlined notranslate" translate="no">picture_as_pdf</span>
    </button>
  </div>
  <button
    type="button"
    class="reading-exit-btn"
    :title="t('reading.exit')"
    :aria-label="t('reading.exit')"
    @click="emit('exit')"
  >
    <span class="material-symbols-outlined notranslate" translate="no">close_fullscreen</span>
  </button>
</template>

<style scoped>
.reading-logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.3px;
}

.reading-logo-mark {
  width: 22px;
  height: 22px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.reading-logo:hover {
  color: var(--color-primary);
}

.reading-logo:hover .reading-logo-mark {
  color: var(--color-primary-hover);
}

.reading-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.reading-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.reading-font-slider {
  width: 130px;
}

.reading-font-size {
  min-width: 42px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.reading-controls.theme-dark .reading-font-size {
  color: #aeb8c7;
}

.reading-theme-swatches {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.reading-theme-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  padding: 0;
}

.reading-theme-dot.theme-white {
  background: #ffffff;
}

.reading-theme-dot.theme-paper {
  background: #f6f1e3;
}

.reading-theme-dot.theme-dark {
  background: #0f1115;
}

.reading-theme-dot.active {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.reading-export-btn,
.reading-find-btn,
.reading-toc-toggle,
.reading-annotations-toggle {
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.reading-toc-toggle.active,
.reading-annotations-toggle.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.reading-export-btn .material-symbols-outlined,
.reading-find-btn .material-symbols-outlined,
.reading-toc-toggle .material-symbols-outlined,
.reading-annotations-toggle .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}

.reading-exit-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg) 92%, transparent);
  color: var(--color-text);
  border-radius: 50%;
  padding: 0;
}

.reading-exit-btn .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}

@media (max-width: 767px) {
  .reading-logo {
    font-size: 13px;
  }

  .reading-title {
    display: none;
  }

  .reading-font-slider {
    width: 72px;
  }

  .reading-font-size {
    min-width: 36px;
    font-size: 11px;
  }

  .reading-theme-dot {
    width: 18px;
    height: 18px;
  }

  .reading-toc-toggle,
  .reading-exit-btn {
    width: 32px;
    height: 32px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .reading-font-slider {
    width: 100px;
  }
}
</style>
