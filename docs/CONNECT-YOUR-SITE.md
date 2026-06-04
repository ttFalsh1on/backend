# Подключить свой сайт к Flex Backend

## Шаг 1 — Запустите бэкенд

```powershell
cd e:\бэкенд\examples\todo
npx tsx src/server.ts
```

API: `http://localhost:3210`

---

## Шаг 2 — Выберите способ для вашего сайта

### A) Обычный HTML / статический сайт

1. Скопируйте в свой проект файл  
   `examples/plain-html/flex-connect.js`
2. В начале файла укажите URL:

```js
const FLEX_URL = "http://localhost:3210";
```

3. Вызывайте API:

```js
// Query
const todos = await run("functions:list", {});

// Mutation
await run("functions:add", { text: "Моя задача" });
```

4. Подключите скрипт в HTML:

```html
<script type="module" src="flex-connect.js"></script>
```

Полный пример: `examples/plain-html/index.html`

Запуск примера (нужен любой статический сервер, не `file://`):

```powershell
cd e:\бэкенд\examples\plain-html
npx serve .
```

Откройте адрес из консоли (обычно http://localhost:3000).

---

### B) React / Vite

```powershell
cd e:\бэкенд
npm run flex -- init E:\путь\к\моему-сайту
```

В `.env` проекта:

```
VITE_FLEX_URL=http://localhost:3210
```

`package.json`:

```json
"@flex/client": "file:../бэкенд/packages/flex-client",
"@flex/react": "file:../бэкенд/packages/flex-react"
```

```tsx
// main.tsx
import { FlexProvider } from "@flex/react";

<FlexProvider url={import.meta.env.VITE_FLEX_URL}>
  <App />
</FlexProvider>
```

```tsx
// App.tsx
import { useFlexQuery, useFlexMutation } from "@flex/react";

const { data: todos } = useFlexQuery("functions:list", {});
const { mutate: add } = useFlexMutation("functions:add");
await add({ text: "Задача" });
```

Пример: `examples/vite-react`

```powershell
npm run dev:app
```

---

### C) Next.js

`.env.local`:

```
NEXT_PUBLIC_FLEX_URL=http://localhost:3210
```

```tsx
"use client";
import { FlexProvider, useFlexQuery } from "@flex/react";

export default function Page() {
  return (
    <FlexProvider url={process.env.NEXT_PUBLIC_FLEX_URL!}>
      <TodoList />
    </FlexProvider>
  );
}
```

---

### D) Любой другой фреймворк (fetch)

```js
const res = await fetch("http://localhost:3210/api/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    path: "functions:list",
    args: {},
  }),
});
const { value } = await res.json();
```

---

## Шаг 3 — Имена функций

Ваш бэкенд (todo) экспортирует модуль `functions`:

| Вызов | Действие |
|-------|----------|
| `functions:list` | Список задач |
| `functions:add` | `{ text: "..." }` |
| `functions:toggle` | `{ id: "..." }` |
| `functions:remove` | `{ id: "..." }` |

Когда напишете свои функции в `examples/todo/src/functions.ts`, на сайте меняйте только `path`.

---

## Шаг 4 — Свои данные (не todo)

1. Отредактируйте `examples/todo/src/schema.ts` — свои таблицы  
2. Отредактируйте `examples/todo/src/functions.ts` — свои query/mutation  
3. Перезапустите сервер  
4. На сайте вызывайте новые пути, например `functions:getProducts`

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| CORS | Сервер уже отдаёт `Access-Control-Allow-Origin: *` |
| Сайт на другом порту | Нормально: :5173 → API :3210 |
| `file://` не работает | Запустите `npx serve` или `vite` |
| Сервер не отвечает | `npx tsx src/server.ts` в `examples/todo` |

---

## Продакшен

1. Задеплойте Flex-сервер (VPS, Docker)  
2. В сайте укажите `FLEX_URL=https://api.ваш-домен.ru`  
3. HTTPS для API и WSS для WebSocket
