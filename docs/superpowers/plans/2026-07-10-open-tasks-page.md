# Open Tasks Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить серверную агрегацию Markdown-задач и страницу `/tasks` с безопасным завершением задач и необязательным summary.

**Architecture:** API сканирует `Page.contentMd` на сервере и возвращает snapshot каждой открытой задачи. Завершение использует `updatedAt` и `sourceOffset` только в пределах этого snapshot, поэтому изменение документа приводит к `409`, а не к изменению неверной строки. Vue-страница группирует плоский ответ по документу и полностью перезагружает список после успеха.

**Tech Stack:** Kotlin, Spring Boot, JPA, Liquibase, Vue 3, Pinia, Vitest.

---

### Task 1: Stabilize existing test commands

**Files:**
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/package.json`
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/test/kotlin/com/mdwiki/service/AuthServiceTest.kt`
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/build.gradle.kts`

- [ ] **Step 1: Make Vitest independent of Node 26 Web Storage**

Change the test script to:

```json
"test": "NODE_OPTIONS=--no-experimental-webstorage vitest run"
```

- [ ] **Step 2: Repair the AuthService test fixture**

Mock and pass the constructor dependency introduced by `ChangePasswordUseCase`:

```kotlin
@Mock
private lateinit var changePasswordUseCase: ChangePasswordUseCase

authService = AuthService(registerUserUseCase, loginUserUseCase, changePasswordUseCase)
```

- [ ] **Step 3: Limit Spring test connection pools**

In `tasks.withType<Test>`, add:

```kotlin
environment("SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE", "1")
```

- [ ] **Step 4: Verify baseline**

Run:

```bash
cd /Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks && npm test
cd /Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks && docker compose up -d postgres && ./gradlew test --rerun-tasks
```

Expected: 129 frontend tests and all API tests pass.

### Task 2: Add task scanning and completion domain logic

**Files:**
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/main/kotlin/com/mdwiki/util/MarkdownTaskScanner.kt`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/main/kotlin/com/mdwiki/dto/TaskDtos.kt`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/main/kotlin/com/mdwiki/service/OpenTaskService.kt`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/main/kotlin/com/mdwiki/service/usecase/CompleteOpenTaskUseCase.kt`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/test/kotlin/com/mdwiki/service/OpenTaskServiceTest.kt`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/test/kotlin/com/mdwiki/service/usecase/CompleteOpenTaskUseCaseTest.kt`

- [ ] **Step 1: Write scanner tests**

Cover two open tasks, a closed task, and a task-looking line in a fenced code block:

```kotlin
val markdown = """
- [ ] Ship release
- [x] Old task
```text
- [ ] Not a task
```
- [ ] Review PR
""".trimIndent()

assertThat(scanner.scan(markdown).map { it.text })
    .containsExactly("Ship release", "Review PR")
```

- [ ] **Step 2: Run the scanner test and observe failure**

Run:

```bash
./gradlew test --tests "com.mdwiki.service.OpenTaskServiceTest"
```

Expected: compilation failure because scanner/service do not exist.

- [ ] **Step 3: Implement the scanner and list service**

`MarkdownTaskScanner` must return records with the marker offset, full source line, and visible text. It must ignore protected code ranges. `OpenTaskService.listOpen()` iterates `findAllByDeletedAtIsNull()`, derives `locked` through `FrontmatterMetaService`, and maps each record to:

```kotlin
data class OpenTaskResponse(
    val documentId: UUID,
    val slug: String,
    val documentTitle: String,
    val taskText: String,
    val sourceOffset: Int,
    val sourceLine: String,
    val updatedAt: Instant,
    val locked: Boolean,
)
```

- [ ] **Step 4: Add completion behavior tests**

Test that completion:

```kotlin
val request = CompleteTaskRequest(page.id, page.updatedAt, offset, "- [ ] Ship release", "Released v1")
useCase.execute(request, "editor")
assertThat(page.contentMd).contains("- [x] Ship release\n> Released v1")
```

Also add separate tests for blank summary, changed `updatedAt` (`ConflictException`), nonmatching offset (`ConflictException`) and locked pages (`ForbiddenException`).

- [ ] **Step 5: Implement atomic completion**

Within `@Transactional`, load the page, reject locked pages, compare `page.updatedAt` to request, validate the exact line at `sourceOffset`, replace only the `[ ]` marker, and insert:

```kotlin
summary.trim().lines().joinToString("\n") { "> $it" }
```

Run the existing write pipeline: update `contentMd`/`updatedAt`/`updatedBy`, refresh frontmatter, write the file, save, sync metadata, and reindex RAG.

- [ ] **Step 6: Run the focused server tests**

Run:

```bash
./gradlew test --tests "com.mdwiki.service.OpenTaskServiceTest" --tests "com.mdwiki.service.usecase.CompleteOpenTaskUseCaseTest"
```

Expected: PASS.

### Task 3: Expose and authorize task endpoints

**Files:**
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/main/kotlin/com/mdwiki/controller/TaskController.kt`
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/main/kotlin/com/mdwiki/config/SecurityConfig.kt`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks/src/test/kotlin/com/mdwiki/controller/TaskControllerTest.kt`

