# mdwiki-frontend

SPA for [mdwiki-api](../mdwiki-api): Vue 3 + TypeScript + Vite. Markdown
editor with preview, document tree, link graph, attachments, tags,
wikilinks, open tasks, and a broken-links page.

Русская версия: `README.ru.md`

Current version: **v0.1.15** (see the git tag; in the UI — `git describe` on the profile page).

## Stack

- Vue 3.5 (`<script setup>`)
- TypeScript (`strict`, `noImplicitOverride`)
- Vite 8 (dev + build)
- Pinia 3 (auth, folders, theme, dialog, tags)
- Vue Router 5
- vue-i18n 11 (EN/RU, dictionaries in `src/i18n/`)
- Axios (401 interceptor and a shared error layer)
- markdown-it (+ anchors, tasklists, sub/sup, mark, wiki plugin, mermaid)
- D3.js for the link graph
- Vitest + @vue/test-utils + jsdom

## Quick start

```sh
npm install
npm run dev        # http://localhost:5173, /api is proxied to :8080
npm run build      # production build in dist/
npm run lint       # ESLint
npm run test       # Vitest (unit + component)
```

## App pages

| Route | Purpose |
|-------|---------|
| `/page/:slug` | Page editor and reader |
| `/search` | Semantic search (RAG) |
| `/graph` | Graph of all pages and links |
| `/broken-links` | Broken `[[wikilink]]` and `/page/…` links |
| `/tasks` | Open Markdown tasks (`- [ ]`) |
| `/attachments` | Attachments |
| `/profile` | Profile, password change, API keys, frontend/backend **versions** |
| `/admin/users`, `/admin/embedding` | Admin panel |

UI language is toggled with the **EN/RU** button in the header (persisted in
`localPreferences['locale']`).

## Editor (`MarkdownEditor`)

Modes: **Editor**, **Split**, **Preview**, **Reading**. Markdown is stored
as text in a `<textarea>`; preview goes through markdown-it.

### Wikilinks

Typing `[[` opens page autocomplete (up to 8 suggestions). The list comes
from `services/pageIndex.ts` with paginated `/api/pages` loads and a 30s
cache. Suggestions appear from cache immediately if it is already warm
(page load or editor mount).

- **↑ / ↓** — move selection
- **Enter** — insert `[[slug]]` or `[[slug|Title]]`
- **Esc** — close the menu

Matching uses title/slug substrings and a normalized key
(`normalizeWikilinkKey`) — including Cyrillic titles such as
`Глава 17: …`.

### Find in document

- **⌘F / Ctrl+F** or the 🔍 toolbar button
- **Enter** / **Shift+Enter** — next / previous match
- **Esc** — close (focus returns to the editor)

Search is case-insensitive. Focus stays in the find field while typing;
matches are highlighted with a mirror layer under the textarea (not native
selection — that is invisible without focus).

### Preview

- Wikilinks to missing pages get the `wikilink-missing` class
  (yellow highlight, same as “ghost” nodes in the graph)
- Internal markdown links `/page/…` — `mdlink-internal-missing`
- Export the current page to PDF (button in Reading mode)

## Versions in the UI

`/profile` shows:

- **Frontend** — `__APP_VERSION_TAG__` (from `git describe --tags --always`
  at Vite build time)
- **Backend** — `GET /api/version` → `versionTag`

Docker does not copy `.git` (`.dockerignore`), so SHA and version tag are
passed as build-args `APP_GIT_SHA` / `APP_VERSION_TAG` from
`scripts/deploy-k8s-with-build.sh`.

## Project layout

```
src/
├─ api/             Domain HTTP clients (axios): auth, pages, folders,
│                   tags, users, attachments, sync, graph, search, events (SSE),
│                   tasks, version
├─ assets/
│  ├─ main.css      Index file that imports style modules
│  └─ styles/       tokens, base, forms, components, wiki, markdown,
│                   highlight — one file per theme
├─ components/
│  ├─ admin/        AdminUsersPage, AdminEmbeddingSettingsPage
│  ├─ attachments/  AttachmentsPage + upload forms
│  ├─ auth/         LoginPage, RegisterPage
│  ├─ editor/       MarkdownEditor, EditorInputPane, EditorPreviewPane,
│  │                EditorToolbar, EditorFindBar, ReadingToolbar,
│  │                markdown.ts (markdown-it config), editorPreferences.ts,
│  │                textareaCaret.ts, structurizr.ts
│  ├─ graph/        WikiGraphPage, GraphPanel, graphRenderer.ts (D3)
│  ├─ layout/       AppLayout, AppHeader, AppSidebar
│  ├─ links/        BrokenLinksPage
│  ├─ pages/        WorkspacePage, NotFoundPage
│  ├─ profile/      ProfilePage
│  ├─ search/       SearchPage (RAG)
│  ├─ tasks/        OpenTasksPage
│  ├─ tree/         DocumentTree, TreeFolder, TreePage
│  └─ ui/           AppDialogHost, SkeletonPage, VerticalPaneResizer
├─ composables/     useEditorHistory, useEditorFind, useWikilinkAutocomplete,
│                   useTreeSse, usePageTags, useTreeActions, useMovePage,
│                   usePageAutosave, usePageLoader, useWorkspacePage,
│                   useBreakpoint, useHorizontalDragResize
├─ i18n/            vue-i18n: en.ts, ru.ts, index.ts (locale persist)
├─ router/          vue-router + auth guards
├─ services/        pageIndex — shared page-list cache, wikilink
│                   resolver, pageMatchesWikilinkQuery
├─ stores/          Pinia: auth, folders, tags, theme, dialog, editorUi
├─ types/           Shared app types and .d.ts for third-party plugins
└─ utils/           apiError, editorFind, frontmatter, localPreferences,
                    folderId, pageSlug, formatMarkdownTable, tablePipeCells,
                    previewLinks, exportPagePdf, and others
```

