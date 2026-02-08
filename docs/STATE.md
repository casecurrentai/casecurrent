# CaseCurrent — State of the World

## Source of truth
- Git remote: origin (GitLab)
- Branch: main

## Environments
- Local (Mac): TBD
- Replit: TBD
- Production URL(s): TBD

## How to run (local)
TBD

## How to run (Replit)
TBD

## Verification
Run:
- ./scripts/verify

## Architecture Overview

### Frontend
- React 18 + Vite (client/)
- TanStack React Query for data fetching
- Wouter for client-side routing
- Radix UI components + TailwindCSS with HSL CSS variables
- Light/dark mode via `.dark` class on `:root`

### Backend
- Express.js on Node 20+
- Prisma ORM on PostgreSQL
- OpenAI GPT-4o-mini for intake extraction and summarization
- Twilio integration for voice calls with real-time transcription

### Design System Components (client/src/components/ui/)
- **MetricCard** — compact KPI display with value, trend indicator, optional sparkline
- **StatusPill** — colored dot + label for lead status/urgency
- **ConfidenceBadge** — numeric confidence with green/yellow/red color gradient
- **TrendSparkline** — tiny inline Recharts line chart for trend data
- **CaseProgressBar** — horizontal segmented milestone bar with tooltips

### Dashboard Components (client/src/components/dashboard/)
- **KPIStrip** — horizontal scrollable strip of 6 MetricCard tiles with sparklines
- **IntakeFeed** — scrolling list of recent leads with status, summary, progress bar

### Case Detail Components (client/src/components/case/)
- **SummaryTab** — AI-generated case snapshot, key moments, completeness checklist
- **TranscriptTab** — searchable speaker-attributed transcript with copy/download
- **ActivityTab** — interaction timeline (calls, messages)

### Shared Utilities (client/src/lib/)
- **lead-utils.ts** — getBestPhone, getBestDisplayName, getBestPracticeArea

## API Endpoints

### Existing
- `GET /v1/analytics/pi-dashboard` — funnel metrics, speed, rescue queue, source ROI, intake completeness
- `GET /v1/leads` — paginated lead list
- `GET /v1/leads/:id` — lead detail with contact, practice area, milestones
- `GET /v1/leads/:id/interactions` — interaction history for a lead
- `GET /v1/leads/:id/intake` — intake status and answers
- `GET /v1/leads/:id/qualification` — AI qualification score and factors
- `PATCH /v1/leads/:id/milestones` — update case milestone timestamps
- `POST /v1/calls/:id/rescue` — resolve missed call

### New (Dashboard Overhaul)
- `POST /v1/ai/summarize/:callId` — LLM summarization with rule-based fallback (server/routes/ai.ts)
- `GET /v1/leads/:id/summary` — aggregated AI summary across all calls (server/routes/summary.ts)
- `GET /v1/leads/:id/transcript` — speaker-attributed transcript with search (server/routes/transcript.ts)
- `GET /v1/analytics/pi-dashboard/trends` — daily trend counts for sparklines (server/routes/analytics-trends.ts)

## Route Module Pattern

New API endpoints use the route module pattern instead of adding to routes.ts directly:
1. Create Express Router in `server/routes/<name>.ts`
2. Mount via `app.use(router)` in `server/routes.ts`
3. One-line import + mount per module to minimize merge conflicts

## P0 Guardrails

- `scripts/no-json-dump.sh` — CI check that greps client/src/ for unguarded JSON.stringify / `<pre>` tags. Override with `// guardrail-allow: json-dump` comment.
- Debug payloads only render when `import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG_PAYLOAD === "1"`
- Caller phone persisted via canonicalPhone resolution — never overwritten by null
