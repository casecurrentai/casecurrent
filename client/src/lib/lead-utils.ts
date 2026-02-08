/**
 * Shared utility functions for lead/case display.
 * Extracted from case-detail.tsx to be reusable across components.
 */

interface LeadBase {
  displayName: string | null;
  contact: { name: string; primaryPhone: string | null };
  intakeData: Record<string, any> | null;
  practiceArea?: { name: string } | null;
}

export function getBestPhone(lead: LeadBase): string | null {
  if (lead.contact?.primaryPhone) return lead.contact.primaryPhone;
  const intakeData = lead.intakeData;
  if (!intakeData) return null;
  const phoneFields = [
    intakeData.phoneNumber,
    intakeData.callerPhone,
    intakeData.phone,
    intakeData.from,
    intakeData.fromNumber,
    intakeData.caller?.phone,
    intakeData.caller?.phoneNumber,
  ];
  for (const phone of phoneFields) {
    if (typeof phone === "string" && phone.trim()) return phone.trim();
  }
  return null;
}

export function getBestDisplayName(lead: LeadBase): string {
  if (lead.displayName?.trim()) return lead.displayName;
  if (lead.contact?.name?.trim() && lead.contact.name !== "Unknown Caller") return lead.contact.name;
  const intakeData = lead.intakeData;
  if (intakeData?.callerName && typeof intakeData.callerName === "string" && intakeData.callerName.trim()) {
    return intakeData.callerName;
  }
  if (intakeData?.caller?.fullName && typeof intakeData.caller.fullName === "string" && intakeData.caller.fullName.trim()) {
    return intakeData.caller.fullName;
  }
  if (intakeData?.caller?.firstName && typeof intakeData.caller.firstName === "string") {
    const first = intakeData.caller.firstName.trim();
    const last = intakeData.caller?.lastName && typeof intakeData.caller.lastName === "string"
      ? intakeData.caller.lastName.trim()
      : "";
    if (first) return last ? `${first} ${last}` : first;
  }
  const phone = getBestPhone(lead);
  if (phone) return phone;
  return "Unknown Caller";
}

export function getBestPracticeArea(lead: LeadBase): string {
  if (lead.practiceArea?.name?.trim()) return lead.practiceArea.name;
  const intakeData = lead.intakeData;
  if (intakeData?.practiceAreaGuess && typeof intakeData.practiceAreaGuess === "string" && intakeData.practiceAreaGuess.trim()) {
    return intakeData.practiceAreaGuess;
  }
  if (intakeData?.practiceArea && typeof intakeData.practiceArea === "string" && intakeData.practiceArea.trim()) {
    return intakeData.practiceArea;
  }
  return "Not assigned";
}
