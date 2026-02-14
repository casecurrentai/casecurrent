// Centralized pricing plan configuration
// Update values here to change pricing across the entire pricing page.

export interface PlanUsage {
  callsPerMonth: number;
  minutesPerMonth: number;
  overagePerMinute: number; // dollars
}

export interface PlanFeature {
  text: string;
  comingSoon?: boolean;
}

export interface PlanDef {
  id: string;
  name: string;
  shortName: string;
  price: number; // monthly USD
  tagline: string;
  positioning: string;
  includesLabel: string;
  features: PlanFeature[];
  usage: PlanUsage;
  highlighted?: boolean;
  badge?: string;
  cta: string;
  ctaHref: string;
  secondaryCta?: { label: string; href: string };
}

export interface ComparisonRow {
  label: string;
  core: string | boolean;
  pro: string | boolean;
  elite: string | boolean;
}

// ──────────────────────────────────────────────
// Pilot config
// ──────────────────────────────────────────────

export const PILOT_CONFIG = {
  termDays: 90,
  maxFirms: 25,
  footnote:
    "Pilot pricing is limited to the first 25 firms. After the 90-day Pilot term, plans transition to standard pricing unless canceled.",
};

// ──────────────────────────────────────────────
// Founding Firm Pilot Plans
// ──────────────────────────────────────────────

export const PILOT_PLANS: PlanDef[] = [
  {
    id: "core-pilot",
    name: "Core Pilot",
    shortName: "Core",
    price: 249,
    tagline: "For solo & small firms needing after-hours/overflow capture",
    positioning:
      "Stop losing leads while you're in court or off the clock.",
    includesLabel: "Includes",
    features: [
      { text: "AI voice agent for after-hours + overflow only" },
      { text: "Voicemail transcription + intelligent summaries" },
      { text: "Lead capture (name, phone, case type, urgency)" },
      { text: "Email notifications only" },
      { text: "Secure dashboard (call + lead history)" },
      { text: "Built-in legal disclaimers" },
      { text: "1 firm, 1 phone number" },
    ],
    usage: {
      callsPerMonth: 50,
      minutesPerMonth: 300,
      overagePerMinute: 0.2,
    },
    cta: "Start Core Pilot",
    ctaHref: "/demo?plan=core-pilot",
  },
  {
    id: "pro-pilot",
    name: "Pro Pilot",
    shortName: "Pro",
    price: 599,
    tagline: "For growing firms that want 24/7 intake + conversion",
    positioning:
      "Turn more callers into signed cases — without adding staff.",
    includesLabel: "Everything in Core Pilot, plus",
    features: [
      { text: "24/7 primary intake (not just overflow)" },
      { text: "Live call screening + warm transfers" },
      { text: 'SMS lead notifications + "missed lead follow-ups"' },
      { text: "Zapier + webhook automations" },
      { text: "CRM integrations (Clio, MyCase)", comingSoon: true },
      { text: "Conversion analytics (basic)" },
      { text: "Multiple phone numbers (up to 3)" },
      { text: "Priority support (same-day response)" },
    ],
    usage: {
      callsPerMonth: 150,
      minutesPerMonth: 900,
      overagePerMinute: 0.18,
    },
    highlighted: true,
    badge: "Most Popular",
    cta: "Start Pro Pilot",
    ctaHref: "/demo?plan=pro-pilot",
  },
];

// ──────────────────────────────────────────────
// Standard Plans
// ──────────────────────────────────────────────

