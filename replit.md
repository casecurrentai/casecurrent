# CounselTech

AI-powered intake and lead capture platform for law firms.

## Overview

CounselTech is a production-grade MVP that captures inbound phone/SMS/web leads, creates structured intakes, runs qualification scoring, sends notifications, and emits outbound webhooks. The platform includes "self-improving" capabilities with an experimentation engine (A/B testing) for intake scripts and explainable scoring stored in qualification reasons.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: Dual frontend setup with Vite + React (primary client in `/client`) and Next.js 14 App Router (`/apps/web`)
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens matching CounselTech.net branding
- **State Management**: TanStack React Query for server state
- **Routing**: Wouter for the Vite client, Next.js App Router for the web app
- **Design System**: Custom design guidelines with guilloche underlays, wireframe AI blueprint elements, and specific typography/spacing requirements

### Backend Architecture

- **Framework**: Express.js with TypeScript (primary server in `/server`), with Fastify setup in `/apps/api`
- **API Structure**: REST API with routes prefixed under `/api`
- **Build System**: esbuild for server bundling, Vite for client
- **Development**: tsx for TypeScript execution in development

### Data Storage

- **Database**: PostgreSQL with Prisma ORM (v7.2.0)
- **Schema Location**: `/apps/api/prisma/schema.prisma` contains 18 base tables with multi-tenant org_id scoping
- **Migrations**: Prisma Migrate (`/apps/api/prisma/migrations` directory)
- **Prisma Config**: `/apps/api/prisma.config.ts` for Prisma 7 configuration
- **Database Adapter**: `@prisma/adapter-pg` for PostgreSQL driver adapter
- **Seed Script**: `/apps/api/prisma/seed.ts` creates demo organization, owner user, practice areas, intake question set, and AI configuration

### Database Tables (21 total)

- **Core**: organizations, users, contacts
- **Practice**: practice_areas, intake_question_sets, ai_configs
- **Leads**: leads, interactions, calls, messages
- **Intake**: intakes, qualifications
- **Telephony**: phone_numbers
- **Workflow**: tasks, notifications
- **Webhooks**: outgoing_webhook_endpoints, outgoing_webhook_deliveries
- **Audit**: audit_logs
- **Marketing**: marketing_contact_submissions
- **Platform Admin**: user_invites, org_health_snapshots

### Marketing Site (Checkpoint 4.5)

Public marketing pages built into the Vite React client:
- **Routes**: `/` (Home), `/how-it-works`, `/security`, `/solutions`, `/pricing`, `/resources`, `/contact`
- **Components**: PageShell, Hero, FeatureCard, SectionFrame, UIFrame, PhoneFrame, PricingCard, TimelineStepper, TrustList
- **Design**: Guilloche SVG patterns, dot-grid backgrounds, wireframe corner brackets, clean enterprise SaaS aesthetic
- **Contact Form**: POST /v1/marketing/contact with honeypot spam protection and rate limiting (5 submissions/hour per IP)
- **Admin View**: /admin/contact-submissions for viewing marketing submissions (requires admin role)
- **SEO**: robots.txt and sitemap.xml in client/public/

### Authentication & Authorization

- **RBAC**: Role-based access control with JWT tokens
- **Roles**: owner, admin, staff, viewer
- **Platform Admin**: Identified by PLATFORM_ADMIN_EMAILS env var (comma-separated list)
- **Session Management**: Express session with connect-pg-simple for PostgreSQL session storage
- **Impersonation**: Platform admins can impersonate any org with 1-hour tokens (fully audited)

### Platform Admin System (Checkpoint 4.5)

- **Admin Access**: Controlled by PLATFORM_ADMIN_EMAILS environment variable
- **Firm Provisioning**: Create orgs with owner via invite link or temporary password
- **Invite System**: 7-day expiration, token-based, creates user on acceptance
- **Impersonation**: Generate time-limited tokens to act as any organization (logged in audit_logs)
- **Health Snapshots**: Compute and store metrics (leads, calls, webhook failures in last 24h)
- **Admin Routes**: `/v1/admin/orgs`, `/v1/admin/orgs/:id`, `/v1/admin/orgs/:id/invites`, `/v1/admin/orgs/:id/impersonate`, `/v1/admin/orgs/:id/health`
- **Setup Wizard**: 8-step onboarding (Firm Basics, Business Hours, Practice Areas, Phone Numbers, AI Voice, Intake Logic, Follow-up, Review)
- **Frontend Pages**: `/admin/orgs`, `/admin/orgs/new`, `/admin/orgs/:id`, `/setup`, `/invite/:token`

### Telephony Ingest (Checkpoint 5)

- **Interactions API**: POST /v1/interactions (manual creation), GET /v1/leads/:id/interactions
- **Twilio Voice Webhook**: POST /v1/telephony/twilio/voice
  - Idempotent by provider_call_id (CallSid)
  - Creates/attaches lead + interaction + call
  - Returns TwiML placeholder response
- **Twilio Status Webhook**: POST /v1/telephony/twilio/status
  - Updates call status and duration
  - Marks interaction as completed when call ends
- **Twilio Recording Webhook**: POST /v1/telephony/twilio/recording
  - Stores recording URL
  - Enqueues transcription job (flag in transcriptJson)
