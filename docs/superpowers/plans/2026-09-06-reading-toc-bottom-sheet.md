# Reading TOC Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На ширине ≤1100px показывать оглавление режима чтения нижней панелью через общий `ReadingBottomSheet`, взаимно исключаясь с аннотациями; на >1100px сохранить sticky-сайдбар.

**Architecture:** Добавить константу `BP_READING_SHEET_MAX = 1100` и флаг `isReadingSheet` в `useBreakpoint`. Новый `ReadingBottomSheet` только позиционирует слот. `MarkdownEditor` монтирует TOC в sheet на узкой ширине и не передаёт TOC в `EditorPreviewPane`; аннотации на той же ширине оборачиваются в sheet. Взаимное исключение — в handlers видимости родителя.

**Tech Stack:** Vue 3 Composition API, vue-i18n, Vitest, Vue Test Utils, существующий `useBreakpoint`.

**Spec:** `docs/superpowers/specs/2026-09-06-reading-toc-bottom-sheet-design.md`

---

## File map

| File | Role |
|------|------|
| `src/composables/useBreakpoint.ts` | Константа `BP_READING_SHEET_MAX`, computed `isReadingSheet` |
| `src/composables/useBreakpoint.test.ts` | Тесты флага |
| `src/components/ui/ReadingBottomSheet.vue` | Shared fixed bottom shell |
| `src/components/ui/ReadingBottomSheet.test.ts` | Тест open/slot/aria |
| `src/components/editor/ReadingToc.vue` | Prop `variant`, кнопка close в sheet |
| `src/components/editor/ReadingToc.test.ts` | Тест close / no-close-on-select |
| `src/components/annotations/AnnotationPanel.vue` | Убрать `@media (max-width: 768px)` fixed; sheet-layout через deep CSS родителя |
| `src/components/editor/EditorPreviewPane.vue` | Убрать static-TOC media hack (TOC на узкой ширине не монтируется) |
| `src/components/editor/MarkdownEditor.vue` | Sheet mounts, mutual exclusion, `previewHasToc` / `sheetHasToc` |
| `src/components/editor/MarkdownEditor.test.ts` | Mutual exclusion + sheet vs sidebar mount |
| `src/i18n/en.ts`, `src/i18n/ru.ts` | `reading.closeToc` |

Discovery **не** трогать.

---

### Task 1: `isReadingSheet` в breakpoint

**Files:**
- Modify: `src/composables/useBreakpoint.ts`
- Create: `src/composables/useBreakpoint.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { BP_READING_SHEET_MAX, useBreakpoint } from './useBreakpoint'

describe('useBreakpoint isReadingSheet', () => {
  afterEach(() => {
    window.dispatchEvent(new Event('resize'))
  })

  it('is true at and below BP_READING_SHEET_MAX', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: BP_READING_SHEET_MAX })
    window.dispatchEvent(new Event('resize'))
    const { isReadingSheet } = useBreakpoint()
    expect(isReadingSheet.value).toBe(true)
  })

  it('is false above BP_READING_SHEET_MAX', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: BP_READING_SHEET_MAX + 1 })
    window.dispatchEvent(new Event('resize'))
    const { isReadingSheet } = useBreakpoint()
    expect(isReadingSheet.value).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/composables/useBreakpoint.test.ts`

Expected: FAIL (export `BP_READING_SHEET_MAX` / `isReadingSheet` missing)

- [ ] **Step 3: Implement**

In `src/composables/useBreakpoint.ts` add:

```ts
export const BP_READING_SHEET_MAX = 1100
```

In `useBreakpoint()`:

```ts
const isReadingSheet = computed(() => width.value <= BP_READING_SHEET_MAX)

return { width, isMobile, isTablet, isDesktop, isNarrow, isReadingSheet }
```

Keep CSS `@media (max-width: 1100px)` numeric literal in sync with this constant (comment near constant: «mirror in ReadingBottomSheet / EditorPreviewPane CSS»).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/composables/useBreakpoint.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useBreakpoint.ts src/composables/useBreakpoint.test.ts
git commit -m "feat: add isReadingSheet breakpoint for reading panels"
```

---

### Task 2: `ReadingBottomSheet` shell

**Files:**
- Create: `src/components/ui/ReadingBottomSheet.vue`
- Create: `src/components/ui/ReadingBottomSheet.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadingBottomSheet from './ReadingBottomSheet.vue'

