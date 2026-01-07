const DISABLE_LOG_MASKING = process.env.DISABLE_LOG_MASKING === "true";

export function maskPhone(phone: string, forceUnmasked = false): string {
  if (!phone) return phone;
  if (DISABLE_LOG_MASKING || forceUnmasked) return phone;
  if (phone.length <= 4) return "***";
  return phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);
}

export function maskSipUri(sipUri: string, forceUnmasked = false): string {
  if (!sipUri) return sipUri;
  if (DISABLE_LOG_MASKING || forceUnmasked) return sipUri;
  const match = sipUri.match(/^sip:([^@]+)@(.+)$/);
  if (!match) return "sip:***@***";
  const [, user, domain] = match;
  const maskedUser = user.length > 8 ? user.slice(0, 4) + "***" + user.slice(-4) : "***";
  return `sip:${maskedUser}@${domain}`;
}

export function maskProjectId(projectId: string, forceUnmasked = false): string {
  if (!projectId) return projectId;
  if (DISABLE_LOG_MASKING || forceUnmasked) return projectId;
  if (projectId.length <= 8) return "proj_***";
  return projectId.slice(0, 5) + "***" + projectId.slice(-4);
}

export function maskCallSid(callSid: string, forceUnmasked = false): string {
  if (!callSid) return callSid;
  if (DISABLE_LOG_MASKING || forceUnmasked) return callSid;
  if (callSid.length <= 10) return "CA***";
  return callSid.slice(0, 4) + "***" + callSid.slice(-4);
}

export function maskSecret(secret: string, forceUnmasked = false): string {
  if (!secret) return "";
  if (DISABLE_LOG_MASKING || forceUnmasked) return secret;
  if (secret.length <= 8) return "***";
  return secret.slice(0, 4) + "***";
}
