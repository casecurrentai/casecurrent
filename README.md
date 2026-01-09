# CaseCurrent

AI-powered intake and lead capture platform for law firms.

## Overview

CaseCurrent is a production-grade MVP that captures inbound phone/SMS/web leads, creates structured intakes, runs qualification scoring, sends notifications, and emits outbound webhooks. The platform includes "self-improving" capabilities with an experimentation engine (A/B testing) for intake scripts and explainable scoring stored in qualification reasons.

## Architecture

This is a monorepo containing the following packages:

```
casecurrent/
├── client/           # Vite + React primary frontend (port 5000)
├── server/           # Express.js backend API
├── shared/           # Shared types and utilities
├── apps/
│   ├── api/          # Fastify API (alternative backend)
│   └── web/          # Next.js frontend (alternative)
├── packages/
│   ├── shared/       # Shared package for monorepo
│   └── config/       # ESLint, Prettier, TypeScript configs
├── scripts/          # Utility scripts (tests, demo data, simulators)
```

## Tech Stack

- **Backend**: Express.js + TypeScript with Prisma ORM
- **Frontend**: Vite + React + TypeScript with shadcn/ui
- **Database**: PostgreSQL (Neon-backed on Replit)
- **Styling**: Tailwind CSS
- **API Documentation**: Swagger/OpenAPI at `/docs`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT token signing | Yes |
| `SESSION_SECRET` | Secret for session cookies | Yes |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated list of platform admin emails | No |
| `NODE_ENV` | Environment: development, production | No |

### Setting Up Secrets

On Replit, secrets are automatically managed. For local development:

```bash
# Create a .env file (not committed to git)
DATABASE_URL="postgresql://user:password@localhost:5432/casecurrent"
JWT_SECRET="your-jwt-secret-at-least-32-chars"
SESSION_SECRET="your-session-secret-at-least-32-chars"
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Run database migrations (Prisma)
cd apps/api && npx prisma migrate deploy

# Seed the database with demo data
cd apps/api && npx tsx prisma/seed.ts
```

### Development

Run the API and web frontend together:

```bash
# Start the development server (API + Frontend on port 5000)
npm run dev
```

The app will be available at `http://localhost:5000`

### Default Demo Account

After seeding, you can login with:
- **Email**: `owner@demo.com`
- **Password**: `DemoPass123!`

## Running Tests

### API Smoke Tests

The smoke tests cover all core API flows:

```bash
# Run all smoke tests against local server
npx tsx scripts/smoke-tests.ts

# Or against a specific URL
API_URL=https://your-app.replit.app npx tsx scripts/smoke-tests.ts
```

The smoke tests verify:
- Authentication (register, login)
- Lead creation and management
- Intake initialization and completion
- Qualification run
- Webhook delivery records
- Experiment assignment
- Policy test run

### Generating Demo Data

To populate the UI with realistic demo data:

```bash
# Generate demo data (requires running server)
npx tsx scripts/demo-data.ts
```

This creates:
- 8 contacts with varied information
- 8 leads at different stages
- Intakes at various completion states
- Qualifications with different dispositions
- Running experiments with assignments
- Policy test suites with run history
- Follow-up sequences
- Webhook endpoints

## Simulating Twilio Webhooks

For local testing of telephony ingest without a real Twilio account:

```bash
# Simulate all events (voice call + SMS)
npx tsx scripts/simulate-twilio.ts

# Simulate voice call only
npx tsx scripts/simulate-twilio.ts voice

# Simulate SMS only
npx tsx scripts/simulate-twilio.ts sms
```

### Twilio Webhook Configuration (Production)

Configure these webhooks in your Twilio console:

| Event | Webhook URL | Method |
|-------|-------------|--------|
| Voice | `/v1/telephony/twilio/voice` | POST |
| Voice Status | `/v1/telephony/twilio/status` | POST |
| Recording | `/v1/telephony/twilio/recording` | POST |
| SMS | `/v1/telephony/twilio/sms` | POST |

## API Documentation

Interactive API documentation is available at `/docs` when running the server.

### Key Endpoints

| Category | Endpoints |
|----------|-----------|
| Auth | `/v1/auth/register`, `/v1/auth/login`, `/v1/auth/me` |
| Contacts | `/v1/contacts` (CRUD) |
| Leads | `/v1/leads` (CRUD) |
| Intake | `/v1/leads/:id/intake` (init, update, complete) |
| Qualification | `/v1/leads/:id/qualification` (run, override) |
| Webhooks | `/v1/webhooks` (CRUD), `/v1/webhook-deliveries` |
| Experiments | `/v1/experiments` (CRUD, start/pause/end, assign, report) |
| Policy Tests | `/v1/policy-tests/suites` (CRUD, run), `/v1/policy-tests/runs` |
| Follow-up | `/v1/followup-sequences` (CRUD, trigger) |
| Telephony | `/v1/telephony/twilio/*` (voice, status, recording, sms) |
| Admin | `/v1/admin/orgs` (platform admin only) |

## Worker Jobs

The current implementation uses inline stubs for background jobs. For production:

### AI Pipeline Stubs

These endpoints run inline but are structured for future job queue integration:

- `POST /v1/ai/transcribe/:callId` - Transcription (stub)
- `POST /v1/ai/summarize/:callId` - Summarization (stub)
- `POST /v1/ai/extract/:leadId` - Intake extraction (stub)
- `POST /v1/ai/score/:leadId` - Qualification scoring (stub)

### Follow-up Sequences

Follow-up sequences use in-memory `setTimeout` for V1. Messages are logged to console but not actually sent. For production:

1. Replace setTimeout with a job queue (Bull, Agenda, etc.)
2. Integrate with Twilio SMS API for actual message sending
3. Add persistence for sequence state across restarts

### Webhook Deliveries

Webhook deliveries run inline with retry logic:
- 3 attempts with exponential backoff (1s, 5s, 15s)
- 10-second timeout per attempt
- HMAC SHA256 signing with X-CT-Signature header

## Project Structure

| Directory | Description |
|-----------|-------------|
| `client/src/pages` | React page components |
| `client/src/components` | Reusable UI components |
| `server/routes.ts` | All API route handlers |
| `server/auth.ts` | Authentication and authorization |
| `server/openapi.ts` | Swagger/OpenAPI configuration |
| `apps/api/prisma` | Prisma schema, migrations, seed |
| `scripts/` | Utility scripts (tests, data, simulators) |

## Checkpoints

- **cp0-structure**: Initial monorepo structure
- **cp1-skeleton**: Basic API and frontend skeleton
- **cp2-auth**: Authentication and RBAC
- **cp3-entities**: Core entities (contacts, leads)
- **cp4-platform-admin**: Platform admin and marketing site
- **cp5-telephony**: Twilio webhooks and telephony ingest
- **cp6-intake**: Structured intake flow
- **cp7-qualification**: AI pipeline and qualification scoring
- **cp8-webhooks**: Outbound webhook system
- **cp9-self-improving**: Experiments, policy tests, follow-up sequences
- **cp10-hardening**: Stability, tests, documentation

## Security

- JWT-based authentication with RBAC (owner, admin, staff, viewer)
- Multi-tenant with org_id scoping on all queries
- Audit logging for sensitive operations
- HMAC SHA256 webhook signatures
- Platform admin impersonation with audit trail

## License

Proprietary - All rights reserved.
