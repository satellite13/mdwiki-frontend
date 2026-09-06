# Favorites Stars + Search Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Избранное показывает только ⭐ страницы/поиски/views; полный CRUD поисков доступен через пункт шапки «Поиск» → `/saved-searches`.

**Architecture:** Таблицы `user_favorite_searches` / `user_favorite_views` по образцу `user_favorite_pages`; REST PUT/DELETE/GET; в DTO search/view — `favorited: boolean`. FE: nav, LibraryPage только ⭐, ⭐ на SavedSearchesPage/ViewsPage, deep-link `/views?view=`.

**Tech Stack:** Kotlin/Spring/Liquibase, Vue 3 + TypeScript, Vitest, vue-i18n.

**Spec:** `docs/superpowers/specs/2026-09-06-favorites-stars-design.md`

---

## File map

| File | Role |
|------|------|
| `mdwiki-api/.../db/changelog/013-favorite-searches-views.yaml` | DDL |
| `mdwiki-api/.../db.changelog-master.yaml` | include 013 |
| `mdwiki-api/.../model/` + repos | Entity + UserFavorite*Repository |
| `mdwiki-api/.../PkmController` or dedicated controllers | REST endpoints |
| `mdwiki-api/.../SavedSearchService`, `SavedViewService`, DTOs | `favorited` |
| `mdwiki-api/.../SecurityConfig.kt` | matchers |
| `mdwiki-frontend/src/api/library.ts` (или `favoriteLibrary.ts`) | client |
| `mdwiki-frontend/src/types/index.ts` | `favorited` |
| `AppHeader.vue`, i18n | nav «Поиск» |
| `LibraryPage.vue` (+test) | Favorites = ⭐ only |
| `SavedSearchesPage.vue` (+test) | ⭐ toggle |
| `ViewsPage.vue` (+test) | ⭐ + `?view=` |

---

### Task 1: Liquibase + models + repositories (API)

**Files:**
- Create: `mdwiki-api/src/main/resources/db/changelog/013-favorite-searches-views.yaml`
- Modify: `mdwiki-api/src/main/resources/db/changelog/db.changelog-master.yaml`
- Modify: `mdwiki-api/src/main/kotlin/com/mdwiki/model/PkmModels.kt` (или рядом новые entity-файлы)
- Modify: `mdwiki-api/src/main/kotlin/com/mdwiki/repository/PkmRepositories.kt`

- [ ] **Step 1: Add changelog**

```yaml
databaseChangeLog:
  - changeSet:
      id: 013-favorite-searches-views
      author: mdwiki
      changes:
        - sql:
            sql: >
              CREATE TABLE user_favorite_searches (
                user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                saved_search_id uuid NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
                created_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (user_id, saved_search_id)
              );
              CREATE INDEX idx_favorite_searches_user_created
                ON user_favorite_searches (user_id, created_at DESC);
              CREATE TABLE user_favorite_views (
                user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                view_id uuid NOT NULL REFERENCES saved_views(id) ON DELETE CASCADE,
                created_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (user_id, view_id)
              );
              CREATE INDEX idx_favorite_views_user_created
                ON user_favorite_views (user_id, created_at DESC);
      rollback:
        - sql:
            sql: DROP TABLE IF EXISTS user_favorite_views, user_favorite_searches;
```

Include after 012 in master.

- [ ] **Step 2: Entities + IdClasses**

По образцу `UserFavoritePage` / `UserPageId`:

```kotlin
data class UserSavedSearchId(val userId: UUID = UUID(0,0), val savedSearchId: UUID = UUID(0,0)) : Serializable

@Entity
@Table(name = "user_favorite_searches")
@IdClass(UserSavedSearchId::class)
class UserFavoriteSearch(
    @Id @Column(name = "user_id") val userId: UUID,
    @Id @Column(name = "saved_search_id") val savedSearchId: UUID,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saved_search_id", insertable = false, updatable = false)
    val savedSearch: SavedSearch,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)
```

Аналогично `UserFavoriteView` / `UserSavedViewId` с `view_id` → `SavedView`.

- [ ] **Step 3: Repositories**

