# Call Trace Debugging Runbook

When a call "vanishes" between webhook receipt and dashboard rendering, use this 3-minute workflow to identify exactly where in the pipeline it failed.

## 1. Identify the Call

Every call has at least one provider-assigned ID that serves as the **traceId**:

| Provider | ID field | Example |
|----------|----------|---------|
| Twilio | `CallSid` | `CA1234abcd...` |
| Vapi | `call.id` | `uuid-from-vapi` |
| ElevenLabs | `conversation_id` | `conv_abc123` |
| OpenAI Realtime | `call_id` | `call_xyz789` |

The `traceId` is whichever of these IDs is available. It's persisted on the Call record as `providerCallId`, `twilioCallSid`, or `elevenLabsId`.

## 2. Hit the Debug Endpoint

```
GET /v1/debug/call-lookup?callSid=<id>
Authorization: Bearer <jwt>
```

Also accepts `?callId=`, `?leadId=`, `?elevenLabsId=`, or `?phone=`.

Requires a valid JWT. Results are scoped to the caller's org (platform admins see all).

## 3. Read the Pipeline Checklist

The response includes a `pipeline` object showing each step:

```json
{
  "traceId": "CA1234abcd...",
  "pipeline": {
    "webhookReceived": true,
    "orgResolved": true,
    "contactCreated": true,
    "leadCreated": true,
    "interactionCreated": true,
    "callPersisted": true,
    "transcriptPresent": false,
    "aiSummaryPresent": false,
    "recordingPresent": false,
    "dashboardVisible": true
  }
}
```

**The first `false` value identifies the failure point.**

### Interpreting Each Step

| Step | What it means when `false` |
|------|---------------------------|
| `webhookReceived` | No webhook event or receipt found. Check provider dashboard for delivery failures. |
| `orgResolved` | Phone number not in `phone_numbers` table with `inbound_enabled=true`, or missing `VAPI_DEFAULT_ORG_ID`. |
| `contactCreated` | Contact creation failed (DB constraint or missing org). |
| `leadCreated` | Lead creation failed after contact was created. |
| `interactionCreated` | Interaction creation failed. Check DB logs for constraint errors. |
| `callPersisted` | Call record was not written. For OpenAI, check `call_trace_persist_failed` logs (async write after 200). |
| `transcriptPresent` | Call exists but no transcript text. End-of-call report may not have arrived yet. |
| `aiSummaryPresent` | No AI summary. Check if `/v1/ai/summarize/:callId` was triggered. |
| `recordingPresent` | No recording URL. Check provider recording settings. |
| `dashboardVisible` | Lead exists but dashboard query doesn't see it (org mismatch or user permissions). |

## 4. Common Failure Modes

### Phone number not registered
**Symptom**: `orgResolved: false`
**Fix**: Add the phone number to the `phone_numbers` table with `inbound_enabled=true` for the correct org. Use `seed:firm` CLI or the admin API.

### OpenAI async write failure
**Symptom**: `callPersisted: false` for OpenAI calls
**Cause**: The OpenAI webhook sends 200 before DB writes. `createCallRecords` runs in `setImmediate` and failures are logged but don't block the call.
**Grep**: `tag: "call_trace_persist_failed"` in server logs.

### Vapi chain creation failure
**Symptom**: `orgResolved: false` or `callPersisted: false`
**Grep**: `tag: "vapi_chain_fail"` in server logs for the specific reason.

### ElevenLabs unlinked call
**Symptom**: Post-call webhook received but no matching call found.
**Grep**: `event: "UNLINKED_ELEVENLABS_CALL"` in server logs.

### Org mismatch
**Symptom**: `dashboardVisible: false` but `callPersisted: true`
**Cause**: Call was persisted under a different org than the user is querying from.
**Check**: Compare `call.orgId` with `dashboardQueryDiag.userOrgId` in the debug response.

## 5. Grep Server Logs by traceId

All webhook handlers now emit a `traceId` field in structured JSON logs. To trace a call across all provider boundaries:

```bash
# Search all logs for a specific call
grep '"traceId":"CA1234abcd"' /var/log/app/*.log

# Or with jq for structured output
cat /var/log/app/server.log | grep 'CA1234abcd' | jq '.'
```

### Sample log lines for a successful call flow

```json
{"tag":"twilio_voice_received","traceId":"CA1234abcd","requestId":"A1B2C3","from":"***7890","to":"+18005551234","direction":"inbound"}
{"event":"db_write_success","model":"Call","traceId":"CA1234abcd","callId":"uuid-1","orgId":"org-1","leadId":"lead-1"}
{"tag":"openai_call_records_created","traceId":"CA1234abcd","requestId":"D4E5F6","callId":"call_xyz","orgId":"org-1","step":"createCallRecords"}
{"tag":"openai_realtime_session_started","traceId":"CA1234abcd","requestId":"D4E5F6","callId":"call_xyz","orgId":"org-1","step":"startRealtimeSession"}
```

### Key tags to search for

| Tag | Meaning |
|-----|---------|
| `twilio_voice_received` | Twilio webhook hit the server |
| `vapi_webhook_received` | Vapi webhook hit the server |
| `elevenlabs_inbound_received` | ElevenLabs inbound webhook hit |
| `elevenlabs_postcall_received` | ElevenLabs post-call webhook hit |
| `call_trace_persist_failed` | DB write failed (OpenAI async path) |
| `vapi_chain_fail` | Vapi call chain creation failed |
| `vapi_chain_created` | Vapi call chain created successfully |
| `vapi_eocr_persisted` | Vapi end-of-call report persisted |
| `UNLINKED_ELEVENLABS_CALL` | ElevenLabs post-call had no matching call |
| `db_write_error` | Generic DB write failure |
