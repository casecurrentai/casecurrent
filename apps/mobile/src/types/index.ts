export interface User {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
}

export interface Lead {
  id: string;
  orgId: string;
  contactId: string;
  source: string;
  status: LeadStatus;
  priority: string;
  practiceAreaId?: string;
  summary?: string;
  score?: number;
  urgency?: string;
  ownerUserId?: string;
  nextStep?: string;
  dnc: boolean;
  dncReason?: string;
  dncAt?: string;
  lastActivityAt?: string;
  lastHumanResponseAt?: string;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
  practiceArea?: { id: string; name: string };
  ownerUser?: { id: string; name: string };
  qualification?: { score: number; disposition: string };
}

export type LeadStatus =
  | "new"
  | "engaged"
  | "intake_started"
  | "intake_complete"
  | "qualified"
  | "not_qualified"
  | "consult_set"
  | "retained"
  | "closed"
  | "referred";

export interface Contact {
  id: string;
  name: string;
  primaryPhone?: string;
  primaryEmail?: string;
}

export interface ThreadItem {
  id: string;
  type: string;
  timestamp: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface ThreadResponse {
  items: ThreadItem[];
  nextCursor?: string;
}

export interface AnalyticsSummary {
  range: string;
  startDate: string;
  capturedLeads: number;
  missedCallRecovery: number;
  qualifiedRate: number;
  qualifiedCount: number;
  consultBookedRate: number;
  consultBookedCount: number;
  medianResponseMinutes: number;
  p90ResponseMinutes: number;
  afterHoursConversionRate?: number;
}

export interface Organization {
  id: string;
  name: string;
}

export interface AuthTokens {
  token: string;
  user: User;
  organizations?: Organization[];
}

export interface RealtimeEvent {
  type: string;
  leadId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}
