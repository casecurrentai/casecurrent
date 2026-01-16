# CaseCurrent

## Overview
CaseCurrent is an AI-powered MVP platform designed for law firms. It automates lead capture via phone, SMS, and web, creates structured intakes, performs qualification scoring, sends notifications, and dispatches outbound webhooks. The platform integrates "self-improving" capabilities through an experimentation engine for A/B testing intake scripts and provides explainable AI scoring with stored qualification reasons. Its core purpose is to streamline lead management and improve client intake efficiency for legal practices.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes a dual setup with Vite + React and Next.js 14 App Router, built with shadcn/ui and Radix UI primitives. Styling is managed with Tailwind CSS, incorporating custom design tokens aligned with CaseCurrent branding. The design system features guilloche underlays, wireframe AI blueprint elements, and specific typography/spacing, creating a clean enterprise SaaS aesthetic.

### Technical Implementations
- **Frontend**: Vite + React and Next.js 14 App Router. State management is handled by TanStack React Query, and routing by Wouter (Vite client) and Next.js App Router.
- **Backend**: Primarily Express.js with TypeScript, with an alternative Fastify setup. It exposes a REST API under the `/api` prefix.
- **Build System**: esbuild for server bundling and Vite for the client.
- **Development**: `tsx` is used for TypeScript execution in development.
- **Authentication & Authorization**: Role-based access control (RBAC) with JWT tokens and Express sessions storing in PostgreSQL. Supports roles like owner, admin, staff, and viewer, with platform admin impersonation capabilities.
- **Monorepo Structure**: Organized into `client/`, `server/`, `shared/`, `apps/` (api, web), and `packages/` (shared, config) for modular development.

### Feature Specifications
- **Realtime Voice Integration**: Utilizes OpenAI Realtime Voice for phone calls via SIP trunking pattern:
  - Twilio receives inbound call → returns TwiML with `<Dial><Sip>` to OpenAI SIP gateway
  - OpenAI sends `realtime.call.incoming` webhook with Standard Webhooks signature (webhook-id, webhook-timestamp, webhook-signature)
  - Server resolves org by called number, creates call records, calls OpenAI `/realtime/calls/{call_id}/accept` endpoint with session config
  - Opens sideband WebSocket to `wss://api.openai.com/v1/realtime?call_id=...` for real-time conversation monitoring and tool execution
  - AI agent greets callers, collects lead information, creates database entries via tools, can request warm transfers
  - Multi-tenancy safety: rejects calls if org cannot be resolved from phone number
- **Telephony Ingest**: Handles inbound calls and SMS via Twilio webhooks, creating leads, interactions, and calls/messages. It manages call status, recordings, and enqueues transcription jobs.
- **Structured Intake Flow**: Manages the lifecycle of lead intake, allowing initialization, updating of answers, and completion, with support for practice area-specific question sets.
- **AI Pipeline & Qualification**: Provides endpoints for AI-driven lead qualification, including transcription, summarization, intake extraction, and scoring based on defined factors (e.g., contact info, practice area, intake completion). It generates detailed qualification reasons.
- **Webhook System**: Offers CRUD operations for managing webhook endpoints, enabling real-time notifications for events like `lead.created`, `lead.updated`, and `intake.completed`. Features secure signing, retry logic, and delivery logging.
- **Self-Improving System**: Incorporates A/B testing for intake scripts, qualification rules, and follow-up timings via an Experiments API. It also includes a Policy Tests API for regression testing AI qualification logic and a Follow-up Sequences API for automated multi-step communications.
- **Platform Admin System**: Provides tools for platform administrators to manage organizations, provision new firms, invite users, impersonate organizations (with auditing), and monitor health snapshots.
- **Mobile Ops App**: React Native (Expo) mobile application for law firm staff operations:
  - **Authentication**: Email/password login with multi-org firm picker for users with access to multiple organizations
  - **Inbox**: Prioritized leads view showing new/engaged leads with HOT score badges, DNC indicators, and overdue highlighting
  - **Lead Detail**: Unified thread view aggregating calls, SMS, and system events with SMS composer (DNC-enforced), tap-to-call, and intake link generation
  - **Leads Search**: Full lead list with search and status filtering
  - **Analytics**: Key metrics dashboard (captured leads, qualified rate, response times, after-hours conversion)
  - **Settings**: Notification preferences (hot leads, inbound SMS, SLA breaches) and logout
  - **Realtime Updates**: WebSocket connection at `/v1/realtime?token=<jwt>` for push events (lead.created, sms.received, lead.dnc_set)
  - **DNC Enforcement**: STOP word detection (stop, unsubscribe, cancel, end, quit) in inbound SMS automatically sets DNC, cancels queued automation
