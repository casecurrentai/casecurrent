# Call Ingestion Resilience Fix

**Date:** 2026-03-04
**Status:** Merged to main
**Branch:** fix/call-ingestion-resilience (see MR)

---

## Problem Summary

Production calls and transcripts were unreliable / missing in the dashboard because of four structural bugs in the Twilio + ElevenLabs ingestion pipeline.

---

## Root Causes and Fixes

### INV-1 · Race: `processCallEnd` exits early if `leadId`/`orgId` are null

**Before:** `scheduleFinalize` polled `createdLeadId` in a closure for up to 10 × 500 ms. If the in-memory variable still wasn't set when retries exhausted, `processCallEnd` returned immediately with a `no_lead_id` skip — **permanently dropping transcript and lead enrichment**.

**After:** `processCallEnd` now does a DB lookup by `twilioCallSid` when `leadId`/`orgId` are absent from the closure. The Call row was already created by the Twilio voice webhook handler (routes.ts), so the lookup almost always succeeds. `scheduleFinalize` no longer retries in a loop — it fires once after a short delay (to let in-flight OpenAI transcriptions land), then delegates the race resolution to `processCallEnd`.

**Files:** `server/telephony/twilio/streamHandler.ts`

---

### INV-2 · Short transcripts silently skipped — "ghost calls"

**Before:** If `fullTranscript.length < 20`, `processCallEnd` returned before step 7 (`transcript_store`). The Call row never got `transcriptText` or `transcriptJson`. Dashboard showed no call artifact even though a Call row existed.

**After:**
1. Transcript quality is classified as `ok` / `short` / `empty` and stored in the new `Call.transcriptQuality` field.
2. The transcript (even a short one) is **always persisted on the Call row** before deciding whether to proceed to extraction.
3. Short/empty transcripts skip AI extraction but mark `Call.status = 'finalized'` so the dashboard can show the call with a "Transcript unavailable" label.

**Files:** `server/telephony/twilio/streamHandler.ts`, `apps/api/prisma/schema.prisma`, migration

---

### INV-3 · Idempotency false positive prevents webhook retry

**Before:** `checkIdempotency` inserted a `WebhookEvent` row **before** any DB work. If the subsequent DB write failed, the error handler returned HTTP 500 but the `WebhookEvent` row remained — so ElevenLabs' next retry hit the duplicate-key guard and was silently skipped.

**After:** The `elevenlabs.ts` catch block calls the new `rollbackIdempotency()` helper (in `shared.ts`) which deletes the `WebhookEvent` row, allowing the next ElevenLabs retry to process it fresh. The IngestionOutcome row with `status: 'failed'` is still written for observability.

**Files:** `server/webhooks/shared.ts`, `server/webhooks/elevenlabs.ts`

---

### INV-4 · `UNLINKED_ELEVENLABS_CALL` discarded data

**Before:** When `findCallByCorrelation` failed, the payload was logged to `IngestionOutcome` as `status: 'skipped'` and returned 200. The data was effectively lost with no retry path.

**After:**
1. Unresolvable payloads are persisted in the new `UnlinkedPostCall` table with the raw payload and extracted correlation keys (`twilioCallSid`, `elevenLabsConvId`, `interactionId`).
2. A background reconciliation job (`server/jobs/reconcileUnlinkedPostCalls.ts`) runs every 60 seconds, searching for newly created Call rows using the stored keys. When found, it applies the transcript/summary to the Call.
3. Returns HTTP 202 (Accepted/Parked) instead of 200.

**Files:** `server/webhooks/elevenlabs.ts`, `server/jobs/reconcileUnlinkedPostCalls.ts`, `server/index.ts`, `apps/api/prisma/schema.prisma`, migration

---

## Schema Changes

### `calls` table — new columns

| Column | Type | Purpose |
|---|---|---|
| `status` | `TEXT DEFAULT 'active'` | `active` → `ended` → `finalized` \| `failed` |
| `finalized_at` | `TIMESTAMPTZ` | Timestamp of successful finalization |
| `last_finalize_error` | `TEXT` | Error message from last failed finalization attempt |
| `transcript_quality` | `TEXT` | `ok` \| `short` \| `empty` — dashboard label |

### New table: `unlinked_post_calls`

Parking lot for provider post-call payloads that could not be matched to a Call row at ingestion time. Columns: `id`, `received_at`, `provider`, `twilio_call_sid`, `elevenlabs_conv_id`, `interaction_id`, `raw_payload_json`, `correlation_keys_json`, `last_retry_at`, `retry_count`, `resolved_call_id`, `resolved_at`, `created_at`.

