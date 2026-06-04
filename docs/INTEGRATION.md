# Подключение Flex к другим проектам

Flex можно использовать из **любого** фронтенда или Node-приложения: React, Vue, Next.js, мобильное приложение, скрипты.

## 1. Установка пакетов

### Из этого monorepo (разработка)

```json
{
  "dependencies": {
    "@flex/client": "file:../../packages/flex-client",
    "@flex/react": "file:../../packages/flex-react"
  }
}
```

### После публикации в npm

```bash
npm install @flex/client
npm install @flex/react   # только для React
```

## 2. CLI — быстрая настройка

Из корня `flex-backend`:

```bash
npm run build
npx flex init ./my-frontend
npx flex link http://localhost:3210
```

Или в целевом проекте (если CLI установлен глобально):

```bash
flex init
flex link http://localhost:3210
flex codegen functions
```

Создаётся:

- `flex.config.json` — URL сервера
- `src/lib/flex.ts` — точка входа клиента
- `.env.example` — `VITE_FLEX_URL` / `FLEX_URL`

## 3. Переменные окружения

| Переменная | Где используется |
|------------|------------------|
| `VITE_FLEX_URL` | Vite |
| `NEXT_PUBLIC_FLEX_URL` | Next.js |
| `REACT_APP_FLEX_URL` | Create React App |
| `FLEX_URL` | Node.js, универсально |
| `FLEX_TOKEN` | Bearer-токен (если на сервере настроен auth) |

## 4. Подключение в коде

### Браузер / Vite / React

```ts
import { initFlex, defineModuleApi } from "@flex/client";

// URL из VITE_FLEX_URL или flex.config.json при SSR
const { api } = initFlex();

export const fn = defineModuleApi("functions", api);

// Вызовы
const todos = await fn.query<Todo[]>("list");
await fn.mutation("add", { text: "Hello" });
```

### React hooks

```tsx
import { FlexProvider, useFlexQuery, useFlexMutation } from "@flex/react";

// main.tsx
<FlexProvider url={import.meta.env.VITE_FLEX_URL}>
  <App />
</FlexProvider>

// App.tsx
const { data } = useFlexQuery<Todo[]>("functions:list");
const { mutate } = useFlexMutation("functions:add");
```

### Node.js (скрипты, SSR, тесты)

```ts
import { connectFlexFromConfig } from "@flex/client/node";

const { api } = connectFlexFromConfig();
const list = await api.query("functions:list");
```

### HTTP без WebSocket

```ts
import { connectFlex } from "@flex/client";

const { api } = connectFlex({
  url: "http://localhost:3210",
  httpOnly: true,
});
```

## 5. Пути функций

Формат: `имяМодуля:имяФункции`

Сервер регистрирует модуль так:

```ts
runtime.registerModule("functions", functions);
```

Клиент вызывает:

```ts
api.query("functions:list", {});
api.mutation("functions:add", { text: "..." });
```

## 6. Пример: отдельный Vite + React

```bash
# Терминал 1 — бэкенд
cd examples/todo && npx tsx src/server.ts

# Терминал 2 — внешний фронт
cd examples/vite-react && npm install && npm run dev
```

Откройте http://localhost:5173 — UI ходит на Flex API на :3210.

## 7. Codegen

```bash
flex codegen
# → src/flex/api.generated.ts
```

```ts
import { functions } from "./flex/api.generated";
await functions.list();
```

## 8. CORS

Сервер по умолчанию отдаёт `Access-Control-Allow-Origin: *`. Для продакшена настройте `cors` в `createFlexServer`.

## 9. Архитектура

```
┌─────────────────┐     HTTP/WS      ┌──────────────────┐
│  Ваш фронтенд   │ ───────────────► │  Flex Server     │
│  @flex/client   │   /api/run       │  @flex/server    │
│  @flex/react    │   WebSocket      │  + ваши functions│
└─────────────────┘                  └──────────────────┘
```

Бэкенд-логика живёт в **вашем** Flex-проекте (`schema`, `functions`). Любое количество клиентов подключается по URL.