- **Mobile API Endpoints**:
  - `GET /v1/leads/:id/thread` - Unified thread aggregation
  - `POST /v1/devices/register` - Push notification device registration
  - `POST /v1/leads/:id/messages` - Outbound SMS with DNC enforcement
  - `POST /v1/leads/:id/call/start` - Tap-to-call (logs attempt, returns dial info)
  - `POST /v1/leads/:id/intake/link` - Generate secure intake URL
  - `POST /v1/leads/:id/status` - Update lead status
  - `POST /v1/leads/:id/assign` - Assign/claim lead
  - `GET /v1/analytics/summary` - Dashboard metrics
  - `GET /v1/analytics/captured-leads` - Detailed leads list

### System Design Choices
- **Database**: PostgreSQL with Prisma ORM (v7.2.0) is used for data storage, including 27 base tables with multi-tenant `org_id` scoping. Migrations are managed via Prisma Migrate.
- **AI Integration**: Deep integration with OpenAI for real-time voice interactions and AI-driven qualification.
  - **Required Environment Variables for Voice**:
    - `OPENAI_API_KEY`: OpenAI API key with Realtime access
    - `OPENAI_PROJECT_ID`: OpenAI project ID for SIP routing (format: `proj_xxxxx`)
    - `OPENAI_WEBHOOK_SECRET`: Webhook signing secret from OpenAI (format: `whsec_xxxxx`)
    - `OPENAI_WEBHOOK_TOLERANCE_SECONDS` (optional): Timestamp tolerance for webhook verification (default: 300)
    - `AVERY_LUNA_STYLE` (optional): Set to `true` to enable Luna-style human voice delivery (default: false)
  - **ElevenLabs TTS Environment Variables** (Tiffany voice):
    - `ELEVENLABS_API_KEY`: ElevenLabs API key (required for TTS)
    - `ELEVENLABS_VOICE_ID_AVERY` or `ELEVENLABS_VOICE_ID`: Voice ID (default: `6aDn1KB0hjpdcocrUkmq` = Tiffany)
    - `ELEVENLABS_MODEL_ID`: TTS model ID (default: `eleven_turbo_v2_5`)
    - `ELEVENLABS_OUTPUT_FORMAT`: Audio output format (default: `ulaw_8000` for Twilio)
  - **Webhook Configuration**: Set OpenAI webhook URL to `https://your-domain.com/v1/telephony/openai/webhook`
  - **Twilio Configuration**: Configure Twilio number webhook to `https://your-domain.com/v1/telephony/twilio/voice`
  - **Phone Number Setup**: Each inbound number must exist in `phone_numbers` table with `inboundEnabled=true`
  - **Luna-Style Voice (Avery)**: Human-like voice delivery with empathy, short sentences, and natural rhythm. Enable with `AVERY_LUNA_STYLE=true`. Features:
    - Warm, emotionally present voice with natural pauses
    - Short sentences, one question per turn
    - Empathy-first pattern for difficult situations: acknowledge → stabilize → proceed
    - Rising intonation questions via repeat-back phrasing ("And you're at the hospital?")
    - Phone/name confirmations with "Just to confirm..." pacing
    - Calm transfer pacing for warm handoffs
    - Files: `server/agent/prompt.ts` (system prompt), `server/agent/formatters/lunaStyle.ts` (speech formatter)