**Migration:** `apps/api/prisma/migrations/20260304000000_call_ingestion_resilience/migration.sql`

> ⚠️ Run the migration against production before deploying the server code.

---

## Standardized Log Tags

| Tag | Meaning |
|---|---|
| `[FINALIZE_ENQUEUE]` | scheduleFinalize queued |
| `[FINALIZE_START]` | processCallEnd invoked |
| `[FINALIZE_DB_LOOKUP]` | Attempting DB lookup for leadId |
| `[FINALIZE_DB_LOOKUP_OK]` | leadId resolved from DB |
| `[FINALIZE_DB_LOOKUP_ERROR]` | DB lookup failed |
| `[FINALIZE_OK]` | Full enrichment pipeline succeeded |
| `[FINALIZE_ERROR]` | Enrichment failed (step name included) |
| `[FINALIZE_SKIP]` | Intentional skip with reason |
| `[TRANSCRIPT_UPSERT_OK]` | Transcript persisted (quality logged) |
| `[ELEVENLABS_CORRELATE_OK]` | Post-call matched to Call row |
| `[ELEVENLABS_UNLINKED_PARKED]` | Payload parked in unlinked_post_calls |
| `[ELEVENLABS_APPLY_OK]` | Post-call data applied to Call |
| `[ELEVENLABS_APPLY_ERROR]` | Post-call application failed |
| `[RECONCILE_START]` | Reconciliation batch started |
| `[RECONCILE_RESOLVED]` | Unlinked payload matched and applied |
| `[RECONCILE_DONE]` | Reconciliation batch complete |

---

## Test Plan

### Manual reproduction steps

**A. Short call — transcript quality preserved**
1. Call the number and hang up after 2 seconds.
2. Check DB: `SELECT status, transcript_quality, transcript_text FROM calls WHERE twilio_call_sid = '<sid>';`
3. Expected: `status = 'finalized'`, `transcript_quality = 'short'` or `'empty'`, call row exists.
4. Dashboard should show call row with "Transcript unavailable" label (not missing).

**B. Stream websocket ends before lead creation**
1. Simulate by temporarily inserting a `await new Promise(r => setTimeout(r, 10000))` after the `start` event DB lookup and before setting `createdLeadId`.
2. Trigger a call that hangs up quickly.
3. Check logs for `[FINALIZE_DB_LOOKUP_OK]` — verifies DB fallback activated.
4. Verify transcript is stored on Call row.

**C. ElevenLabs post-call before Call exists**
1. POST to `/v1/webhooks/elevenlabs/post-call` with a `conversation_id` that has no matching Call row.
2. Expected: HTTP 202, row inserted in `unlinked_post_calls`.
3. Create the matching Call row (via normal inbound webhook).
4. Wait up to 60 seconds for reconciliation loop.
5. Verify: `unlinked_post_calls.resolved_at` is set, `calls.transcript_text` populated.

### Automated tests

`server/__tests__/callIngestion.test.ts` — 6 tests, run with `npm test`:

- INV-1: Call upsert keyed by `twilioCallSid` is idempotent (2 cases)
- INV-2: processCallEnd resolves `leadId` from DB when not in closure (1 case)
- INV-3: Idempotency rollback deletes WebhookEvent on error (1 case)
- INV-4: Correlation failure parks in UnlinkedPostCall; success does not park (2 cases)

---

## Files Changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Add `Call.status/finalizedAt/lastFinalizeError/transcriptQuality`; add `UnlinkedPostCall` model |
| `apps/api/prisma/migrations/20260304000000_call_ingestion_resilience/migration.sql` | New migration |
| `server/telephony/twilio/streamHandler.ts` | Fix `processCallEnd` DB fallback; fix transcript short-circuit; add status tracking; fix `scheduleFinalize` |
| `server/webhooks/elevenlabs.ts` | Park unlinked payloads; rollback idempotency on error; add log tags |
| `server/webhooks/shared.ts` | Add `rollbackIdempotency()` |
| `server/jobs/reconcileUnlinkedPostCalls.ts` | New reconciliation job |
| `server/index.ts` | Start reconciliation loop on boot |
| `server/routes.ts` | Add `status` and `transcriptQuality` to `/v1/leads/:id/calls` response |
| `server/__tests__/callIngestion.test.ts` | New automated tests |
| `package.json` | Include `server/__tests__` in test glob |
| `docs/CALL_INGESTION_FIX.md` | This document |
