# mdwiki-frontend

SPA для [mdwiki-api](../mdwiki-api): Vue 3 + TypeScript + Vite. Редактор
Markdown с превью, деревом документов, графом связей, вложениями,
тегами, wiki-ссылками и страницей битых ссылок.

## Стек

- Vue 3.5 (`<script setup>`)
- TypeScript (`strict`, `noImplicitOverride`)
- Vite 8 (dev + build)
- Pinia 3 (auth, folders, theme, dialog, tags)
- Vue Router 5
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

## Страницы приложения

| Маршрут | Назначение |
|---------|------------|
| `/page/:slug` | Редактор и просмотр страницы |
| `/search` | Семантический поиск (RAG) |
| `/graph` | Граф всех страниц и связей |
| `/broken-links` | Битые `[[wikilink]]` и `/page/…` ссылки |
| `/attachments` | Вложения |
| `/admin/users`, `/admin/embedding` | Админ-панель |

## Редактор (`MarkdownEditor`)

Режимы: **Editor**, **Split**, **Preview**, **Reading**. Markdown хранится
как текст в `<textarea>`, превью — через markdown-it.

### Wiki-ссылки

При вводе `[[` открывается автокомплит по списку страниц (до 8
подсказок). Список подгружается из `services/pageIndex.ts` с
постраничной загрузкой `/api/pages` и кэшем на 30 с. Подсказки
показываются сразу из кэша, если он уже прогрет (загрузка страницы или
монтирование редактора).

- **↑ / ↓** — выбор подсказки
- **Enter** — вставить `[[slug]]` или `[[slug|Title]]`
- **Esc** — закрыть меню

Сопоставление запроса учитывает подстроки title/slug и нормализованный
ключ (`normalizeWikilinkKey`) — в т.ч. кириллические заголовки вроде
`Глава 17: …`.

### Поиск в документе

- **⌘F / Ctrl+F** или кнопка 🔍 на панели инструментов
- **Enter** / **Shift+Enter** — следующее / предыдущее совпадение
- **Esc** — закрыть

Поиск без учёта регистра; совпадения подсвечиваются выделением в
textarea. Панель поиска не перехватывает ввод в редакторе — запрос
меняется только в поле поиска.

### Превью

- Wiki-ссылки на несуществующие страницы помечаются классом
  `wikilink-missing` (жёлтая подсветка, как «призрачные» узлы в графе)
- Внутренние markdown-ссылки `/page/…` — `mdlink-internal-missing`
- Экспорт текущей страницы в PDF (кнопка в Reading-режиме)

## Структура проекта

```
src/
├─ api/             HTTP-клиенты (axios) по доменам: auth, pages, folders,
│                   tags, users, attachments, sync, graph, search, events (SSE)
├─ assets/
│  ├─ main.css      index-файл, импортирующий стилевые модули
│  └─ styles/       tokens, base, forms, components, wiki, markdown,
│                   highlight — каждая тема в отдельном файле
├─ components/
│  ├─ admin/        AdminUsersPage, AdminEmbeddingSettingsPage
│  ├─ attachments/  AttachmentsPage + формы загрузки
│  ├─ auth/         LoginPage, RegisterPage, ProfilePage
│  ├─ editor/       MarkdownEditor, EditorInputPane, EditorPreviewPane,
│  │                EditorToolbar, EditorFindBar, ReadingToolbar,
│  │                markdown.ts (конфиг markdown-it), editorPreferences.ts,
│  │                textareaCaret.ts, structurizr.ts
│  ├─ graph/        WikiGraphPage, GraphPanel, graphRenderer.ts (D3)
│  ├─ layout/       AppLayout, AppHeader, AppSidebar
│  ├─ links/        BrokenLinksPage
│  ├─ pages/        WorkspacePage, SearchPage
│  ├─ search/       SearchPage (RAG)
│  ├─ tree/         DocumentTree, TreeFolder, TreePage
│  └─ ui/           AppDialogHost, SkeletonPage, VerticalPaneResizer
├─ composables/     useEditorHistory, useEditorFind, useWikilinkAutocomplete,
│                   useTreeSse, usePageTags, useTreeActions, useMovePage,
│                   usePageAutosave, usePageLoader, useWorkspacePage,
│                   useBreakpoint, useHorizontalDragResize
├─ router/          vue-router + guards аутентификации
├─ services/        pageIndex — единый кэш списка страниц, резолвер
│                   wiki-ссылок, pageMatchesWikilinkQuery
├─ stores/          Pinia: auth, folders, tags, theme, dialog
├─ types/           Общие типы приложения и .d.ts для сторонних плагинов
└─ utils/           apiError, editorFind, frontmatter, i18n, localPreferences,
                    folderId, pageSlug, formatMarkdownTable, tablePipeCells,
                    previewLinks, exportPagePdf и др.
```

