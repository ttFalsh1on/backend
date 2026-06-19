# Flex Backend

Гибкий self-hosted бэкенд в духе [Convex](https://www.convex.dev): схема таблиц, типизированные функции, транзакционные мутации и real-time подписки.

## Возможности

| Возможность | Описание |
|-------------|----------|
| **Схема** | Таблицы, поля, индексы (`defineSchema`, `defineTable`) |
| **Функции** | `query` (чтение), `mutation` (запись в транзакции), `action` (внешние вызовы) |
| **Валидаторы** | `v.string()`, `v.object()`, `v.id("table")` и др. |
| **БД** | SQLite, документная модель с `_id` и `_creationTime` |
| **Real-time** | WebSocket-подписки на query — клиент получает обновления после мутаций |
| **HTTP API** | `POST /api/run` для одноразовых вызовов |
| **Auth** | Опциональный `auth` hook по Bearer-токену |

## Структура

```
packages/
  flex-core/    — схема, БД, runtime функций
  flex-server/  — HTTP + WebSocket сервер
  flex-client/  — клиентский SDK + connectFlex
  flex-cli/     — flex init, flex link, flex codegen
  flex-react/   — useFlexQuery, useFlexMutation
examples/
  todo/         — бэкенд (схема, функции, API)
public/
  index.html    — минимальная страница «только API» на Vercel
```

Фронтенд — **ваш отдельный сайт**, подключается через `@flex/client` и `VITE_FLEX_URL`.

**Подключение к другим проектам:** [docs/INTEGRATION.md](docs/INTEGRATION.md)  
**Подключить свой сайт:** [docs/CONNECT-YOUR-SITE.md](docs/CONNECT-YOUR-SITE.md)  
**Деплой на Vercel:** [docs/VERCEL.md](docs/VERCEL.md)  
**GitHub:** [GITHUB.md](GITHUB.md)

## Быстрый старт (только API)

```bash
npm install
npm run dev
```

Сервер: `http://localhost:3210` — `POST /api/run`, WebSocket для подписок.

В браузере на `/` нет todo-интерфейса — только API. UI — на вашем сайте.

## Как писать бэкенд

### 1. Схема (`schema.ts`)

```ts
import { defineSchema, defineTable, v } from "@flex/core";

export const schema = defineSchema({
  messages: defineTable({
    body: v.string(),
    author: v.string(),
  }).index("by_author", ["author"]),
});
```

### 2. Функции (`functions.ts`)

```ts
import { mutation, query, v } from "@flex/core";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("messages").collect(),
});

export const send = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, { body, author }) => {
    return ctx.db.insert("messages", { body, author });
  },
});
```

### 3. Сервер (`server.ts`)

```ts
import { createDatabase, createRuntime } from "@flex/core";
import { createFlexServer } from "@flex/server";
import { schema } from "./schema.js";
import * as functions from "./functions.js";

const db = createDatabase("./data/flex.db", schema);
const runtime = createRuntime(db, { schema });
runtime.registerModule("functions", functions);

const server = createFlexServer({ runtime, port: 3210 });
await server.start();
```

### 4. Подключение из другого проекта

```bash
npm run flex -- init ./my-app
npm run flex -- link http://localhost:3210
```

```ts
import { initFlex, defineModuleApi } from "@flex/client";

const { api } = initFlex(); // URL из VITE_FLEX_URL
const fn = defineModuleApi("functions", api);
await fn.query("list");
```

### 5. Клиент (низкоуровневый)

```ts
import { createClient } from "@flex/client";

const client = createClient({ url: "http://localhost:3210" });

// Одноразовый запрос
const items = await client.query("functions:list", {});

// Real-time подписка
const unsub = client.subscribe("functions:list", {}, (data) => {
  console.log(data);
});

// Мутация (через WS — сразу обновляет подписчиков)
await client.mutation("functions:send", { body: "Hi", author: "me" });
```

## API

### HTTP

- `GET /api/health` — проверка сервера
- `GET /api/functions` — список зарегистрированных функций
- `POST /api/run` — `{ "path": "functions:list", "args": {} }`

### WebSocket

- `{ "type": "subscribe", "path": "...", "args": {} }` — подписка на query
- `{ "type": "mutation", "path": "...", "args": {} }` — мутация + инвалидация подписок
- `{ "type": "unsubscribe", "subscriptionId": "..." }`

## Отличия от Convex

Это **ваш** бэкенд на своём сервере:

- SQLite вместо облачной БД Convex
- Нет облачного деплоя — полный контроль над кодом и данными
- Проще расширять: можно менять `@flex/core`, добавлять плагины, свои storage-драйверы
- Планировщик `ctx.scheduler.runAfter` — базовая in-process реализация

## Расширение

- **Новый storage**: реализуйте `DatabaseReader` в `flex-core`
- **Auth**: передайте `auth: async (token) => ({ userId })` в `createRuntime`
- **Внутренние функции**: `internalQuery` / `internalMutation` (не экспортируйте в публичный API)

## Лицензия

MIT — используйте как основу для своего продукта.