### Architecture notes

- **Single error layer.** Use `utils/apiError.ts` (`getApiErrorMessage`,
  `isApiErrorWithStatus`) instead of ad-hoc `axios.isAxiosError`. New
  error UI should go through it.
- **`localStorage` only via `utils/localPreferences.ts`.** Direct
  `window.localStorage` is forbidden: it survives Safari private mode and
  quota errors and gives typed JSON reads.
- **i18n via `src/i18n/`.** The old `utils/i18n.ts` is gone; components
  use `useI18n()` / `t('key')`.
- **One page cache.** `services/pageIndex.ts` is the only page-list source
  for wiki autocomplete, preview, and the resolver. Mutations in
  `api/pages.ts`, `api/sync.ts`, and `api/links.ts` call
  `invalidatePageIndex()`.
- **Composition over inheritance.** Large logic (editor, tree, graph) lives
  in composables and plain modules. Vue components stay a thin UI/state
  wrapper.
- **Styles split by theme.** Edit a specific file in `assets/styles`, not
  the shared `main.css` — it only imports modules now.

## Tests

All tests are `src/**/*.test.ts`:

- `utils/` — `apiError`, `editorFind`, `frontmatter`, `localPreferences`,
  `folderId`, `pageSlug`, `formatMarkdownTable`, `tablePipeCells`,
  `previewLinks`, `exportPagePdf`, `dndPayload`, `folderTree`.
- `services/` — `pageIndex` (wikilink query matching, pagination).
- `composables/` — `useWikilinkAutocomplete`.
- `stores/` — `auth`, `folders`, `dialog` with mocked axios clients.
- `components/` — `markdown`, `structurizr`, `graphRenderer`,
  `AppDialogHost`, `AdminEmbeddingSettingsPage`, `OpenTasksPage`.

```sh
npm run test
```

## Kubernetes deploy

Scripts in `scripts/` deploy the Helm chart
`deploy/helm/mdwiki-frontend` (nginx + static files, proxy `/api/*` to the
backend). You need `kubectl`, `helm`, and `docker`.

| Script | Purpose |
|--------|---------|
| `scripts/deploy-k8s.sh` | `helm upgrade --install` without building an image |
| `scripts/deploy-k8s-with-build.sh` | `docker build` (+ push for a remote registry) + deploy |
| `scripts/undeploy-k8s.sh` | `helm uninstall` the release |

### Typical deploy

```sh
# Local OrbStack / k8s: values-local.yaml in the repo root
VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh

# Prod values (ingress, upstream API, etc.)
VALUES_FILE=deploy/helm/mdwiki-frontend/values-prod.yaml ./scripts/deploy-k8s-with-build.sh

# Helm only, image already in a registry
IMAGE_REPOSITORY=ghcr.io/your-org/mdwiki-frontend \
IMAGE_TAG=v0.1.0 \
./scripts/deploy-k8s.sh
```

The API should be deployed first (see
[mdwiki-api/scripts/deploy-k8s-with-build.sh](../mdwiki-api/scripts/deploy-k8s-with-build.sh)).
By default nginx proxies to `http://mdwiki-api-mdwiki-api:8080`
(`api.upstream` in values).

The image gets a single tag — **`git describe --tags --always`**
(for example `mdwiki-frontend:v0.1.0` or `mdwiki-frontend:v0.1.0-3-g7dc9ede`).
Builds receive `APP_GIT_SHA` and `APP_VERSION_TAG` (for the UI, not as a
second docker tag).

### Useful environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RELEASE_NAME` | `mdwiki-frontend` | Helm release name |
| `NAMESPACE` | `mdwiki` | Namespace (same as the API) |
| `VALUES_FILE` | — | Extra values file |
| `IMAGE_REPOSITORY` | `mdwiki-frontend` | Image repository |
| `IMAGE_TAG` | `git describe --tags --always` (+ `-dirty`) | Image tag |
| `PUSH_IMAGE` | `true` for a remote registry, otherwise `false` | Push the image after build |
| `IMAGE_PULL_POLICY` | `Always` / `IfNotPresent` | Cluster pull policy |
| `TIMEOUT` | `5m` | Deploy timeout |

### Remove from the cluster

```sh
./scripts/undeploy-k8s.sh
```

Chart details: `deploy/helm/mdwiki-frontend/README.md`.
