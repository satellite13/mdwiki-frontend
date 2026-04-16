<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialogStore } from '@/stores/dialog'
import { t } from '@/utils/i18n'

const store = useDialogStore()
const { active } = storeToRefs(store)

const promptValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  active,
  async (a) => {
    if (a?.kind === 'prompt') {
      promptValue.value = a.defaultValue
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    }
  },
  { flush: 'post' }
)

function onKeydown(e: KeyboardEvent) {
  if (!active.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (active.value.kind === 'confirm') store.submitConfirm(false)
    else if (active.value.kind === 'prompt') store.submitPrompt(null)
    else store.submitAlert()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function onPromptSubmit() {
  store.submitPrompt(promptValue.value)
}

function onOverlayMouseDown(e: MouseEvent) {
  if (e.target !== e.currentTarget) return
  if (!active.value) return
  if (active.value.kind === 'alert') store.submitAlert()
  else if (active.value.kind === 'confirm') store.submitConfirm(false)
  else store.submitPrompt(null)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="dialog-root"
      role="presentation"
      @mousedown.self="onOverlayMouseDown"
    >
      <div
        class="dialog-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="active.title ? 'dialog-title' : undefined"
        aria-describedby="dialog-desc"
        @mousedown.stop
      >
        <h2 v-if="active.title" id="dialog-title" class="dialog-title">{{ active.title }}</h2>
        <p id="dialog-desc" class="dialog-message">{{ active.message }}</p>

        <div v-if="active.kind === 'prompt'" class="dialog-field">
          <input
            ref="inputRef"
            v-model="promptValue"
            type="text"
            class="dialog-input"
            autocomplete="off"
            @keydown.enter.prevent="onPromptSubmit"
          />
        </div>

        <div class="dialog-actions">
          <template v-if="active.kind === 'alert'">
            <button type="button" class="btn-primary" @click="store.submitAlert()">
              {{ t.dialog.ok }}
            </button>
          </template>
          <template v-else-if="active.kind === 'confirm'">
            <button type="button" class="btn-secondary" @click="store.submitConfirm(false)">
              {{ t.common.cancel }}
            </button>
            <button
              type="button"
              :class="active.danger ? 'btn-danger-solid' : 'btn-primary'"
              @click="store.submitConfirm(true)"
            >
              {{ active.confirmLabel ?? t.common.confirm }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="btn-secondary" @click="store.submitPrompt(null)">
              {{ t.common.cancel }}
            </button>
            <button type="button" class="btn-primary" @click="onPromptSubmit">
              {{ t.dialog.ok }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-root {
  position: fixed;
  inset: 0;
  z-index: 32000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(36, 41, 47, 0.45);
  backdrop-filter: blur(2px);
}

.dialog-panel {
  width: 100%;
  max-width: 420px;
  padding: 22px 24px 20px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(36, 41, 47, 0.15);
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--color-text);
}

.dialog-message {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin-bottom: 16px;
  white-space: pre-wrap;
}

.dialog-field {
  margin-bottom: 18px;
}

.dialog-input {
  width: 100%;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-danger-solid {
  cursor: pointer;
  border: none;
  border-radius: var(--radius);
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  background: var(--color-danger);
  color: #fff;
  transition: all 0.15s;
}

.btn-danger-solid:hover {
  background: var(--color-danger-hover);
}
</style>
