# GitHub — быстрый старт

Git уже инициализирован в `e:\бэкенд`, первый коммит создан локально.

## Вариант A — через GitHub CLI (рекомендуется)

**1.** Войдите в GitHub (один раз):

```powershell
gh auth login
```

Выберите: GitHub.com → HTTPS → Login with a web browser.

**2.** Создайте репозиторий и отправьте код:

```powershell
cd e:\бэкенд
gh repo create flex-backend --public --source=. --remote=origin --push
```

Для **приватного** репозитория:

```powershell
gh repo create flex-backend --private --source=. --remote=origin --push
```

Готово. Репозиторий: `https://github.com/ВАШ_ЛОГИН/flex-backend`

---

## Вариант B — через сайт GitHub

**1.** https://github.com/new  
**2.** Имя: `flex-backend`  
**3.** **Без** README / .gitignore (пустой репозиторий)  
**4.** Create repository  

**5.** В PowerShell:

```powershell
cd e:\бэкенд
git branch -M main
git remote add origin https://github.com/ttfalsh1on/flex-backend.git
git push -u origin main
```

Замените `ttfalsh1on` на свой логин, если другой.

## 3. Дальнейшие обновления

```powershell
cd e:\бэкенд
git add .
git commit -m "Описание изменений"
git push
```

Если подключён Vercel к GitHub — сайт обновится сам после `git push`.

## 4. Секреты (не коммитить)

- `.env` — в `.gitignore`, уже исключён  
- Токены Vercel — только в панели Vercel → Environment Variables
