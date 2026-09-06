# Attachments list — server search + pagination

## Цель

На странице Attachments дать поиск по имени файла и пагинацию списка, чтобы при большом числе вложений UI оставался управляемым.

## Решения

- Поиск: только по `originalName` (case-insensitive substring).
- Пагинация и фильтр: **на сервере**.
- Размер страницы по умолчанию: **20**.
- UI пагинации: **Назад / Вперёд** + диапазон «1–20 из 87».
- Контракт ответа: тело — массив (как сейчас), total — заголовок **`X-Total-Count`** (как у `GET /api/pages`).
- URL query (`?q=&page=`) **не** синхронизируем.

## API

`GET /api/attachments`

| Param | Default | Описание |
|-------|---------|----------|
| `page` | `0` | 0-based индекс страницы |
| `size` | `20` | Размер страницы (было 50) |
| `q` | — | Опциональный substring по `originalName`; пустой/`null` — без фильтра |
| `pageId` | — | Как сейчас: фильтр по связанной wiki-странице |

- Тело: `AttachmentResponse[]` (текущая страница после фильтра).
- Заголовок: `X-Total-Count` = число совпадений **после** `q`/`pageId`.
- Сортировка: `createdAt DESC`.
- Реализация поиска в БД (Spring Data / `ILIKE` / аналог), не client-side по полному списку.

Breaking change относительно прежнего default `size=50`: клиенты без `size` получат 20. FE и тесты API обновляются явно.

## Frontend

### API client

`listAttachments({ page, size, q, pageId?, signal? })` возвращает `{ items, total }` (total из `X-Total-Count`, fallback `items.length` если header нет).

### AttachmentsPage

- Поле поиска над таблицей; placeholder «поиск по имени»; debounce ~300 ms.
- Смена `q` → сброс на `page = 0`.
- Под таблицей: текст диапазона + Prev/Next; Prev disabled на первой странице, Next — когда конец (`(page+1)*size >= total`).
- Empty states: нет вложений vs ничего не найдено при непустом `q`.
- Upload/delete → повторный fetch с текущими `q` + `page` (если после delete страница опустела и `page > 0` — шаг назад).
- Abort предыдущего list-запроса при новом `q`/`page` (паттерн Library).
- Ошибка загрузки — `dialog.alert`, как сейчас.

### i18n

Строки EN/RU: placeholder поиска, «ничего не найдено», «Назад»/«Вперёд» (или reuse `common`), диапазон «{from}–{to} of {total}» / «{from}–{to} из {total}».

## Тесты

- API: list с `q`, корректный `X-Total-Count`, пагинация страниц, default size 20.
- FE: сброс page при смене q; disabled Prev/Next; empty vs no-results.

## Вне задачи

- Поиск по contentType / uploadedBy.
- Выбор page size в UI.
- Синхронизация с URL.
- Cursor-pagination.
- Общий reusable `Pagination` на все списки (можно вынести позже, если появится второй consumer).
