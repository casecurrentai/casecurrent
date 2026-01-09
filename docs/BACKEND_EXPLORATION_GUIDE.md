# CaseCurrent Backend Exploration Guide

> **Purpose:** Step-by-step workflow for product demos, customer onboarding understanding, and sales training.

---

## Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Demo Owner** | `owner@demo.com` | `DemoPass123!` |

> **Organization:** Demo Law Firm  
> **Access Level:** Full owner permissions

---

## Step-by-Step Feature Exploration

### Step 1: Initial Login & Dashboard Orientation

**Navigate to:** `/login`

1. Enter the demo credentials above
2. You'll be authenticated and land on the main dashboard
3. Note your organization context: **Demo Law Firm**

**What you'll see:**
- Organization overview
- Quick stats on leads, calls, and intakes
- Navigation to all major features

**Demo Talking Point:**
> *"Every law firm gets their own secure workspace. Role-based access ensures staff only see what they need."*

---

### Step 2: Lead Management (Core Feature)

**Navigate to:** `/leads`

#### Exploring Existing Leads
1. View the lead list with status badges (New, Contacted, Qualified, etc.)
2. Notice the practice area tags
3. See lead scores at a glance

#### Creating a Test Lead
1. Click **"New Lead"**
2. Fill in the form:
   - **Name:** Test Client
   - **Phone:** (555) 123-4567
   - **Email:** test@example.com
   - **Practice Area:** Personal Injury
3. Submit to create the lead

#### Lead Detail View
Click into any lead to see:
- **Contact Information** - Phone, email, address
- **Interaction Timeline** - Every call, SMS, and web form chronologically
- **Intake Status** - Partial/Complete with answers
- **Qualification Score** - AI-generated score with reasoning

**Demo Talking Point:**
> *"Every inbound call, text, or web form automatically creates a lead. Your team sees the complete picture in one place—no switching between systems."*

---

### Step 3: Structured Intake Flow

**From a lead detail page:**

#### Initialize Intake
1. Click **"Initialize Intake"**
2. The system loads the appropriate question set based on practice area
3. For Personal Injury leads, you'll see questions about:
   - Contact Information
   - Incident Details (date, location, description)
   - Injuries sustained
   - Medical treatment status
   - Other parties involved

#### Complete the Intake
1. Fill in intake answers in the provided form/editor
2. Click **"Save"** to update partially
3. Click **"Complete Intake"** to finalize
4. This triggers the `intake.completed` webhook event

**Demo Talking Point:**
> *"Our AI agent asks these exact questions during live calls. Everything gets extracted and structured automatically—no manual data entry."*

---

### Step 4: AI Qualification & Scoring

**From a lead detail page:**

#### Run AI Qualification
1. Click **"Run Qualification"**
2. The AI analyzes all available data and generates a score

#### Understanding the Qualification Panel

| Field | Description |
|-------|-------------|
| **Score** | 0-100 composite score |
| **Disposition** | Accept (≥70), Review (40-69), Decline (<40) |
| **Confidence** | AI's certainty level |

#### Score Factors (Explainable AI)
Each factor shows:
- **Name** - What was evaluated
- **Weight** - How important (percentage)
- **Evidence** - Why this score
- **Evidence Quote** - Actual text from call/intake

Example factors:
- Contact Info (20%) - "Has verified phone and email"
- Practice Area Match (15%) - "Personal injury case type"
- Intake Completeness (25%) - "All required fields answered"
- Incident Details (20%) - "Clear liability indicators"
- Communication History (20%) - "2 successful calls"

#### Missing Fields
Shows what information is still needed to improve the score.

#### Disqualifiers
Lists reasons a lead might be declined:
- Statute of limitations expired
- Pre-existing attorney
- No actual injury

**Demo Talking Point:**
> *"This is explainable AI—you see exactly WHY each lead was scored the way it was. No black box. Your intake staff knows which leads to prioritize and why."*

---

### Step 5: Telephony & Interactions

**From a lead detail page:**

#### Calls Panel
- View all call records with:
  - Call duration
  - Recording status
  - Transcription (when available)
  - Summary notes

#### Messages Panel
- SMS conversation thread
- Inbound and outbound messages
- Timestamps and delivery status

#### Interactions Timeline
Chronological view combining:
- Inbound calls
- Outbound calls
- SMS messages
- Web form submissions
- Status changes

**Demo Talking Point:**
> *"Every call is recorded, transcribed, and analyzed automatically. Voicemails are processed and summarized so your team never misses critical information."*

---

### Step 6: Webhook Integration

**Navigate to:** `/settings/webhooks`

#### View Webhook Endpoints
See all configured integrations with:
- Endpoint URL
- Active status
- Events subscribed
- Recent delivery status

#### Create a New Webhook
1. Click **"Add Endpoint"**
2. Enter the destination URL
3. Select events to subscribe:
   - `lead.created`
   - `lead.updated`
   - `lead.qualified`
   - `intake.completed`
   - `call.completed`
   - `contact.created`
4. Save the endpoint (note: secret is shown only once!)