- **Modularity**: The monorepo structure and clear separation of concerns (frontend, backend, shared logic) promote maintainability and scalability.
- **Log Masking**: Sensitive data (phone numbers, SIP URIs, project IDs, call SIDs) is automatically masked in logs across ALL environments by default. To disable for debugging, set `DISABLE_LOG_MASKING=true`. Masking utilities are in `server/utils/logMasking.ts`.
- **Inbound Call Diagnostic Logging**: Structured logging tags for end-to-end call debugging:
  - `[INBOUND]` - Immediate call receipt with callSid, from, to, direction, timestamp
  - `[ENV]` - NODE_ENV, REPL_SLUG, RAILWAY_SHA, baseUrl
  - `[DB]` - Database host, name, schema (no password)
  - `[NORMALIZED]` - E.164 normalized from/to numbers
  - `[TENANT_HIT]` - Phone number found, org resolved
  - `[TENANT_MISS]` - Phone number not found, with DB debug info
  - `[LEAD_CREATED]` - New lead created with leadId, orgId, contactId, callSid
  - `[LEAD_EXISTS]` - Existing lead reused
  - `[LEADS_QUERY]` - Dashboard leads fetch with orgId, limit, offset, returnedCount
- **Enrichment Pipeline Logging**: Structured logging tags for call finalization debugging:
  - `[FINALIZE_BEGIN]` - Enrichment pipeline starting for callSid
  - `[TX_APPEND]` - Transcript message added (role, text length)
  - `[EXTRACT_BEGIN]` - AI extraction starting
  - `[EXTRACT_OK]` - Extraction completed with field list
  - `[TRANSCRIPT_UPSERT_OK]` - Transcript saved to call record
  - `[INTAKE_UPSERT_OK]` - Intake record created/updated
  - `[LEAD_UPDATE_OK]` - Lead updated with displayName/score/practiceArea
  - `[CONTACT_UPDATE_OK]` - Contact updated with name/phone
  - `[FINALIZE_DONE]` - Enrichment pipeline completed successfully
  - `[FINALIZE_ERROR]` - Enrichment failed with step tracking
  - `[FINALIZE_SKIP]` - Duplicate finalization prevented by guard
- **Diagnostic Endpoints** (require DIAG_TOKEN env var):
  - `GET /v1/diag/telephony-status?to=+1XXXXXXXXXX&token=DIAG_TOKEN` - Returns env identifiers, db host/name, phone number record, orgId, leads count in last 24h, most recent lead
  - `GET /v1/diag/enrichment?callSid=...&token=DIAG_TOKEN` - Returns transcript/extraction/intake status for a specific call (displayName, practiceArea, transcriptExists, msgCount, extractedKeys, intakeExists, score, tier, scoreReasons)
- **Demo Phone Seeding**: On startup, server idempotently seeds demo phone number +18443214257 for org 4a906d8e-952a-4ee0-8eae-57f293362987 (matches dashboard demo login)
- **Media Stream Lead Creation**: The WebSocket stream handler (`server/telephony/twilio/streamHandler.ts`) now creates leads on the "start" event to ensure lead persistence even if the initial voice webhook fails. Uses customParameters (orgId, phoneNumberId, callSid, from, to) passed from TwiML. Logs: `[INBOUND_STREAM_START]`, `[TENANT_HIT]`/`[TENANT_MISS]`, `[LEAD_CREATED]`/`[LEAD_EXISTS]`
- **Intake Extraction Display**: Frontend pages display auto-extracted caller data from voice calls:
  - **Leads List** (`client/src/pages/leads.tsx`): Shows `displayName || contact.name` with score badge (color-coded: green=high, yellow=medium, muted=low)
  - **Lead Detail** (`client/src/pages/lead-detail.tsx`): Header shows caller name and score badge; Lead Summary card displays score factors list from `scoreReasons`
  - **Search**: Leads search includes displayName in filter criteria alongside summary, location, and contact name

## External Dependencies

- **Database**: PostgreSQL
- **ORM**: Prisma, Drizzle ORM
- **UI Libraries**: Radix UI, shadcn/ui, Lucide React, react-day-picker, embla-carousel-react, recharts, vaul
- **Styling**: Tailwind CSS, class-variance-authority
- **Backend Frameworks**: Express.js, Fastify
- **Validation**: Zod, drizzle-zod
- **Authentication**: Passport.js (planned)
- **Development Tools**: TypeScript, ESLint, Prettier, tsx, Vite
- **Replit-Specific Plugins**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner