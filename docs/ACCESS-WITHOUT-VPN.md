# Открыть сайт без VPN (из России)

## Почему не открывается `*.vercel.app`

Сайт на Vercel **работает**, но часть IP-адресов Vercel **блокируется провайдером**. Браузер не может установить соединение → `ERR_CONNECTION_TIMED_OUT`. С VPN всё ок, потому что трафик идёт через другую страну.

## Решение: Cloudflare Pages (рекомендуется)

Статика и API отдаются через **Cloudflare** (обычно доступен без VPN). Запросы к `/api/*` проксируются на Vercel на стороне сервера — ваш браузер до Vercel **не ходит**.

### Один раз

1. Регистрация: [dash.cloudflare.com](https://dash.cloudflare.com)
2. В терминале:

```powershell
cd e:\бэкенд
npx wrangler login
npm run deploy:cf
```

3. В конце появится ссылка вида `https://flex-backend.pages.dev` — **её и открывайте** (без VPN).

### Если API перестал отвечать после нового деплоя на Vercel

Cloudflare Dashboard → **Workers & Pages** → **flex-backend** → **Settings** → **Variables**:

| Переменная | Значение |
|------------|----------|
| `VERCEL_ORIGIN` | URL последнего деплоя Vercel (из `npx vercel ls`, первая строка Ready) |

Пример: `https://flex-backend-n7du4w1nf-ttfalsh1ons-projects.vercel.app`

---

## Свой домен (ещё надёжнее)

1. Купите домен (Reg.ru, Timeweb и т.д.)
2. Добавьте сайт в Cloudflare (DNS)
3. **Workers & Pages** → flex-backend → **Custom domains** → подключите домен
4. Открывайте `https://ваш-домен.ru`

---

## Другие варианты

| Способ | Комментарий |
|--------|-------------|
| DNS `8.8.8.8` / `1.1.1.1` | Иногда помогает, не гарантировано |
| `npm run dev` | Локально http://localhost:3210 |
| VPN | Временный обход |

---

## Два хостинга

| Роль | Где |
|------|-----|
| Бэкенд (БД, функции, Blob) | Vercel (скрытый origin) |
| Сайт для пользователей | Cloudflare Pages `*.pages.dev` или свой домен |

После `npm run ship` обновите Vercel. Чтобы обновить Cloudflare-фронт: `npm run deploy:cf`.
