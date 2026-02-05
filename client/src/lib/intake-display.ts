/**
 * Helper for normalizing intake data for safe display.
 * Prevents raw JSON/objects from being rendered to production UI.
 */

export interface IntakeDisplayData {
  urgency?: "high" | "medium" | "low" | string;
  summary?: string;
  injuryDescription?: string;
  practiceArea?: string;
  practiceAreaGuess?: string;
  keyFacts?: string[];
  callerName?: string;
  callerPhone?: string;
  callerEmail?: string;
  incidentDate?: string;
  location?: string;
}

/**
 * Normalizes intake data from various input formats into a safe display object.
 * Only outputs strings and arrays of strings - no nested objects.
 *
 * @param intakeRaw - The raw intake data (object, JSON string, or null/undefined)
 * @returns Normalized display data or null if no valid data
 */
export function getIntakeDisplayData(
  intakeRaw: unknown
): IntakeDisplayData | null {
  if (intakeRaw === null || intakeRaw === undefined) {
    return null;
  }

  let data: Record<string, unknown>;

  // Handle JSON string input
  if (typeof intakeRaw === "string") {
    try {
      const parsed = JSON.parse(intakeRaw);
      if (typeof parsed !== "object" || parsed === null) {
        return null;
      }
      data = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof intakeRaw === "object") {
    data = intakeRaw as Record<string, unknown>;
  } else {
    return null;
  }

  // Check if we have any meaningful data
  const hasContent =
    data.summary ||
    data.practiceArea ||
    data.practiceAreaGuess ||
    data.urgency ||
    data.keyFacts ||
    data.caller ||
    data.callerName ||
    data.incidentDate ||
    data.injuryDescription;

  if (!hasContent) {
    return null;
  }

  const result: IntakeDisplayData = {};

  // Urgency
  if (typeof data.urgency === "string") {
    result.urgency = data.urgency;
  }

  // Summary
  if (typeof data.summary === "string" && data.summary.trim()) {
    result.summary = data.summary.trim();
  }

  // Injury description
  if (typeof data.injuryDescription === "string" && data.injuryDescription.trim()) {
    result.injuryDescription = data.injuryDescription.trim();
  }

  // Practice area
  if (typeof data.practiceArea === "string" && data.practiceArea.trim()) {
    result.practiceArea = data.practiceArea.trim();
  }
  if (typeof data.practiceAreaGuess === "string" && data.practiceAreaGuess.trim()) {
    result.practiceAreaGuess = data.practiceAreaGuess.trim();
  }

  // Key facts
  if (Array.isArray(data.keyFacts)) {
    const validFacts = data.keyFacts
      .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
      .map((f) => f.trim());
    if (validFacts.length > 0) {
      result.keyFacts = validFacts;
    }
  }

  // Caller info - can be nested in a caller object or at root
  const caller = typeof data.caller === "object" && data.caller !== null
    ? (data.caller as Record<string, unknown>)
    : data;

  // Caller name - try various fields
  const callerName =
    caller.fullName || caller.callerName || caller.name ||
    (caller.firstName && caller.lastName
      ? `${caller.firstName} ${caller.lastName}`
      : caller.firstName || caller.lastName);
  if (typeof callerName === "string" && callerName.trim()) {
    result.callerName = callerName.trim();
  }

  // Caller phone - check many possible field names with priority order
  const callerPhone =
    caller.phone ||
    caller.callerPhone ||
    caller.phoneNumber ||
    data.phone ||
    data.callerPhone ||
    data.phoneNumber ||
    data.from ||
    data.fromNumber;
  if (typeof callerPhone === "string" && callerPhone.trim()) {
    result.callerPhone = callerPhone.trim();
  }

  // Caller email
  const callerEmail = caller.email || caller.callerEmail || data.email || data.callerEmail;
  if (typeof callerEmail === "string" && callerEmail.trim()) {
    result.callerEmail = callerEmail.trim();
  }

  // Incident date
  if (typeof data.incidentDate === "string" && data.incidentDate.trim()) {
    result.incidentDate = data.incidentDate.trim();
  }

  // Location
  if (typeof data.location === "string" && data.location.trim()) {
    result.location = data.location.trim();
  }

  // Return null if no fields were populated
  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}
