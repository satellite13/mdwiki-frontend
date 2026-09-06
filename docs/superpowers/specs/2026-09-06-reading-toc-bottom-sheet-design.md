# Reading TOC как нижняя панель (shared bottom sheet)

## Цель

В режиме чтения на ширине ≤1100px оглавление не должно оказываться под контентом (сейчас приходится прокручивать вниз). Оно открывается нижней панелью по той же модели, что и аннотации. На >1100px поведение TOC не меняется: sticky-сайдбар в сетке превью.

Discovery (unlinked / orphans / broken links) в эту спеку **не входит** — отдельная задача.

## Решения (зафиксировано)

- Подход: общий shell для нижних панелей (не копипаста CSS только в TOC).
- Breakpoint sheet: **≤1100px** (там, где TOC сейчас уезжает вниз; аннотации поднимаем с 768 до 1100 для согласованности).
- Закрытие: только вручную — кнопка закрытия в панели и/или повторный клик по кнопке TOC/аннотаций в reading toolbar. Клик по пункту оглавления **не** закрывает панель.
- TOC и аннотации **взаимоисключающие**: открытие одной закрывает другую.
- Escape в v1 **не** добавляем (у аннотаций его сейчас нет).

## Архитектура

```
MarkdownEditor
├── ReadingToolbar  (tocVisible / annotationsVisible, с взаимным исключением)
├── EditorPreviewPane
│   └── ReadingToc          # только >1100px, sticky в grid
├── ReadingToc + ReadingBottomSheet   # только ≤1100px, рядом с AnnotationPanel
└── AnnotationPanel (+ ReadingBottomSheet на ≤1100px)
```

Родитель (`MarkdownEditor`) владеет видимостью обеих панелей и применяет взаимное исключение при переключении.

## Компоненты

### `ReadingBottomSheet.vue` (новый)

Расположение: `src/components/ui/ReadingBottomSheet.vue`.

- Props: `open: boolean`, `ariaLabel: string`
- Slot: **весь** UI панели (заголовок, кнопка закрытия, список) — shell только позиционирует и ограничивает высоту
- На ≤1100px: `position: fixed; bottom: 0; left/right: 0; width: 100%; max-height: 50vh; border-radius` сверху; `z-index` как у текущей annotation panel (~1000); `overflow: auto` на оболочке или на внутреннем slot-контейнере
- На >1100px родители **не** оборачивают панели в shell

### `ReadingToc.vue`

- Один компонент, два места монтирования по breakpoint (не два разных TOC):
  - >1100px: sticky aside внутри `EditorPreviewPane` при `showToc`
  - ≤1100px: **не** в grid под контентом; монтируется в `MarkdownEditor` внутри `ReadingBottomSheet`
- В sheet-режиме у TOC появляется кнопка закрытия в заголовке (как у `AnnotationPanel`), эмит/`update` видимости через родителя
- Клик по пункту → существующий `select` / scroll к заголовку; панель остаётся открытой
- Кнопка копирования якоря сохраняется

### `AnnotationPanel.vue`

- Desktop layout без изменений; свой header/close остаётся внутри панели
- Mobile/tablet sheet-позиционирование переносится на обёртку `ReadingBottomSheet` (дублирующие `position: fixed` стили у панели удаляются)
- Breakpoint нижней панели: **≤1100px** (вместо 768)

### `MarkdownEditor.vue` / `ReadingToolbar.vue`

- При `tocVisible → true` выставлять `annotationsVisible = false`
- При `annotationsVisible → true` выставлять `tocVisible = false`
- Видимость TOC-sheet: `readingTocVisible && readingTocItems.length > 0` в reading mode

### `EditorPreviewPane.vue`

- На ≤1100px: убрать TOC из layout (не `position: static` под контентом); grid с TOC только на wide
- Контент читается на всю ширину без «хвоста» оглавления внизу

## Поведение и edge cases

| Ситуация | Поведение |
|----------|-----------|
| Нет заголовков | TOC не показывается; логика кнопки тулбара без расширения scope |
| Reading → edit/split | Sheet исчезает вместе с reading UI |
| Смена страницы / slug | Сброс видимости по текущим правилам аннотаций |
| Resize через 1100px | Wide → sticky TOC; narrow → sheet только если tocVisible |
| Обе панели «хотят» открыться | Взаимное исключение в родителе |

## Вне scope

- Мобильная адаптация Discovery
- FAB / отдельная плавающая кнопка TOC
- Swipe-to-dismiss и Escape
- Изменение desktop (>1100) layout TOC или аннотаций

## Проверка

- Unit/component: взаимное исключение TOC ↔ annotations; на узком viewport TOC не в DOM под контентом, а в sheet-контейнере
- Ручная проверка на локальном OrbStack k8s (`VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh`), **не** Vite:
  - ≤1100: TOC по кнопке снизу; без прокрутки к низу страницы
  - >1100: sticky сайдбар
  - открытие аннотаций закрывает TOC и наоборот
  - регрессия списка аннотаций на том же breakpoint
