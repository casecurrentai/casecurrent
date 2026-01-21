# CaseCurrent

## Overview
CaseCurrent is an AI-powered MVP platform designed for law firms to automate lead capture, create structured intakes, perform qualification scoring, send notifications, and dispatch outbound webhooks. It integrates "self-improving" capabilities through an experimentation engine for A/B testing and provides explainable AI scoring. The platform's core purpose is to streamline lead management and improve client intake efficiency for legal practices, with a vision to enhance legal operations through advanced AI and automation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses Vite + React and Next.js 14 App Router, built with shadcn/ui and Radix UI primitives. Styling is managed with Tailwind CSS, incorporating custom design tokens and a specific brand aesthetic featuring guilloche underlays, wireframe AI blueprint elements, and distinct typography, creating a clean enterprise SaaS look.

### Technical Implementations
- **Frontend**: Vite + React and Next.js 14 App Router, utilizing TanStack React Query for state management and Wouter/Next.js App Router for routing.
- **Backend**: Express.js with TypeScript (with an alternative Fastify setup) exposing a REST API.
- **Build System**: esbuild for server, Vite for client. `tsx` for development.
- **Authentication & Authorization**: Role-based access control (RBAC) with JWT tokens and Express sessions stored in PostgreSQL. Supports multiple roles and platform admin impersonation.
- **Monorepo Structure**: Organized for modularity into `client/`, `server/`, `shared/`, `apps/`, and `packages/`.

### Feature Specifications
- **Realtime Voice Integration**: Utilizes OpenAI Realtime Voice via SIP trunking for inbound calls, enabling AI agents to greet callers, collect lead information, and create database entries. Includes multi-tenancy safety checks.
- **Telephony Ingest**: Handles inbound calls and SMS via Twilio and ElevenLabs, creating leads, interactions, and managing call status, recordings, and transcription.
- **ElevenLabs Webhook Integration**: Data pipeline for ElevenLabs Agents with two endpoints:
  - `POST /v1/webhooks/elevenlabs/inbound` - Called at call start. Receives caller_id, called_number, conversation_id, call_sid. Performs firm lookup via PhoneNumber.e164, upserts Contact/Lead/Call scoped by orgId.
  - `POST /v1/webhooks/elevenlabs/post-call` - Called after call ends. Updates Call with duration, transcript, summary, recording. Merges extracted_data (callerName, phone, incidentDate, injuryDescription, etc.) into Lead.intakeData.
  - Idempotency via WebhookEvent table with @@unique([provider, externalId, eventType]).
- **Structured Intake Flow**: Manages the lifecycle of lead intake, supporting initialization, answer updates, and completion with practice area-specific question sets.
- **AI Pipeline & Qualification**: Provides AI-driven lead qualification including transcription, summarization, intake extraction, and scoring based on defined factors, generating detailed qualification reasons.
- **Webhook System**: Manages webhook endpoints for real-time notifications on events like `lead.created`, `lead.updated`, and `intake.completed`, featuring secure signing, retry logic, and delivery logging.
- **Self-Improving System**: Incorporates A/B testing for intake scripts, qualification rules, and follow-up timings via an Experiments API, a Policy Tests API for regression testing AI logic, and a Follow-up Sequences API for automated communications.
- **Platform Admin System**: Tools for managing organizations, provisioning firms, user invitations, organization impersonation (with auditing), and health monitoring.
- **Mobile Ops App**: A React Native (Expo) mobile application for law firm staff, providing:
    - **Authentication**: Email/password login with multi-org firm selection.
    - **Inbox**: Prioritized leads view with scoring, DNC indicators, and overdue highlighting.
    - **Lead Detail**: Unified thread view (calls, SMS, system events) with SMS composer, tap-to-call, and intake link generation.
    - **Leads Search**: Full lead list with search and status filtering.
    - **Analytics**: Dashboard for key metrics.
    - **Settings**: Notification preferences.
    - **Realtime Updates**: WebSocket for push events.
    - **DNC Enforcement**: Automatic DNC setting for STOP words in SMS.
- **Mobile API Endpoints**: Dedicated endpoints for mobile app functionality including thread aggregation, device registration, SMS sending, call logging, intake link generation, lead status updates, lead assignment, and analytics.

### System Design Choices
- **Database**: PostgreSQL with Prisma ORM for data storage, supporting multi-tenant `org_id` scoping.
- **AI Integration**: Deep integration with OpenAI for real-time voice and AI-driven qualification. Includes detailed configuration for OpenAI and ElevenLabs TTS, with advanced barge-in echo protection logic and diagnostic logging.
- **Luna-Style Voice**: Human-like voice delivery ("Avery") with empathy-first patterns, short sentences, and natural rhythm, configurable via environment variables.
- **TurnController State Machine**: A robust state machine manages conversation flow, preventing phantom turns and handling user input with various thresholds for no-input, short utterances, and barge-in.
  - **12 States**: INIT, IDLE, ASSIST_PLANNING, ASSIST_SPEAKING, POST_TTS_DEADZONE, WAITING_FOR_USER_START, USER_SPEAKING, USER_END_DEBOUNCE, USER_FINALIZING, USER_VALIDATING, NO_INPUT_REPROMPT, SHORT_UTTER_REPROMPT
  - **Core Thresholds**: postTtsDeadzoneMs (450ms), longNoInputMs (9s), idleNoInputMs (12s), minUtteranceMs (900ms), minWords (2), bargeInEchoIgnoreMs (800ms), bargeInSustainedSpeechMs (650ms), bargeInCooldownMs (800ms)
  - **Flow**: speech_started → onSpeechStarted() → speech_stopped → onSpeechStopped() → transcript_final → onTranscriptFinal() → validateUserUtterance() → onRequestLlmResponse()
  - **LLM Call Guard**: Blocks responses when in WAITING_FOR_USER_START state to prevent phantom turns
  - **Utterance Validation**: Slot-aware - phone number questions accept 1-word utterances if digits present
  - **Reprompts**: "I'm sorry, I didn't catch that" for no-input, "Could you say that again?" for short utterances
  - **Logging**: All state transitions logged with event `turn_state_change`, including fromState, toState, reason, timestamp, and stateData
- **Modularity**: Monorepo structure ensures clear separation of concerns.
- **Log Masking**: Automatic masking of sensitive data in logs across all environments.
- **Diagnostic Logging**: Structured logging for inbound calls, enrichment pipeline, and specific diagnostic endpoints to aid debugging and monitoring.
- **Media Stream Lead Creation**: Leads are created on the "start" event of WebSocket streams to ensure persistence.
- **Intake Extraction Display**: Frontend displays auto-extracted caller data (display name, score, score reasons) on lead lists and detail pages.

## External Dependencies

- **Database**: PostgreSQL
- **ORM**: Prisma, Drizzle ORM
- **UI Libraries**: Radix UI, shadcn/ui, Lucide React, react-day-picker, embla-carousel-react, recharts, vaul
- **Styling**: Tailwind CSS, class-variance-authority
- **Backend Frameworks**: Express.js, Fastify
- **Validation**: Zod, drizzle-zod
- **Development Tools**: TypeScript, ESLint, Prettier, tsx, Vite