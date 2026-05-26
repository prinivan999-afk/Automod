# Деплой на Railway

## Что нужно заранее

- Аккаунт на [railway.app](https://railway.app) (бесплатный — $5 кредитов в месяц, хватает на ~500 часов)
- Репозиторий проекта на GitHub
- API-ключ Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (бесплатно)

---

## Шаг 1 — Залить код на GitHub

Если ещё не сделано:
1. Создайте репозиторий на GitHub (можно приватный)
2. Залейте весь проект туда

---

## Шаг 2 — Создать проект на Railway

1. Зайдите на [railway.app](https://railway.app) → **New Project**
2. Выберите **Deploy from GitHub repo** → выберите ваш репозиторий
3. Railway автоматически найдёт `railway.json` и настроит сборку

---

## Шаг 3 — Добавить PostgreSQL

1. В проекте нажмите **+ Add Service** → **Database** → **PostgreSQL**
2. После создания базы зайдите в неё → вкладка **Variables**
3. Скопируйте значение `DATABASE_URL` — оно понадобится на следующем шаге

---

## Шаг 4 — Переменные окружения

В сервисе с вашим кодом → вкладка **Variables** → добавьте:

| Переменная | Значение | Где взять |
|---|---|---|
| `NODE_ENV` | `production` | вписать вручную |
| `DATABASE_URL` | `postgresql://...` | из PostgreSQL сервиса (шаг 3) |
| `GEMINI_API_KEY` | `AIza...` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | от [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | `AutoMind5_bot` | username вашего бота (без @) |
| `BOT_ENABLED` | `true` | вписать вручную |
| `ADMIN_SECRET` | придумайте пароль | для генерации лицензий |

> **PORT** Railway выставляет автоматически — не трогайте.

---

## Шаг 5 — Первый запуск

После добавления переменных Railway автоматически запустит деплой.

Следите за логами: **Deployments** → выберите деплой → **View Logs**

Когда появится строка `Server listening` — всё работает.

---

## Шаг 6 — Перенести данные из Replit (опционально)

Если нужно перенести пользователей и лиды из Replit-базы:

1. На Replit выполните дамп:
   ```
   pg_dump $DATABASE_URL --no-owner --no-acl > backup.sql
   ```
2. Загрузите `backup.sql` в Railway PostgreSQL:
   ```
   psql <RAILWAY_DATABASE_URL> < backup.sql
   ```

---

## Что происходит при деплое

```
Railway клонирует репозиторий
  └─ pnpm install
  └─ vite build  (фронтенд → artifacts/crm-dashboard/dist/public)
  └─ esbuild     (API сервер → artifacts/api-server/dist/index.mjs)
  └─ node artifacts/api-server/dist/index.mjs
       ├─ Express раздаёт /api/*
       ├─ Express раздаёт фронтенд (статика + SPA fallback)
       ├─ Telegram бот запускается
       └─ Авто-миграции БД применяются
```

---

## Обновление

Просто сделайте `git push` — Railway автоматически пересоберёт и задеплоит.

---

## Домен

Railway даёт бесплатный домен вида `your-app.up.railway.app`.  
Свой домен можно добавить в **Settings** → **Domains**.