```kotlin
interface UserFavoriteSearchRepository : JpaRepository<UserFavoriteSearch, UserSavedSearchId> {
    @Modifying
    @Query(
        value = """
            INSERT INTO user_favorite_searches(user_id,saved_search_id,created_at)
            VALUES (:userId,:savedSearchId,now())
            ON CONFLICT(user_id,saved_search_id) DO NOTHING
        """,
        nativeQuery = true
    )
    fun add(@Param("userId") userId: UUID, @Param("savedSearchId") savedSearchId: UUID)

    fun deleteByUserIdAndSavedSearchId(userId: UUID, savedSearchId: UUID)
    fun existsByUserIdAndSavedSearchId(userId: UUID, savedSearchId: UUID): Boolean

    @Query(
        "select f from UserFavoriteSearch f join fetch f.savedSearch s " +
            "where f.userId=:userId order by f.createdAt desc"
    )
    fun listByUser(@Param("userId") userId: UUID): List<UserFavoriteSearch>
}
```

Аналогично для views (`viewId`).

- [ ] **Step 4: Commit (api)**

```bash
git add src/main/resources/db/changelog/013-favorite-searches-views.yaml \
  src/main/resources/db/changelog/db.changelog-master.yaml \
  src/main/kotlin/com/mdwiki/model/ \
  src/main/kotlin/com/mdwiki/repository/PkmRepositories.kt
git commit -m "feat(api): tables for favorite searches and views"
```

---

### Task 2: REST + favorited in DTOs + tests (API)

**Files:**
- Modify: `SavedSearchDtos.kt`, `PropertyDtos.kt` (`SavedViewResponse`)
- Modify: `SavedSearchService.kt`, `SavedViewService.kt`
- Modify: `PkmController.kt` (или новые контроллеры рядом)
- Modify: `PkmService.kt` **или** тонкий сервис в Saved*Service для favorite ops
- Modify: `SecurityConfig.kt`
- Create/Modify tests: service/controller tests for favorites searches/views

Рекомендация: методы add/remove/list favorite search/view держать в `SavedSearchService` / `SavedViewService` (они знают ownership), endpoints в `PkmController` рядом с page favorites **или** в существующих Saved*Controller.

- [ ] **Step 1: Extend DTOs**

```kotlin
// SavedSearchResponse — add:
val favorited: Boolean = false

// SavedViewResponse — add:
val favorited: Boolean = false
```

В `response(...)` передавать `favorited = favoriteRepo.existsByUserIdAnd…`.

Для `list()`: один запрос id избранного пользователя → `Set<UUID>`, чтобы не N+1.

- [ ] **Step 2: Failing tests**

```kotlin
@Test
fun `add favorite search is idempotent and lists`() { /* … */ }

@Test
fun `cannot favorite another users search`() { /* expect 404 */ }

@Test
fun `saved search response includes favorited`() { /* … */ }
```

Аналогично для views. Run → FAIL.

- [ ] **Step 3: Implement endpoints**

```kotlin
@PutMapping("/api/me/favorite-searches/{savedSearchId}")
fun addFavoriteSearch(@PathVariable savedSearchId: UUID, auth: Authentication) =
    savedSearchService.addFavorite(savedSearchId, auth.name)

@DeleteMapping("/api/me/favorite-searches/{savedSearchId}")
fun removeFavoriteSearch(@PathVariable savedSearchId: UUID, auth: Authentication) =
    savedSearchService.removeFavorite(savedSearchId, auth.name)

@GetMapping("/api/me/favorite-searches")
fun listFavoriteSearches(auth: Authentication) =
    savedSearchService.listFavorites(auth.name)
```

Аналогично `/api/me/favorite-views/{viewId}` и GET list.

`addFavorite`: verify owned search exists → `repo.add`.  
`listFavorites`: map to `SavedSearchResponse` with `favorited=true`.

Security:

```kotlin
.requestMatchers(
  "/api/me/recent-pages/**",
  "/api/me/favorites/**",
  "/api/me/favorite-searches/**",
  "/api/me/favorite-views/**"
).hasAnyRole("READER", "EDITOR", "ADMIN")
```

- [ ] **Step 4: Run tests PASS**

```bash
./gradlew test --tests '*SavedSearch*' --tests '*SavedView*' --tests '*Favorite*'
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): favorite searches and views endpoints with favorited flag"
```

---

### Task 3: FE types + API client

**Files:**
- Modify: `mdwiki-frontend/src/types/index.ts`
- Modify: `mdwiki-frontend/src/api/library.ts` (добавить функции) **или** create `src/api/favoriteLibrary.ts`
- Create: `src/api/library.favorites.test.ts` (или рядом)

- [ ] **Step 1: Types**

```ts
export interface SavedSearch {
  // ...existing
  favorited: boolean
}
export interface SavedView {
  // ...existing
  favorited: boolean
}
```

- [ ] **Step 2: Client**

