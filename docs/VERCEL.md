# Деплой на Vercel

## Что деплоится

| Часть | На Vercel |
|-------|-----------|
| Сайт (UI) | `examples/todo/public` |
| API | Serverless Functions в `/api` |
| WebSocket | **Нет** — на Vercel UI обновляется через HTTP polling |
| База SQLite | `/tmp` на сервере (данные **могут сбрасываться** при cold start) |

Для продакшена с постоянной БД лучше: [Turso](https://turso.tech), Neon, или бэкенд на Railway/Render + только фронт на Vercel.

---

## Ваш проект на Vercel

- **Сайт:** https://flex-backend-three.vercel.app  
- **Dashboard:** https://vercel.com/ttfalsh1ons-projects/flex-backend  

> Папка `бэкенд` (кириллица) не подходит как имя проекта — в `vercel.json` задано `"name": "flex-backend"`.

---

## Быстрый деплой

### 1. Установите Vercel CLI

```powershell
npm i -g vercel
```

### 2. Из корня проекта

```powershell
cd e:\бэкенд
npm run build:vercel
vercel
```

Следуйте вопросам (логин, имя проекта). Продакшен:

```powershell
vercel --prod
```

### 3. Через GitHub

1. Залейте репозиторий на GitHub  
2. [vercel.com/new](https://vercel.com/new) → Import репозитория  
3. **Root Directory:** корень `бэкенд`  
4. **Build Command:** `npm run build:vercel`  
5. **Output Directory:** `examples/todo/public`  
6. Deploy  

---

## Переменные окружения (Vercel Dashboard → Settings → Environment Variables)

| Переменная | Назначение |
|------------|------------|
| `FLEX_DB_PATH` | Путь к SQLite (опционально, по умолчанию `/tmp/flex-vercel.db`) |
| `FLEX_PUBLIC_API_URL` | Пусто = API на том же домене. Или `https://api.example.com` если API отдельно |

---

## Только фронт на Vercel (API на другом сервере)

1. Задеплойте бэкенд локально/Railway: `npx tsx examples/todo/src/server.ts`  
2. В Vercel задайте `FLEX_PUBLIC_API_URL=https://ваш-api.railway.app`  
3. Build: `npm run vercel:build` (без serverless API — удалите папку `api` или используйте отдельный проект)

---

## Ограничения Vercel

- Нет постоянного диска → SQLite в `/tmp` не для важных данных  
- Нет WebSocket → real-time через опрос каждые 3 сек  
- `better-sqlite3` — нативный модуль; при ошибке сборки используйте внешний хостинг API  

---

## Проверка после деплоя

```
https://ваш-проект.vercel.app/
https://ваш-проект.vercel.app/api/health
```
