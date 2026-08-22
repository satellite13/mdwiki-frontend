<script setup lang="ts">
import type { FolderTreeNode } from '@/types'
import { bundleNodeState } from '@/utils/folderTree'

const props = defineProps<{
  nodes: FolderTreeNode[]
  selected: Set<string>
  depth?: number
  mode?: 'multi' | 'single'
  activeId?: string | null
}>()

const emit = defineEmits<{
  toggle: [nodeId: string]
  select: [nodeId: string]
}>()

const depth = props.depth ?? 0
const mode = props.mode ?? 'multi'
</script>

<template>
  <ul class="selectable-tree" :style="{ paddingLeft: depth === 0 ? '0' : '14px' }">
    <li v-for="node in nodes" :key="node.id">
      <label
        v-if="mode === 'multi'"
        class="tree-row"
        :class="{ folder: node.type === 'folder' }"
      >
        <input
          type="checkbox"
          :checked="bundleNodeState(node, selected) === 'checked'"
          :indeterminate="bundleNodeState(node, selected) === 'indeterminate'"
          @change="emit('toggle', node.id)"
        />
        <span class="row-name">{{ node.name }}</span>
        <span v-if="node.type === 'page' && node.slug" class="row-slug">{{ node.slug }}</span>
      </label>
      <button
        v-else
        type="button"
        class="tree-row"
        :class="{ folder: node.type === 'folder', active: activeId === node.id }"
        @click="emit('select', node.id)"
      >
        <span class="row-name">{{ node.name }}</span>
        <span v-if="node.type === 'page' && node.slug" class="row-slug">{{ node.slug }}</span>
      </button>
      <SelectableDocumentTree
        v-if="node.children.length > 0"
        :nodes="node.children"
        :selected="selected"
        :depth="depth + 1"
        :mode="mode"
        :active-id="activeId"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.selectable-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.tree-row:hover,
.tree-row.active {
  background: color-mix(in srgb, var(--color-border, #d0d7de) 35%, transparent);
}

.row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-row input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  min-width: 16px;
  margin: 0;
  padding: 0;
  flex: 0 0 auto;
  border: 1.5px solid var(--color-text-muted, #656d76);
  border-radius: 4px;
  background: var(--color-bg, #fff);
  box-shadow: none;
  cursor: pointer;
  position: relative;
}

.tree-row input[type='checkbox']:checked,
.tree-row input[type='checkbox']:indeterminate {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.tree-row input[type='checkbox']:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.tree-row input[type='checkbox']:indeterminate::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 6px;
  width: 8px;
  height: 0;
  border-top: 2px solid #fff;
}

.tree-row.folder .row-name {
  font-weight: 600;
}

.row-slug {
  color: var(--color-text-muted, #656d76);
  font-size: 11px;
}
</style>
