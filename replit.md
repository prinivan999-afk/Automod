# LeadFlow CRM Dashboard

## Overview

A CRM platform for businesses that receive client leads via Telegram, Instagram, and MAX messenger bots. AI bots chat with clients, collect order details, then submit structured lead data to the dashboard. Business owners see all leads with status, pricing, and AI recommendations.

## Architecture

Full-stack app: React + Vite frontend (crm-dashboard), Express 5 API server, PostgreSQL database.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/crm-dashboard), Tailwind CSS, Recharts
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI provider**: Gemini via Replit AI Integrations (`AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`)

## Key Features

- **Dashboard**: Summary stats (total, hot, warm, cold leads), platform performance chart, status distribution, recent activity
- **Leads list**: Filterable by status and platform, searchable, shows status badges and platform icons
- **Lead detail**: Full info card, recommendation block, one-click status change
- **Add lead**: Manual lead entry form (for testing bot integration)
- **Bot integration**: POST /api/leads endpoint accepts structured JSON from bots
- **Tariff platforms**: Tariff setup can target Telegram, Instagram, and/or MAX bots
- **Account hosting setup**: Business owner records Telegram/MAX/Instagram account details in the leads section
- **Lead chat**: Each created lead automatically creates a CRM chat message with the collected client information

## Bot Integration API

Bots submit leads via:
```
POST /api/leads
{
  "clientName": "Имя клиента",
  "platform": "Telegram" | "Instagram" | "MAX",
  "service": "Название услуги",
  "details": "Детали заказа",
  "quantity": "Количество",
  "deadline": "Срок",
  "price": "Стоимость",
  "comment": "Комментарий",
  "status": "hot" | "warm" | "cold",
  "isPriority": true | false
}
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## File Structure

- `artifacts/crm-dashboard/` — React+Vite frontend
- `artifacts/api-server/src/routes/leads.ts` — Lead CRUD + analytics routes
- `lib/db/src/schema/leads.ts` — Leads table schema
- `lib/api-spec/openapi.yaml` — API spec (source of truth)
- `lib/integrations-gemini-ai/` — Gemini client and helper modules
- `lib/db/src/schema/bot-accounts.ts` — connected messaging account records
- `lib/db/src/schema/lead-chat-messages.ts` — CRM lead notification chat messages
- `artifacts/api-server/src/telegram-bot.ts` — Telegram bot (polling), handles buyer conversations and seller verification
- `artifacts/api-server/src/routes/users.ts` — Seller registration, profile, and verification endpoints

## Telegram Seller Verification Flow

1. Seller clicks "Подтвердить через Telegram" on their profile page
2. Frontend calls `POST /api/users/request-verification` → generates 8-char hex code, stores in `users.verificationCode`
3. Response includes `{code, botUsername}` → frontend opens `https://t.me/{botUsername}?start=v_{CODE}`
4. Seller clicks Start in Telegram; bot receives `/start v_CODE`
5. Bot looks up user by `verificationCode`, sets `telegramUsernameVerified=true`, clears the code
6. Frontend polls `GET /api/users/profile` every 3 s until verified → shows success toast

Bot only runs in production (`BOT_ENABLED=true`). Dev uses env var `TELEGRAM_BOT_USERNAME=AutoMind5_bot` for deep-link generation without bot running.