describe('ReadingBottomSheet', () => {
  it('renders slot when open and exposes aria-label', () => {
    const wrapper = mount(ReadingBottomSheet, {
      props: { open: true, ariaLabel: 'Table of contents' },
      slots: { default: '<div class="sheet-body">Hello</div>' },
    })
    const root = wrapper.get('[data-testid="reading-bottom-sheet"]')
    expect(root.attributes('aria-label')).toBe('Table of contents')
    expect(wrapper.get('.sheet-body').text()).toBe('Hello')
  })

  it('does not render when closed', () => {
    const wrapper = mount(ReadingBottomSheet, {
      props: { open: false, ariaLabel: 'Table of contents' },
      slots: { default: '<div class="sheet-body">Hello</div>' },
    })
    expect(wrapper.find('[data-testid="reading-bottom-sheet"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/ReadingBottomSheet.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement `ReadingBottomSheet.vue`**

```vue
<script setup lang="ts">
defineProps<{
  open: boolean
  ariaLabel: string
}>()
</script>

<template>
  <aside
    v-if="open"
    class="reading-bottom-sheet"
    data-testid="reading-bottom-sheet"
    role="complementary"
    :aria-label="ariaLabel"
  >
    <slot />
  </aside>
</template>

<style scoped>
/* Keep max-width in sync with BP_READING_SHEET_MAX (1100) in useBreakpoint.ts */
.reading-bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 50vh;
  overflow: auto;
  border-top: 1px solid var(--color-border);
  border-radius: 12px 12px 0 0;
  z-index: 1000;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  background: var(--color-bg);
}

.reading-bottom-sheet :deep(.annotation-panel) {
  width: 100%;
  height: auto;
  max-height: none;
  border-left: none;
  border-radius: 12px 12px 0 0;
}

.reading-bottom-sheet :deep(.reading-toc) {
  position: static;
  max-height: none;
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/ReadingBottomSheet.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ReadingBottomSheet.vue src/components/ui/ReadingBottomSheet.test.ts
git commit -m "feat: add ReadingBottomSheet shared shell"
```

---

### Task 3: `ReadingToc` sheet variant + i18n

**Files:**
- Modify: `src/components/editor/ReadingToc.vue`
- Create: `src/components/editor/ReadingToc.test.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/ru.ts`

- [ ] **Step 1: Add i18n keys**

In `reading` block of both locale files:

```ts
closeToc: 'Close table of contents', // en
closeToc: 'Закрыть оглавление', // ru
```

- [ ] **Step 2: Write the failing test**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadingToc from './ReadingToc.vue'
import { i18n } from '@/i18n'

const items = [
  { id: 'h1', text: 'Intro', level: 1 },
  { id: 'h2', text: 'Details', level: 2 },
]

function mountToc(variant: 'sidebar' | 'sheet' = 'sidebar') {
  return mount(ReadingToc, {
    props: { items, theme: 'white', variant },
    global: { plugins: [i18n] },
  })
}

describe('ReadingToc', () => {
  it('shows close control only in sheet variant', async () => {
    const sidebar = mountToc('sidebar')
    expect(sidebar.find('.reading-toc-close').exists()).toBe(false)

    const sheet = mountToc('sheet')
    expect(sheet.find('.reading-toc-close').exists()).toBe(true)
    await sheet.get('.reading-toc-close').trigger('click')
    expect(sheet.emitted('close')?.at(-1)).toEqual([])
  })

  it('emits select without closing', async () => {
    const wrapper = mountToc('sheet')
    await wrapper.get('.reading-toc-select').trigger('click')
    expect(wrapper.emitted('select')?.at(-1)).toEqual(['h1'])
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/components/editor/ReadingToc.test.ts`

Expected: FAIL (no `variant` / `close`)

- [ ] **Step 4: Update `ReadingToc.vue`**

Extend props/emits:

```ts
const props = defineProps<{
  items: TocItem[]
  theme: 'white' | 'paper' | 'dark'
  variant?: 'sidebar' | 'sheet'
}>()

const emit = defineEmits<{
  select: [id: string]
  copy: [item: TocItem]
  close: []
}>()
```

Title row:

```vue
<div class="reading-toc-title-row">
  <div class="reading-toc-title">{{ t('reading.toc') }}</div>
  <button
    v-if="props.variant === 'sheet'"
    type="button"
    class="reading-toc-close"
    :title="t('reading.closeToc')"
    :aria-label="t('reading.closeToc')"
    @click="emit('close')"
  >
    <span class="material-symbols-outlined notranslate" translate="no">close</span>
  </button>
</div>
```

Styles for title-row/close (mirror annotation close size 28px). **Remove** the `@media (max-width: 1100px) { position: static; ... }` block — narrow TOC will not use sidebar mount.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/editor/ReadingToc.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/ReadingToc.vue src/components/editor/ReadingToc.test.ts src/i18n/en.ts src/i18n/ru.ts
git commit -m "feat: add sheet variant and close control to ReadingToc"
```

---

### Task 4: Strip AnnotationPanel mobile fixed CSS

**Files:**
- Modify: `src/components/annotations/AnnotationPanel.vue`

- [ ] **Step 1: Remove the mobile fixed block**

Delete the entire:

```css
@media (max-width: 768px) {
  .annotation-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-height: 50vh;
    border-left: none;
    border-top: 1px solid var(--color-border);
    border-radius: 12px 12px 0 0;
    z-index: 1000;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  }
}
```

Sheet chrome now lives in `ReadingBottomSheet` (Task 2 deep styles). Desktop `.annotation-panel` styles stay.

- [ ] **Step 2: Smoke existing annotation/editor tests**

Run: `npm test -- src/components/editor/MarkdownEditor.test.ts`

Expected: PASS (stubs still isolate AnnotationPanel)

- [ ] **Step 3: Commit**

```bash
git add src/components/annotations/AnnotationPanel.vue
git commit -m "refactor: move annotation sheet positioning out of AnnotationPanel"
```

---

### Task 5: Wire MarkdownEditor — mutual exclusion + sheet mounts

**Files:**
- Modify: `src/components/editor/MarkdownEditor.vue`
- Modify: `src/components/editor/MarkdownEditor.test.ts`
- Modify: `src/components/editor/EditorPreviewPane.vue` (only if leftover media still forces TOC below; after Task 3 TOC media removed, optional comment cleanup of grid-only media)

- [ ] **Step 1: Extend ReadingToolbar stub and write failing integration tests**

In `MarkdownEditor.test.ts`, replace `ReadingToolbarStub` with one that toggles visibility props:

```ts
const ReadingToolbarStub = {
  props: ['tocVisible', 'annotationsVisible'],
  emits: ['find', 'exportMarkdown', 'exportPdf', 'exit', 'update:tocVisible', 'update:annotationsVisible'],
  template: `
    <div class="reading-toolbar-stub">
      <button class="reading-find" @click="$emit('find')" />
      <button class="reading-toc" @click="$emit('update:tocVisible', !tocVisible)" />
      <button class="reading-annotations" @click="$emit('update:annotationsVisible', !annotationsVisible)" />
      <button class="reading-export-md" @click="$emit('exportMarkdown')" />
      <button class="reading-export-pdf" @click="$emit('exportPdf')" />
      <button class="reading-exit" @click="$emit('exit')" />
    </div>
  `
}
```

Stub real sheet/toc for mount checks (or use real `ReadingBottomSheet` + stub heavy panes). Prefer:

```ts
ReadingBottomSheet: false, // real component
ReadingToc: {
  props: ['variant', 'items'],
  emits: ['select', 'copy', 'close'],
  template: '<aside class="reading-toc-stub" :data-variant="variant" />'
},
AnnotationPanel: {
  props: ['visible'],
  template: '<div class="annotation-panel-stub" v-if="visible" />'
},
```

Update `PreviewPaneStub` to expose `showToc`:

```ts
const PreviewPaneStub = {
  props: ['findOpen', 'showToc'],
  emits: ['mouseup'],
  template: '<div class="preview-pane-stub" :data-show-toc="String(showToc)" :data-find-open="String(findOpen)"><button class="preview-mouseup" @mouseup="$emit(\'mouseup\', $event)" /></div>'
}
```

Force reading mode after mount (click reading if available, or set localStorage / emit — follow existing editor API). Looking at current editor: readonly starts in preview; need reading. Add helper:

```ts
async function mountReadingEditor(innerWidth: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth })
  window.dispatchEvent(new Event('resize'))
  const wrapper = mount(MarkdownEditor, {
    props: {
      modelValue: '# Title\n\n## Section\n\nBody',
      pageSlug: 'demo',
      readingTitle: 'Demo',
      readonly: false
    },
    global: { /* plugins + stubs as above */ }
  })
  await flushPromises()
  const readingBtn = wrapper.find('.mode-reading')
  if (readingBtn.exists()) await readingBtn.trigger('click')
  await flushPromises()
  return wrapper
}
```

Tests:

```ts
it('mutually excludes toc and annotations visibility', async () => {
  const wrapper = await mountReadingEditor(1200)
  await wrapper.get('.reading-toc').trigger('click')
  await wrapper.get('.reading-annotations').trigger('click')
  // annotations open should force toc closed — assert via stub props / DOM
  expect(wrapper.find('.annotation-panel-stub').exists()).toBe(true)
  // After annotations open, sidebar toc showToc should be false
  expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('false')
})

it('mounts toc in bottom sheet on narrow reading width', async () => {
  const wrapper = await mountReadingEditor(900)
  await wrapper.get('.reading-toc').trigger('click')
  await flushPromises()
  expect(wrapper.find('[data-testid="reading-bottom-sheet"]').exists()).toBe(true)
  expect(wrapper.find('.reading-toc-stub').attributes('data-variant')).toBe('sheet')
  expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('false')
})

it('keeps toc in preview pane on wide reading width', async () => {
  const wrapper = await mountReadingEditor(1200)
  await wrapper.get('.reading-toc').trigger('click')
  await flushPromises()
  expect(wrapper.get('.preview-pane-stub').attributes('data-show-toc')).toBe('true')
  expect(wrapper.find('.reading-toc-stub[data-variant="sheet"]').exists()).toBe(false)
})
```

Adjust assertions if default `readingTocVisible` is already `true` (it is `ref(true)` today): first narrow test may not need toc click if items exist. `readingTocItems` come from `useReadingToc` after preview render — with stubbed preview pane, **items may be empty**. If so, inject headings by not stubbing preview HTML path OR temporarily set items via exposing — simplest fix for tests: stub `useReadingToc` is heavy; instead pass enough that `previewHasToc` works.

**Practical approach for empty TOC with stubbed pane:** In tests that need TOC, mock the composable is hard. Alternative: assert mutual exclusion on `annotationsVisible` / `readingTocVisible` through emitted toolbar state by controlling props after making handlers set both. Easiest reliable path:

1. Do not stub `EditorPreviewPane` for the narrow/wide TOC mount tests — too heavy.
2. Or add `data-testid` hooks driven only by computed flags in template:

```vue
<div
  v-if="sheetHasToc"
  data-testid="reading-toc-sheet-host"
>
  <ReadingBottomSheet ...>
    <ReadingToc variant="sheet" ... />
  </ReadingBottomSheet>
</div>
```

And for tests, **spy/computed via DOM hosts** even if ReadingToc items stubbed: make `sheetHasToc` also true when `readingTocVisible && isReadingSheet && editorMode==='reading'` **even with 0 items?** Spec says no TOC without headings. For tests, either:

- Unstub preview and let markdown-it build TOC from `# Title`, or
- Temporarily allow a test-only prop (avoid), or
- Mock `useReadingToc` module.

**Chosen:** mock `./useReadingToc` in the specific describe block (real API returns `readingTocItems`, not `items`):

```ts
import { ref } from 'vue'

vi.mock('./useReadingToc', () => ({
  useReadingToc: () => ({
    readingTocItems: ref([{ id: 'h1', text: 'Title', level: 1 }]),
    buildReadingToc: vi.fn(),
    scrollToHeading: vi.fn(),
  })
}))
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/components/editor/MarkdownEditor.test.ts`

Expected: FAIL on new cases (no sheet host / no exclusion)

- [ ] **Step 3: Implement wiring in `MarkdownEditor.vue`**

Import:

```ts
import ReadingBottomSheet from '@/components/ui/ReadingBottomSheet.vue'
import ReadingToc from '@/components/editor/ReadingToc.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
```

(`ReadingToc` may already be only inside preview — import at editor level for sheet mount.)

```ts
const { isMobile, isReadingSheet } = useBreakpoint() // `useBreakpoint` already imported; extend existing destructure
```

Replace visibility assignments from toolbar:

```ts
function setReadingTocVisible(value: boolean) {
  readingTocVisible.value = value
  if (value) annotationsVisible.value = false
}

function setAnnotationsVisible(value: boolean) {
  annotationsVisible.value = value
  if (value) readingTocVisible.value = false
}
```

Template toolbar:

```vue
@update:toc-visible="setReadingTocVisible"
@update:annotations-visible="setAnnotationsVisible"
```

Computeds:

```ts
const tocAvailable = computed(
  () => editorMode.value === 'reading' && readingTocVisible.value && readingTocItems.value.length > 0
)
const previewHasToc = computed(() => tocAvailable.value && !isReadingSheet.value)
const sheetHasToc = computed(() => tocAvailable.value && isReadingSheet.value)
```

In reading block after `EditorPreviewPane`:

```vue
<ReadingBottomSheet
  v-if="isReadingSheet"
  :open="sheetHasToc"
  :aria-label="t('reading.toc')"
>
  <ReadingToc
    :items="readingTocItems"
    :theme="readingTheme"
    variant="sheet"
    @select="readingToc.scrollToHeading"
    @copy="copyTocSection"
    @close="setReadingTocVisible(false)"
  />
</ReadingBottomSheet>

<ReadingBottomSheet
  v-if="isReadingSheet"
  :open="annotationsVisible"
  :aria-label="t('annotations.panel', { count: annotations.length })"
>
  <AnnotationPanel
    :annotations="annotations"
    :visible="annotationsVisible"
    :can-edit="!props.readonly"
    @update:visible="setAnnotationsVisible"
    @select="scrollToAnnotation($event.id)"
    @deleted="onAnnotationDeleted"
    @updated="onAnnotationUpdated"
  />
</ReadingBottomSheet>

<AnnotationPanel
  v-else
  v-show="annotationsVisible"
  :annotations="annotations"
  :visible="annotationsVisible"
  :can-edit="!props.readonly"
  @update:visible="setAnnotationsVisible"
  @select="scrollToAnnotation($event.id)"
  @deleted="onAnnotationDeleted"
  @updated="onAnnotationUpdated"
/>
```

Remove the old single `AnnotationPanel` block to avoid duplication.

Note: `AnnotationPanel` root uses `v-if="visible"` — when sheet `:open="annotationsVisible"`, panel also gates on visible; both true together is fine. Prefer sheet `open` as sole gate and pass `:visible="true"` inside open sheet **or** keep both in sync as above.

- [ ] **Step 4: Clean `EditorPreviewPane`**

Keep:

```css
@media (max-width: 1100px) {
  .reading-layout.with-toc {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Only as safety if `with-toc` ever true on narrow; with `previewHasToc` false it won't apply. No TOC static styles left in `ReadingToc`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/editor/MarkdownEditor.test.ts src/components/editor/ReadingToc.test.ts src/components/ui/ReadingBottomSheet.test.ts src/composables/useBreakpoint.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/MarkdownEditor.vue src/components/editor/MarkdownEditor.test.ts src/components/editor/EditorPreviewPane.vue
git commit -m "feat: reading TOC and annotations share bottom sheet on narrow screens"
```

---

### Task 6: Manual verify on OrbStack (not Vite)

**Files:** none (verification only)

- [ ] **Step 1: Deploy local k8s**

```bash
VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh
```

- [ ] **Step 2: Checklist**

- Ширина ≤1100, reading mode, страница с заголовками: кнопка TOC открывает нижнюю панель; контент без оглавления внизу страницы
- Клик по пункту TOC скроллит и **не** закрывает панель; крестик / повтор TOC закрывают
- Открытие аннотаций закрывает TOC и наоборот
- Ширина >1100: sticky TOC справа как раньше; аннотации боковой колонкой
- Планшет 800–1100: аннотации тоже bottom sheet (новый breakpoint)

- [ ] **Step 3: Commit only if verification found small fixups**; otherwise done

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Shared `ReadingBottomSheet` | Task 2 |
| TOC sheet ≤1100, sidebar >1100 | Tasks 1, 3, 5 |
| Annotations sheet ≤1100 (was 768) | Tasks 4, 5 |
| Manual close only / no close on TOC select | Task 3 |
| Mutual exclusion | Task 5 |
| No Discovery / no Escape / no FAB | Out of plan |
| Tests + k8s verify | Tasks 1–6 |

## Placeholder scan

No TBD/TODO left in steps; `useReadingToc` mock must match real export when implementing Task 5.
