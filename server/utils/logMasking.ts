const isProduction = process.env.NODE_ENV === "production";

export function maskPhone(phone: string): string {
  if (!isProduction || !phone) return phone;
  if (phone.length <= 4) return "***";
  return phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);
}

export function maskSipUri(sipUri: string): string {
  if (!isProduction || !sipUri) return sipUri;
  const match = sipUri.match(/^sip:([^@]+)@(.+)$/);
  if (!match) return "sip:***@***";
  const [, user, domain] = match;
  const maskedUser = user.length > 8 ? user.slice(0, 4) + "***" + user.slice(-4) : "***";
  return `sip:${maskedUser}@${domain}`;
}

export function maskProjectId(projectId: string): string {
  if (!isProduction || !projectId) return projectId;
  if (projectId.length <= 8) return "proj_***";
  return projectId.slice(0, 5) + "***" + projectId.slice(-4);
}

export function maskCallSid(callSid: string): string {
  if (!isProduction || !callSid) return callSid;
  if (callSid.length <= 10) return "CA***";
  return callSid.slice(0, 4) + "***" + callSid.slice(-4);
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "***";
  return secret.slice(0, 4) + "***";
}
