# Admin Trash Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать ADMIN UI «Корзина» для просмотра soft-deleted страниц, восстановления и окончательного удаления.

**Architecture:** Переиспользовать существующие `GET /api/pages/deleted`, `POST /api/pages/{slug}/restore` и `DELETE ?mode=HARD`. Ужесточить security до ADMIN, добавить `deletedAt` в `PageListItem`, отсортировать список на сервере. На фронте — страница `/admin/trash` по паттерну `AdminUsersPage`, ссылка в admin-nav.

**Tech Stack:** Kotlin, Spring Boot Security, JPA, Vue 3, Vue Router, vue-i18n, Vitest, MockMvc.

**Spec:** `docs/superpowers/specs/2026-07-30-admin-trash-restore-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `mdwiki-api/.../dto/PageDtos.kt` | `PageListItem.deletedAt` |
| `mdwiki-api/.../mapper/PageMapper.kt` | map `deletedAt` |
| `mdwiki-api/.../repository/PageRepository.kt` | sorted deleted query |
| `mdwiki-api/.../service/PageService.kt` | use sorted query |
| `mdwiki-api/.../config/SecurityConfig.kt` | ADMIN-only deleted/restore |
| `mdwiki-api/.../controller/PageControllerTest.kt` | security + deletedAt JSON |
| `mdwiki-frontend/src/types/index.ts` | `deletedAt` on `PageListItem` |
| `mdwiki-frontend/src/api/pages.ts` | `listDeletedPages`, `restorePage` |
| `mdwiki-frontend/src/router/index.ts` | `/admin/trash` route |
| `mdwiki-frontend/src/i18n/ru.ts`, `en.ts` | trash strings |
| `mdwiki-frontend/src/components/admin/AdminTrashPage.vue` | trash UI |
| `mdwiki-frontend/src/components/admin/AdminTrashPage.test.ts` | smoke tests |
| `mdwiki-frontend/src/components/admin/AdminUsersPage.vue` | admin-nav link |
| `mdwiki-frontend/src/components/admin/AdminEmbeddingSettingsPage.vue` | admin-nav link |

---

### Task 1: API — `deletedAt` in list DTO + sorted deleted list

**Files:**
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/main/kotlin/com/mdwiki/dto/PageDtos.kt`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/main/kotlin/com/mdwiki/mapper/PageMapper.kt`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/main/kotlin/com/mdwiki/repository/PageRepository.kt`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/main/kotlin/com/mdwiki/service/PageService.kt`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/test/kotlin/com/mdwiki/controller/PageControllerTest.kt`
- Test: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/test/kotlin/com/mdwiki/service/PageServiceTest.kt` (optional unit assert if easy)

- [ ] **Step 1: Write failing controller test for `deletedAt` in listDeleted response**

Add to `PageControllerTest.kt`:

```kotlin
@Test
@WithMockUser(roles = ["ADMIN"])
fun `GET deleted pages returns deletedAt`() {
    val deletedAt = Instant.parse("2026-07-29T14:22:00Z")
    val item = PageListItem(
        id = samplePage.id,
        slug = "gone",
        title = "Gone",
        tags = emptyList(),
        updatedAt = Instant.now(),
        deletedAt = deletedAt
    )
    whenever(pageService.findDeleted()).thenReturn(listOf(item))

    mockMvc.get("/api/pages/deleted").andExpect {
        status { isOk() }
        jsonPath("$[0].slug") { value("gone") }
        jsonPath("$[0].deletedAt") { value("2026-07-29T14:22:00Z") }
    }
}
```

Also update the existing `PageListItem(...)` construction in `GET pages returns list` — it still compiles if `deletedAt` has default `null`.

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-api && ./gradlew test --tests "com.mdwiki.controller.PageControllerTest.GET deleted pages returns deletedAt"
```

Expected: FAIL (403 if security not yet ADMIN-only for this path under ADMIN user — actually ADMIN should pass general GET matcher today; fail because service mock may work but `deletedAt` not in DTO → compilation error or JSON missing field). Prefer compilation failure / assertion failure on missing `deletedAt`.

- [ ] **Step 3: Implement DTO + mapper + sorted repository**

In `PageDtos.kt`:

```kotlin
data class PageListItem(
    val id: UUID,
    val slug: String,
    val title: String,
    val tags: List<String>,
    val folderId: UUID? = null,
    val updatedAt: Instant,
    val deletedAt: Instant? = null
)
```

In `PageMapper.kt` `toListItem()`:

```kotlin
fun Page.toListItem(): PageListItem = PageListItem(
    id = id!!,
    slug = slug,
    title = displayTitle(),
    tags = tags.map { it.name },
    folderId = folder?.id,
    updatedAt = updatedAt,
    deletedAt = deletedAt
)
```

