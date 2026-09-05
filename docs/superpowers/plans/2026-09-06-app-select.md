# AppSelect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить все нативные `<select>` в mdwiki-frontend на единый `AppSelect` с высотой как у input, single/multi и опциональным поиском.

**Architecture:** Один Vue SFC (`AppSelect.vue`) без UI-библиотек: trigger-кнопка + popover-список (паттерн `ToolbarDropdown` — клик снаружи закрывает). Опции передаются массивом `{ value, label, disabled? }`; `v-model` — `string | string[] | null`. Поиск включается только через `searchable`. Миграция экранов пакетами; длинные списки страниц/свойств получают `searchable`.

**Tech Stack:** Vue 3 SFC, TypeScript, Vitest, Vue Test Utils, vue-i18n, существующие CSS-токены (`--color-border`, `--radius`, `--font-body`).

**Spec:** `docs/superpowers/specs/2026-09-06-app-select-design.md`

---

## File map

| File | Role |
|------|------|
| `src/components/ui/AppSelect.vue` | Компонент: trigger, listbox, search, keyboard |
| `src/components/ui/AppSelect.test.ts` | Unit-тесты API/поведения |
| `src/i18n/en.ts`, `src/i18n/ru.ts` | `common.selectNoResults`, `common.clearSelection` (если нужны) |
| Страницы с `<select>` (см. Task 3–5) | Замена на `AppSelect` |
| Соответствующие `*.test.ts` | Обновить взаимодействие (не native select) |

---

### Task 1: Типы + падающие unit-тесты `AppSelect`

**Files:**
- Create: `src/components/ui/AppSelect.test.ts`
- Create (stub ok): `src/components/ui/AppSelect.vue` (минимальный, чтобы импорт работал)

- [ ] **Step 1: Создать минимальный stub компонента**

`AppSelect.vue` — пустой SFC с props-заглушкой и `<div />`, чтобы тест импортировался.

- [ ] **Step 2: Написать падающие тесты**

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppSelect from './AppSelect.vue'

const options = [
  { value: '', label: 'Choose…' },
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Charlie' },
]

function mountSelect(props: Record<string, unknown> = {}) {
  return mount(AppSelect, {
    props: {
      options,
      modelValue: null,
      ...props,
    },
    attachTo: document.body,
  })
}

