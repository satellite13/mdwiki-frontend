<script setup lang="ts">
import { ref } from 'vue'
import IconActionButton from '@/components/ui/IconActionButton.vue'
import ToolbarDropdown from '@/components/ui/ToolbarDropdown.vue'
import type { ToolbarAction } from './toolbarTypes'

const TABLE_GRID_MAX = 8
const headingLevels = [1, 2, 3, 4, 5] as const

const props = defineProps<{
  inlineFormatActions: ToolbarAction[]
  listAndBlockActions: ToolbarAction[]
  quickInsertActions: ToolbarAction[]
  historyActions: ToolbarAction[]
  modeSwitchActions: ToolbarAction[]
  emojiItems: string[]
  onApplyHeading: (level: number) => void
  onApplyTableSize: (cols: number, rows: number) => void
  onApplyEmoji: (emoji: string) => void
}>()

const headingMenuOpen = ref(false)
const tableMenuOpen = ref(false)
const emojiMenuOpen = ref(false)
const tableHoverCols = ref(1)
const tableHoverRows = ref(1)

function toggleHeadingMenu() {
  headingMenuOpen.value = !headingMenuOpen.value
  tableMenuOpen.value = false
  emojiMenuOpen.value = false
}

function toggleTableMenu() {
  tableMenuOpen.value = !tableMenuOpen.value
  headingMenuOpen.value = false
  emojiMenuOpen.value = false
}

function toggleEmojiMenu() {
  emojiMenuOpen.value = !emojiMenuOpen.value
  headingMenuOpen.value = false
  tableMenuOpen.value = false
}

function setTableHover(cols: number, rows: number) {
  tableHoverCols.value = cols
  tableHoverRows.value = rows
}

function getTableGridCoords(idx: number) {
  return {
    cols: ((idx - 1) % TABLE_GRID_MAX) + 1,
    rows: Math.floor((idx - 1) / TABLE_GRID_MAX) + 1
  }
}

function onTableGridHover(idx: number) {
  const { cols, rows } = getTableGridCoords(idx)
  setTableHover(cols, rows)
}

function onTableGridClick(idx: number) {
  const { cols, rows } = getTableGridCoords(idx)
  tableMenuOpen.value = false
  props.onApplyTableSize(cols, rows)
}

function isTableGridCellActive(idx: number): boolean {
  const { cols, rows } = getTableGridCoords(idx)
  return cols <= tableHoverCols.value && rows <= tableHoverRows.value
}

function onHeadingClick(level: number) {
  headingMenuOpen.value = false
  props.onApplyHeading(level)
}

function onEmojiClick(emoji: string) {
  emojiMenuOpen.value = false
  props.onApplyEmoji(emoji)
}
</script>

<template>
  <IconActionButton
    v-for="action in inlineFormatActions"
    :key="action.key"
    :title="action.title"
    :ariaLabel="action.ariaLabel"
    :icon="action.icon"
    @click="action.onClick"
  />
  <span class="sep" />
  <ToolbarDropdown v-model="headingMenuOpen" class="heading-menu">
    <template #trigger>
      <IconActionButton
        title="Heading levels"
        ariaLabel="Heading levels"
        icon="title"
        @click="toggleHeadingMenu"
      />
    </template>
    <div class="heading-menu-list">
      <button
        v-for="level in headingLevels"
        :key="level"
        type="button"
        class="heading-menu-item"
        @click="onHeadingClick(level)"
      >
        H{{ level }}
      </button>
    </div>
  </ToolbarDropdown>
  <IconActionButton
    v-for="action in listAndBlockActions"
    :key="action.key"
    :title="action.title"
    :ariaLabel="action.ariaLabel"
    :icon="action.icon"
    @click="action.onClick"
  />
  <span class="sep" />
  <IconActionButton
    v-for="action in quickInsertActions"
    :key="action.key"
    :title="action.title"
    :ariaLabel="action.ariaLabel"
    :icon="action.icon"
    @click="action.onClick"
  />
  <ToolbarDropdown v-model="tableMenuOpen" class="table-menu">
    <template #trigger>
      <IconActionButton
        title="Insert table"
        ariaLabel="Insert table"
        icon="grid_on"
        @click="toggleTableMenu"
      />
    </template>
    <div class="table-menu-list">
      <div
        class="table-grid"
        :style="{ gridTemplateColumns: `repeat(${TABLE_GRID_MAX}, 16px)` }"
        @mouseleave="setTableHover(1, 1)"
      >
        <button
          v-for="idx in TABLE_GRID_MAX * TABLE_GRID_MAX"
          :key="idx"
          type="button"
          class="table-grid-cell"
          :class="{ active: isTableGridCellActive(idx) }"
          @mouseenter="onTableGridHover(idx)"
          @click="onTableGridClick(idx)"
        />
      </div>
      <div class="table-grid-label">{{ tableHoverCols }} × {{ tableHoverRows }}</div>
    </div>
  </ToolbarDropdown>
  <ToolbarDropdown v-model="emojiMenuOpen" class="emoji-menu">
    <template #trigger>
      <IconActionButton
        title="Insert emoji"
        ariaLabel="Insert emoji"
        icon="sentiment_satisfied"
        @click="toggleEmojiMenu"
      />
    </template>
    <div class="emoji-menu-list">
      <button
        v-for="emoji in emojiItems"
        :key="emoji"
        type="button"
        class="emoji-item"
        :title="emoji"
        @click="onEmojiClick(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </ToolbarDropdown>
  <span class="sep" />
  <IconActionButton
    v-for="action in historyActions"
    :key="action.key"
    :title="action.title"
    :ariaLabel="action.ariaLabel"
    :icon="action.icon"
    :disabled="action.disabled"
    @click="action.onClick"
  />
  <span class="mode-switch">
    <IconActionButton
      v-for="action in modeSwitchActions"
      :key="action.key"
      :title="action.title"
      :ariaLabel="action.ariaLabel"
      :icon="action.icon"
      :active="action.active"
      @click="action.onClick"
    />
  </span>
</template>

<style scoped>
.sep {
  width: 1px;
  height: 22px;
  background: var(--color-border);
  margin: 0 2px;
}

.mode-switch {
  margin-left: auto;
  display: inline-flex;
  gap: 4px;
}

.heading-menu-list,
.table-menu-list,
.emoji-menu-list {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.heading-menu-list {
  display: grid;
  gap: 2px;
  padding: 6px;
  min-width: 64px;
}

.heading-menu-item {
  border: none;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  padding: 6px 8px;
  border-radius: 6px;
}

.heading-menu-item:hover {
  background: var(--color-bg-hover);
}

.table-menu-list {
  padding: 8px;
  width: max-content;
}

.table-grid {
  display: grid;
  gap: 3px;
}

.table-grid-cell {
  width: 16px;
  min-width: 16px;
  height: 16px;
  min-height: 16px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  border-radius: 2px;
  padding: 0;
}

.table-grid-cell.active {
  background: color-mix(in srgb, var(--color-primary) 26%, var(--color-bg-secondary));
  border-color: color-mix(in srgb, var(--color-primary) 54%, var(--color-border));
}

.table-grid-label {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.emoji-menu-list {
  width: 284px;
  max-height: 210px;
  overflow: auto;
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 4px;
}

.emoji-item {
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 18px;
}

.emoji-item:hover {
  border-color: var(--color-border);
  background: var(--color-bg-hover);
}
</style>
