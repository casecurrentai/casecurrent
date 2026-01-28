# CLAUDE.md - Project Intelligence

## Project Overview

CaseCurrent is an AI-powered intake and lead capture platform for law firms. It manages leads, phone calls, SMS, intake questionnaires, qualification scoring, follow-up sequences, A/B experiments, and webhooks — all in a multi-tenant architecture.

## Tech Stack

- **Backend**: Node.js 20, Express 4, TypeScript 5.6 (strict mode)
- **Frontend**: React 18, Vite 7, Tailwind CSS, shadcn/ui (Radix primitives), Wouter router, TanStack React Query
- **Database**: PostgreSQL 16 via Prisma ORM 7.2 (schema at `apps/api/prisma/schema.prisma`)
- **Mobile**: React Native 0.73 + Expo 51 (iOS/Android)
- **Telephony**: Twilio (primary), Plivo (secondary), OpenAI Realtime, ElevenLabs
- **Auth**: JWT (HS256, 7-day expiry) + express-session cookies
- **Build**: esbuild (server → dist/index.cjs), Vite (client → dist/public)
- **Testing**: Node built-in test runner (`node:test` + `assert`)

## Repository Structure

```
server/              # Express API (routes.ts has 139 endpoints, ~10K lines)
  auth.ts            # JWT middleware, token generation, RBAC
  routes.ts          # All API route handlers
  openapi.ts         # Swagger spec
  telephony/         # Twilio/Plivo webhook handlers
  openai/            # OpenAI realtime voice integration
  webhooks/          # Outgoing webhook delivery
  intake/            # Intake flow logic
  analytics/         # Event tracking
  voice/             # Voice processing
  agent/             # AI agent integration
  routes.test.ts     # API tests (13 groups)

client/              # Vite + React frontend
  src/pages/         # 13 pages (leads, experiments, webhooks, etc.)
  src/components/    # 88 .tsx component files
  src/lib/           # Auth, query client, utilities

apps/
  api/prisma/        # Prisma schema + migrations (31 tables)
  web/               # Next.js alternative frontend
  mobile/            # React Native/Expo app

packages/
  shared/            # Shared types & utilities
  config/            # ESLint, TypeScript configs

scripts/             # Demo data, smoke tests, telephony simulators
shared/              # Drizzle ORM schema (backup)
```

## Key Patterns

### Multi-Tenancy
All tables have `orgId`. Auth token includes `orgId` + `userId`. Every query filters by org_id.

### RBAC
Roles: owner > admin > staff > viewer. Middleware: `requireMinRole(role)`. Platform admins defined via `PLATFORM_ADMIN_EMAILS` env var.

### API Convention
- Standard JSON responses, errors as `{ error: "message" }`
- Auth via `Authorization: Bearer <token>` header
- Routes prefixed `/v1/` for versioned API, `/api/` for system endpoints
- WebSocket at `/ws` for real-time org-wide updates

### Database (31 Prisma tables)
Core domains: Organization, User, Contact, Lead, Call, Message, Intake, Qualification, Task, Notification, Experiment, FollowupSequence, OutgoingWebhookEndpoint, AnalyticsEvent, AuditLog, PolicyTestSuite, PhoneNumber, AiConfig.

### Build & Run
```bash
npm run build          # esbuild server + Vite client
npm run dev            # Dev server with hot reload (port 5000)
npm run check          # TypeScript type checking
node dist/index.cjs    # Production start
```

### Testing
```bash
npx tsx server/routes.test.ts              # API tests
npx tsx scripts/smoke-tests.ts             # Full smoke suite
npx tsx scripts/demo-data.ts               # Seed demo data
npx tsx scripts/simulate-twilio.ts [voice|sms]  # Telephony simulator
```

### Environment Variables (Required)
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — 32+ char signing key
- `SESSION_SECRET` — 32+ char session key

### Environment Variables (Optional)
- `OPENAI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`
- `PLATFORM_ADMIN_EMAILS` — comma-separated admin emails
- `PUBLIC_HOST` — for webhook URLs (default: casecurrent.co)
- `DIAG_TOKEN` — diagnostic endpoint access (prefix: `diag_`)

## Architecture Notes

- Server bundle uses esbuild with selective allowlist to reduce cold start
- Webhook delivery has retry logic (1s, 5s, 15s backoff) with idempotency deduplication
- In-memory flight recorder (400-line log buffer) powers `/v1/diag/logs`
- Logging uses `[SOURCE]` prefixes: express, CRASH_GUARD, DB, BOOT, WS
- Follow-up jobs currently use `setTimeout` (production should migrate to Bull/Agenda)
- Telephony uses canonical status mapping across providers (connected, voicemail, no-answer, busy, failed)
- Qualification produces score 0-100, disposition (accept/review/decline), confidence, and explainable decision trace