describe('AppSelect', () => {
  it('opens list and selects a single value', async () => {
    const wrapper = mountSelect({ placeholder: 'Pick' })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-a"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['a'])
    wrapper.unmount()
  })

  it('filters options when searchable', async () => {
    const wrapper = mountSelect({ searchable: true, modelValue: '' })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-search"]').setValue('bet')
    expect(wrapper.find('[data-testid="app-select-option-a"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-select-option-b"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('toggles values in multiple mode without closing', async () => {
    const wrapper = mountSelect({ multiple: true, modelValue: [] })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-a"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a']])
    expect(wrapper.find('[data-testid="app-select-list"]').exists()).toBe(true)
    await wrapper.get('[data-testid="app-select-option-b"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']])
    wrapper.unmount()
  })

  it('supports keyboard open and choose', async () => {
    const wrapper = mountSelect({ modelValue: null })
    const trigger = wrapper.get('[data-testid="app-select-trigger"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('[data-testid="app-select-list"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('does not open when disabled', async () => {
    const wrapper = mountSelect({ disabled: true })
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="app-select-list"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
```

- [ ] **Step 3: Запустить тесты — ожидаем FAIL**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend
npx vitest run src/components/ui/AppSelect.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/AppSelect.vue src/components/ui/AppSelect.test.ts
git commit -m "$(cat <<'EOF'
test: add failing AppSelect coverage

EOF
)"
```

---

### Task 2: Реализовать `AppSelect`

**Files:**
- Modify: `src/components/ui/AppSelect.vue`
- Modify: `src/i18n/en.ts`, `src/i18n/ru.ts` (ключи `common.noMatchingOptions` / `common.clearSelection` при необходимости)
- Reference: `src/components/ui/ToolbarDropdown.vue` (outside click)
- Reference: `src/assets/styles/forms.css` (высота/бордер input)

- [ ] **Step 1: Props / emits**

```ts
export type AppSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  options: AppSelectOption[]
  modelValue: string | string[] | null
  multiple?: boolean
  searchable?: boolean
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  ariaLabel?: string
}>(), {
  multiple: false,
  searchable: false,
  disabled: false,
  clearable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | null]
  change: [value: string | string[] | null]
}>()
```

- [ ] **Step 2: UI + поведение**

- Trigger: `button`/`div role=combobox`, `min-height: 44px`, border как у input, шеврон.
- Single: показать label выбранного или placeholder.
- Multi: счётчик `N selected` или первые 1–2 label + «+N» (не раздувать trigger).
- List: absolute popover под trigger, `z-index` ≥ 40; max-height + scroll.
- Outside click + Escape → close (как ToolbarDropdown).
- `searchable`: input сверху списка; фильтр `label.toLowerCase().includes(q)`; empty → i18n `common.noMatchingOptions`.
- Keyboard: ArrowDown/Up, Home/End, Enter/Space выбрать; Tab закрывает.
- Multi: Enter/клик toggle, список остаётся открытым.
- `clearable`: кнопка сброса на trigger → `null` или `[]`.
- `data-testid`: `app-select-trigger`, `app-select-list`, `app-select-search`, `app-select-option-${value}` (для `value===''` → `app-select-option-empty`).

- [ ] **Step 3: Тесты PASS**

```bash
npx vitest run src/components/ui/AppSelect.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/AppSelect.vue src/i18n/en.ts src/i18n/ru.ts
git commit -m "$(cat <<'EOF'
feat: add AppSelect with search and multi support

EOF
)"
```

---

### Task 3: Миграция длинных списков (`searchable`)

**Files:**
- Modify: `src/components/pkm/UnlinkedMentionsPage.vue`
- Modify: `src/components/pkm/UnlinkedMentionsPage.test.ts`
- Modify: `src/components/pages/ViewsPage.vue` (filterKey / sortKey / groupKey / filter value SELECT)
- Modify: `src/components/pages/ViewsPage.test.ts`
- Modify: `src/components/pages/PageHistory.vue` (from/to revision selects — список может быть длинным → `searchable`)
- Modify: `src/components/pages/PageHistory.test.ts` при необходимости

- [ ] **Step 1: UnlinkedMentions**

Заменить `<select v-model="target">` на:

```vue
<AppSelect
  v-model="target"
  :options="[
    { value: '', label: t('pkm.choosePage') },
    ...pages.map((p) => ({ value: p.slug, label: p.title })),
  ]"
  searchable
  :placeholder="t('pkm.choosePage')"
  @update:modelValue="select"
/>
```

(или `@change` — согласовать с тем, что `select()` делает `router.replace`; при `v-model` + watch на target можно оставить текущий flow).

- [ ] **Step 2: ViewsPage**

Все селекты свойств/операторов/значений/sort/group → AppSelect; `filterKey`/`sortKey`/`groupKey` — `searchable` если опций из definitions много. Layout (`TABLE`/`LIST`/`CARDS`) — без search.

- [ ] **Step 3: PageHistory**

Селекты ревизий → AppSelect `searchable`.

- [ ] **Step 4: Тесты страниц**

```bash
npx vitest run src/components/pkm/UnlinkedMentionsPage.test.ts src/components/pages/ViewsPage.test.ts src/components/pages/PageHistory.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: migrate long page selects to AppSelect

EOF
)"
```

---

### Task 4: Миграция коротких селектов (без search)

**Files:**
- Modify: `src/components/pkm/OrphansPage.vue`
- Modify: `src/components/search/SearchPage.vue`
- Modify: `src/components/search/SavedSearchesPage.vue`
- Modify: `src/components/admin/AdminPropertiesPage.vue`
- Modify: `src/components/admin/AdminUsersPage.vue`
- Modify: `src/components/admin/AdminEmbeddingSettingsPage.vue`
- Modify: соответствующие `*.test.ts`

- [ ] **Step 1: Заменить native select**

Паттерн:

```vue
<AppSelect
  v-model="mode"
  :options="[
    { value: 'HYBRID', label: 'Hybrid' },
    { value: 'TEXT', label: 'Text' },
    { value: 'SEMANTIC', label: 'Semantic' },
  ]"
/>
```

Для `AdminUsersPage` role: `:model-value="user.role"` + `@update:modelValue="(v) => changeRole(user, String(v))"`.

Для `minScore` (number): options со string values, coerce при emit или хранить string в локальном state.

- [ ] **Step 2: Тесты**

```bash
npx vitest run src/components/search/SearchPage.test.ts src/components/search/SavedSearchesPage.test.ts src/components/admin/AdminPropertiesPage.test.ts src/components/admin/AdminUsersPage.test.ts src/components/admin/AdminEmbeddingSettingsPage.test.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: migrate short form selects to AppSelect

EOF
)"
```

---

### Task 5: Properties panel (SELECT + MULTI_SELECT)

**Files:**
- Modify: `src/components/pages/PagePropertiesPanel.vue`
- Modify: `src/components/pages/PagePropertiesPanel.test.ts`

- [ ] **Step 1: SELECT**

```vue
<AppSelect
  :model-value="textValue(definition.key)"
  :options="[
    { value: '', label: t('properties.empty') },
    ...(definition.config.options as string[] || []).map((o) => ({ value: o, label: o })),
  ]"
  :disabled="busy"
  :aria-label="definition.displayName"
  @update:modelValue="(v) => saveSelect(definition, String(v ?? ''))"
/>
```

Адаптировать `save()` — сейчас ждёт DOM `change` event; вынести `saveSelect(definition, value: string)`.

- [ ] **Step 2: MULTI_SELECT**

```vue
<AppSelect
  multiple
  :model-value="(data.values[definition.key] as string[]) ?? []"
  :options="(definition.config.options as string[] || []).map((o) => ({ value: o, label: o }))"
  :disabled="busy"
  :aria-label="definition.displayName"
  @update:modelValue="(v) => saveMulti(definition, Array.isArray(v) ? v : [])"
/>
```

- [ ] **Step 3: Тесты + commit**

```bash
npx vitest run src/components/pages/PagePropertiesPanel.test.ts
git commit -m "$(cat <<'EOF'
feat: use AppSelect in page properties panel

EOF
)"
```

---

### Task 6: Финальная проверка

**Files:** none (verify only)

- [ ] **Step 1: Убедиться, что native `<select>` не осталось в UI**

```bash
rg '<select' src/components --glob '*.vue'
```

Ожидание: пусто (кроме если что-то вне scope — тогда явно задокументировать).

- [ ] **Step 2: Полный прогон затронутых тестов**

```bash
npx vitest run src/components/ui/AppSelect.test.ts \
  src/components/pkm/UnlinkedMentionsPage.test.ts \
  src/components/pages/ViewsPage.test.ts \
  src/components/pages/PageHistory.test.ts \
  src/components/pages/PagePropertiesPanel.test.ts \
  src/components/search/SearchPage.test.ts \
  src/components/search/SavedSearchesPage.test.ts \
  src/components/admin/AdminPropertiesPage.test.ts \
  src/components/admin/AdminUsersPage.test.ts \
  src/components/admin/AdminEmbeddingSettingsPage.test.ts
```

- [ ] **Step 3: Deploy frontend на OrbStack**

```bash
VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh
```

Визуально: Unlinked mentions (search), Views (короткий layout + searchable properties), Properties multi, высота рядом с input.

- [ ] **Step 4: Commit плана выполненным не нужно; при необходимости docs-only note**

---

## Out of scope (из спеки)

- Автопорог searchable по числу опций
- Async/remote options
- Option groups
- File / date native controls
