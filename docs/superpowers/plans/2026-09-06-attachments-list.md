# Attachments List Search + Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На странице Attachments — серверный поиск по имени файла и пагинация Prev/Next с `X-Total-Count`.

**Architecture:** API `GET /api/attachments` принимает `q`, `page`, `size` (default 20); фильтр `originalName` ILIKE в БД; тело — массив, total — заголовок `X-Total-Count` (как `/api/pages`). FE читает header, debounce поиска, abort на смене параметров.

**Tech Stack:** Kotlin/Spring Data JPA, Vue 3 + TypeScript, Vitest, vue-i18n, axios.

**Spec:** `docs/superpowers/specs/2026-09-06-attachments-list-design.md`

---

## File map

| File | Role |
|------|------|
| `mdwiki-api/.../repository/AttachmentRepository.kt` | Query methods с `q` / `pageId` |
| `mdwiki-api/.../service/AttachmentService.kt` | `list` → `Page<AttachmentResponse>` + `q` |
| `mdwiki-api/.../controller/AttachmentController.kt` | param `q`, default size 20, `X-Total-Count` |
| `mdwiki-api/.../mcp/WikiAttachmentListTool.kt` | `.content` + optional `q` |
| `mdwiki-api/.../AttachmentServiceTest.kt` | Unit list+q |
| `mdwiki-api/.../AttachmentControllerTest.kt` | MockMvc header + q |
| `mdwiki-frontend/src/api/attachments.ts` | `{ items, total }` из data + header |
| `mdwiki-frontend/src/components/attachments/AttachmentsPage.vue` | Search + pagination UI |
| `mdwiki-frontend/src/components/attachments/AttachmentsPage.test.ts` | Component tests |
| `mdwiki-frontend/src/i18n/en.ts`, `ru.ts` | Строки поиска/пагинации |

---

### Task 1: API repository + service list with `q` and `Page`

**Files:**
- Modify: `mdwiki-api/src/main/kotlin/com/mdwiki/repository/AttachmentRepository.kt`
- Modify: `mdwiki-api/src/main/kotlin/com/mdwiki/service/AttachmentService.kt`
- Modify: `mdwiki-api/src/test/kotlin/com/mdwiki/service/AttachmentServiceTest.kt`

- [ ] **Step 1: Write failing service tests for `q` and Page return**

В `AttachmentServiceTest.kt` обновить существующие list-тесты и добавить:

```kotlin
@Test
fun `list without q uses findAll`() {
    whenever(attachmentRepository.findAll(any<Pageable>())).thenReturn(PageImpl(emptyList()))
    val result = service.list(0, 20, null, null, "reader")
    assertEquals(0, result.totalElements)
    verify(attachmentRepository).findAll(any<Pageable>())
}

@Test
fun `list with q uses name search`() {
    whenever(
        attachmentRepository.findByOriginalNameContainingIgnoreCase(eq("note"), any<Pageable>())
    ).thenReturn(PageImpl(emptyList(), PageRequest.of(0, 20), 0))
    service.list(0, 20, null, "note", "reader")
    verify(attachmentRepository).findByOriginalNameContainingIgnoreCase(eq("note"), any<Pageable>())
}

@Test
fun `list with pageId and q uses combined search`() {
    val pid = UUID.randomUUID()
    whenever(
        attachmentRepository.findByPageIdAndOriginalNameContainingIgnoreCase(eq(pid), eq("img"), any<Pageable>())
    ).thenReturn(PageImpl(emptyList()))
    service.list(0, 20, pid, "img", "reader")
    verify(attachmentRepository)
        .findByPageIdAndOriginalNameContainingIgnoreCase(eq(pid), eq("img"), any<Pageable>())
}
```

Обновить старые вызовы `service.list(0, 50, …)` → новая сигнатура с `q` и assert на `Page`.

- [ ] **Step 2: Run tests — expect FAIL (missing methods / signature)**

Run (из `mdwiki-api`):

```bash
./gradlew test --tests com.mdwiki.service.AttachmentServiceTest
```

Expected: FAIL (method/signature not found).

- [ ] **Step 3: Implement repository methods**

```kotlin
interface AttachmentRepository : JpaRepository<Attachment, UUID> {
    fun findByPageId(pageId: UUID, pageable: Pageable): Page<Attachment>
    fun findByPageIdIn(pageIds: Collection<UUID>): List<Attachment>
    fun findByStoredName(storedName: String): Attachment?
    fun findByOriginalNameContainingIgnoreCase(originalName: String, pageable: Pageable): Page<Attachment>
    fun findByPageIdAndOriginalNameContainingIgnoreCase(
        pageId: UUID,
        originalName: String,
        pageable: Pageable
    ): Page<Attachment>
}
```

- [ ] **Step 4: Implement service `list` returning `Page`**

Заменить `list` в `AttachmentService.kt`:

```kotlin
@Transactional(readOnly = true)
fun list(
    page: Int,
    size: Int,
    pageId: UUID?,
    q: String?,
    requestingUsername: String
): Page<AttachmentResponse> {
    val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
    val needle = q?.trim()?.takeIf { it.isNotEmpty() }
    val results = when {
        pageId != null && needle != null ->
            attachmentRepository.findByPageIdAndOriginalNameContainingIgnoreCase(pageId, needle, pageable)
        pageId != null ->
            attachmentRepository.findByPageId(pageId, pageable)
        needle != null ->
            attachmentRepository.findByOriginalNameContainingIgnoreCase(needle, pageable)
        else ->
            attachmentRepository.findAll(pageable)
    }
    return results.map { it.toResponse() }
}
```

- [ ] **Step 5: Run service tests — expect PASS**

```bash
./gradlew test --tests com.mdwiki.service.AttachmentServiceTest
```

Expected: PASS.

- [ ] **Step 6: Commit (api repo)**

```bash
git add src/main/kotlin/com/mdwiki/repository/AttachmentRepository.kt \
  src/main/kotlin/com/mdwiki/service/AttachmentService.kt \
  src/test/kotlin/com/mdwiki/service/AttachmentServiceTest.kt
git commit -m "feat(api): filter attachments list by originalName with Page result"
```

---

### Task 2: AttachmentController + MCP + controller tests

**Files:**
- Modify: `mdwiki-api/src/main/kotlin/com/mdwiki/controller/AttachmentController.kt`
- Modify: `mdwiki-api/src/main/kotlin/com/mdwiki/mcp/WikiAttachmentListTool.kt`
- Modify: `mdwiki-api/src/test/kotlin/com/mdwiki/controller/AttachmentControllerTest.kt`

- [ ] **Step 1: Write failing controller test**

```kotlin
@Test
@WithMockUser(roles = ["READER"])
fun `GET attachments sets X-Total-Count and passes q`() {
    val page = PageImpl(listOf(sample), PageRequest.of(0, 20), 42)
    whenever(attachmentService.list(0, 20, null, "png", "user")).thenReturn(page)

    mockMvc.get("/api/attachments") {
        param("q", "png")
    }.andExpect {
        status { isOk() }
        header { string("X-Total-Count", "42") }
        jsonPath("$[0].storedName") { value("uuid.png") }
    }
}
```

Обновить существующий `GET attachments delegates…`: mock `list(0, 20, null, null, "user")` → `PageImpl(listOf(sample))`.

- [ ] **Step 2: Run controller test — expect FAIL**

```bash
./gradlew test --tests com.mdwiki.controller.AttachmentControllerTest
```

Expected: FAIL (wrong signature / no header).

- [ ] **Step 3: Update controller**

```kotlin
@GetMapping
fun list(
    @RequestParam(defaultValue = "0") page: Int,
    @RequestParam(defaultValue = "20") size: Int,
    @RequestParam(required = false) pageId: UUID?,
    @RequestParam(required = false) q: String?,
    auth: Authentication,
    response: HttpServletResponse
): List<AttachmentResponse> {
    val result = attachmentService.list(page, size, pageId, q, auth.name)
    response.setHeader("X-Total-Count", result.totalElements.toString())
    return result.content
}
```

Добавить imports: `HttpServletResponse`, `jakarta.servlet.http.HttpServletResponse` (как в `PageController`).

- [ ] **Step 4: Update MCP tool**

```kotlin
fun list(
    @McpToolParam(description = "Page number (0-based)", required = false) page: Int?,
    @McpToolParam(description = "Page size", required = false) size: Int?,
    @McpToolParam(description = "Optional page UUID to filter attachments", required = false) pageId: String?,
    @McpToolParam(description = "Optional substring filter on original file name", required = false) q: String?
): List<Map<String, Any?>> {
    val parsedPageId = pageId?.takeIf { it.isNotBlank() }?.let(::parseUuid)
    return attachmentService
        .list(page ?: 0, size ?: 20, parsedPageId, q, currentUsername())
        .content
        .map(::attachmentToMap)
}
```

- [ ] **Step 5: Run controller tests — expect PASS**

```bash
./gradlew test --tests com.mdwiki.controller.AttachmentControllerTest --tests com.mdwiki.service.AttachmentServiceTest
```

Expected: PASS. Если есть MCP-тесты на list — поправить под новую сигнатуру.

- [ ] **Step 6: Commit (api repo)**

```bash
git add src/main/kotlin/com/mdwiki/controller/AttachmentController.kt \
  src/main/kotlin/com/mdwiki/mcp/WikiAttachmentListTool.kt \
  src/test/kotlin/com/mdwiki/controller/AttachmentControllerTest.kt
git commit -m "feat(api): expose attachment search q and X-Total-Count"
```

---

### Task 3: FE API client `listAttachments`

**Files:**
- Modify: `mdwiki-frontend/src/api/attachments.ts`
- Create: `mdwiki-frontend/src/api/attachments.test.ts` (если в проекте принято тестировать api-обёртки; иначе покрыть через page test в Task 4)

- [ ] **Step 1: Write failing client test** (Vitest + axios mock)

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('./client', () => ({ default: { get, post: vi.fn(), delete: vi.fn() } }))

import { listAttachments } from './attachments'

