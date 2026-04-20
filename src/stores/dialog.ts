import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export type AlertPayload = {
  kind: 'alert'
  message: string
  title?: string
  resolve: () => void
}

export type ConfirmPayload = {
  kind: 'confirm'
  message: string
  title?: string
  danger?: boolean
  /** Подпись основной кнопки (по умолчанию — «Подтвердить» из i18n). */
  confirmLabel?: string
  resolve: (value: boolean) => void
}

export type PromptPayload = {
  kind: 'prompt'
  message: string
  title?: string
  defaultValue: string
  resolve: (value: string | null) => void
}

export type ChoiceOption = {
  value: string
  label: string
  description?: string
  danger?: boolean
}

export type ChoicePayload = {
  kind: 'choice'
  message: string
  title?: string
  options: ChoiceOption[]
  cancelLabel?: string
  resolve: (value: string | null) => void
}

export type DialogPayload = AlertPayload | ConfirmPayload | PromptPayload | ChoicePayload

export const useDialogStore = defineStore('dialog', () => {
  const queue = ref<DialogPayload[]>([])
  const active = shallowRef<DialogPayload | null>(null)

  function openNext() {
    if (active.value) return
    const next = queue.value.shift()
    if (next) active.value = next
  }

  function enqueue(payload: DialogPayload) {
    queue.value.push(payload)
    openNext()
  }

  function closeCurrent() {
    active.value = null
    openNext()
  }

  function alert(message: string): Promise<void> {
    return new Promise((resolve) => {
      enqueue({
        kind: 'alert',
        message,
        resolve: () => {
          resolve()
          closeCurrent()
        }
      })
    })
  }

  function confirm(
    message: string,
    options?: { title?: string; danger?: boolean; confirmLabel?: string }
  ): Promise<boolean> {
    return new Promise((resolve) => {
      enqueue({
        kind: 'confirm',
        message,
        title: options?.title,
        danger: options?.danger,
        confirmLabel: options?.confirmLabel,
        resolve: (value: boolean) => {
          resolve(value)
          closeCurrent()
        }
      })
    })
  }

  function prompt(
    message: string,
    defaultValue = '',
    options?: { title?: string }
  ): Promise<string | null> {
    return new Promise((resolve) => {
      enqueue({
        kind: 'prompt',
        message,
        title: options?.title,
        defaultValue,
        resolve: (value: string | null) => {
          resolve(value)
          closeCurrent()
        }
      })
    })
  }

  function choice(
    message: string,
    options: ChoiceOption[],
    config?: { title?: string; cancelLabel?: string }
  ): Promise<string | null> {
    return new Promise((resolve) => {
      enqueue({
        kind: 'choice',
        message,
        title: config?.title,
        options,
        cancelLabel: config?.cancelLabel,
        resolve: (value: string | null) => {
          resolve(value)
          closeCurrent()
        }
      })
    })
  }

  /** Закрыть alert (кнопка OK). */
  function submitAlert() {
    if (active.value?.kind !== 'alert') return
    active.value.resolve()
  }

  function submitConfirm(ok: boolean) {
    if (active.value?.kind !== 'confirm') return
    active.value.resolve(ok)
  }

  function submitPrompt(value: string | null) {
    if (active.value?.kind !== 'prompt') return
    active.value.resolve(value)
  }

  function submitChoice(value: string | null) {
    if (active.value?.kind !== 'choice') return
    active.value.resolve(value)
  }

  return {
    active,
    alert,
    confirm,
    prompt,
    choice,
    submitAlert,
    submitConfirm,
    submitPrompt,
    submitChoice
  }
})