#### Test the Webhook
1. Click **"Test"** on any endpoint
2. A sample payload is sent immediately
3. View the response status

#### Delivery Logs
- See all attempted deliveries
- Check success/failure status
- View retry attempts (up to 3 with exponential backoff)

**Security Features:**
- HMAC SHA256 signing with `X-CT-Signature` header
- Secret rotation available
- 10-second timeout per delivery

**Demo Talking Point:**
> *"Push qualified leads directly to your CRM, case management system, or marketing automation. Real-time data flow means no manual exports."*

---

### Step 7: Self-Improving System (A/B Testing)

**Navigate to:** `/experiments`

#### View Experiments
See all experiments with:
- Name and description
- Status (Draft, Running, Paused, Ended)
- Variant configuration
- Start/end dates

#### Create an Experiment
1. Click **"New Experiment"**
2. Configure:
   - **Name:** e.g., "Intake Script Test Q1"
   - **Kind:** intake_script, qualification_rules, or follow_up_timing
   - **Variants:** Define A/B/C variants with configurations
3. Save as draft

#### Experiment Lifecycle
1. **Draft** → Configure and refine
2. **Start** → Begin assigning leads to variants
3. **Pause** → Temporarily halt assignments
4. **End** → Lock results and declare winner

#### Performance Report
View per-variant metrics:
- Leads assigned
- Conversion rate (qualified as "accept")
- Average score
- Statistical significance

**Demo Talking Point:**
> *"Continuously improve your intake. Test different scripts, questions, and routing rules. Data tells you what works—no guessing."*

---

### Step 8: Policy Tests (Quality Assurance)

**Navigate to:** `/policy-tests`

#### Default Test Suite
Pre-built with 6 test cases covering:

| Test Case | Expected Result |
|-----------|-----------------|
| Complete lead with phone+email | Accept |
| Minimal info | Review |
| No contact info | Decline |
| Partial intake with practice area | Review |
| Complete intake without calls | Accept |
| High engagement with partial info | Review |

#### Run the Test Suite
1. Click **"Run Tests"**
2. Each test case executes against current qualification rules
3. View results: ✅ Pass or ❌ Fail

#### Create Custom Tests
Add test cases specific to your firm's requirements:
- Define input scenarios
- Set expected disposition
- Optionally set minimum score threshold

**Demo Talking Point:**
> *"Before changing any qualification rules, run regression tests. Ensure you don't break what's already working. Quality control built into the platform."*

---

### Step 9: Follow-up Sequences

**Feature:** Automated lead nurturing

#### Default Sequence: "New Lead Welcome"
Pre-configured 3-step SMS sequence:

| Step | Delay | Message |
|------|-------|---------|
| 1 | Immediate | "Thank you for contacting Demo Law Firm. We have received your inquiry and will be in touch shortly." |
| 2 | 1 hour | "Hi! Just following up on your inquiry. Is there any additional information you can share about your situation?" |
| 3 | 24 hours | "We wanted to make sure you received our messages. Our team is ready to help. Reply or call us at your convenience." |

#### Stop Rules
Sequence automatically stops when:
- Lead responds (inbound message received)
- Lead status changes to "disqualified" or "closed"

#### Trigger a Sequence
From a lead detail page:
1. Select a sequence
2. Click **"Trigger Sequence"**
3. Messages send according to delay schedule

**Demo Talking Point:**
> *"Automated nurturing keeps leads warm while your team focuses on qualified prospects. No leads fall through the cracks."*

---

### Step 10: Platform Admin Features

> **Note:** These features are for CaseCurrent internal team only.

**Navigate to:** `/admin/orgs`

#### Organization Management
- View all law firm organizations
- See status, lead counts, activity metrics
- Access health snapshots

#### Create a New Firm
1. Click **"New Organization"**
2. Enter:
   - Firm name
   - URL slug
   - Timezone
3. Choose onboarding method:
   - **Invite Link:** Send email to owner (7-day expiration)
   - **Temporary Password:** Set initial credentials

#### Impersonation
1. Select an organization
2. Click **"Impersonate"**
3. Receive a 1-hour access token
4. View/act as that organization for support purposes
5. All actions are logged in audit_logs

#### Health Snapshots
Per-organization metrics:
- Leads in last 24 hours
- Calls in last 24 hours
- Webhook delivery failures

**Demo Talking Point:**
> *"Our support team can securely access your account when you need help—with full audit logging for compliance."*

---

### Step 11: Setup Wizard (Customer Onboarding)

**Navigate to:** `/setup`

Walk new customers through 8 configuration steps:

#### Step 1: Firm Basics
- Organization name
- Primary timezone
- Business type

#### Step 2: Business Hours
- Start/end times
- Days of operation
- Holiday handling

#### Step 3: Practice Areas
- Add/remove practice areas
- Personal Injury, Criminal Defense, Family Law, etc.
- Enable/disable per area

#### Step 4: Phone Numbers
- Twilio integration
- Provision new numbers
- Port existing numbers

