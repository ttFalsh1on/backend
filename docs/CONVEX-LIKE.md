# Flex — динамический бэкенд (как Convex)

## Как это работает

1. Создаёшь **таблицу** в UI или через API (`tables:create`)
2. Автоматически появляются **5 рабочих функций**:
   - `{slug}:list` — query, все записи
   - `{slug}:get` — query, `{ id }`
   - `{slug}:create` — mutation, поля таблицы
   - `{slug}:patch` — mutation, `{ id, ...поля }`
   - `{slug}:remove` — mutation, `{ id }`

`slug` — имя таблицы в нижнем регистре (например `posts` → `posts:list`).

Данные хранятся в `dynamicRows` и привязаны к проекту.

---

## Вызов API (для Cursor / фронтенда)

```http
POST /api/run
Authorization: Bearer <token>
X-Project-Id: <project_id>
Content-Type: application/json

{ "path": "posts:create", "args": { "title": "Hello", "body": "..." } }
```

### Создать таблицу (AI / скрипт)

```json
{
  "path": "tables:create",
  "args": {
    "projectId": "<id>",
    "name": "posts",
    "fields": [
      { "name": "title", "type": "string" },
      { "name": "body", "type": "string" }
    ]
  }
}
```

Ответ содержит `listPath`, `createPath`, `functions`.

### Список функций проекта

```json
{ "path": "projectFns:list", "args": { "projectId": "<id>" } }
```

---

## Cursor: типичный сценарий

Промпт:

> В проекте Flex создай таблицу `todos` с полями `text` (string) и `done` (boolean), затем добавь тестовую запись.

AI должен:

1. `POST tables:create` с полями
2. `POST todos:create` с `{ text: "...", done: false }`
3. `POST todos:list` для проверки

Локально: `npm run dev` → http://localhost:3210  
Production: URL Vercel + токен после входа.

---

## Отличие от Convex

| Convex | Flex (динамика) |
|--------|-----------------|
| Произвольный TS-код в функциях | CRUD по схеме таблицы |
| `npx convex deploy` | `tables:create` + готовые пути |
| Полный TypeScript | string/number/boolean/id |

Сложную логику по-прежнему пиши в `examples/todo/src/functions/*.ts` и деплой.
