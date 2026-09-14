# Task comment preference & complete-all Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profile toggle to skip task-completion comment modal; when off, show per-document “complete all” checkbox on `/tasks`.

**Architecture:** Client-only preference in `localStorage` via `localPreferences`. OpenTasksPage branches on the flag; bulk complete loops existing `POST /tasks/complete` with a list refresh between calls for fresh `updatedAt`.

**Tech Stack:** Vue 3, Vitest, vue-i18n, existing tasks API.

---

### Task 1: Preference helper

**Files:**
- Create: `src/components/tasks/taskPreferences.ts`
- Create: `src/components/tasks/taskPreferences.test.ts`

- [x] Read/write `mdwiki-task-ask-comment`; default `true` when missing
- [x] Unit tests for default / `'0'` / `'1'`

### Task 2: Profile toggle

**Files:**
- Modify: `src/components/profile/ProfilePage.vue`
- Modify: `src/i18n/ru.ts`, `src/i18n/en.ts`

- [x] Section «Tasks» with checkbox bound to preference
- [x] i18n keys for title/label/hint

### Task 3: OpenTasksPage behavior

**Files:**
- Modify: `src/components/tasks/OpenTasksPage.vue`
- Modify: `src/components/tasks/OpenTasksPage.test.ts`
- Modify: i18n tasks keys (completeAll, confirmCompleteAll, …)

- [x] If ask-comment on: keep modal flow
- [x] If off: checkbox completes immediately without modal
- [x] If off: header checkbox completes all tasks in group (confirm → sequential complete + refresh)
- [x] Hide header checkbox when ask-comment on, locked, or non-editor
- [x] Tests for all branches
