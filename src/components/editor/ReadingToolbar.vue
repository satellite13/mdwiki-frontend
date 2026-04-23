<script setup lang="ts">
type ReadingTheme = 'white' | 'paper' | 'dark'

const props = defineProps<{
  title?: string
  fontSize: number
  fontMin: number
  fontMax: number
  theme: ReadingTheme
  tocVisible: boolean
}>()

const emit = defineEmits<{
  'update:fontSize': [value: number]
  'update:theme': [value: ReadingTheme]
  'update:tocVisible': [value: boolean]
  exit: []
}>()

const themeOptions: Array<{ id: ReadingTheme; ariaLabel: string; title: string; className: string }> = [
  { id: 'white', ariaLabel: 'White background', title: 'White', className: 'theme-white' },
  { id: 'paper', ariaLabel: 'Paper background', title: 'Paper', className: 'theme-paper' },
  { id: 'dark', ariaLabel: 'Dark background', title: 'Dark', className: 'theme-dark' }
]

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
  <router-link to="/" class="reading-logo">MDWiki</router-link>
  <div class="reading-title" :title="props.title || ''">{{ props.title || 'Untitled' }}</div>
  <div class="reading-controls" :class="{ 'theme-dark': props.theme === 'dark' }">
    <input
      class="reading-font-slider"
      type="range"
      :value="props.fontSize"
      :min="props.fontMin"
      :max="props.fontMax"
      step="1"
      aria-label="Reading font size"
      title="Reading font size"
      @input="onFontInput"
    />
    <span class="reading-font-size">{{ props.fontSize }}px</span>
    <div class="reading-theme-swatches" role="radiogroup" aria-label="Reading background style">
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
      title="Оглавление"
      aria-label="Оглавление"
      @click="toggleToc"
    >
      <span class="material-symbols-outlined notranslate" translate="no">toc</span>
    </button>
  </div>
  <button
    type="button"
    class="reading-exit-btn"
    title="Exit reading mode"
    aria-label="Exit reading mode"
    @click="emit('exit')"
  >
    <span class="material-symbols-outlined notranslate" translate="no">close_fullscreen</span>
  </button>
</template>

<style scoped>
.reading-logo {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.3px;
}

.reading-logo:hover {
  color: var(--color-primary);
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

.reading-toc-toggle {
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

.reading-toc-toggle.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.reading-toc-toggle .material-symbols-outlined {
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
</style>
