# Админ-корзина: восстановление soft-deleted страниц

## Цель

Soft-delete страниц уже есть (файл в trash, `deletedAt`, `POST /api/pages/{slug}/restore`, `GET /api/pages/deleted`), но в UI восстановить нельзя. Добавить админ-страницу «Корзина», где ADMIN может восстановить страницу или удалить её навсегда.

## Границы

- Только роль `ADMIN` (UI `requiresAdmin` + security matcher’ы на list/restore).
- Действия: восстановить, удалить навсегда (с danger-confirm). Без «очистить корзину», preview, поиска, пагинации.
- Не добавляем restore из дерева и баннер на slug удалённой страницы.
- Hard delete из дерева при удалении страницы остаётся как сейчас.

## Backend (mdwiki-api)

Существующие эндпоинты:

- `GET /api/pages/deleted` → `List<PageListItem>`
- `POST /api/pages/{slug}/restore` → `PageResponse` (сбрасывает `deletedAt`, возвращает файл из trash, инвалидирует tree)
- `DELETE /api/pages/{slug}?mode=HARD` — уже есть; используется для «Удалить навсегда»

Изменения:

1. **SecurityConfig** — до общих matcher’ов `/api/pages/**`:
   - `GET /api/pages/deleted` → `hasRole("ADMIN")`
   - `POST /api/pages/*/restore` → `hasRole("ADMIN")`
2. **PageListItem** — поле `deletedAt: Instant?` (`null` для активных страниц). Mapper заполняет из `Page.deletedAt`.
3. **Сортировка** — либо на сервере в `findDeleted()`, либо на клиенте: по `deletedAt` desc. Предпочтительно сервер (`ORDER BY deletedAt DESC` / sort в use-case), чтобы UI был тонким.

Тесты: EDITOR получает 403 на listDeleted и restore; ADMIN — 200; ответ listDeleted содержит `deletedAt`.

## Frontend (mdwiki-frontend)

1. Маршрут `/admin/trash` → `AdminTrashPage.vue`, `meta.requiresAdmin`.
2. Ссылка «Корзина» в admin-nav на Users / Embedding / Trash (все три админ-страницы).
3. API-клиент в `pages.ts`: `listDeletedPages()`, `restorePage(slug)`. Hard delete — существующий `deletePage(slug, 'hard')`.
4. Типы: `PageListItem.deletedAt?: string | null`.
5. UI: таблица (название, slug, удалено, действия); empty state «Нет удалённых страниц»; restore без confirm; hard delete с danger-confirm; i18n ru/en.
6. После успешного restore/hard-delete — повторный `listDeletedPages()` (как Users после delete). Tree обновится через уже существующий `treeUpdated` с API.

Тесты: smoke mount — loading → список / empty; вызов restore/delete API по клику (паттерн как `AdminEmbeddingSettingsPage.test.ts`).

## Потоки ошибок

- Ошибки API → `dialog.alert` + `getApiErrorMessage`.
- Restore не-удалённой / отсутствующей страницы — серверные ошибки как сейчас; UI показывает сообщение.
- Non-admin на UI редиректится guard’ом; на API — 403.

## Вне scope

Preview содержимого, поиск/фильтр, массовая очистка, restore для EDITOR, UI в дереве/на slug.