In `PageRepository.kt` replace/add:

```kotlin
@EntityGraph(attributePaths = ["tags"])
fun findByDeletedAtIsNotNullOrderByDeletedAtDesc(): List<Page>
```

Remove unused `findByDeletedAtIsNotNull()` if nothing else calls it (grep first); if sync/other code uses it, keep both and switch only `findDeleted`.

In `PageService.findDeleted()`:

```kotlin
fun findDeleted(): List<PageListItem> {
    return pageRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc().map { it.toListItem() }
}
```

- [ ] **Step 4: Re-run test — expect PASS**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-api && ./gradlew test --tests "com.mdwiki.controller.PageControllerTest.GET deleted pages returns deletedAt"
```

Expected: PASS

- [ ] **Step 5: Commit (mdwiki-api)**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-api
git add src/main/kotlin/com/mdwiki/dto/PageDtos.kt \
  src/main/kotlin/com/mdwiki/mapper/PageMapper.kt \
  src/main/kotlin/com/mdwiki/repository/PageRepository.kt \
  src/main/kotlin/com/mdwiki/service/PageService.kt \
  src/test/kotlin/com/mdwiki/controller/PageControllerTest.kt
git commit -m "$(cat <<'EOF'
feat: include deletedAt in deleted pages list

EOF
)"
```

---

### Task 2: API — ADMIN-only security for deleted list and restore

**Files:**
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/main/kotlin/com/mdwiki/config/SecurityConfig.kt`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-api/src/test/kotlin/com/mdwiki/controller/PageControllerTest.kt`

- [ ] **Step 1: Write failing security tests**

```kotlin
@Test
@WithMockUser(roles = ["EDITOR"])
fun `GET deleted pages forbidden for EDITOR`() {
    mockMvc.get("/api/pages/deleted").andExpect {
        status { isForbidden() }
    }
}

@Test
@WithMockUser(roles = ["EDITOR"])
fun `POST restore forbidden for EDITOR`() {
    mockMvc.post("/api/pages/gone/restore").andExpect {
        status { isForbidden() }
    }
}

@Test
@WithMockUser(roles = ["ADMIN"])
fun `POST restore allowed for ADMIN`() {
    whenever(pageService.restore("gone")).thenReturn(samplePage)

    mockMvc.post("/api/pages/gone/restore").andExpect {
        status { isOk() }
        jsonPath("$.slug") { value("test-page") }
    }
    verify(pageService).restore("gone")
}
```

Keep Task 1's ADMIN listDeleted test — it must remain 200.

- [ ] **Step 2: Run EDITOR forbidden test — expect FAIL (currently 200)**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-api && ./gradlew test --tests "com.mdwiki.controller.PageControllerTest.GET deleted pages forbidden for EDITOR"
```

Expected: FAIL — status 200 instead of 403.

- [ ] **Step 3: Tighten SecurityConfig**

Insert **before** the general `GET/POST /api/pages/**` matchers:

```kotlin
.requestMatchers(HttpMethod.GET, "/api/pages/deleted").hasRole("ADMIN")
.requestMatchers(HttpMethod.POST, "/api/pages/*/restore").hasRole("ADMIN")
.requestMatchers(HttpMethod.GET, "/api/pages/**", "/api/tags/**", "/api/search/**").hasAnyRole("READER", "EDITOR", "ADMIN")
.requestMatchers(HttpMethod.POST, "/api/pages/**").hasAnyRole("EDITOR", "ADMIN")
```

Do not change DELETE matcher — hard delete from trash still uses existing EDITOR+ADMIN rule; UI gates hard delete to ADMIN via `requiresAdmin` page.

- [ ] **Step 4: Run all new PageControllerTest methods**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-api && ./gradlew test --tests "com.mdwiki.controller.PageControllerTest"
```

Expected: all PASS

- [ ] **Step 5: Commit (mdwiki-api)**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-api
git add src/main/kotlin/com/mdwiki/config/SecurityConfig.kt \
  src/test/kotlin/com/mdwiki/controller/PageControllerTest.kt
git commit -m "$(cat <<'EOF'
fix: restrict deleted list and restore to ADMIN

EOF
)"
```

---

### Task 3: Frontend — API client, types, i18n, route

**Files:**
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/types/index.ts`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/api/pages.ts`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/i18n/ru.ts`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/i18n/en.ts`

- [ ] **Step 1: Extend `PageListItem`**

```ts
export interface PageListItem {
  id: string
  slug: string
  title: string
  tags: string[]
  folderId: string | null
  updatedAt: string
  deletedAt?: string | null
}
```

- [ ] **Step 2: Add API helpers in `pages.ts`**

```ts
export function listDeletedPages() {
  return client.get<PageListItem[]>('/pages/deleted')
}

