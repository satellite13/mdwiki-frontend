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

function onActivate(node: FolderTreeNode) {
  if (mode === 'single') emit('select', node.id)
  else emit('toggle', node.id)
}
</script>

<template>
  <ul class="selectable-tree" :style="{ paddingLeft: depth === 0 ? '0' : '14px' }">
    <li v-for="node in nodes" :key="node.id">
      <button
        type="button"
        class="tree-row"
        :class="{
          folder: node.type === 'folder',
          active: mode === 'single' && activeId === node.id
        }"
        @click="onActivate(node)"
      >
        <input
          v-if="mode === 'multi'"
          type="checkbox"
          :checked="bundleNodeState(node, selected) === 'checked'"
          :indeterminate="bundleNodeState(node, selected) === 'indeterminate'"
          tabindex="-1"
          @click.stop="emit('toggle', node.id)"
        />
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

.tree-row.folder .row-name {
  font-weight: 600;
}

.row-slug {
  color: var(--color-text-muted, #656d76);
  font-size: 11px;
}
</style>
