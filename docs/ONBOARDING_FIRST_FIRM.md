# Onboarding Your First Firm

Provision a complete law-firm tenant (Organization, Admin User, Phone Number, OrgSettings, Practice Areas) with a single command.

## Prerequisites

- `DATABASE_URL` pointing to the CaseCurrent PostgreSQL instance
- A Twilio phone number already provisioned in your Twilio account

## Quick Start

```bash
DATABASE_URL="postgresql://..." \
ORG_NAME="Smith & Associates" \
ADMIN_EMAIL="admin@smithlaw.com" \
FIRM_PHONE_E164="+15551234567" \
npm run seed:firm
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ORG_NAME` | Yes | — | Firm display name (slug auto-derived) |
| `ADMIN_EMAIL` | Yes | — | Login email for the firm owner |
| `ADMIN_PASSWORD` | No | Auto-generated (printed to stdout) | Min 8 characters |
| `ADMIN_NAME` | No | Derived from email | Display name for the admin user |
| `FIRM_PHONE_E164` | Yes | — | Phone in E.164 format (`+15551234567`) |
| `ORG_TIMEZONE` | No | `America/New_York` | IANA timezone |
| `DEFAULT_PRACTICE_AREAS` | No | `Personal Injury,Criminal Defense,Family Law` | Comma-separated list |
| `BUSINESS_HOURS` | No | Mon-Fri 9:00-17:00 | JSON object (see schema below) |

### Business Hours JSON format

```json
{
  "monday":    { "open": "09:00", "close": "17:00" },
  "tuesday":   { "open": "09:00", "close": "17:00" },
  "wednesday": { "open": "09:00", "close": "17:00" },
  "thursday":  { "open": "09:00", "close": "17:00" },
  "friday":    { "open": "09:00", "close": "17:00" },
  "saturday":  null,
  "sunday":    null
}
```

## Idempotency

The script is safe to re-run. All records use `upsert` — running twice with the same inputs produces the same result with no duplicates.

The one safety check: if `FIRM_PHONE_E164` already belongs to a **different** organization, the script errors out rather than reassigning it.

## Verification

After running, confirm the tenant exists:

```sql
SELECT o.name, o.slug, p.e164
FROM organizations o
JOIN phone_numbers p ON p.org_id = o.id
WHERE o.slug = 'smith-associates';
```

Or log in at the web UI with the printed admin credentials.
