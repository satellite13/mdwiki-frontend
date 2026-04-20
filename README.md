# mdwiki-frontend

SPA для [mdwiki-api](../mdwiki-api): Vue 3 + TypeScript + Vite. Редактор
Markdown с превью, деревом документов, граф-панелью, вложениями,
тегами и wiki-ссылками.

## Стек

- Vue 3.5 (`<script setup>`)
- TypeScript (`strict`, `noImplicitOverride`)
- Vite 8 (dev + build)
- Pinia 3 (auth, folders, theme, dialog, tags)
- Vue Router 4
- Axios (с перехватом 401 и единым слоем ошибок)
- markdown-it (+ анкора, tasklists, sub/sup, mark, wiki-плагин, mermaid)
- D3.js для графа связей
- Vitest + @vue/test-utils + jsdom

## Быстрый старт

```sh
npm install
npm run dev        # http://localhost:5173, /api проксируется на :8080
npm run build      # сборка в dist/
npm run lint       # ESLint
npm run test       # Vitest (unit + компонентные)
```

## Структура проекта

```
src/
├─ api/             HTTP-клиенты (axios) по доменам: auth, pages, folders,
│                   tags, users, attachments, sync, graph, events (SSE)
├─ assets/
│  ├─ main.css      index-файл, импортирующий стилевые модули
│  └─ styles/       tokens, base, forms, components, wiki, markdown,
│                   highlight — каждая тема в отдельном файле
├─ components/
│  ├─ admin/        AdminUsersPage
│  ├─ attachments/  AttachmentsPage + формы загрузки
│  ├─ auth/         LoginPage, RegisterPage, ProfilePage
│  ├─ editor/       MarkdownEditor + markdown.ts (конфиг markdown-it),
│  │                editorPreferences.ts, textareaCaret.ts
│  ├─ graph/        GraphPanel + graphRenderer.ts (D3-рендер, чистый TS)
│  ├─ layout/       AppHeader и прочий каркас
│  ├─ pages/        WorkspacePage, SearchPage и страницы списка
│  ├─ tree/         DocumentTree, TreeFolder, TreePage
│  └─ ui/           AppDialogHost и простые переиспользуемые элементы
├─ composables/     useEditorHistory, useWikilinkAutocomplete,
│                   useTreeSse, usePageTags, useTreeActions,
│                   useMovePage, usePageAutosave, usePageLoader,
│                   useWorkspacePage
├─ router/          vue-router + guards аутентификации
├─ services/        pageIndex — единый кэш списка страниц + резолвер
│                   wiki-ссылок
├─ stores/          Pinia: auth, folders, tags, theme, dialog
├─ types/           Общие типы приложения и .d.ts для сторонних плагинов
└─ utils/           apiError, frontmatter, i18n, localPreferences,
                    folderId, pageSlug, dndPayload, dndDebug и др.
```

### Архитектурные принципы

- **Единый слой ошибок.** `utils/apiError.ts` (`getApiErrorMessage`,
  `isApiErrorWithStatus`) используется вместо `axios.isAxiosError` по коду.
  Новые места показа ошибок должны идти через него.
- **`localStorage` только через `utils/localPreferences.ts`.** Прямой
  `window.localStorage` запрещён: это защищает от Safari private mode и
  исключений квоты и даёт типобезопасное чтение JSON.
- **Один кэш страниц.** `services/pageIndex.ts` — единственный источник
  списка страниц для wiki-автокомплита и резолвера. Мутации в
  `api/pages.ts` и `api/sync.ts` вызывают `invalidatePageIndex()`.
- **Композиция поверх наследования.** Большая логика (редактор, дерево,
  граф) разнесена по composables и чистым модулям. Vue-компоненты
  остаются тонкой обёрткой над UI/состоянием.
- **Стили разделены по темам.** Правим конкретный файл в `assets/styles`,
  а не общий `main.css` — он сейчас только импортирует модули.

## Тесты

Все тесты — `src/**/*.test.ts`:

- `utils/` — `apiError`, `frontmatter`, `localPreferences`, `folderId`,
  `dndPayload`, `pageSlug`.
- `stores/` — `auth`, `folders`, `dialog` с моками axios-клиентов.
- `components/ui/AppDialogHost.test.ts` — компонентный тест через
  `@vue/test-utils` и Pinia.

```sh
npm run test
```

## Ветки и коммиты

Текущая ветка разработки — `feat/tiptap-migration`, но фактически в ней
проведён рефакторинг фронтенда (редактор остался на
`<textarea>` + markdown-it, без TipTap). Рекомендуется переименовать
ветку перед слиянием, например:

```sh
git branch -m feat/tiptap-migration refactor/frontend-cleanup
git push origin -u refactor/frontend-cleanup
git push origin --delete feat/tiptap-migration
```
