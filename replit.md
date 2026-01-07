# CounselTech

## Overview
CounselTech is an AI-powered MVP platform designed for law firms. It automates lead capture via phone, SMS, and web, creates structured intakes, performs qualification scoring, sends notifications, and dispatches outbound webhooks. The platform integrates "self-improving" capabilities through an experimentation engine for A/B testing intake scripts and provides explainable AI scoring with stored qualification reasons. Its core purpose is to streamline lead management and improve client intake efficiency for legal practices.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes a dual setup with Vite + React and Next.js 14 App Router, built with shadcn/ui and Radix UI primitives. Styling is managed with Tailwind CSS, incorporating custom design tokens aligned with CounselTech.net branding. The design system features guilloche underlays, wireframe AI blueprint elements, and specific typography/spacing, creating a clean enterprise SaaS aesthetic.

### Technical Implementations
- **Frontend**: Vite + React and Next.js 14 App Router. State management is handled by TanStack React Query, and routing by Wouter (Vite client) and Next.js App Router.
- **Backend**: Primarily Express.js with TypeScript, with an alternative Fastify setup. It exposes a REST API under the `/api` prefix.
- **Build System**: esbuild for server bundling and Vite for the client.
- **Development**: `tsx` is used for TypeScript execution in development.
- **Authentication & Authorization**: Role-based access control (RBAC) with JWT tokens and Express sessions storing in PostgreSQL. Supports roles like owner, admin, staff, and viewer, with platform admin impersonation capabilities.
- **Monorepo Structure**: Organized into `client/`, `server/`, `shared/`, `apps/` (api, web), and `packages/` (shared, config) for modular development.

### Feature Specifications
- **Realtime Voice Integration**: Utilizes OpenAI Realtime Voice for phone calls, managing conversations, executing tools via Prisma, and logging interactions. The AI agent greets callers, collects essential lead information, creates database entries, and can request warm transfers.
- **Telephony Ingest**: Handles inbound calls and SMS via Twilio webhooks, creating leads, interactions, and calls/messages. It manages call status, recordings, and enqueues transcription jobs.
- **Structured Intake Flow**: Manages the lifecycle of lead intake, allowing initialization, updating of answers, and completion, with support for practice area-specific question sets.
- **AI Pipeline & Qualification**: Provides endpoints for AI-driven lead qualification, including transcription, summarization, intake extraction, and scoring based on defined factors (e.g., contact info, practice area, intake completion). It generates detailed qualification reasons.
- **Webhook System**: Offers CRUD operations for managing webhook endpoints, enabling real-time notifications for events like `lead.created`, `lead.updated`, and `intake.completed`. Features secure signing, retry logic, and delivery logging.
- **Self-Improving System**: Incorporates A/B testing for intake scripts, qualification rules, and follow-up timings via an Experiments API. It also includes a Policy Tests API for regression testing AI qualification logic and a Follow-up Sequences API for automated multi-step communications.
- **Platform Admin System**: Provides tools for platform administrators to manage organizations, provision new firms, invite users, impersonate organizations (with auditing), and monitor health snapshots.

### System Design Choices
- **Database**: PostgreSQL with Prisma ORM (v7.2.0) is used for data storage, including 27 base tables with multi-tenant `org_id` scoping. Migrations are managed via Prisma Migrate.
- **AI Integration**: Deep integration with OpenAI for real-time voice interactions and AI-driven qualification, supported by specific environment variables.
- **Modularity**: The monorepo structure and clear separation of concerns (frontend, backend, shared logic) promote maintainability and scalability.

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