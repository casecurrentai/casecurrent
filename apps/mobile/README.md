# CaseCurrent Mobile App (Ops App)

React Native mobile application for law firm operations.

## Features (v1)

- **Inbox**: Prioritized leads needing attention
- **Leads**: Search and filter all leads
- **Lead Detail**: Unified thread view with SMS, calls, and system events
- **Analytics**: Key performance metrics
- **Settings**: Notification preferences and logout

## Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator

### Installation

```bash
cd apps/mobile
npm install
```

### Running the App

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Environment Variables

Create a `.env` file or set in Expo config:

```
EXPO_PUBLIC_API_URL=https://casecurrent.co
EXPO_PUBLIC_WS_URL=wss://casecurrent.co
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/auth/login` | POST | Authenticate user |
| `/v1/auth/logout` | POST | End session |
| `/v1/leads` | GET | List leads with filters |
| `/v1/leads/:id` | GET | Get lead details |
| `/v1/leads/:id/thread` | GET | Unified thread (calls + SMS + events) |
| `/v1/leads/:id/status` | POST | Update lead status |
| `/v1/leads/:id/messages` | POST | Send SMS (with DNC enforcement) |
| `/v1/leads/:id/call/start` | POST | Tap-to-call (logs attempt, returns dial info) |
| `/v1/leads/:id/intake/link` | POST | Generate secure intake link |
| `/v1/devices/register` | POST | Register for push notifications |
| `/v1/devices/unregister` | POST | Unregister device |
| `/v1/analytics/summary` | GET | Analytics dashboard data |
| `/v1/analytics/captured-leads` | GET | Detailed leads list |

## Realtime Updates

Connect to WebSocket at `/v1/realtime?token=<jwt>` for live updates.

Event types:
- `connected` - Connection established
- `lead.created` - New lead
- `lead.updated` - Lead changed
- `sms.received` - Inbound SMS
- `sms.sent` - Outbound SMS
- `lead.dnc_set` - Lead marked DNC

## Testing

### Manual QA Steps

1. **Login**: Enter credentials → successful login → see Inbox
2. **Inbox**: Pull to refresh → leads load with priority sorting
3. **Lead Detail**: Tap lead → see unified thread → send SMS → see in thread
4. **Tap-to-Call**: Tap Call → opens phone dialer with lead's number
5. **DNC**: Lead with DNC shows banner, SMS disabled
6. **STOP**: Send "STOP" via SMS → lead marked DNC → automation cancelled

### Curl Examples

```bash
# Login
curl -X POST https://casecurrent.co/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@firm.com","password":"password"}'

# Get leads
curl https://casecurrent.co/v1/leads \
  -H "Authorization: Bearer <token>"

# Send SMS
curl -X POST https://casecurrent.co/v1/leads/<leadId>/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"body":"Hello from CaseCurrent!"}'

# Get analytics
curl https://casecurrent.co/v1/analytics/summary?range=7d \
  -H "Authorization: Bearer <token>"
```

## Architecture

```
apps/mobile/
├── App.tsx              # Root with navigation
├── src/
│   ├── screens/         # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── InboxScreen.tsx
│   │   ├── LeadsScreen.tsx
│   │   ├── LeadDetailScreen.tsx
│   │   ├── AnalyticsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── api.ts       # REST API client
│   │   └── realtime.ts  # WebSocket client
│   └── types/
│       └── index.ts     # TypeScript types
└── assets/              # Icons and splash screens
```

## TODOs for v2

- [ ] Push notifications (FCM integration)
- [ ] Scheduling screen
- [ ] Offline caching
- [ ] Biometric authentication
- [ ] Multi-firm picker
