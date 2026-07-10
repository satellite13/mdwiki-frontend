<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as tasksApi from '@/api/tasks'
import type { OpenTask } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'
import { t } from '@/utils/i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'
import { invalidatePageIndex } from '@/services/pageIndex'

interface TaskGroup {
  documentId: string
  slug: string
  documentTitle: string
  items: OpenTask[]
}

const auth = useAuthStore()
const dialog = useDialogStore()
const router = useRouter()

const tasks = ref<OpenTask[]>([])
const loading = ref(true)
const completing = ref(false)
const completingTask = ref<OpenTask | null>(null)
const summary = ref('')

const groups = computed<TaskGroup[]>(() => {
  const map = new Map<string, TaskGroup>()
  for (const task of tasks.value) {
    const group = map.get(task.documentId) ?? {
      documentId: task.documentId,
      slug: task.slug,
      documentTitle: task.documentTitle,
      items: []
    }
    group.items.push(task)
    map.set(task.documentId, group)
  }
  return [...map.values()].sort((a, b) => a.documentTitle.localeCompare(b.documentTitle, 'ru', { sensitivity: 'base' }))
})

async function fetchOpenTasks() {
  loading.value = true
  try {
    const { data } = await tasksApi.listOpenTasks()
    tasks.value = data
  } catch (error) {
    tasks.value = []
    await dialog.alert(getApiErrorMessage(error, t.tasks.loadFailed))
  } finally {
    loading.value = false
  }
}

function openDocument(slug: string) {
  void router.push({ name: 'page', params: { slug } })
}

function openCompleteDialog(task: OpenTask) {
  if (task.locked || !auth.isEditor || completing.value) return
  completingTask.value = task
  summary.value = ''
}

function resetCompleteDialog() {
  completingTask.value = null
  summary.value = ''
}

function closeCompleteDialog() {
  if (completing.value) return
  resetCompleteDialog()
}

async function completeTask() {
  const task = completingTask.value
  if (!task || completing.value) return

  completing.value = true
  try {
    const trimmedSummary = summary.value.trim()
    await tasksApi.completeTask({
      documentId: task.documentId,
      updatedAt: task.updatedAt,
      sourceOffset: task.sourceOffset,
      sourceLine: task.sourceLine,
      ...(trimmedSummary ? { summary: summary.value } : {})
    })
    invalidatePageIndex()
    resetCompleteDialog()
    await fetchOpenTasks()
  } catch (error) {
    if (isApiErrorWithStatus(error, 409)) {
      resetCompleteDialog()
      const reload = await dialog.confirm(t.tasks.conflict, { confirmLabel: t.tasks.reload })
      if (reload) await fetchOpenTasks()
    } else {
      await dialog.alert(getApiErrorMessage(error, t.tasks.completeFailed))
    }
  } finally {
    completing.value = false
  }
}

onMounted(fetchOpenTasks)
</script>

<template>
  <div class="open-tasks-page">
    <div class="page-header">
      <div>
        <h1>{{ t.tasks.title }}</h1>
        <p class="page-subtitle">{{ t.tasks.subtitle }}</p>
      </div>
      <button type="button" class="btn-secondary" :disabled="loading" @click="fetchOpenTasks">
        {{ t.tasks.refresh }}
      </button>
    </div>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>

    <div v-else-if="tasks.length === 0" class="empty-state">
      {{ t.tasks.empty }}
    </div>

    <div v-else class="groups">
      <section v-for="group in groups" :key="group.documentId" class="task-group">
        <div class="group-header">
          <div>
            <button
              type="button"
              class="link-btn group-title"
              :data-testid="`open-document-${group.slug}`"
              @click="openDocument(group.slug)"
            >
              {{ group.documentTitle }}
            </button>
            <p class="group-meta">{{ t.tasks.count(group.items.length) }}</p>
          </div>
        </div>

        <ul class="task-list">
          <li v-for="task in group.items" :key="`${task.documentId}-${task.sourceOffset}`" class="task-item">
            <input
              :data-testid="`complete-${task.sourceOffset}`"
              type="checkbox"
              :aria-label="t.tasks.complete"
              :disabled="task.locked || !auth.isEditor || completing"
              @change="openCompleteDialog(task)"
            />
            <span class="task-text">{{ task.text }}</span>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="completingTask" class="complete-overlay" @click.self="closeCompleteDialog">
      <div class="complete-dialog" role="dialog" aria-modal="true" :aria-label="t.tasks.completeDialogTitle">
        <h2>{{ t.tasks.completeDialogTitle }}</h2>
        <p class="complete-task-text">{{ completingTask.text }}</p>

        <label class="field-label" for="task-summary">{{ t.tasks.summaryLabel }}</label>
        <textarea
          id="task-summary"
          v-model="summary"
          class="field-input"
          rows="4"
          :placeholder="t.tasks.summaryPlaceholder"
        />

        <div class="complete-actions">
          <button type="button" class="btn-secondary" :disabled="completing" @click="closeCompleteDialog">
            {{ t.common.cancel }}
          </button>
          <button
            type="button"
            class="btn-primary"
            data-testid="confirm-complete"
            :disabled="completing"
            @click="completeTask"
          >
            {{ completing ? '…' : t.tasks.complete }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.open-tasks-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 2rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.page-subtitle {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted, #656d76);
}

.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-text-muted, #656d76);
  border: 1px dashed var(--color-border, #d0d7de);
  border-radius: 12px;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.task-group {
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-surface, #fff);
}

.group-header {
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #d0d7de);
  background: color-mix(in srgb, var(--color-border, #d0d7de) 18%, transparent);
}

.group-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  word-break: break-word;
}

.group-meta {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted, #656d76);
  font-size: 0.9rem;
}

.link-btn {
  border: 0;
  background: none;
  padding: 0;
  color: var(--color-wikilink, #0d9488);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.link-btn:hover {
  text-decoration: underline;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 1rem;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  line-height: 1.45;
}

.task-item input {
  width: 1rem;
  height: 1rem;
  margin: 0.2rem 0 0;
  accent-color: var(--color-primary);
  flex: 0 0 auto;
}

.task-item input:not(:disabled) {
  cursor: pointer;
}

.task-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.complete-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.complete-dialog {
  width: min(520px, 100%);
  background: var(--color-surface, #fff);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: var(--shadow, 0 8px 30px rgba(0, 0, 0, 0.12));
}

.complete-task-text {
  margin: 0.5rem 0 1rem;
  color: var(--color-text-muted, #656d76);
  white-space: pre-wrap;
  word-break: break-word;
}

.field-label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 600;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: 8px;
  font: inherit;
  background: var(--color-bg, #fff);
  color: inherit;
  resize: vertical;
}

.complete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