- **Twilio SMS Webhook**: POST /v1/telephony/twilio/sms
  - Idempotent by providerMessageId (MessageSid)
  - Creates message + interaction, attaches to lead
  - Returns TwiML response
- **Audit Logging**: All telephony events logged with entityType/entityId
- **Lead Detail UI**: Shows interactions timeline, calls panel, messages panel

### Structured Intake Flow (Checkpoint 6)

- **GET /v1/leads/:id/intake**: Retrieve intake for a lead (includes question set schema)
- **POST /v1/leads/:id/intake/init**: Initialize intake with question set selection
  - Priority: practice area-specific question set > default question set
  - Creates intake row with completion_status=partial
- **PATCH /v1/leads/:id/intake**: Update intake answers (merge with existing)
- **POST /v1/leads/:id/intake/complete**: Complete intake with webhook stub
  - Sets completion_status=complete, completed_at
  - Emits intake.completed webhook event (record-only stub)
- **Audit Logging**: All intake operations logged (init, update, complete)
- **UI Components**: IntakePanel with JSON editor, init/save/complete buttons

### AI Pipeline & Qualification (Checkpoint 7)

- **Qualification Endpoints**:
  - GET /v1/leads/:id/qualification - Retrieve qualification
  - POST /v1/leads/:id/qualification/run - Run AI qualification
  - PATCH /v1/leads/:id/qualification - Human override
- **AI Job Stubs** (inline for V1, job queue ready):
  - POST /v1/ai/transcribe/:callId - Transcription stub
  - POST /v1/ai/summarize/:callId - Summarization stub
  - POST /v1/ai/extract/:leadId - Intake extraction stub
  - POST /v1/ai/score/:leadId - Qualification scoring stub
- **Qualification Reasons JSON Contract**:
  ```json
  {
    "score_factors": [{"name": string, "weight": number, "evidence": string, "evidence_quote": string|null}],
    "missing_fields": [string],
    "disqualifiers": [string],
    "routing": {"practice_area_id": string|null, "notes": string|null},
    "model": {"provider": string, "model": string, "version": string|null},
    "explanations": [string]
  }
  ```
- **Scoring Factors**: Contact info (20), Practice area (15), Intake completion (25), Incident details (20), Communication history (20)
- **Disposition Logic**: accept (score >= 70, <= 2 missing), decline (score < 30 or disqualifiers), review (default)
- **UI Components**: QualificationPanel showing score, disposition, confidence, score_factors, missing_fields, disqualifiers, explanations

### Webhook System (Checkpoint 8)

- **Webhook Endpoints CRUD**:
  - GET /v1/webhooks - List endpoints (secrets excluded)
  - POST /v1/webhooks - Create endpoint (returns secret only on creation)
  - GET /v1/webhooks/:id - Get endpoint details
  - PATCH /v1/webhooks/:id - Update endpoint (url, events, active)
  - DELETE /v1/webhooks/:id - Delete endpoint
  - POST /v1/webhooks/:id/rotate-secret - Rotate signing secret
  - GET /v1/webhooks/:id/deliveries - Get endpoint delivery history
  - GET /v1/webhook-deliveries - Get all org delivery history
  - POST /v1/webhooks/:id/test - Send test webhook
- **Delivery System**:
  - Records outgoing_webhook_deliveries with status tracking
  - Retry logic: 3 attempts with exponential backoff (1s, 5s, 15s)
  - HMAC SHA256 signing with X-CT-Signature header
  - 10-second timeout per delivery attempt
- **Events Emitted**:
  - lead.created, lead.updated, lead.qualified
  - intake.completed, call.completed, contact.created
- **Security**:
  - Secrets generated with crypto.randomBytes(32)
  - Secrets only exposed on creation and rotation
  - Secrets never logged or returned in list/get responses
- **UI**: /settings/webhooks page for endpoint management and delivery logs

### Monorepo Structure

```
counseltech/
├── client/           # Vite + React primary frontend
├── server/           # Express.js backend API
├── shared/           # Shared types, schemas, and utilities
├── apps/
│   ├── api/          # Fastify API (alternative backend)
│   └── web/          # Next.js frontend (alternative)
├── packages/
│   ├── shared/       # Shared package for monorepo
│   └── config/       # ESLint, Prettier, TypeScript configs
```

## External Dependencies

### Database
- PostgreSQL (requires `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe database queries
- drizzle-zod for schema validation

### UI/Frontend Libraries
- Radix UI primitives (dialogs, menus, forms, etc.)
- Tailwind CSS with class-variance-authority
- Lucide React for icons
- react-day-picker for calendar components
- embla-carousel-react for carousels
- recharts for charts
- vaul for drawer components

### API/Backend Libraries
- Express.js with CORS support
- Fastify with Swagger documentation
- Zod for runtime validation
- Passport.js for authentication (planned)

### Development Tools
- TypeScript with strict mode
- ESLint with TypeScript plugin
- Prettier for code formatting
- tsx for TypeScript execution
- Vite with HMR for development

### Replit-Specific
- @replit/vite-plugin-runtime-error-modal
- @replit/vite-plugin-cartographer
- @replit/vite-plugin-dev-banner