describe('listAttachments', () => {
  beforeEach(() => get.mockReset())

  it('returns items and total from X-Total-Count', async () => {
    get.mockResolvedValue({
      data: [{ id: '1', originalName: 'a.png' }],
      headers: { 'x-total-count': '42' },
    })
    const result = await listAttachments({ page: 0, size: 20, q: 'a' })
    expect(get).toHaveBeenCalledWith('/attachments', {
      params: { page: 0, size: 20, q: 'a' },
      signal: undefined,
    })
    expect(result).toEqual({
      items: [{ id: '1', originalName: 'a.png' }],
      total: 42,
    })
  })

  it('falls back to items.length when header missing', async () => {
    get.mockResolvedValue({ data: [{ id: '1' }, { id: '2' }], headers: {} })
    const result = await listAttachments({ page: 0, size: 20 })
    expect(result.total).toBe(2)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/api/attachments.test.ts
```

Expected: FAIL (old signature returns AxiosResponse).

- [ ] **Step 3: Implement client**

```ts
import client from './client'
import type { Attachment } from '@/types'

export type AttachmentListResult = {
  items: Attachment[]
  total: number
}

export async function listAttachments(options: {
  page?: number
  size?: number
  q?: string
  pageId?: string
  signal?: AbortSignal
} = {}): Promise<AttachmentListResult> {
  const { page = 0, size = 20, q, pageId, signal } = options
  const res = await client.get<Attachment[]>('/attachments', {
    params: {
      page,
      size,
      ...(q && q.trim() ? { q: q.trim() } : {}),
      ...(pageId ? { pageId } : {}),
    },
    signal,
  })
  const header = res.headers['x-total-count']
  const total =
    header != null && header !== ''
      ? Number(header)
      : res.data.length
  return { items: res.data, total: Number.isFinite(total) ? total : res.data.length }
}
```

Оставить `uploadAttachment` / `deleteAttachment` без изменений.

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/api/attachments.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (frontend repo)**

```bash
git add src/api/attachments.ts src/api/attachments.test.ts
git commit -m "feat(fe): listAttachments returns items and total from X-Total-Count"
```

---

### Task 4: AttachmentsPage UI — search + pagination

**Files:**
- Modify: `mdwiki-frontend/src/components/attachments/AttachmentsPage.vue`
- Create: `mdwiki-frontend/src/components/attachments/AttachmentsPage.test.ts`
- Modify: `mdwiki-frontend/src/i18n/en.ts`, `mdwiki-frontend/src/i18n/ru.ts`

- [ ] **Step 1: Add i18n keys**

В `attachments` (en):

```ts
searchPlaceholder: 'Search by file name',
noResults: 'No attachments match your search.',
range: '{from}–{to} of {total}',
prevPage: 'Previous',
nextPage: 'Next',
```

В `attachments` (ru):

```ts
searchPlaceholder: 'Поиск по имени файла',
noResults: 'Ничего не найдено.',
range: '{from}–{to} из {total}',
prevPage: 'Назад',
nextPage: 'Вперёд',
```

- [ ] **Step 2: Write failing page tests**

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AttachmentsPage from './AttachmentsPage.vue'

const listAttachments = vi.fn()
const uploadAttachment = vi.fn()
const deleteAttachment = vi.fn()

vi.mock('@/api/attachments', () => ({
  listAttachments: (...a: unknown[]) => listAttachments(...a),
  uploadAttachment: (...a: unknown[]) => uploadAttachment(...a),
  deleteAttachment: (...a: unknown[]) => deleteAttachment(...a),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isEditor: true }),
}))

vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({
    alert: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}))

function sample(id: string, name: string) {
  return {
    id,
    originalName: name,
    storedName: name,
    contentType: 'text/plain',
    sizeBytes: 10,
    uploadedBy: 'u',
    pageId: null,
    url: `/api/uploads/${name}`,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

describe('AttachmentsPage', () => {
  beforeEach(() => {
    listAttachments.mockReset()
    listAttachments.mockResolvedValue({
      items: [sample('1', 'a.txt')],
      total: 25,
    })
  })

  it('loads first page with size 20', async () => {
    mount(AttachmentsPage)
    await flushPromises()
    expect(listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 20 })
    )
  })

  it('resets to page 0 when search query changes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AttachmentsPage)
    await flushPromises()
    listAttachments.mockClear()
    await wrapper.get('[data-testid="attachments-search"]').setValue('note')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, q: 'note', size: 20 })
    )
    vi.useRealTimers()
  })

  it('disables next on last page and prev on first', async () => {
    listAttachments.mockResolvedValue({ items: [sample('1', 'a.txt')], total: 1 })
    const wrapper = mount(AttachmentsPage)
    await flushPromises()
    expect(wrapper.get('[data-testid="attachments-prev"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="attachments-next"]').attributes('disabled')).toBeDefined()
  })

  it('shows no-results when q set and items empty', async () => {
    listAttachments.mockResolvedValue({ items: [], total: 0 })
    const wrapper = mount(AttachmentsPage)
    await flushPromises()
    await wrapper.get('[data-testid="attachments-search"]').setValue('zzz')
    // trigger immediate fetch path used after debounce in impl — or call load via next button absence
    await flushPromises()
    // After mounting with empty+no q shows empty; force q via setting and advancing timers:
    vi.useFakeTimers()
    await wrapper.get('[data-testid="attachments-search"]').setValue('zzz')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(wrapper.text()).toContain('attachments.noResults')
    vi.useRealTimers()
  })
})
```

Уточнить тест no-results при реализации (один путь с fake timers).

- [ ] **Step 3: Run page tests — expect FAIL**

```bash
npx vitest run src/components/attachments/AttachmentsPage.test.ts
```

Expected: FAIL (нет search/pagination).

- [ ] **Step 4: Implement AttachmentsPage**

Ключевые части script:

```ts
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
// ...existing imports...
import * as attachmentsApi from '@/api/attachments'

const PAGE_SIZE = 20
const attachments = ref<Attachment[]>([])
const total = ref(0)
const page = ref(0)
const searchInput = ref('')
const query = ref('')
const loading = ref(true)
let controller: AbortController | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const from = computed(() => (total.value === 0 ? 0 : page.value * PAGE_SIZE + 1))
const to = computed(() => Math.min((page.value + 1) * PAGE_SIZE, total.value))
const canPrev = computed(() => page.value > 0)
const canNext = computed(() => (page.value + 1) * PAGE_SIZE < total.value)
const showNoResults = computed(() => !loading.value && attachments.value.length === 0 && !!query.value.trim())
const showEmpty = computed(() => !loading.value && attachments.value.length === 0 && !query.value.trim())

async function fetchAttachments() {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  try {
    const result = await attachmentsApi.listAttachments({
      page: page.value,
      size: PAGE_SIZE,
      q: query.value,
      signal: controller.signal,
    })
    attachments.value = result.items
    total.value = result.total
    if (attachments.value.length === 0 && page.value > 0 && total.value > 0) {
      page.value -= 1
      await fetchAttachments()
    }
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_CANCELED') return
    await dialog.alert(getApiErrorMessage(e, t('errors.loadAttachmentsFailed')))
  } finally {
    loading.value = false
  }
}

watch(searchInput, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    query.value = value.trim()
    page.value = 0
    void fetchAttachments()
  }, 300)
})

function goPrev() {
  if (!canPrev.value) return
  page.value -= 1
  void fetchAttachments()
}

function goNext() {
  if (!canNext.value) return
  page.value += 1
  void fetchAttachments()
}

onMounted(fetchAttachments)
onBeforeUnmount(() => {
  controller?.abort()
  if (debounceTimer) clearTimeout(debounceTimer)
})
```

После upload/delete вызывать `fetchAttachments()` (уже есть).

Template (между upload-zone и таблицей):

```html
<div class="attachments-toolbar">
  <input
    data-testid="attachments-search"
    type="search"
    class="attachments-search"
    v-model="searchInput"
    :placeholder="t('attachments.searchPlaceholder')"
    :aria-label="t('attachments.searchPlaceholder')"
  />
</div>
```

Empty:

```html
<div v-else-if="showEmpty" class="state-placeholder">{{ t('attachments.empty') }}</div>
<div v-else-if="showNoResults" class="state-placeholder">{{ t('attachments.noResults') }}</div>
```

Под таблицей:

```html
<nav v-if="total > 0" class="attachments-pagination" :aria-label="t('attachments.title')">
  <span class="attachments-range">
    {{ t('attachments.range', { from, to, total }) }}
  </span>
  <div class="attachments-page-actions">
    <button
      type="button"
      class="btn-secondary btn-sm"
      data-testid="attachments-prev"
      :disabled="!canPrev"
      @click="goPrev"
    >{{ t('attachments.prevPage') }}</button>
    <button
      type="button"
      class="btn-secondary btn-sm"
      data-testid="attachments-next"
      :disabled="!canNext"
      @click="goNext"
    >{{ t('attachments.nextPage') }}</button>
  </div>
</nav>
```

CSS (scoped): toolbar flex, search input на полную ширину max ~28rem, pagination flex space-between, align center, margin-top.

- [ ] **Step 5: Run page + api tests — expect PASS**

```bash
npx vitest run src/api/attachments.test.ts src/components/attachments/AttachmentsPage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit (frontend repo)**

```bash
git add src/components/attachments/AttachmentsPage.vue \
  src/components/attachments/AttachmentsPage.test.ts \
  src/i18n/en.ts src/i18n/ru.ts
git commit -m "feat(fe): attachments search by name and prev/next pagination"
```

---

### Task 5: Manual verify + deploy note

- [ ] **Step 1: Deploy API then FE** (локальный OrbStack):

```bash
# api
cd mdwiki-api && VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh

# fe — уникальный IMAGE_TAG при -dirty, иначе под может остаться на старом digest
cd mdwiki-frontend && IMAGE_TAG="v$(date +%Y%m%d%H%M%S)-dirty" VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh
```

- [ ] **Step 2: Smoke checklist**

1. `/attachments` — до 20 строк, range «1–N из T».
2. Ввод имени — debounce, сброс на первую страницу, фильтр.
3. Prev/Next disabled на краях.
4. Пустой поиск без файлов → `empty`; с `q` без совпадений → `noResults`.
5. Upload/delete обновляет текущую выборку.

- [ ] **Step 3: Commit only if deploy scripts/docs changed** (обычно не нужно). Иначе skip.

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Search `originalName` only | 1 |
| Server-side page/size/q | 1–2 |
| Default size 20 | 2–4 |
| Body array + `X-Total-Count` | 2–3 |
| Prev/Next + range text | 4 |
| Debounce ~300ms, reset page on q | 4 |
| Empty vs no-results | 4 |
| Abort on new request | 4 |
| Upload/delete refetch (+ empty page step-back) | 4 |
| No URL sync | (explicit non-goal) |
| API + FE tests | 1–4 |
| MCP list still works | 2 |

## Out of scope (do not implement)

- Search by contentType / uploadedBy
- Page size selector
- URL query sync
- Shared Pagination component
