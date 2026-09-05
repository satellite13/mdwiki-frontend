# AppSelect — единый селект в дизайне mdwiki

## Цель

Заменить все нативные `<select>` в UI на свой компонент `AppSelect`: единая высота и стиль с полями ввода, поддержка single/multi и опциональный поиск для длинных списков.

## Решения

- Scope: все `<select>` в интерфейсе (Views, Discovery, Search, History, Admin, Properties panel и др.).
- Поиск: только при явном prop `searchable` (длинные списки страниц/свойств).
- Режимы: single и multi в первой версии.
- Реализация: свой компонент без UI-библиотек (паттерн в духе `ToolbarDropdown`).

## Компонент

Путь: `src/components/ui/AppSelect.vue` (+ unit-тесты рядом).

### Props / API

| Prop | Тип | Описание |
|------|-----|----------|
| `options` | `{ value: string; label: string; disabled?: boolean }[]` | Список пунктов |
| `modelValue` | `string \| string[] \| null` | Выбранное значение |
| `multiple` | `boolean` | Multi-режим |
| `searchable` | `boolean` | Поле фильтра в выпадающем списке |
| `placeholder` | `string` | Текст, когда ничего не выбрано |
| `disabled` | `boolean` | Блокировка |
| `clearable` | `boolean` | Сброс выбора (опционально) |
| `ariaLabel` / label через слот/атрибут | `string` | Доступное имя |

События: `update:modelValue`; при необходимости зеркало `change` для мест с `@change` на native select.

### Внешний вид

- Trigger: кнопка/поле с `min-height` ~44px, border/radius/цвета из дизайн-токенов (`--color-border`, `--radius`, `--font-body`), как у input.
- Шеврон справа.
- Single: выбранный `label` или `placeholder`.
- Multi: краткое представление выбранных (чипы и/или счётчик), без раздувания trigger на весь список.
- Список: popover под trigger; клик снаружи и Escape закрывают.
- При `searchable`: input фильтра сверху списка; фильтр по `label`, case-insensitive; пустой результат — короткий empty-state.

### Клавиатура и a11y

- Открытие: Enter / Space / ArrowDown на trigger.
- Навигация: ArrowUp/Down, Home/End.
- Выбор: Enter / Space.
- Multi: выбор переключает пункт, список остаётся открытым.
- Роли: combobox/listbox (или эквивалент listbox+button по практике a11y), `aria-expanded`, `aria-activedescendant` или фокус на option.
- Фокус-ловушка не нужна (не модалка); Tab уходит и закрывает список.

## Миграция

1. Ввести `AppSelect` и покрыть тестами (single, multi, searchable, disabled, keyboard, clearable).
2. Заменить все `<select>`:
   - длинные (страницы, свойства) → `searchable`;
   - короткие (роль, layout, mode, sort) → без поиска;
   - `MULTI_SELECT` в Properties → `multiple`.
3. Пустое значение: `placeholder` + `clearable` и/или option с `value=""` — сохранить текущий UX «Выберите…».
4. Обновить page/component-тесты, которые кликали по native `<select>`.

## Проверка

- Unit-тесты `AppSelect`.
- Существующие тесты страниц после миграции.
- Визуально на OrbStack: высота рядом с input, длинный список со поиском (Unlinked mentions), multi в Properties.

## Вне задачи

- Автопорог поиска по числу опций.
- Async/remote loading options.
- Группировка option groups (если появится — отдельным шагом).
- Замена file inputs / native date controls.