export async function restorePage(slug: string) {
  const res = await client.post<Page>(`/pages/${slug}/restore`)
  invalidatePageIndex()
  return res
}
```

- [ ] **Step 3: Add i18n keys**

`ru.ts` under `admin`:

```ts
trashTitle: 'Корзина',
trashSubtitle: 'Мягко удалённые страницы. Можно восстановить или удалить навсегда.',
openTrash: 'Корзина',
colTitle: 'Название',
colSlug: 'Slug',
colDeletedAt: 'Удалено',
restore: 'Восстановить',
hardDelete: 'Удалить навсегда',
confirmHardDelete: 'Удалить страницу "{title}" навсегда? Это нельзя отменить.',
trashEmpty: 'Нет удалённых страниц',
```

`en.ts` under `admin`:

```ts
trashTitle: 'Trash',
trashSubtitle: 'Soft-deleted pages. Restore them or delete permanently.',
openTrash: 'Trash',
colTitle: 'Title',
colSlug: 'Slug',
colDeletedAt: 'Deleted',
restore: 'Restore',
hardDelete: 'Delete permanently',
confirmHardDelete: 'Permanently delete page "{title}"? This cannot be undone.',
trashEmpty: 'No deleted pages',
```

Also add under `errors` in both locales if missing:

```ts
// ru
loadTrashFailed: 'Не удалось загрузить корзину',
restorePageFailed: 'Не удалось восстановить страницу',
hardDeletePageFailed: 'Не удалось удалить страницу навсегда',

// en
loadTrashFailed: 'Failed to load trash',
restorePageFailed: 'Failed to restore page',
hardDeletePageFailed: 'Failed to permanently delete page',
```

- [ ] **Step 4: Commit (mdwiki-frontend)**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend
git add src/types/index.ts src/api/pages.ts src/i18n/ru.ts src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat: add trash API client and i18n

EOF
)"
```

---

### Task 4: Frontend — `AdminTrashPage` + route + tests + admin-nav links

**Files:**
- Create: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/components/admin/AdminTrashPage.vue`
- Create: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/components/admin/AdminTrashPage.test.ts`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/router/index.ts`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/components/admin/AdminUsersPage.vue`
- Modify: `/Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend/src/components/admin/AdminEmbeddingSettingsPage.vue`

- [ ] **Step 1: Write failing page tests**

`AdminTrashPage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminTrashPage from './AdminTrashPage.vue'
import { i18n } from '@/i18n'

const mockListDeletedPages = vi.fn()
const mockRestorePage = vi.fn()
const mockDeletePage = vi.fn()
const mockAlert = vi.fn()
const mockConfirm = vi.fn()

vi.mock('@/api/pages', () => ({
  listDeletedPages: (...args: unknown[]) => mockListDeletedPages(...args),
  restorePage: (...args: unknown[]) => mockRestorePage(...args),
  deletePage: (...args: unknown[]) => mockDeletePage(...args)
}))

vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({
    alert: mockAlert,
    confirm: mockConfirm
  })
}))

describe('AdminTrashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListDeletedPages.mockResolvedValue({
      data: [
        {
          id: '1',
          slug: 'gone',
          title: 'Gone',
          tags: [],
          folderId: null,
          updatedAt: '2026-07-29T10:00:00Z',
          deletedAt: '2026-07-29T14:22:00Z'
        }
      ]
    })
    mockRestorePage.mockResolvedValue({ data: {} })
    mockDeletePage.mockResolvedValue(undefined)
    mockConfirm.mockResolvedValue(true)
  })

  it('lists deleted pages and restores on click', async () => {
    const wrapper = mount(AdminTrashPage, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Gone')
    expect(wrapper.text()).toContain('gone')

    await wrapper.get('button.btn-restore').trigger('click')
    await flushPromises()

    expect(mockRestorePage).toHaveBeenCalledWith('gone')
    expect(mockListDeletedPages).toHaveBeenCalledTimes(2)
  })

  it('hard-deletes after confirm', async () => {
    const wrapper = mount(AdminTrashPage, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    await flushPromises()

    await wrapper.get('button.btn-hard-delete').trigger('click')
    await flushPromises()

    expect(mockConfirm).toHaveBeenCalled()
    expect(mockDeletePage).toHaveBeenCalledWith('gone', 'hard')
  })

  it('shows empty state when trash is empty', async () => {
    mockListDeletedPages.mockResolvedValue({ data: [] })
    const wrapper = mount(AdminTrashPage, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    await flushPromises()
    expect(wrapper.text()).toMatch(/Нет удалённых|No deleted/i)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend && npm test -- src/components/admin/AdminTrashPage.test.ts
```

