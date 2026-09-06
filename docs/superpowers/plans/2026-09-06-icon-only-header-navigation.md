# Icon-Only Header Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить текстовые пункты desktop-навигации на иконки Material Symbols, показывая подпись только у активного раздела, и сохранить подписи рядом с иконками в мобильном меню.

**Architecture:** Расширить локальную модель `navLinks` в `AppHeader.vue` полем `icon` и вычислять активность ссылки из текущего route. Один и тот же массив будет рендерить компактные desktop-кнопки и понятные mobile-строки; отдельный компонент не нужен.

**Tech Stack:** Vue 3 Composition API, Vue Router, Pinia, vue-i18n, Material Symbols, Vitest, Vue Test Utils.

---

### Task 1: Зафиксировать доступное поведение навигации тестами

**Files:**
- Modify: `src/components/layout/AppHeader.test.ts`
- Test: `src/components/layout/AppHeader.test.ts`

- [ ] **Step 1: Сделать route в тесте реактивным**

Добавить `reactive` в импорт Vue и заменить статический mock route:

```ts
import { reactive } from 'vue'

const route = reactive({
  name: 'views',
  path: '/views',
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => route,
}))
```

В `beforeEach` возвращать исходный route:

```ts
route.name = 'views'
route.path = '/views'
route.params = {}
route.query = {}
```

- [ ] **Step 2: Написать падающий тест desktop-иконок и активной подписи**

Добавить helper для mount, чтобы тесты использовали одинаковые stubs:

```ts
function mountHeader() {
  return mount(AppHeader, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        ThemeModeIcon: true,
        MdwikiMark: true,
      },
    },
  })
}
```

Добавить сценарий:

```ts
it('renders desktop navigation as icons and labels only the active route', () => {
  const wrapper = mountHeader()
  const views = wrapper.get('[data-nav-key="views"]')
  const recent = wrapper.get('[data-nav-key="recent"]')

  expect(views.get('.material-symbols-outlined').text()).toBe('view_list')
  expect(views.get('.nav-link-label').text()).toBe('Views')
  expect(views.attributes('aria-label')).toBe('Views')
  expect(views.attributes('title')).toBe('Views')

  expect(recent.get('.material-symbols-outlined').text()).toBe('history')
  expect(recent.find('.nav-link-label').exists()).toBe(false)
  expect(recent.attributes('aria-label')).toBe('Recent')
})
```

- [ ] **Step 3: Написать падающий тест mobile-подписей и language icon**

```ts
it('keeps icon labels in mobile navigation and exposes language accessibly', async () => {
  const wrapper = mountHeader()
  await wrapper.get('.header-actions-mobile .icon-btn').trigger('click')

  const mobileViews = wrapper.get('.mobile-nav-link[data-nav-key="views"]')
  expect(mobileViews.get('.material-symbols-outlined').text()).toBe('view_list')
  expect(mobileViews.get('.mobile-nav-label').text()).toBe('Views')

  const localeButtons = wrapper.findAll('.locale-toggle')
  expect(localeButtons).toHaveLength(2)
  for (const button of localeButtons) {
    expect(button.get('.material-symbols-outlined').text()).toBe('language')
    expect(button.text()).not.toMatch(/\b(EN|RU)\b/)
    expect(button.attributes('aria-label')).toContain('EN')
  }
})
```

- [ ] **Step 4: Запустить тест и подтвердить RED**

Run:

```bash
npm test -- --run src/components/layout/AppHeader.test.ts
```

Expected: FAIL — отсутствуют `data-nav-key`, иконки, активная подпись и доступное имя language-кнопки.

### Task 2: Реализовать модель и разметку icon navigation

**Files:**
- Modify: `src/components/layout/AppHeader.vue`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/ru.ts`
- Test: `src/components/layout/AppHeader.test.ts`

- [ ] **Step 1: Добавить тип ссылки, icon mapping и определение активности**

В `AppHeader.vue` определить тип и обновить `navLinks`:

```ts
type HeaderNavLink = {
  key: string
  to: RouteLocationRaw
  label: string
  icon: string
  title?: string
}

const navLinks = computed<HeaderNavLink[]>(() => [
  { key: 'daily', to: '/daily', label: t('pkm.today'), icon: 'today' },
  { key: 'recent', to: '/recent', label: t('pkm.recent'), icon: 'history' },
  { key: 'favorites', to: '/favorites', label: t('pkm.favorites'), icon: 'star' },
  { key: 'search-library', to: '/saved-searches', label: t('header.searchNav'), icon: 'saved_search' },
  { key: 'views', to: '/views', label: t('views.title'), icon: 'view_list' },
  { key: 'tasks', to: '/tasks', label: t('header.tasks'), icon: 'task_alt' },
  { key: 'attachments', to: '/attachments', label: t('header.attachments'), icon: 'attach_file' },
  { key: 'discovery', to: '/links/unlinked', label: t('pkm.discovery'), icon: 'explore' },
  {
    key: 'graph',
    to: graphLinkTo.value,
    label: t('header.graph'),
    icon: 'hub',
    title: t('header.graphTitle'),
  },
])

