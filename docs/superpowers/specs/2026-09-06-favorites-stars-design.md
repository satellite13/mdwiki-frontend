# Favorites = только ⭐; навигация «Поиск» для сохранённых поисков

## Цель

Сделать Избранное настоящим списком ярлыков (только отмеченное звёздочкой), а полный CRUD сохранённых поисков — доступным через нормальный пункт навигации, без захода «через поле поиска».

## Решения

| Решение | Выбор |
|---------|--------|
| Состав Избранного | ⭐ страницы + ⭐ сохранённые поиски + ⭐ представления |
| Хранение ⭐ | Отдельные таблицы (как `user_favorite_pages`), не boolean на сущности |
| Навигация к CRUD поисков | Пункт шапки **«Поиск»** → `/saved-searches` |
| H1 `/saved-searches` | «Сохранённые поиски» (длинное имя только на странице) |
| Миграция | Существующие поиски **не** авто-⭐ |
| Пустые секции на Favorites | Не показывать |

## Информационная архитектура

### `/favorites`
Три группы (каждая только если есть элементы):
1. **Сохранённые поиски** — клик → `/search?saved={id}` (как сейчас).
2. **Представления** — клик → `/views?view={id}` (выбрать и запустить).
3. **Страницы** — клик → `/page/{slug}` (как сейчас).

Если все группы пусты — один empty-state.

Убрать зависимость от кнопки «Управлять поисками» как единственного входа; дубль-ссылку на `/saved-searches` можно оставить или убрать (не критично).

**Не** показывать на Favorites полный список всех saved searches.

### `/saved-searches`
Полный список всех сохранённых поисков пользователя + CRUD (как сейчас). У каждой строки — ⭐ toggle. Открытие поиска — в Search с `saved=`.

### `/views`
Без смены роли страницы. У каждой view в списке — ⭐. Deep-link: `/views?view={id}` при монтировании/смене query выбирает view и вызывает run.

### Шапка
Пункт с коротким лейблом **«Поиск»** / **Search** → `/saved-searches`, рядом с Favorites / Views.

На Search page опционально мелкая ссылка «Все сохранённые» → `/saved-searches` (удобство, не единственный вход).

## API

По аналогии с избранными страницами:

| Метод | Путь | Назначение |
|--------|------|------------|
| `GET` | `/api/me/favorite-searches` | Список ⭐ поисков |
| `PUT` | `/api/me/favorite-searches/{savedSearchId}` | Добавить ⭐ |
| `DELETE` | `/api/me/favorite-searches/{savedSearchId}` | Снять ⭐ |
| `GET` | `/api/me/favorite-views` | Список ⭐ views |
| `PUT` | `/api/me/favorite-views/{viewId}` | Добавить ⭐ |
| `DELETE` | `/api/me/favorite-views/{viewId}` | Снять ⭐ |

`GET/PUT/DELETE /api/me/favorites/{pageId}` — без изменений.

### Схема
- `user_favorite_searches(user_id, saved_search_id, created_at)` — UNIQUE(user_id, saved_search_id); FK cascade при удалении search.
- `user_favorite_views(user_id, view_id, created_at)` — аналогично.

### DTO
В `SavedSearchResponse` и `SavedViewResponse` добавить `favorited: boolean`, чтобы UI списков не делал N+1 запросов.

### Правила
- ⭐ только на **свои** search/view (иначе 404).
- Idempotent PUT (повторный — OK).
- Optimistic UI на FE с откатом при ошибке (паттерн WorkspacePage).

## UI детали

- Иконка ⭐ / outline — тот же паттерн, что favorite на странице документа.
- CountBadge на заголовках групп Favorites — по желанию, в стиле остальных group headers.
- i18n: короткий `header.search` / `pkm.searchNav` = «Поиск»; H1 saved-searches без изменений смысла; подзаголовок Favorites обновить («только отмеченное звёздочкой»).

## Тесты

- API: add/remove/list; ownership; cascade delete; `favorited` в list/get.
- FE: Favorites не рендерит незазвёздленные searches; ⭐ toggle на saved-searches и views; nav «Поиск»; `/views?view=` запускает view.

## Вне задачи

- Embed view в документ.
- Авто-⭐ миграция существующих поисков.
- Полиморфная таблица всех favorites.
- Переименование маршрута `/saved-searches` → `/search` (Search results остаётся на `/search`).