- [ ] **Step 1: Write controller authorization tests**

Assert `GET /api/tasks/open` is available to READER, `POST /api/tasks/complete` is forbidden to READER, and POST succeeds for EDITOR with a valid JSON snapshot.

- [ ] **Step 2: Run the controller test and observe failure**

Run:

```bash
./gradlew test --tests "com.mdwiki.controller.TaskControllerTest"
```

Expected: compilation failure because `TaskController` does not exist.

- [ ] **Step 3: Implement controller and route rules**

Use:

```kotlin
@RestController
@RequestMapping("/api/tasks")
class TaskController(
    private val openTaskService: OpenTaskService,
    private val completeOpenTaskUseCase: CompleteOpenTaskUseCase,
) {
    @GetMapping("/open")
    fun listOpen() = openTaskService.listOpen()

    @PostMapping("/complete")
    fun complete(@Valid @RequestBody request: CompleteTaskRequest, auth: Authentication) =
        completeOpenTaskUseCase.execute(request, auth.name)
}
```

Authorize GET for `READER`, `EDITOR`, `ADMIN` and POST for `EDITOR`, `ADMIN`.

- [ ] **Step 4: Run controller tests**

Run:

```bash
./gradlew test --tests "com.mdwiki.controller.TaskControllerTest"
```

Expected: PASS.

### Task 4: Add frontend API types and tasks screen

**Files:**
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/src/api/tasks.ts`
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/src/types/index.ts`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/src/components/tasks/OpenTasksPage.vue`
- Create: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/src/components/tasks/OpenTasksPage.test.ts`
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/src/router/index.ts`
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/src/components/layout/AppHeader.vue`
- Modify: `/Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks/src/utils/i18n.ts`

- [ ] **Step 1: Write UI tests**

Mock `/api/tasks` and test grouping, disabled locked checkbox, opening the document, blank/nonblank summary payloads, post-success reload, and `409` confirmation/reload.

- [ ] **Step 2: Run the page test and observe failure**

Run:

```bash
npm test -- src/components/tasks/OpenTasksPage.test.ts
```

Expected: failure because module/page does not exist.

- [ ] **Step 3: Implement types and API module**

Use snapshot types:

```ts
export interface OpenTask {
  documentId: string
  slug: string
  documentTitle: string
  taskText: string
  sourceOffset: number
  sourceLine: string
  updatedAt: string
  locked: boolean
}
```

`completeTask()` posts the snapshot plus optional trimmed summary to `/tasks/complete`, then calls `invalidatePageIndex()`.

- [ ] **Step 4: Implement `OpenTasksPage.vue`**

Follow `BrokenLinksPage.vue`: fetch on mount, use `SkeletonPage`, group by `documentId`, use an inline textarea modal, and reload after completion. Use `isApiErrorWithStatus(error, 409)` to offer a list reload. Disable complete controls for `locked`, non-editors, and in-flight completion.

- [ ] **Step 5: Add route, nav, and translations**

Add child route `{ path: 'tasks', name: 'open-tasks', component: () => import('@/components/tasks/OpenTasksPage.vue') }`, then add the translated Tasks link in desktop and mobile header navigation.

- [ ] **Step 6: Run frontend verification**

Run:

```bash
npm test -- src/components/tasks/OpenTasksPage.test.ts
npm test
npm run build
```

Expected: all checks pass.

### Task 5: Cross-repository verification

**Files:**
- Modify: all files from Tasks 2–4.

- [ ] **Step 1: Run all focused tests with PostgreSQL**

```bash
cd /Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks
docker compose up -d postgres
./gradlew test --tests "com.mdwiki.service.OpenTaskServiceTest" --tests "com.mdwiki.service.usecase.CompleteOpenTaskUseCaseTest" --tests "com.mdwiki.controller.TaskControllerTest"
```

- [ ] **Step 2: Run complete checks**

```bash
cd /Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks
npm test
npm run build
cd /Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks
./gradlew test
```

- [ ] **Step 3: Review diffs and status**

```bash
git -C /Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-frontend/feat-open-tasks status --short
git -C /Users/nikolaygroznyh/.config/superpowers/worktrees/mdwiki-api/feat-open-tasks status --short
```