function isNavLinkActive(link: HeaderNavLink): boolean {
  if (typeof link.to === 'string') {
    return route.path === link.to || route.path.startsWith(`${link.to}/`)
  }
  return typeof link.to.name === 'string' && route.name === link.to.name
}

const localeTitle = computed(() =>
  t('header.languageCurrent', { language: localeLabel.value }),
)
```

- [ ] **Step 2: Заменить desktop-текст и mobile-текст общей icon-разметкой**

Desktop `router-link`:

```vue
<router-link
  v-for="link in navLinks"
  :key="link.key"
  :to="link.to"
  class="nav-link"
  :class="{ 'is-active': isNavLinkActive(link) }"
  :title="link.title ?? link.label"
  :aria-label="link.label"
  :data-nav-key="link.key"
  @click="onNavClick"
>
  <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">
    {{ link.icon }}
  </span>
  <span v-if="isNavLinkActive(link)" class="nav-link-label">{{ link.label }}</span>
</router-link>
```

Mobile `router-link`:

```vue
<router-link
  v-for="link in navLinks"
  :key="link.key"
  :to="link.to"
  class="mobile-nav-link"
  :data-nav-key="link.key"
  @click="onNavClick"
>
  <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">
    {{ link.icon }}
  </span>
  <span class="mobile-nav-label">{{ link.label }}</span>
</router-link>
```

- [ ] **Step 3: Заменить обе language-кнопки**

В desktop и mobile блоках использовать одинаковую разметку:

```vue
<button
  type="button"
  class="theme-toggle locale-toggle"
  :title="localeTitle"
  :aria-label="localeTitle"
  @click="toggleLocale()"
>
  <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true">
    language
  </span>
</button>
```

- [ ] **Step 4: Добавить i18n доступного имени**

В `src/i18n/en.ts` внутри `header`:

```ts
languageCurrent: 'Language: {language}',
```

В `src/i18n/ru.ts` внутри `header`:

```ts
languageCurrent: 'Язык: {language}',
```

- [ ] **Step 5: Запустить component-тест и подтвердить GREEN**

Run:

```bash
npm test -- --run src/components/layout/AppHeader.test.ts
```

Expected: все тесты `AppHeader.test.ts` проходят.

### Task 3: Оформить компактную desktop-панель и mobile-строки

**Files:**
- Modify: `src/components/layout/AppHeader.vue`
- Test: `src/components/layout/AppHeader.test.ts`

- [ ] **Step 1: Заменить стили `.nav-link`**

```css
.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 34px;
  min-width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--color-text-muted);
  text-decoration: none;
  transition:
    width 0.18s ease,
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.nav-link .material-symbols-outlined {
  font-size: 19px;
  line-height: 1;
}

.nav-link.is-active,
.nav-link.router-link-active {
  width: auto;
  gap: 5px;
  padding: 0 9px;
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.nav-link-label {
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}
```

Удалить старые underline-правила `.nav-link::after`, `.nav-link:hover::after` и active `::after`.

- [ ] **Step 2: Обновить mobile layout**

```css
.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 8px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  border-radius: 6px;
}

.mobile-nav-link .material-symbols-outlined {
  width: 22px;
  color: var(--color-text-muted);
  font-size: 20px;
  text-align: center;
}
```

Удалить неиспользуемые `.locale-label` styles. В tablet media query удалить text-specific настройки `.nav-link` и оставить базовые размеры icon-кнопок.

- [ ] **Step 3: Проверить component-тест после CSS-изменений**

Run:

```bash
npm test -- --run src/components/layout/AppHeader.test.ts
```

Expected: PASS.

- [ ] **Step 4: Закоммитить реализацию**

```bash
git add src/components/layout/AppHeader.vue \
  src/components/layout/AppHeader.test.ts \
  src/i18n/en.ts src/i18n/ru.ts
git commit -m "feat: use icons in header navigation"
```

### Task 4: Полная проверка и локальный контур

**Files:**
- Verify: `src/components/layout/AppHeader.vue`
- Verify: `src/components/layout/AppHeader.test.ts`

- [ ] **Step 1: Запустить полный frontend suite**

Run:

```bash
npm test
```

Expected: все test files и tests проходят.

- [ ] **Step 2: Запустить lint**

Run:

```bash
npm run lint
```

Expected: exit code 0 без ESLint errors.

- [ ] **Step 3: Запустить production build**

Run:

```bash
npm run build
```

Expected: `vue-tsc -b` и `vite build` завершаются с exit code 0.

- [ ] **Step 4: Проверить diff**

Run:

```bash
git diff --check
git status --short
```

Expected: нет whitespace errors; после implementation commit рабочее дерево чистое.

- [ ] **Step 5: Развернуть локальный Kubernetes frontend**

Run:

```bash
VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh
```

Expected: Helm upgrade и rollout `mdwiki-frontend-mdwiki-frontend` завершаются успешно новым image tag.

- [ ] **Step 6: Выполнить browser smoke-test**

Проверить desktop:

- все девять центральных пунктов имеют иконки;
- только активный пункт показывает подпись;
- переключатель языка является icon-only и tooltip сообщает текущий язык;
- переходы, поиск, профиль, тема и выход доступны.

Проверить mobile:

- выпадающее меню показывает иконку и подпись у каждого пункта;
- меню закрывается после перехода.