Expected: FAIL — component missing / selectors missing.

- [ ] **Step 3: Implement `AdminTrashPage.vue`**

Mirror structure/styles of `AdminUsersPage.vue` (admin-nav, table, mobile data-labels). Core script:

```ts
import { ref, onMounted } from 'vue'
import * as pagesApi from '@/api/pages'
import type { PageListItem } from '@/types'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

const { t } = useI18n()
const dialog = useDialogStore()
const pages = ref<PageListItem[]>([])
const loading = ref(true)

function formatDeletedAt(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

async function fetchDeleted() {
  loading.value = true
  try {
    const { data } = await pagesApi.listDeletedPages()
    pages.value = data
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.loadTrashFailed')))
  } finally {
    loading.value = false
  }
}

async function restore(page: PageListItem) {
  try {
    await pagesApi.restorePage(page.slug)
    await fetchDeleted()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.restorePageFailed')))
  }
}

async function hardDelete(page: PageListItem) {
  const ok = await dialog.confirm(t('admin.confirmHardDelete', { title: page.title }), {
    danger: true,
    confirmLabel: t('admin.hardDelete')
  })
  if (!ok) return
  try {
    await pagesApi.deletePage(page.slug, 'hard')
    await fetchDeleted()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.hardDeletePageFailed')))
  }
}

onMounted(fetchDeleted)
```

Template essentials:

- admin-nav with three links: users, embedding, trash (`t('admin.openTrash')`)
- `h1` + subtitle
- loading → `SkeletonPage variant="table"`
- `v-else-if="pages.length === 0"` → empty text
- else table columns: title, slug, deletedAt (`formatDeletedAt`), actions with `button.btn-restore` and `button.btn-hard-delete`

Reuse scoped CSS patterns from `AdminUsersPage` (admin-nav, table, danger-ish button hover). Keep mobile stacked rows with `data-label` like Users.

- [ ] **Step 4: Add route + wire admin-nav**

In `router/index.ts` children, next to other admin routes:

```ts
{ path: 'admin/trash', name: 'admin-trash', component: () => import('@/components/admin/AdminTrashPage.vue'), meta: { requiresAdmin: true } },
```

In both `AdminUsersPage.vue` and `AdminEmbeddingSettingsPage.vue`, add after Embedding link:

```vue
<router-link to="/admin/trash" class="admin-nav-link">{{ t('admin.openTrash') }}</router-link>
```

(Also include the same three-link nav inside `AdminTrashPage` itself.)

- [ ] **Step 5: Run frontend tests**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend && npm test -- src/components/admin/AdminTrashPage.test.ts
```

Expected: PASS

Also run full suite if time allows:

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend && npm test
```

Expected: all PASS

- [ ] **Step 6: Commit (mdwiki-frontend)**

```bash
cd /Users/nikolaygroznyh/Work/mdwiki/mdwiki-frontend
git add src/components/admin/AdminTrashPage.vue \
  src/components/admin/AdminTrashPage.test.ts \
  src/components/admin/AdminUsersPage.vue \
  src/components/admin/AdminEmbeddingSettingsPage.vue \
  src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: add admin trash page for restore and hard delete

EOF
)"
```

(Include any Task 3 files not yet committed if Task 3 commit was skipped.)

---

### Task 5: Manual verification checklist

- [ ] **Step 1: Soft-delete a page from the tree** (EDITOR or ADMIN)
- [ ] **Step 2: As ADMIN open `/admin/trash`** — page appears with `deletedAt`
- [ ] **Step 3: Restore** — page returns to tree; row leaves trash
- [ ] **Step 4: Soft-delete again, then hard-delete from trash** — confirm dialog; page gone from trash and disk; tree updated
- [ ] **Step 5: As EDITOR** — `/admin/trash` redirects away; `GET /api/pages/deleted` → 403

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Admin page `/admin/trash` | 4 |
| admin-nav link on all admin pages | 4 |
| `listDeleted` / `restore` client | 3 |
| Hard delete via existing API | 4 |
| `deletedAt` on `PageListItem` | 1, 3 |
| Sort by `deletedAt` desc | 1 |
| ADMIN-only security | 2 |
| Empty state, confirm hard delete, no confirm restore | 4 |
| API error alerts | 4 |
| Tests API + frontend | 1, 2, 4 |
| Out of scope items not implemented | — |