### Архитектурные принципы

- **Единый слой ошибок.** `utils/apiError.ts` (`getApiErrorMessage`,
  `isApiErrorWithStatus`) используется вместо `axios.isAxiosError` по коду.
  Новые места показа ошибок должны идти через него.
- **`localStorage` только через `utils/localPreferences.ts`.** Прямой
  `window.localStorage` запрещён: это защищает от Safari private mode и
  исключений квоты и даёт типобезопасное чтение JSON.
- **Один кэш страниц.** `services/pageIndex.ts` — единственный источник
  списка страниц для wiki-автокомплита, превью и резолвера. Мутации в
  `api/pages.ts`, `api/sync.ts` и `api/links.ts` вызывают
  `invalidatePageIndex()`.
- **Композиция поверх наследования.** Большая логика (редактор, дерево,
  граф) разнесена по composables и чистым модулям. Vue-компоненты
  остаются тонкой обёрткой над UI/состоянием.
- **Стили разделены по темам.** Правим конкретный файл в `assets/styles`,
  а не общий `main.css` — он сейчас только импортирует модули.

## Тесты

Все тесты — `src/**/*.test.ts`:

- `utils/` — `apiError`, `editorFind`, `frontmatter`, `localPreferences`,
  `folderId`, `pageSlug`, `formatMarkdownTable`, `tablePipeCells`,
  `previewLinks`, `exportPagePdf`, `dndPayload`, `folderTree`.
- `services/` — `pageIndex` (сопоставление wikilink-запросов, пагинация).
- `composables/` — `useWikilinkAutocomplete`.
- `stores/` — `auth`, `folders`, `dialog` с моками axios-клиентов.
- `components/` — `markdown`, `structurizr`, `graphRenderer`,
  `AppDialogHost`, `AdminEmbeddingSettingsPage`.

```sh
npm run test
```

## Деплой в Kubernetes

Скрипты в `scripts/` разворачивают Helm chart
`deploy/helm/mdwiki-frontend` (nginx + статика, прокси `/api/*` на backend).
Требуются `kubectl`, `helm`, `docker`.

| Скрипт | Назначение |
|--------|------------|
| `scripts/deploy-k8s.sh` | `helm upgrade --install` без сборки образа |
| `scripts/deploy-k8s-with-build.sh` | `docker build` (+ push для remote registry) + деплой |
| `scripts/undeploy-k8s.sh` | `helm uninstall` релиза |

### Типичный деплой

```sh
# Локальный образ mdwiki-frontend:<timestamp>-<sha> в namespace mdwiki
./scripts/deploy-k8s-with-build.sh

# С values (ingress, upstream API и т.д.)
VALUES_FILE=deploy/helm/mdwiki-frontend/values-prod.yaml ./scripts/deploy-k8s-with-build.sh

# Только helm, образ уже в registry
IMAGE_REPOSITORY=ghcr.io/your-org/mdwiki-frontend \
IMAGE_TAG=20260617-abc1234 \
./scripts/deploy-k8s.sh
```

Сначала должен быть развёрнут API (см.
[mdwiki-api/scripts/deploy-k8s-with-build.sh](../mdwiki-api/scripts/deploy-k8s-with-build.sh)).
По умолчанию nginx проксирует на `http://mdwiki-api-mdwiki-api:8080`
(`api.upstream` в values).

### Полезные переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `RELEASE_NAME` | `mdwiki-frontend` | Имя Helm-релиза |
| `NAMESPACE` | `mdwiki` | Namespace (тот же, что у API) |
| `VALUES_FILE` | — | Дополнительный values-файл |
| `IMAGE_REPOSITORY` | `mdwiki-frontend` | Репозиторий образа |
| `IMAGE_TAG` | `<UTC-timestamp>-<git-sha>[-dirty]` | Тег образа |
| `PUSH_IMAGE` | `true` для remote registry, иначе `false` | Пушить образ после сборки |
| `IMAGE_PULL_POLICY` | `Always` / `IfNotPresent` | Политика pull в кластере |
| `TIMEOUT` | `5m` | Таймаут деплоя |

### Снятие с кластера

```sh
./scripts/undeploy-k8s.sh
```

Подробнее по chart — `deploy/helm/mdwiki-frontend/README.md`.