```ts
export const listFavoriteSearches = (signal?: AbortSignal) =>
  client.get<SavedSearch[]>('/me/favorite-searches', { signal })
export const addFavoriteSearch = (id: string) =>
  client.put<void>(`/me/favorite-searches/${id}`)
export const removeFavoriteSearch = (id: string) =>
  client.delete<void>(`/me/favorite-searches/${id}`)

export const listFavoriteViews = (signal?: AbortSignal) =>
  client.get<SavedView[]>('/me/favorite-views', { signal })
export const addFavoriteView = (id: string) =>
  client.put<void>(`/me/favorite-views/${id}`)
export const removeFavoriteView = (id: string) =>
  client.delete<void>(`/me/favorite-views/${id}`)
```

- [ ] **Step 3: Unit test mock client calls** (по желанию короткий) + commit

```bash
git commit -m "feat(fe): API client for favorite searches and views"
```

---

### Task 4: Nav «Поиск» + i18n + Favorites page

**Files:**
- Modify: `AppHeader.vue`
- Modify: `src/i18n/en.ts`, `ru.ts`
- Modify: `LibraryPage.vue`, `LibraryPage.test.ts`
- Optionally: `SearchPage.vue` link «Все сохранённые»

- [ ] **Step 1: i18n**

```ts
// header or pkm
searchNav: 'Search', // en
searchNav: 'Поиск',  // ru
favoritesSubtitle: 'Only items you marked with a star.', // en
favoritesSubtitle: 'Только то, что отмечено звёздочкой.', // ru
favoriteSearches: 'Saved searches',
favoriteViews: 'Views',
```

- [ ] **Step 2: AppHeader navLinks**

После `favorites`, до `views`:

```ts
{ key: 'search-library', to: '/saved-searches', label: t('header.searchNav') },
```

- [ ] **Step 3: LibraryPage favorites mode**

Загрузка:

```ts
const [favPages, favSearches, favViews] = await Promise.all([
  library.getFavorites(signal),
  library.listFavoriteSearches(signal),
  library.listFavoriteViews(signal),
])
```

**Не** вызывать `listSavedSearches()` на Favorites.

Три секции с `v-if` length > 0 + CountBadge; search → `searchLink`; view → `{ path: '/views', query: { view: id } }`; pages как сейчас.

Убрать кнопку «Управлять» **или** оставить как вторичную — спека допускает; предпочтительно убрать (nav уже есть).

- [ ] **Step 4: Tests**

```ts
it('favorites shows only starred searches not full list', async () => {
  // mock listFavoriteSearches with one item; listSavedSearches must NOT be called
})
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(fe): Search nav and favorites show only starred items"
```

---

### Task 5: ⭐ on SavedSearchesPage + ViewsPage deep-link

**Files:**
- Modify: `SavedSearchesPage.vue`, `SavedSearchesPage.test.ts`
- Modify: `ViewsPage.vue`, `ViewsPage.test.ts`

- [ ] **Step 1: SavedSearchesPage**

У каждой строки кнопка ⭐ (`favorited` из API), optimistic toggle через `addFavoriteSearch` / `removeFavoriteSearch`. Паттерн как WorkspacePage favorite-btn.

- [ ] **Step 2: ViewsPage**

1. ⭐ на каждом view в списке.
2. Watch `route.query.view`: если id есть в `views` — `run(thatView)`; если список ещё грузится — после load.

```ts
watch(
  [() => route.query.view, views],
  ([id]) => {
    if (typeof id !== 'string' || !id) return
    const v = views.value.find((x) => x.id === id)
    if (v) void run(v)
  },
  { immediate: true }
)
```

Не зациклить run: сравнивать `activeView?.id`.

- [ ] **Step 3: Tests** — toggle star; views deep-link calls run. PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(fe): star toggles on saved searches and views with deep-link"
```

---

### Task 6: Deploy smoke

- [ ] Deploy API then FE with unique `IMAGE_TAG` if dirty.
- [ ] Checklist: nav «Поиск»; Favorites без незазвёздленных searches; ⭐ search/view; `/views?view=` runs; page ⭐ unchanged.

---

## Spec coverage

| Spec | Task |
|------|------|
| Tables + cascade | 1 |
| REST favorite-searches/views | 2 |
| `favorited` on DTOs | 2–3 |
| Nav «Поиск» → `/saved-searches` | 4 |
| Favorites only ⭐ (3 groups) | 4 |
| No auto-migration | (default) |
| ⭐ on saved-searches / views | 5 |
| `/views?view=` | 5 |
| Empty sections hidden | 4 |

## Out of scope

Embed views; auto-⭐ migration; polymorphic favorites; rename `/saved-searches` route.
