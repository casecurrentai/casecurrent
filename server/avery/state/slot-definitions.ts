/**
 * Slot definitions for Avery intake extraction.
 *
 * Slots are the structured data fields we're trying to capture from a call.
 * They are organized into universal slots (every call) and matter-specific sets.
 */

import { MatterType } from '../types';

export interface SlotDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

// ──────────────────────────────────────────────────────────────────
// Universal slots — collected on every call
// ──────────────────────────────────────────────────────────────────

export const UNIVERSAL_SLOTS: SlotDefinition[] = [
  {
    key: 'caller_name',
    label: 'Caller Name',
    required: true,
    description: 'Full name of the caller',
  },
  {
    key: 'callback_number',
    label: 'Callback Number',
    required: true,
    description: 'Phone number to reach the caller',
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    description: 'Email address for follow-up',
  },
  {
    key: 'preferred_contact_method',
    label: 'Preferred Contact Method',
    required: false,
    description: 'Phone call, email, or text message',
  },
  {
    key: 'short_matter_summary',
    label: 'Matter Summary',
    required: true,
    description: 'Brief description of the legal matter',
  },
  {
    key: 'opposing_party',
    label: 'Opposing Party',
    required: false,
    description: 'Name of the opposing party for conflict check',
  },
  {
    key: 'represented_already',
    label: 'Already Represented',
    required: false,
    description: 'Whether the caller has existing legal representation',
  },
  {
    key: 'incident_date',
    label: 'Incident Date',
    required: false,
    description: 'Date of the incident or triggering event',
  },
  {
    key: 'incident_location',
    label: 'Incident Location',
    required: false,
    description: 'Location where the incident occurred',
  },
  {
    key: 'urgency_notes',
    label: 'Urgency Notes',
    required: false,
    description: 'Court dates, statutes of limitation, or other deadlines',
  },
];

// ──────────────────────────────────────────────────────────────────
// Matter-specific slot sets
// ──────────────────────────────────────────────────────────────────

const PI_SLOTS: SlotDefinition[] = [
  {
    key: 'injury_type',
    label: 'Injury Type',
    required: true,
    description: 'Nature and severity of injuries sustained',
  },
  {
    key: 'medical_treatment',
    label: 'Medical Treatment',
    required: false,
    description: 'Whether caller sought or received medical care',
  },
  {
    key: 'insurance_involved',
    label: 'Insurance Involved',
    required: false,
    description: 'Insurance carrier(s) involved if known',
  },
  {
    key: 'police_report',
    label: 'Police Report',
    required: false,
    description: 'Whether a police report was filed',
  },
  {
    key: 'vehicle_involved',
    label: 'Vehicle Involved',
    required: false,
    description: 'Motor vehicle involvement in the incident',
  },
];

const EMPLOYMENT_SLOTS: SlotDefinition[] = [
  {
    key: 'employer_name',
    label: 'Employer Name',
    required: true,
    description: 'Name of the employer or company',
  },
  {
    key: 'job_status',
    label: 'Job Status',
    required: false,
    description: 'Currently employed, terminated, resigned, on leave, etc.',
  },
  {
    key: 'discrimination_or_retaliation',
    label: 'Discrimination / Retaliation',
    required: false,
    description: 'Type of discriminatory or retaliatory conduct alleged',
  },
  {
    key: 'termination_date',
    label: 'Termination Date',
    required: false,
    description: 'Date of termination if applicable',
  },
];

const FAMILY_SLOTS: SlotDefinition[] = [
  {
    key: 'family_matter_category',
    label: 'Family Matter Category',
    required: true,
    description: 'Divorce, custody, child support, adoption, etc.',
  },
  {
    key: 'children_involved',
    label: 'Children Involved',
    required: false,
    description: 'Whether minor children are part of the matter',
  },
  {
    key: 'court_dates',
    label: 'Court Dates',
    required: false,
    description: 'Any pending hearing or court dates',
  },
];

const CRIMINAL_SLOTS: SlotDefinition[] = [
  {
    key: 'charges_known',
    label: 'Charges',
    required: true,
    description: 'Criminal charges if known to the caller',
  },
  {
    key: 'arrest_date',
    label: 'Arrest Date',
    required: false,
    description: 'Date of arrest',
  },
  {
    key: 'custody_status',
    label: 'Custody Status',
    required: false,
    description: 'In custody, released on bail, released on own recognizance, etc.',
  },
  {
    key: 'court_date',
    label: 'Court Date',
    required: false,
    description: 'Next scheduled court date',
  },
];

const ESTATE_SLOTS: SlotDefinition[] = [
  {
    key: 'deceased_or_living',
    label: 'Deceased or Living',
    required: true,
    description: 'Whether the estate matter concerns a deceased or living person',
  },
  {
    key: 'will_exists',
    label: 'Will Exists',
    required: false,
    description: 'Whether a will is known to exist',
  },
  {
    key: 'probate_status',
    label: 'Probate Status',
    required: false,
    description: 'Whether probate has been opened and current status',
  },
];

// ──────────────────────────────────────────────────────────────────
// Matter type → slot map
// ──────────────────────────────────────────────────────────────────

const MATTER_SLOTS: Partial<Record<MatterType, SlotDefinition[]>> = {
  personal_injury: PI_SLOTS,
  employment: EMPLOYMENT_SLOTS,
  family: FAMILY_SLOTS,
  criminal: CRIMINAL_SLOTS,
  estate: ESTATE_SLOTS,
};

/** Returns the full slot definition set for a given matter type (universal + specific). */
export function getSlotsForMatterType(matterType: MatterType): SlotDefinition[] {
  const specific = MATTER_SLOTS[matterType] ?? [];
  return [...UNIVERSAL_SLOTS, ...specific];
}

/** Returns only the required slot keys for a given matter type. */
export function getRequiredSlots(matterType: MatterType): string[] {
  return getSlotsForMatterType(matterType)
    .filter((s) => s.required)
    .map((s) => s.key);
}
