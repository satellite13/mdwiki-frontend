import { copyTextToClipboard } from '@/utils/clipboard'

type RootGetter = () => HTMLElement | null

export function usePreviewCopyDecorations(getRoot: RootGetter) {
  const copyFeedbackTimers = new WeakMap<HTMLButtonElement, number>()

  function decorateHeadingAnchors() {
    const root = getRoot()
    if (!root) return
    const headings = root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
    headings.forEach((heading) => {
      if (heading.querySelector(':scope > .heading-copy-btn')) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'heading-copy-btn'
      button.dataset.anchor = heading.id
      button.title = 'Скопировать якорь раздела'
      button.setAttribute('aria-label', 'Скопировать якорь раздела')
      button.innerHTML = '<span class="material-symbols-outlined notranslate" translate="no">content_copy</span>'
      heading.appendChild(button)
    })
  }

  function decorateCodeCopyButtons() {
    const root = getRoot()
    if (!root) return
    const blocks = root.querySelectorAll<HTMLElement>('pre')
    blocks.forEach((block) => {
      if (block.querySelector(':scope > .code-copy-btn')) return
      const code = block.querySelector('code')
      if (!code) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'code-copy-btn'
      button.title = 'Скопировать код'
      button.setAttribute('aria-label', 'Скопировать код')
      button.innerHTML = '<span class="material-symbols-outlined notranslate" translate="no">content_copy</span>'
      block.appendChild(button)
    })
  }

  function applyCopyFeedback(
    button: HTMLButtonElement,
    copied: boolean,
    okTitle: string,
    failTitle: string,
    resetTitle: string
  ) {
    const previousTimer = copyFeedbackTimers.get(button)
    if (previousTimer) window.clearTimeout(previousTimer)
    button.classList.remove('copied', 'failed')
    button.classList.add(copied ? 'copied' : 'failed')
    button.title = copied ? okTitle : failTitle
    const timer = window.setTimeout(() => {
      button.classList.remove('copied', 'failed')
      button.title = resetTitle
    }, 1300)
    copyFeedbackTimers.set(button, timer)
  }

  async function onPreviewClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    const headingButton = target?.closest<HTMLButtonElement>('.heading-copy-btn')
    if (headingButton) {
      event.preventDefault()
      event.stopPropagation()

      const anchor = headingButton.dataset.anchor
      if (!anchor) return
      const link = `#${anchor}`
      const copied = await copyTextToClipboard(link)
      applyCopyFeedback(
        headingButton,
        copied,
        'Якорь скопирован',
        'Не удалось скопировать',
        'Скопировать якорь раздела'
      )
      return
    }

    const codeButton = target?.closest<HTMLButtonElement>('.code-copy-btn')
    if (!codeButton) return

    event.preventDefault()
    event.stopPropagation()

    const codeHost = codeButton.closest('pre')
    const code = codeHost?.querySelector('code')
    const codeText = code?.textContent ?? ''
    if (!codeText.trim()) return

    const copied = await copyTextToClipboard(codeText)
    applyCopyFeedback(codeButton, copied, 'Код скопирован', 'Не удалось скопировать', 'Скопировать код')
  }

  return {
    decorateHeadingAnchors,
    decorateCodeCopyButtons,
    onPreviewClick
  }
}