#### Step 5: AI Voice Configuration
- Greeting script
- Recording disclaimer
- Tone profile (professional, empathetic, formal)
- Handoff rules

#### Step 6: Intake Logic
- Question sets per practice area
- Required vs. optional fields
- Conditional logic

#### Step 7: Follow-up Sequences
- Configure nurture campaigns
- Timing and messaging
- Stop rules

#### Step 8: Review & Launch
- Summary of all settings
- Final confirmation
- Go live!

**Demo Talking Point:**
> *"Live in days, not months. Our setup wizard guides you through configuration step by step. Most firms are operational within a week."*

---

## API Endpoints Quick Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/login` | Login with email/password |
| POST | `/v1/auth/register` | Register new user |
| GET | `/v1/me` | Get current user profile |
| GET | `/v1/org` | Get current organization |

### Leads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/leads` | List all leads |
| POST | `/v1/leads` | Create new lead |
| GET | `/v1/leads/:id` | Get lead details |
| PATCH | `/v1/leads/:id` | Update lead |

### Intake
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/leads/:id/intake` | Get intake for lead |
| POST | `/v1/leads/:id/intake/init` | Initialize intake |
| PATCH | `/v1/leads/:id/intake` | Update intake answers |
| POST | `/v1/leads/:id/intake/complete` | Complete intake |

### Qualification
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/leads/:id/qualification` | Get qualification |
| POST | `/v1/leads/:id/qualification/run` | Run AI qualification |
| PATCH | `/v1/leads/:id/qualification` | Human override |

### Interactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/leads/:id/interactions` | Get lead interactions |
| POST | `/v1/interactions` | Create interaction |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/webhooks` | List endpoints |
| POST | `/v1/webhooks` | Create endpoint |
| PATCH | `/v1/webhooks/:id` | Update endpoint |
| DELETE | `/v1/webhooks/:id` | Delete endpoint |
| POST | `/v1/webhooks/:id/test` | Test endpoint |
| POST | `/v1/webhooks/:id/rotate-secret` | Rotate secret |
| GET | `/v1/webhooks/:id/deliveries` | Delivery history |

### Experiments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/experiments` | List experiments |
| POST | `/v1/experiments` | Create experiment |
| POST | `/v1/experiments/:id/start` | Start experiment |
| POST | `/v1/experiments/:id/pause` | Pause experiment |
| POST | `/v1/experiments/:id/end` | End experiment |
| GET | `/v1/experiments/:id/report` | Get performance report |

### Policy Tests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/policy-tests/suites` | List test suites |
| POST | `/v1/policy-tests/suites` | Create suite |
| POST | `/v1/policy-tests/suites/:id/run` | Run tests |
| GET | `/v1/policy-tests/runs` | Get run history |

### Follow-up Sequences
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/followup-sequences` | List sequences |
| POST | `/v1/followup-sequences` | Create sequence |
| POST | `/v1/leads/:id/followups/trigger` | Trigger for lead |

---

## Key Sales Talking Points

### 1. 24/7 Coverage
> *"Never miss a case-worthy call—even at 3am on a holiday. Our AI agent answers, qualifies, and routes leads around the clock."*

### 2. Explainable AI
> *"See exactly why each lead was scored the way it was. No black box. Your team knows which leads to prioritize and why."*

### 3. Self-Improving Platform
> *"A/B test intake scripts, qualification rules, and follow-up timing. Data tells you what works—continuous improvement built in."*

### 4. Compliance First
> *"Audit logs, recording disclaimers, role-based access control. Built for firms that handle sensitive cases."*

### 5. Integration Ready
> *"Webhooks push qualified leads to any CRM or case management system in real-time. No manual exports."*

### 6. Fast Time-to-Value
> *"Live in days, not months. Our setup wizard gets you operational in about a week."*

---

## Demo Flow Recommendations

### 5-Minute Executive Demo
1. Login → Show dashboard
2. Create a lead → Explain capture channels
3. Run qualification → Show explainable scoring
4. View webhook config → Integration story

### 15-Minute Technical Demo
1. Full lead lifecycle (capture → intake → qualify → route)
2. Deep dive on qualification factors
3. Webhook configuration and testing
4. A/B testing overview

### 30-Minute Full Product Demo
1. Complete setup wizard walkthrough
2. Lead management end-to-end
3. Telephony integration (calls, SMS)
4. AI qualification with explainability
5. Webhooks and integrations
6. Self-improving system (experiments, policy tests)
7. Follow-up sequences
8. Admin features (for internal audience)

---

## Troubleshooting

### Can't Login?
- Verify email: `owner@demo.com`
- Password is case-sensitive: `DemoPass123!`
- Check if the database has been seeded

### No Leads Showing?
- Create test leads manually
- Or run seed script to populate demo data

### Qualification Not Running?
- Ensure lead has minimal required data (contact info)
- Check that practice area is assigned

### Webhooks Failing?
- Verify endpoint URL is accessible
- Check delivery logs for error details
- Test with a simple endpoint like webhook.site

---

*Last Updated: January 2026*
*CaseCurrent v1.0*
