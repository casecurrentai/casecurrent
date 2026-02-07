# Product Requirements Document: CaseCurrent Dashboard Overhaul

**Document ID:** PRD-2026-002
**Date:** February 7, 2026
**Version:** 1.0
**Status:** Draft
**Author:** Research Agent

---

## Table of Contents

1. [Overview](#overview)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Feature A: Command Center Home Dashboard](#feature-a-command-center-home-dashboard)
4. [Feature B: Case Detail -- Summary Tab](#feature-b-case-detail--summary-tab)
5. [Feature C: Case Detail -- Transcript Tab](#feature-c-case-detail--transcript-tab)
6. [Feature D: Navigation Overhaul](#feature-d-navigation-overhaul)
7. [Feature E: Data Pipeline](#feature-e-data-pipeline)
8. [Feature F: P0 Quality Requirements](#feature-f-p0-quality-requirements)
9. [Data Model Changes](#data-model-changes)
10. [API Surface Changes](#api-surface-changes)
11. [Migration & Rollout Plan](#migration--rollout-plan)

---

## Overview

The CaseCurrent dashboard overhaul replaces the current PI Dashboard (`pi-dashboard.tsx`) and Case Detail (`case-detail.tsx`) pages with a redesigned Command Center and enhanced Case Detail view. The overhaul introduces AI-generated case summaries, speaker-attributed transcripts, key moment extraction, and restructured navigation.

### Current State

- **PI Dashboard:** Single-page with greeting, pulse card (new cases count), priority actions (rescue queue), pipeline snapshot (3 compact cards), and intake health card. Data sourced from `/v1/analytics/pi-dashboard`.
- **Case Detail:** Accordion-based layout with Activity, Contact Info, Incident Details, Intake, and Score sections. Desktop sidebar shows funnel milestones and notifications placeholder.
- **Navigation:** Sidebar groups: Main (Home, Cases), Firm Ops (Safety Checks, Integrations, Inquiries), Intake Lab (Experiments), System (Activity Log). Mobile bottom nav: Home, Cases, Menu.
- **Known Issues:** Raw JSON was visible in production (fixed in recent PRs), phone number persistence issues (fixed), empty states needed improvement (fixed).

### Target State

A Command Center dashboard with KPI strip, real-time intake feed, and analytics panels. Case Detail pages with AI-generated summary tab and speaker-attributed transcript tab. Simplified navigation with Insights and Tasks replacing Firm Ops, and Experiments removed from primary navigation.

---

## Goals & Non-Goals

### Goals

1. Provide firm owners and intake staff with instant operational awareness via the Command Center.
2. Replace manual case review with AI-generated case snapshots and key moments.
3. Enable full transcript review with speaker attribution, search, and export.
4. Simplify navigation to match actual user workflows.
5. Establish the data pipeline for LLM summarization, sentiment analysis, and key moment extraction.

### Non-Goals

1. Real-time audio playback from transcripts (future phase).
2. Client-facing intake portal (future phase).
3. Billing or time-tracking integration (out of scope).
4. Multi-language transcript support (future phase).
5. AI-powered chat/copilot within the dashboard (future phase).

---

## Feature A: Command Center Home Dashboard

### A.1 KPI Strip

**Description:** A horizontal row of 6 metric cards displayed at the top of the Command Center, providing at-a-glance operational awareness.

**Metrics:**

| KPI | Definition | Source | Format |
|---|---|---|---|
| New Cases | Count of leads created in the selected time period | `leads` table, `createdAt` within range | Integer with trend arrow |
| Qualified | Count of leads with disposition "accept" in period | `qualifications` table, `disposition = 'accept'` | Integer with trend arrow |
| Response Time | Median minutes from lead creation to first interaction | `leads.createdAt` to `interactions.startedAt` | `Xm` or `Xh` format |
| Consults | Count of leads with `consultScheduledAt` set in period | `leads` table | Integer with trend arrow |
| Retainers | Count of leads with `retainerSentAt` set in period | `leads` table | Integer with trend arrow |
| Signed | Count of leads with `retainerSignedAt` set in period | `leads` table | Integer with trend arrow |

**Acceptance Criteria:**

- [ ] AC-A1.1: All 6 KPI cards render on the Command Center page at viewport widths >= 768px in a single horizontal row.
- [ ] AC-A1.2: On mobile (< 768px), KPI cards display in a 2-column grid (3 rows).
- [ ] AC-A1.3: Each KPI card displays: metric label, current value, and a trend indicator (up arrow green, down arrow red, dash gray) comparing current period to the prior equivalent period.
- [ ] AC-A1.4: A date range selector (Today, 7d, 30d, 90d) is available and changing it updates all 6 KPI values and all other dashboard panels simultaneously.
- [ ] AC-A1.5: Default date range is "30d" (last 30 days).
- [ ] AC-A1.6: Loading state shows skeleton placeholders for each KPI card.
- [ ] AC-A1.7: If the API returns an error, a non-blocking error banner appears below the KPI strip with retry affordance; existing data remains visible if previously loaded.
- [ ] AC-A1.8: Response Time displays "N/A" with a muted tooltip explanation if no leads have interactions in the selected period.

### A.2 Intake Feed

**Description:** A real-time scrolling list of recent intakes displayed below the KPI strip, showing the most recent intake events with essential context.

**Acceptance Criteria:**

- [ ] AC-A2.1: The intake feed displays the 20 most recent leads, sorted by `createdAt` descending.
- [ ] AC-A2.2: Each feed item displays: contact avatar (first initial), display name (resolved via the `getBestDisplayName` logic), source badge (Call/Text/Web), status badge (color-coded per existing `STATUS_COLORS`), practice area label, and relative timestamp ("3m ago", "2h ago").
- [ ] AC-A2.3: Each feed item is clickable and navigates to `/cases/:id`.
- [ ] AC-A2.4: The feed includes a "View all cases" link at the bottom that navigates to `/cases`.
- [ ] AC-A2.5: If a new lead is created while the user is viewing the feed, a "New intake available" banner appears at the top of the feed. Clicking it prepends the new item(s) and dismisses the banner.
- [ ] AC-A2.6: Empty state displays an illustration with text: "No intakes yet. New calls and form submissions will appear here." No raw technical error messages.
- [ ] AC-A2.7: Feed respects the global date range selector from the KPI strip.
- [ ] AC-A2.8: Phone number is always shown on the feed item if available (from `contact.primaryPhone` or intake data fallback).

### A.3 Analytics Panel

**Description:** A set of analytics visualizations displayed below the intake feed (on mobile) or to the right of it (on desktop), providing deeper operational insights.

#### A.3.1 Source ROI

**Acceptance Criteria:**

- [ ] AC-A3.1.1: A table/chart showing lead sources (rows) with columns: Source Name, Total Calls, Qualified Count, Signed Count, Qualified Rate (%), Signed Rate (%).
- [ ] AC-A3.1.2: Sources are sorted by Total Calls descending.
- [ ] AC-A3.1.3: Qualified Rate and Signed Rate are displayed as colored percentage badges (green >= 20%, yellow 10-19%, red < 10%).
- [ ] AC-A3.1.4: Minimum 3 rows visible without scrolling; remaining accessible via scroll or expand.
- [ ] AC-A3.1.5: Empty state: "No source data available for this period."

#### A.3.2 Conversion Funnel

**Acceptance Criteria:**

- [ ] AC-A3.2.1: A horizontal funnel visualization showing the progression: New > Qualified > Consult Scheduled > Retainer Sent > Signed.
- [ ] AC-A3.2.2: Each stage shows the count and the conversion rate from the previous stage.
- [ ] AC-A3.2.3: Funnel bars are proportionally sized relative to the "New" stage count.
- [ ] AC-A3.2.4: Clicking a funnel stage navigates to the Cases page with the appropriate status filter pre-applied.
- [ ] AC-A3.2.5: On mobile, the funnel renders as a vertical stepped list instead of a horizontal bar chart.

#### A.3.3 Intake Health

**Acceptance Criteria:**

- [ ] AC-A3.3.1: Displays overall intake completeness percentage as a progress bar.
- [ ] AC-A3.3.2: Below the progress bar, shows a list of PI-specific intake fields with captured/total counts and individual percentage bars.
- [ ] AC-A3.3.3: Fields are sorted by completeness ascending (worst first) to highlight gaps.
- [ ] AC-A3.3.4: If a drop-off step is identified, it is highlighted with an amber warning icon and text.
- [ ] AC-A3.3.5: A "Review intake script" link navigates to the intake configuration page (or a future experiments page).

---

## Feature B: Case Detail -- Summary Tab

### B.1 AI-Generated Case Snapshot

**Description:** A 2-3 sentence AI-generated summary of the case displayed at the top of the Summary Tab, written in professional legal intake language.

**Acceptance Criteria:**

- [ ] AC-B1.1: The case snapshot appears at the top of the Summary Tab within a visually distinct card (light background, left blue border accent).
- [ ] AC-B1.2: The snapshot is 2-3 sentences maximum, written in legal intake language (e.g., "Caller reports a rear-end collision..." not "The customer called about...").
- [ ] AC-B1.3: The snapshot includes a "Generated by AI" label with a timestamp showing when it was last generated.
- [ ] AC-B1.4: A "Regenerate" button allows the user to request a new AI summary. The button shows a loading spinner during regeneration.
- [ ] AC-B1.5: If no AI summary is available (pipeline not yet run), an empty state displays: "AI summary will be available once the call has been processed." with a "Generate now" button.
- [ ] AC-B1.6: The snapshot text is selectable and copyable.
- [ ] AC-B1.7: If the AI pipeline returns an error, the snapshot area displays: "Unable to generate summary. The AI pipeline encountered an error." with a "Retry" button. No stack traces or raw error objects are shown.

### B.2 Key Moments List

**Description:** A timestamped list of significant moments extracted from the call, displayed below the case snapshot.

**Acceptance Criteria:**

- [ ] AC-B2.1: Each key moment displays: timestamp (MM:SS format), moment text (1-2 sentences), and a sentiment indicator (positive = green dot, neutral = gray dot, negative = red dot).
- [ ] AC-B2.2: Moments are sorted chronologically by timestamp.
- [ ] AC-B2.3: Each moment is visually separated with subtle dividers or card boundaries.
- [ ] AC-B2.4: If no key moments are available, an empty state displays: "No key moments identified." with contextual text explaining that moments are extracted from calls longer than 30 seconds.
- [ ] AC-B2.5: The sentiment indicator includes a tooltip showing the sentiment label ("positive", "neutral", "negative") on hover/long-press.
- [ ] AC-B2.6: Key moments list supports a maximum of 20 items. If more are available, a "Show all X moments" expansion affordance is provided.
- [ ] AC-B2.7: (Future-ready) Each moment timestamp is rendered as a tappable element. Currently it does nothing, but the component accepts an `onTimestampClick` callback prop for future audio playback linking.

### B.3 Completeness Checklist

**Description:** A visual checklist showing which PI-specific intake fields have been captured versus which are still missing.

**Fields Tracked (PI Practice Area):**

| Field | Label | Required for Qualification |
|---|---|---|
| callerName | Caller Name | Yes |
| phone | Phone Number | Yes |
| incidentDate | Incident Date | Yes |
| incidentLocation | Incident Location | Yes |
| injuryDescription | Injury Description | Yes |
| atFault | At-Fault Party | No |
| medicalTreatment | Medical Treatment | Yes |
| insuranceInfo | Insurance Info | No |
| priorAttorney | Prior Attorney | No |
| statuteOfLimitations | Statute Check | No |

**Acceptance Criteria:**

- [ ] AC-B3.1: The completeness checklist displays all tracked fields as a vertical list with checkmark (green) or missing (amber circle) icons.
- [ ] AC-B3.2: Each field row shows: icon (check/missing), field label, and extracted value (if captured) or "Not captured" (if missing).
- [ ] AC-B3.3: A completeness percentage is displayed at the top of the checklist (e.g., "7 of 10 fields captured (70%)").
- [ ] AC-B3.4: Fields required for qualification are visually distinguished (e.g., asterisk or "Required" badge) from optional fields.
- [ ] AC-B3.5: If all required fields are captured, a green success banner appears: "All required intake fields captured."
- [ ] AC-B3.6: If required fields are missing, an amber banner appears: "X required fields missing. Follow up recommended." with action buttons: "Call back" (opens tel: link) and "Send intake form" (placeholder for future feature).
- [ ] AC-B3.7: The checklist reflects the current state of `lead.intakeData` and `intake.answers`, using the same field resolution logic as `IntakeAnalysisCard`.
- [ ] AC-B3.8: Practice area determines which fields are tracked. The default field set is PI. Other practice areas can define their own field sets (data-driven, not hardcoded).

---

## Feature C: Case Detail -- Transcript Tab

### C.1 Speaker-Attributed Transcript

**Description:** A full transcript of the call with clear visual distinction between speakers.

**Acceptance Criteria:**

- [ ] AC-C1.1: The transcript displays utterances in chronological order with speaker labels: "Avery" (the AI agent) and "Caller" (or the caller's name if known).
- [ ] AC-C1.2: Avery's utterances are styled with a blue-tinted background and left-aligned. Caller utterances are styled with a gray background and left-aligned (no right-alignment chat bubble pattern -- this is a transcript, not a chat).
- [ ] AC-C1.3: Each utterance block displays: speaker label, timestamp (MM:SS), and the utterance text.
- [ ] AC-C1.4: Utterance blocks are visually separated by 8px vertical spacing.
- [ ] AC-C1.5: If the transcript is not yet available (processing), a loading state displays: "Transcript is being generated..." with a progress indicator or spinner.
- [ ] AC-C1.6: If the transcript failed to generate, an error state displays: "Transcript could not be generated." with a "Retry" button.
- [ ] AC-C1.7: If no call recording exists for this case, the Transcript Tab shows: "No call recording available for this case." with no retry option.
- [ ] AC-C1.8: Long transcripts (>100 utterances) use virtualized scrolling to maintain performance.

### C.2 Timestamps

**Acceptance Criteria:**

- [ ] AC-C2.1: Each utterance block displays a timestamp in MM:SS format, representing the elapsed time from the start of the call.
- [ ] AC-C2.2: Timestamps are displayed in a muted foreground color to the left of or above the utterance text.
- [ ] AC-C2.3: Timestamps are monotonically increasing.
- [ ] AC-C2.4: (Future-ready) Timestamp elements accept an `onTimestampClick` callback prop for future audio playback integration.

### C.3 Search with Highlight

**Acceptance Criteria:**

- [ ] AC-C3.1: A search input is available at the top of the Transcript Tab.
- [ ] AC-C3.2: As the user types (debounced by 300ms), all matching text within the transcript is highlighted with a yellow background.
- [ ] AC-C3.3: A match count indicator displays "X of Y matches" next to the search input.
- [ ] AC-C3.4: Up/down arrow buttons (or keyboard shortcuts) navigate between matches, scrolling the transcript to center the current match.
- [ ] AC-C3.5: The current match is highlighted with a distinct color (orange) while other matches remain yellow.
- [ ] AC-C3.6: Clearing the search input removes all highlights and resets the match counter.
- [ ] AC-C3.7: Search is case-insensitive.
- [ ] AC-C3.8: Search matches across speaker labels, timestamps, and utterance text.

### C.4 Copy/Export Functionality

**Acceptance Criteria:**

- [ ] AC-C4.1: A "Copy" button is available in the transcript header area. Clicking it copies the full transcript to the clipboard in plain text format with speaker labels and timestamps.
- [ ] AC-C4.2: Copy format:
  ```
  [00:00] Avery: Thank you for calling Demo Law Firm. My name is Avery...
  [00:15] Caller: Hi, I was in a car accident last week and...
  ```
- [ ] AC-C4.3: A "Download" button exports the transcript as a `.txt` file named `transcript-{caseId}-{date}.txt`.
- [ ] AC-C4.4: After copy, a toast notification confirms: "Transcript copied to clipboard."
- [ ] AC-C4.5: If the transcript is empty or not available, copy/download buttons are disabled with a tooltip explanation.

---

## Feature D: Navigation Overhaul

### D.1 Sidebar Restructure

**Description:** Replace the current sidebar group structure to better match user workflows.

**Current Structure:**
```
Main:        Home, Cases
Firm Ops:    Safety Checks, Integrations, Inquiries
Intake Lab:  Experiments
System:      Activity Log (admin only)
```

**New Structure:**
```
Main:        Home (Command Center), Cases
Insights:    Analytics (future), Intake Health
Tasks:       Follow-ups, Safety Checks
Settings:    Integrations, Team (future)
System:      Activity Log (admin only)
```

**Acceptance Criteria:**

- [ ] AC-D1.1: The sidebar group "Firm Ops" is removed and replaced with "Insights" and "Tasks".
- [ ] AC-D1.2: "Insights" group contains: "Intake Health" (links to the intake health analytics view, initially the same data as the analytics panel on the Command Center).
- [ ] AC-D1.3: "Tasks" group contains: "Follow-ups" (links to follow-up sequences management) and "Safety Checks" (existing policy tests page).
- [ ] AC-D1.4: "Experiments" is removed from the primary sidebar navigation. It remains accessible via a direct URL (`/experiments`) but is not in the nav. A redirect or link from the Intake Health page may reference it.
- [ ] AC-D1.5: "Settings" group contains: "Integrations" (existing webhooks page). "Team" is listed but can be a placeholder page for the initial release.
- [ ] AC-D1.6: All existing pages remain accessible via their current URLs (no breaking URL changes).
- [ ] AC-D1.7: Active state highlighting works correctly for all new nav items.

### D.2 Mobile Navigation Update

**Description:** Update the mobile bottom navigation to reflect the new structure.

**Current Mobile Nav:** Home, Cases, Menu
**New Mobile Nav:** Home, Cases, Menu (unchanged -- Menu page updated to reflect new nav structure)

**Acceptance Criteria:**

- [ ] AC-D2.1: The mobile bottom navigation retains 3 items: Home, Cases, Menu.
- [ ] AC-D2.2: The Menu page (`menu.tsx`) is updated to reflect the new sidebar structure: Insights, Tasks, Settings sections with the same items as the sidebar.
- [ ] AC-D2.3: The "Experiments" item is not visible on the Menu page.
- [ ] AC-D2.4: All menu items on the Menu page navigate to the correct routes.

---

## Feature E: Data Pipeline

### E.1 LLM Summarization Module

**Description:** A backend module that takes a call transcript and produces a structured case summary for the Summary Tab.

**Input:** Call transcript (array of `{speaker, timestamp, text}` objects) + lead metadata (practice area, existing intake data).

**Output:**
```typescript
interface CaseSummary {
  narrative: string;          // 2-3 sentence case snapshot
  generatedAt: string;        // ISO timestamp
  modelId: string;            // e.g., "anthropic/claude-3-haiku"
  confidence: number;         // 0.0 - 1.0
}
```

**Acceptance Criteria:**

- [ ] AC-E1.1: The summarization module accepts a call transcript and returns a `CaseSummary` object.
- [ ] AC-E1.2: The narrative is constrained to a maximum of 3 sentences and 300 characters.
- [ ] AC-E1.3: The narrative is written in professional legal intake language appropriate to the practice area.
- [ ] AC-E1.4: The module includes a system prompt that instructs the LLM to: identify the caller's legal situation, note key facts (injury type, incident details, parties involved), and flag any urgency indicators.
- [ ] AC-E1.5: The module has a configurable timeout (default: 30 seconds). If the LLM does not respond within the timeout, the module returns a structured error.
- [ ] AC-E1.6: The module logs the model ID and token count for each request (for cost tracking).
- [ ] AC-E1.7: The summary is stored in a new `case_summaries` table (or as a JSON column on the `leads` table, per data model decision) and is retrievable via a GET endpoint.
- [ ] AC-E1.8: The module is idempotent: calling it again for the same call ID overwrites the previous summary.

### E.2 Sentiment Analysis

**Description:** A module that analyzes the sentiment of each utterance in a call transcript and produces per-utterance and per-call sentiment scores.

**Input:** Call transcript (array of `{speaker, timestamp, text}` objects).

**Output:**
```typescript
interface SentimentResult {
  overall: "positive" | "neutral" | "negative";
  overallScore: number;       // -1.0 to 1.0
  utterances: Array<{
    index: number;
    sentiment: "positive" | "neutral" | "negative";
    score: number;            // -1.0 to 1.0
  }>;
}
```

**Acceptance Criteria:**

- [ ] AC-E2.1: The sentiment module processes each utterance and assigns a sentiment label and score.
- [ ] AC-E2.2: The overall sentiment is computed as the weighted average of utterance sentiments, weighted by utterance length (word count).
- [ ] AC-E2.3: Sentiment classification thresholds: score > 0.2 = positive, score < -0.2 = negative, otherwise neutral.
- [ ] AC-E2.4: The module can operate on the full transcript in a single LLM call (batch mode) or per-utterance (streaming mode). Batch mode is the default for cost efficiency.
- [ ] AC-E2.5: Sentiment results are stored alongside the transcript data and retrievable via the transcript GET endpoint.
- [ ] AC-E2.6: The module handles empty transcripts gracefully, returning `overall: "neutral"` with an empty utterances array.

### E.3 Key Moment Extraction

**Description:** A module that identifies significant moments within a call transcript and produces a structured list of key moments.

**Input:** Call transcript + practice area context.

**Output:**
```typescript
interface KeyMoment {
  timestamp: string;          // "MM:SS" format
  text: string;               // 1-2 sentence description
  category: "fact" | "concern" | "objection" | "commitment" | "question" | "urgency";
  sentiment: "positive" | "neutral" | "negative";
  utteranceIndex: number;     // index into transcript array
}

interface KeyMomentsResult {
  moments: KeyMoment[];
  extractedAt: string;        // ISO timestamp
}
```

**Acceptance Criteria:**

- [ ] AC-E3.1: The module extracts between 3-10 key moments per call, depending on call length.
- [ ] AC-E3.2: For calls shorter than 30 seconds, the module returns an empty moments array (no extraction attempted).
- [ ] AC-E3.3: Moment categories are practice-area-aware. For PI, the extraction prompt emphasizes: injury details, accident circumstances, insurance information, medical treatment, liability indicators, and statute of limitations concerns.
- [ ] AC-E3.4: Each moment includes a sentiment classification consistent with the sentiment module output.
- [ ] AC-E3.5: Moments are sorted by timestamp ascending.
- [ ] AC-E3.6: The module includes the `utteranceIndex` to enable future transcript-to-moment linking.
- [ ] AC-E3.7: Key moments are stored in a new `key_moments` table (or as a JSON array on the call record) and retrievable via a GET endpoint.

### E.4 Rule-Based Fallback

**Description:** When the LLM pipeline is unavailable, slow, or returns an error, a rule-based fallback system provides basic extraction using pattern matching and keyword detection.

**Acceptance Criteria:**

- [ ] AC-E4.1: The fallback system activates automatically if the LLM pipeline times out (>30s) or returns an error.
- [ ] AC-E4.2: The fallback extracts the following fields using regex and keyword matching:
  - Phone number (E.164 pattern)
  - Caller name (from greeting patterns: "my name is...", "this is...")
  - Incident date (date patterns: "last week", "January 15", "on the 3rd")
  - Injury keywords (mapping common terms to injury descriptions)
  - Insurance mentions (company name patterns)
- [ ] AC-E4.3: Fallback-generated summaries are marked with a `"source": "rule-based"` flag (vs. `"source": "llm"`) so the UI can display a "basic analysis" indicator.
- [ ] AC-E4.4: Fallback-generated key moments are limited to keyword-based detection (e.g., any utterance containing "injury", "pain", "accident", "insurance", "attorney") and are marked with `category: "fact"` and `sentiment: "neutral"`.
- [ ] AC-E4.5: The fallback system does not call any external APIs and completes within 500ms.
- [ ] AC-E4.6: When the LLM pipeline becomes available again, previously fallback-processed calls can be reprocessed via the "Regenerate" button on the Summary Tab.

---

## Feature F: P0 Quality Requirements

### F.1 No Raw JSON in Production

**Description:** No page in the application may display raw JSON, unformatted API responses, JavaScript object notation, or `[object Object]` to the user.

**Acceptance Criteria:**

- [ ] AC-F1.1: The `IntakeAnalysisCard` component handles all data shapes (object, JSON string, null, undefined, malformed) without rendering raw JSON. This is already implemented but must be verified via automated tests.
- [ ] AC-F1.2: The Case Detail page does not render `lead.intakeData` directly. All intake data passes through the `getIntakeDisplayData` utility.
- [ ] AC-F1.3: Error responses from the API are displayed as human-readable messages, never as raw JSON response bodies.
- [ ] AC-F1.4: The `DebugPayload` component (in `intake-analysis-card.tsx`) is only visible when `import.meta.env.DEV === true` AND `VITE_SHOW_DEBUG_PAYLOAD === "1"`. It must not be visible in any production or staging build.
- [ ] AC-F1.5: A lint rule or build-time check prevents `JSON.stringify` from being used in JSX rendering expressions outside of designated debug components.

### F.2 Phone Always Persisted and Shown

**Description:** The caller's phone number must be captured from the first interaction and displayed consistently throughout the application.

**Acceptance Criteria:**

- [ ] AC-F2.1: When a Twilio voice webhook is received at `/v1/telephony/twilio/voice`, the `From` field is persisted to `contact.primaryPhone` if the contact's `primaryPhone` is null. An existing non-null `primaryPhone` is never overwritten with null.
- [ ] AC-F2.2: The `getBestPhone` utility function (in `case-detail.tsx` and similar) checks the following sources in priority order: `contact.primaryPhone`, `intakeData.phoneNumber`, `intakeData.callerPhone`, `intakeData.phone`, `intakeData.from`, `intakeData.fromNumber`, `intakeData.caller.phone`, `intakeData.caller.phoneNumber`.
- [ ] AC-F2.3: Every case list item (in `cases.tsx`) displays a phone number if one is available from any source.
- [ ] AC-F2.4: The Case Detail header always shows the phone number (formatted) if available, with a tap-to-call action.
- [ ] AC-F2.5: The Command Center intake feed items display the phone number.
- [ ] AC-F2.6: If no phone number is available from any source, the UI displays "No phone" in muted text -- never a blank space, null, or undefined.

### F.3 Graceful Empty States

**Description:** Every section of the application that can be empty must display a purposeful empty state with context and a call to action.

**Acceptance Criteria:**

| Component | Empty State Text | Call to Action |
|---|---|---|
| Command Center KPI strip (no data) | "No intake data for this period." | "Adjust the date range or check that Avery is connected." |
| Intake Feed (no leads) | "No intakes yet. New calls and form submissions will appear here." | "Set up your phone number" (link to setup) |
| Source ROI (no data) | "No source data available for this period." | None (informational) |
| Conversion Funnel (no data) | "Not enough data to display the funnel." | "Intakes will populate this chart automatically." |
| Intake Health (no intakes) | "No completed intakes to analyze." | None (informational) |
| Case Snapshot (not generated) | "AI summary will be available once the call has been processed." | "Generate now" button |
| Key Moments (none) | "No key moments identified for this call." | Contextual: "Moments are extracted from calls longer than 30 seconds." |
| Transcript (not available) | "No call recording available for this case." | None |
| Transcript (processing) | "Transcript is being generated..." | Spinner/progress indicator |
| Completeness Checklist (no intake) | "No intake data captured yet." | "Start intake" button |
| Interaction Timeline (none) | "No interactions yet." | Icon + muted text (existing pattern) |

- [ ] AC-F3.1: Every empty state listed above is implemented with the specified text and call to action.
- [ ] AC-F3.2: No empty state displays: blank white space, "undefined", "null", "No data", or a generic "Error" without context.
- [ ] AC-F3.3: Empty states use the existing design pattern: centered icon (muted, 32x32), descriptive text (text-sm text-muted-foreground), and optional action button below.
- [ ] AC-F3.4: Empty states are responsive and look correct on both mobile and desktop.

### F.4 Accessibility

**Description:** The dashboard overhaul must meet WCAG 2.1 AA compliance for keyboard navigation and focus management.

**Acceptance Criteria:**

- [ ] AC-F4.1: All interactive elements (buttons, links, KPI cards, feed items, tab selectors, search inputs) are reachable via keyboard Tab navigation in a logical order.
- [ ] AC-F4.2: Focused elements display a visible focus ring (2px solid, primary color, 2px offset) that meets the 3:1 contrast ratio against adjacent backgrounds.
- [ ] AC-F4.3: The Summary/Transcript tab switcher is keyboard-operable: Tab to reach the tab bar, arrow keys to switch between tabs, Enter/Space to activate.
- [ ] AC-F4.4: KPI cards have `role="group"` with `aria-label` describing the metric (e.g., `aria-label="New Cases: 42, up 12%"`).
- [ ] AC-F4.5: The transcript search input has `aria-label="Search transcript"` and the match count indicator has `aria-live="polite"` so screen readers announce match count changes.
- [ ] AC-F4.6: Sentiment indicators (colored dots) include screen-reader-only text (`sr-only` class) with the sentiment label.
- [ ] AC-F4.7: Loading states include `aria-busy="true"` on the container and skeleton elements have `aria-hidden="true"`.
- [ ] AC-F4.8: Color is never the sole means of conveying information. Sentiment uses color + icon shape + tooltip text. Status badges use color + text label.

---

## Data Model Changes

### New Tables / Columns

```sql
-- Option A: Separate tables (recommended for query flexibility)

CREATE TABLE case_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  narrative TEXT NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'llm',  -- 'llm' | 'rule-based'
  model_id VARCHAR(100),
  confidence DECIMAL(3,2),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id)  -- one summary per lead, overwritten on regeneration
);

CREATE TABLE key_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  timestamp_seconds INTEGER NOT NULL,
  text TEXT NOT NULL,
  category VARCHAR(20) NOT NULL,  -- 'fact' | 'concern' | 'objection' | 'commitment' | 'question' | 'urgency'
  sentiment VARCHAR(10) NOT NULL DEFAULT 'neutral',  -- 'positive' | 'neutral' | 'negative'
  sentiment_score DECIMAL(4,3),   -- -1.000 to 1.000
  utterance_index INTEGER,
  source VARCHAR(20) NOT NULL DEFAULT 'llm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  utterances JSONB NOT NULL,  -- [{speaker, timestamp, text, sentiment, sentimentScore}]
  overall_sentiment VARCHAR(10),
  overall_sentiment_score DECIMAL(4,3),
  source VARCHAR(20) NOT NULL DEFAULT 'llm',
  model_id VARCHAR(100),
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'complete' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(call_id)
);

CREATE INDEX idx_case_summaries_lead ON case_summaries(lead_id);
CREATE INDEX idx_key_moments_lead ON key_moments(lead_id);
CREATE INDEX idx_key_moments_call ON key_moments(call_id);
CREATE INDEX idx_transcripts_call ON transcripts(call_id);
CREATE INDEX idx_transcripts_status ON transcripts(processing_status);
```

---

## API Surface Changes

### New Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/v1/leads/:id/summary` | Get AI-generated case summary |
| POST | `/v1/leads/:id/summary/generate` | Trigger summary generation |
| GET | `/v1/leads/:id/moments` | Get key moments for a lead |
| GET | `/v1/calls/:id/transcript` | Get speaker-attributed transcript |
| POST | `/v1/calls/:id/transcript/generate` | Trigger transcript generation |
| GET | `/v1/analytics/command-center` | Get all Command Center data (KPI strip + feed + analytics) |

### Modified Endpoints

| Method | Path | Change |
|---|---|---|
| GET | `/v1/leads/:id` | Add `summary`, `moments` as optional includes (via `?include=summary,moments`) |
| GET | `/v1/leads` | Add `summary` snippet (first sentence only) in list response |
| GET | `/v1/analytics/pi-dashboard` | Deprecate in favor of `/v1/analytics/command-center`. Keep functional for backward compatibility. |

### Command Center Response Shape

```typescript
interface CommandCenterResponse {
  kpiStrip: {
    newCases: { value: number; trend: number; trendDirection: "up" | "down" | "flat" };
    qualified: { value: number; trend: number; trendDirection: "up" | "down" | "flat" };
    responseTime: { value: number | null; unit: "minutes"; trend: number; trendDirection: "up" | "down" | "flat" };
    consults: { value: number; trend: number; trendDirection: "up" | "down" | "flat" };
    retainers: { value: number; trend: number; trendDirection: "up" | "down" | "flat" };
    signed: { value: number; trend: number; trendDirection: "up" | "down" | "flat" };
  };
  intakeFeed: Array<{
    id: string;
    displayName: string;
    phone: string | null;
    source: string;
    status: string;
    practiceArea: string | null;
    createdAt: string;
    summarySnippet: string | null;
  }>;
  sourceROI: Array<{
    source: string;
    calls: number;
    qualified: number;
    signed: number;
    qualifiedRate: number;
    signedRate: number;
  }>;
  conversionFunnel: Array<{
    stage: string;
    count: number;
    conversionFromPrevious: number | null;
  }>;
  intakeCompleteness: {
    overallPercentage: number;
    fields: Array<{
      field: string;
      label: string;
      captured: number;
      total: number;
      percentage: number;
    }>;
    dropOffStep: string | null;
  };
  periodStart: string;
  periodEnd: string;
}
```

---

## Migration & Rollout Plan

### Phase 1: Data Pipeline Foundation (Week 1-2)

1. Create database migrations for `case_summaries`, `key_moments`, and `transcripts` tables.
2. Implement LLM summarization module with rule-based fallback.
3. Implement sentiment analysis module.
4. Implement key moment extraction module.
5. Add new API endpoints for summary, moments, and transcript CRUD.
6. Wire up automatic pipeline triggering when a call recording is received.

### Phase 2: Command Center (Week 2-3)

1. Implement `/v1/analytics/command-center` endpoint.
2. Build Command Center page replacing `pi-dashboard.tsx`.
3. Implement KPI strip component with date range selector.
4. Implement intake feed component.
5. Implement analytics panel (source ROI, conversion funnel, intake health).
6. Verify all empty states and loading states.

### Phase 3: Case Detail Overhaul (Week 3-4)

1. Refactor Case Detail page to use tabbed layout (Summary | Transcript).
2. Build Summary Tab with case snapshot, key moments, and completeness checklist.
3. Build Transcript Tab with speaker attribution, search, and export.
4. Integrate with data pipeline endpoints.
5. Verify all empty states, error states, and loading states.

### Phase 4: Navigation & Polish (Week 4)

1. Restructure sidebar navigation (Insights, Tasks, Settings groups).
2. Update mobile Menu page.
3. P0 quality audit: no raw JSON, phone persistence, empty states, accessibility.
4. Run `./scripts/verify` and ensure all checks pass.
5. Cross-browser and mobile testing.

### Phase 5: Validation (Week 5)

1. Demo data generation for all new features.
2. Smoke test updates for new endpoints.
3. Accessibility audit (keyboard nav, focus states, screen reader testing).
4. Performance testing (Command Center load time < 2s, transcript rendering for 500+ utterances).
5. Final review and merge request.

---

*This PRD is a living document. Acceptance criteria may be refined during implementation. All changes must pass `./scripts/verify` before merge.*
