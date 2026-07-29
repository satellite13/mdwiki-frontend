<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as tasksApi from '@/api/tasks'
import type { OpenTask } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'
import { t } from '@/utils/i18n'
import AppModal from '@/components/ui/AppModal.vue'
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
  <div class="grouped-page">
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
      <section v-for="group in groups" :key="group.documentId" class="group-card">
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

    <AppModal v-if="completingTask" :label="t.tasks.completeDialogTitle" @close="closeCompleteDialog">
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

      <div class="modal-actions">
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
    </AppModal>
  </div>
</template>

<style scoped>
.group-header {
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #d0d7de);
  background: color-mix(in srgb, var(--color-border, #d0d7de) 18%, transparent);
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

.complete-task-text {
  margin: 0.5rem 0 1rem;
  color: var(--color-text-muted, #656d76);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
