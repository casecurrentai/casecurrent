/**
 * Intake requirements configuration.
 *
 * Defines required, minimumViable, and optional fields per matter type.
 * This is the single source of truth for what constitutes a complete intake —
 * used by readiness evaluation and nextQuestionSelector.
 *
 *   required       — all fields needed for a full handoff-ready record
 *   minimumViable  — minimum for a contactable, routable lead (callback-worthy)
 *   optional       — enrichment fields asked after required are filled
 *
 * All field keys must correspond to slots defined in slot-definitions.ts.
 */

import { MatterType } from '../types';

export interface IntakeRequirement {
  /** All fields needed to consider intake complete and ready for attorney handoff. */
  required: string[];
  /** Minimum subset that makes the lead contactable and actionable — enough to stop if needed. */
  minimumViable: string[];
  /** Secondary/enrichment fields asked after required fields are captured. */
  optional: string[];
}

// ──────────────────────────────────────────────────────────────────
// Per-matter-type requirements
// ──────────────────────────────────────────────────────────────────

const PERSONAL_INJURY: IntakeRequirement = {
  required: [
    'caller_name',
    'callback_number',
    'incident_date',
    'short_matter_summary',
    'injury_type',
  ],
  minimumViable: ['callback_number', 'short_matter_summary'],
  optional: [
    'medical_treatment',
    'insurance_involved',
    'police_report',
    'vehicle_involved',
    'incident_location',
    'opposing_party',
  ],
};

const EMPLOYMENT: IntakeRequirement = {
  required: [
    'caller_name',
    'callback_number',
    'short_matter_summary',
    'employer_name',
  ],
  minimumViable: ['callback_number', 'short_matter_summary'],
  optional: [
    'job_status',
    'discrimination_or_retaliation',
    'termination_date',
    'incident_date',
    'incident_location',
  ],
};

const FAMILY: IntakeRequirement = {
  required: [
    'caller_name',
    'callback_number',
    'short_matter_summary',
    'family_matter_category',
  ],
  minimumViable: ['callback_number', 'short_matter_summary'],
  optional: ['children_involved', 'court_dates', 'incident_date'],
};

// Criminal: custody_status is in minimumViable because it affects urgency routing
const CRIMINAL: IntakeRequirement = {
  required: [
    'caller_name',
    'callback_number',
    'short_matter_summary',
    'charges_known',
  ],
  minimumViable: ['callback_number', 'custody_status'],
  optional: ['arrest_date', 'court_date', 'incident_location'],
};

const ESTATE: IntakeRequirement = {
  required: [
    'caller_name',
    'callback_number',
    'short_matter_summary',
    'deceased_or_living',
  ],
  minimumViable: ['callback_number', 'short_matter_summary'],
  optional: ['will_exists', 'probate_status'],
};

const GENERAL: IntakeRequirement = {
  required: ['caller_name', 'callback_number', 'short_matter_summary'],
  minimumViable: ['callback_number', 'short_matter_summary'],
  optional: ['incident_date', 'opposing_party', 'incident_location'],
};

// Used when matterType is "unknown" — bare minimum to proceed
const DEFAULT: IntakeRequirement = {
  required: ['caller_name', 'callback_number', 'short_matter_summary'],
  minimumViable: ['callback_number'],
  optional: [],
};

// ──────────────────────────────────────────────────────────────────
// Config map
// ──────────────────────────────────────────────────────────────────

export const INTAKE_REQUIREMENTS: Record<string, IntakeRequirement> = {
  personal_injury: PERSONAL_INJURY,
  employment: EMPLOYMENT,
  family: FAMILY,
  criminal: CRIMINAL,
  estate: ESTATE,
  general: GENERAL,
  unknown: DEFAULT,
};

/**
 * Get intake requirements for a matter type.
 * Falls back to DEFAULT for unrecognized types.
 */
export function getIntakeRequirements(matterType: MatterType): IntakeRequirement {
  return INTAKE_REQUIREMENTS[matterType] ?? DEFAULT;
}