export const STANDARD_PLANS: PlanDef[] = [
  {
    id: "core",
    name: "CaseCurrent Core",
    shortName: "Core",
    price: 349,
    tagline: "Overflow & after-hours intake",
    positioning:
      "Capture leads you're already paying for — after hours and when you can't answer.",
    includesLabel: "Includes",
    features: [
      { text: "Overflow + after-hours AI intake" },
      { text: "Voicemail transcription + summaries" },
      { text: "Lead capture + secure dashboard" },
      { text: "Email notifications only" },
      { text: "Built-in legal disclaimers" },
      { text: "1 firm, 1 phone number" },
    ],
    usage: {
      callsPerMonth: 75,
      minutesPerMonth: 450,
      overagePerMinute: 0.2,
    },
    cta: "Get Started",
    ctaHref: "/demo?plan=core",
  },
  {
    id: "pro",
    name: "CaseCurrent Pro",
    shortName: "Pro",
    price: 749,
    tagline: "24/7 primary intake + transfers + automations",
    positioning:
      "24/7 primary intake + transfers + automations.",
    includesLabel: "Everything in Core, plus",
    features: [
      { text: "24/7 primary intake" },
      { text: "Warm transfers / live screening" },
      { text: "SMS notifications + follow-ups" },
      { text: "Zapier + webhook automations" },
      { text: "CRM integrations (Clio, MyCase)", comingSoon: true },
      { text: "Advanced analytics + conversion insights" },
      { text: "Multiple phone numbers (up to 5)" },
      { text: "Priority support (4-hour response)" },
    ],
    usage: {
      callsPerMonth: 200,
      minutesPerMonth: 1200,
      overagePerMinute: 0.18,
    },
    highlighted: true,
    badge: "Most Popular",
    cta: "Get Started",
    ctaHref: "/demo?plan=pro",
  },
  {
    id: "elite",
    name: "CaseCurrent Elite",
    shortName: "Elite",
    price: 1499,
    tagline: "SLA-backed reliability for high-volume firms",
    positioning:
      "SLA-backed intake reliability for high-volume, multi-attorney firms.",
    includesLabel: "Everything in Pro, plus",
    features: [
      { text: "99.9% uptime SLA target" },
      { text: "Incident response (<1 hour during business hours)" },
      { text: "Reliability monitoring + escalations" },
      { text: "Dedicated onboarding" },
      { text: "Quarterly optimization review (conversion + scripts)" },
      { text: "Practice-area-specific configurations (scripts/question sets)" },
      { text: "Firm-branded AI voice + scripting" },
      { text: "Optional bilingual support (add-on)" },
    ],
    usage: {
      callsPerMonth: 500,
      minutesPerMonth: 3000,
      overagePerMinute: 0.15,
    },
    cta: "Get Started",
    ctaHref: "/demo?plan=elite",
    secondaryCta: { label: "Talk to Sales", href: "/contact?plan=elite" },
  },
];

// ──────────────────────────────────────────────
// Comparison table
// ──────────────────────────────────────────────

export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Overflow / after-hours", core: true, pro: true, elite: true },
  { label: "24/7 primary intake", core: false, pro: true, elite: true },
  { label: "Warm transfers", core: false, pro: true, elite: true },
  { label: "SMS notifications", core: false, pro: true, elite: true },
  { label: "Missed-lead follow-ups", core: false, pro: true, elite: true },
  { label: "Integrations (CRM / Zapier)", core: false, pro: true, elite: true },
  { label: "Multiple phone numbers", core: false, pro: "Up to 5", elite: "Unlimited" },
  { label: "Analytics depth", core: "Basic", pro: "Advanced", elite: "Advanced + custom" },
  { label: "SLA / incident response", core: false, pro: false, elite: true },
  { label: "Dedicated success manager", core: false, pro: false, elite: true },
  { label: "Quarterly optimization review", core: false, pro: false, elite: true },
  { label: "Bilingual support", core: false, pro: false, elite: "Add-on" },
];

// ──────────────────────────────────────────────
// FAQs
// ──────────────────────────────────────────────

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    question: "Is this replacing my receptionist?",
    answer:
      "Not necessarily. CaseCurrent works as overflow and after-hours coverage, or as a full 24/7 primary intake agent. Many firms use it alongside their existing staff to ensure no call goes unanswered — nights, weekends, holidays, and during busy periods.",
  },
  {
    question: "What happens if Avery can't answer a question?",
    answer:
      "Avery is trained on your firm's practice areas and intake scripts. If a caller asks something outside scope, Avery captures the caller's details and flags the lead for your team to follow up. On Pro and Elite plans, Avery can warm-transfer the call directly to an attorney.",
  },
  {
    question: "How are legal disclaimers and conflicts handled?",
    answer:
      "CaseCurrent includes built-in legal disclaimers that are delivered during every call. Avery makes clear that no attorney-client relationship is being established and that the call is for intake purposes only. Your firm controls the disclaimer language.",
  },
  {
    question: "How does included usage work? What are overages?",
    answer:
      "Each plan includes a set number of calls and minutes per month. If you exceed your allowance, overage charges apply per minute at the rate listed on your plan. You'll receive alerts at 80% and 100% usage so there are no surprises. You can upgrade your plan anytime to get more included usage.",
  },
  {
    question: "Can I port my existing phone number?",
    answer:
      "Yes. CaseCurrent can work with your existing phone number through call forwarding, or you can port your number directly. Our onboarding team will help you set up the best configuration for your firm.",
  },
  {
    question: "Are Clio and MyCase integrations live?",
    answer:
      "CRM integrations with Clio and MyCase are currently in development and will be available soon. In the meantime, you can use Zapier and webhook automations (available on Pro and Elite plans) to connect CaseCurrent with your existing tools.",
  },
];

// ──────────────────────────────────────────────
// Trust row items
// ──────────────────────────────────────────────

export const TRUST_ITEMS = [
  { label: "Secure dashboard", icon: "shield" },
  { label: "Built-in disclaimers", icon: "file-check" },
  { label: "CRM-ready", icon: "plug" },
  { label: "Designed for law firms", icon: "scale" },
] as const;
