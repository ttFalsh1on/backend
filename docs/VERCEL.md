# Деплой на Vercel

## Что деплоится

| Часть | На Vercel |
|-------|-----------|
| Корень `/` | UI: вход, проекты, задачи (`examples/todo/public`) |
| API | Serverless Functions в `/api` |
| WebSocket | **Нет** (UI использует HTTP polling) |
| База | **Vercel Blob** (если подключён) или JSON в `/tmp` |

## Важно: хранение аккаунтов

Без **Vercel Blob** каждый деплой обнуляет базу — аккаунты пропадают.

**Один раз в Vercel Dashboard:**
1. Проект **flex-backend** → **Storage** → **Create Database** → **Blob** (лучше **Private**, регион **Frankfurt**)
2. Подключите Blob к проекту — появятся `BLOB_STORE_ID` и OIDC-токен (или `BLOB_READ_WRITE_TOKEN`)
3. Redeploy

После подключения Blob аккаунты **сохраняются между деплоями**. Зарегистрируйтесь один раз заново после первого успешного подключения.

---

## Настройки проекта в Vercel

| Поле | Значение |
|------|----------|
| **Build Command** | `npm run build:vercel` |
| **Output Directory** | `examples/todo/public` |
| **Install Command** | `npm install` |

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
