# Деплой на Vercel

## Что деплоится

| Часть | На Vercel |
|-------|-----------|
| Корень `/` | UI: вход, проекты, задачи (`examples/todo/public`) |
| API | Serverless Functions в `/api` |
| WebSocket | **Нет** (UI использует HTTP polling) |
| База | JSON в `/tmp` (данные могут сбрасываться) |

---

## Настройки проекта в Vercel

| Поле | Значение |
|------|----------|
| **Build Command** | `npm run build:vercel` |
| **Output Directory** | `examples/todo/public` |
| **Install Command** | `npm install && npm rebuild better-sqlite3` |

---

## Деплой

```powershell
cd e:\бэкенд
npm run build:vercel
npx vercel deploy --prod --yes
```

Или `git push` в [github.com/ttFalsh1on/backend](https://github.com/ttFalsh1on/backend) — если репозиторий подключён к Vercel.

---

## URL API для вашего сайта

```
https://ваш-проект.vercel.app
```

В `.env` фронтенда:

```
VITE_FLEX_URL=https://ваш-проект.vercel.app
```

Запросы:

```
POST https://ваш-проект.vercel.app/api/run
Authorization: Bearer <token>
X-Project-Id: <project_id>
```

---

## Проверка

- `GET /api/health` → `{"ok":true}`
- `GET /api` → справка по эндпоинтам
