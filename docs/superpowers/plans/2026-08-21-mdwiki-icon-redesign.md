# MDWiki Icon Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить декоративную марку mdwiki на утверждённый плоский бирюзовый блок с белыми скобками `[[`.

**Architecture:** Один и тот же минимальный SVG размечается в Vue-компоненте и автономном favicon. Компонент остаётся декоративным и не зависит от `currentColor`; небольшой Vitest-тест фиксирует геометрию, цвета, отсутствие эффектов и совпадение favicon с компонентом.

**Tech Stack:** Vue 3 SFC, TypeScript, SVG, Vitest, Vue Test Utils.

---

### Task 1: Зафиксировать контракт нового знака тестами

**Files:**
- Create: `src/components/layout/MdwikiMark.test.ts`
- Reference: `src/components/layout/MdwikiMark.vue`
- Reference: `public/favicon.svg`

- [ ] **Step 1: Создать падающие тесты геометрии и доступности**

Создать `src/components/layout/MdwikiMark.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MdwikiMark from './MdwikiMark.vue'

const bracketPath =
  'M14 8h-3.5A1.5 1.5 0 0 0 9 9.5v13a1.5 1.5 0 0 0 1.5 1.5H14' +
  'M23 8h-3.5A1.5 1.5 0 0 0 18 9.5v13a1.5 1.5 0 0 0 1.5 1.5H23'

describe('MdwikiMark', () => {
  it('renders the approved flat two-color mark', () => {
    const wrapper = mount(MdwikiMark)
    const svg = wrapper.get('svg')
    const rect = wrapper.get('rect')
    const path = wrapper.get('path')

    expect(svg.attributes('viewBox')).toBe('0 0 32 32')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
    expect(wrapper.find('defs').exists()).toBe(false)
    expect(wrapper.find('filter').exists()).toBe(false)

    expect(rect.attributes()).toMatchObject({
      x: '3',
      y: '3',
      width: '26',
      height: '26',
      rx: '4',
      fill: '#0d9488'
    })
    expect(path.attributes()).toMatchObject({
      d: bracketPath,
      fill: 'none',
      stroke: '#fff',
      'stroke-width': '2.6',
      'stroke-linecap': 'square'
    })
    expect(wrapper.html()).not.toContain('currentColor')
  })

  it('keeps favicon geometry aligned with the Vue mark', () => {
    const favicon = readFileSync(new URL('../../../public/favicon.svg', import.meta.url), 'utf8')

    expect(favicon).toContain('<rect x="3" y="3" width="26" height="26" rx="4" fill="#0d9488"/>')
    expect(favicon).toContain(`d="${bracketPath}"`)
    expect(favicon).toContain('stroke="#fff"')
    expect(favicon).toContain('stroke-width="2.6"')
    expect(favicon).not.toMatch(/linearGradient|filter|feDropShadow|currentColor/)
  })
})
```

- [ ] **Step 2: Запустить целевой тест и подтвердить ожидаемое падение**

Run:

```bash
npm test -- src/components/layout/MdwikiMark.test.ts
```

Expected: FAIL — текущий компонент содержит `<defs>`, фильтры и старую геометрию; favicon также не содержит утверждённый прямоугольник.

### Task 2: Заменить Vue-компонент и favicon

**Files:**
- Modify: `src/components/layout/MdwikiMark.vue`
- Modify: `public/favicon.svg`
- Test: `src/components/layout/MdwikiMark.test.ts`

- [ ] **Step 1: Упростить `MdwikiMark.vue` до утверждённой геометрии**

Полностью заменить содержимое `src/components/layout/MdwikiMark.vue`:

```vue
<template>
  <svg class="mdwiki-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#0d9488" />
    <path
      d="M14 8h-3.5A1.5 1.5 0 0 0 9 9.5v13a1.5 1.5 0 0 0 1.5 1.5H14M23 8h-3.5A1.5 1.5 0 0 0 18 9.5v13a1.5 1.5 0 0 0 1.5 1.5H23"
      fill="none"
      stroke="#fff"
      stroke-width="2.6"
      stroke-linecap="square"
    />
  </svg>
</template>
```

Это удаляет `<script setup>`, `useId()`, `<defs>`, градиенты, фильтры и зависимость от `currentColor`.

- [ ] **Step 2: Привести `public/favicon.svg` к той же геометрии**

Полностью заменить содержимое `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="3" y="3" width="26" height="26" rx="4" fill="#0d9488"/>
  <path
    d="M14 8h-3.5A1.5 1.5 0 0 0 9 9.5v13a1.5 1.5 0 0 0 1.5 1.5H14M23 8h-3.5A1.5 1.5 0 0 0 18 9.5v13a1.5 1.5 0 0 0 1.5 1.5H23"
    fill="none"
    stroke="#fff"
    stroke-width="2.6"
    stroke-linecap="square"
  />
</svg>
```

- [ ] **Step 3: Запустить целевой тест**

Run:

```bash
npm test -- src/components/layout/MdwikiMark.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 4: Проверить диагностические сообщения изменённых файлов**

Проверить IDE diagnostics для:

- `src/components/layout/MdwikiMark.vue`
- `src/components/layout/MdwikiMark.test.ts`

Expected: новых ошибок и предупреждений нет.

### Task 3: Полная верификация

**Files:**
- Verify: `src/components/layout/MdwikiMark.vue`
- Verify: `src/components/layout/MdwikiMark.test.ts`
- Verify: `public/favicon.svg`

- [ ] **Step 1: Запустить lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 2: Запустить полный набор тестов**

Run:

```bash
npm test
```

Expected: exit code 0, включая `MdwikiMark.test.ts`.

- [ ] **Step 3: Собрать production bundle**

Run:

```bash
npm run build
```

Expected: exit code 0; `vue-tsc` и Vite завершаются без ошибок.

- [ ] **Step 4: Визуально проверить знак**

Запустить приложение и проверить:

- favicon во вкладке браузера при 16 px;
- марку в desktop header, mobile navigation и reading toolbar;
- светлую и тёмную темы;
- отсутствие размытия, обрезания и зависимости цвета от родительского текста.

Expected: бирюзовый блок и белые скобки одинаково читаются во всех местах.

### Task 4: Передача результата

- [ ] **Step 1: Просмотреть diff только по файлам задачи**

Проверить изменения в:

- `public/favicon.svg`
- `src/components/layout/MdwikiMark.vue`
- `src/components/layout/MdwikiMark.test.ts`
- `docs/superpowers/specs/2026-08-21-mdwiki-icon-redesign.md`
- `docs/superpowers/plans/2026-08-21-mdwiki-icon-redesign.md`

Убедиться, что посторонние пользовательские изменения не затронуты.

- [ ] **Step 2: Сообщить результат и доказательства проверки**

Указать изменённые файлы и фактические результаты lint, tests и build. Коммит создавать только по отдельной явной просьбе пользователя.
