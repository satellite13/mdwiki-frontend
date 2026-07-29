<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import type { FolderTreeNode } from '@/types'
import { useI18n } from 'vue-i18n'
import { useTreeDragSource } from '@/composables/useTreeDnd'

const { t } = useI18n()
const props = defineProps<{
  node: FolderTreeNode
  depth: number
  active: boolean
  staggerIndex?: number
}>()

const emit = defineEmits<{
  select: [slug: string]
  contextmenu: [event: MouseEvent, node: FolderTreeNode]
  delete: [node: FolderTreeNode]
}>()

const auth = useAuthStore()

const { onDragStart, onDragOverAllow, onDragEnd } = useTreeDragSource({
  payload: () => (props.node.slug ? { type: 'page', slug: props.node.slug } : null),
  zoneLabel: 'page',
  dragOverLogKey: `page:${props.node.slug}`,
  logContext: () => ({ slug: props.node.slug, name: props.node.name })
})

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  emit('contextmenu', e, props.node)
}

function onSelect() {
  if (!props.node.slug) return
  emit('select', props.node.slug)
}
</script>

<template>
  <div
    :class="['tree-page', { active }]"
    :style="{ paddingLeft: `${depth * 16 + 24}px`, '--stagger-index': staggerIndex ?? 0 }"
    :draggable="auth.isEditor"
    @dragstart="onDragStart"
    @dragover="onDragOverAllow"
    @dragend="onDragEnd"
    @contextmenu="onContextMenu"
    @click="onSelect"
  >
    <span class="page-icon">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3.5 1.5h6l3 3v10h-9v-13z" stroke="currentColor" stroke-width="1.2" fill="none"/>
        <path d="M9.5 1.5v3h3" stroke="currentColor" stroke-width="1.2" fill="none"/>
      </svg>
    </span>
    <span class="page-name">{{ node.name }}</span>

    <span v-if="auth.isEditor" class="page-actions" @click.stop>
      <button class="node-action danger" :title="t('tree.deletePage')" @click="emit('delete', node)">
        <span class="material-symbols-outlined node-action-icon notranslate" translate="no">delete</span>
      </button>
    </span>
  </div>
</template>

<style scoped>
.tree-page {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  border-radius: 6px;
  color: var(--color-text);
  user-select: none;
  transition: background 0.15s, color 0.15s;
}

.tree-page:hover {
  background: var(--color-bg-hover);
}

.tree-page.active {
  background: var(--color-primary);
  color: #fff;
}

.page-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--color-text-faint);
}

.tree-page.active .page-icon {
  color: #fff;
}

.page-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.page-actions {
  display: none;
  gap: 1px;
  margin-left: auto;
  flex-shrink: 0;
}

.tree-page:hover .page-actions {
  display: flex;
}

.node-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.1s;
}

.node-action:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
}

.node-action.danger:hover {
  background: rgba(207, 34, 46, 0.08);
  color: var(--color-danger);
}

.node-action-icon {
  font-size: 16px;
}

@media (prefers-reduced-motion: no-preference) {
  .tree-page {
    animation: fadeInUp 0.3s ease both;
    animation-delay: calc(var(--stagger-index, 0) * 20ms);
  }

  .tree-page:hover .page-icon {
    transform: scale(1.01);
  }
}
</style>
