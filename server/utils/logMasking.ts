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

/**
 * Normalize a phone number to E.164 format variants for lookup.
 * Returns an array of possible E.164 formats to try.
 */
export function normalizeToE164Variants(value: string): string[] {
  if (!value) return [];
  
  const variants: string[] = [];
  let cleaned = value.trim();
  
  // Add original raw value first
  variants.push(value);
  
  // Add trimmed value if different
  if (cleaned !== value) {
    variants.push(cleaned);
  }
  
  // Handle SIP URI format: sip:+18443214257@...
  if (cleaned.toLowerCase().startsWith("sip:")) {
    const sipMatch = cleaned.match(/^sip:([^@;]+)/i);
    if (sipMatch) {
      cleaned = sipMatch[1];
      variants.push(cleaned);
    }
  }
  
  // Extract digits only
  const digitsOnly = cleaned.replace(/\D/g, "");
  
  if (digitsOnly.length > 0) {
    // Try with + prefix
    const withPlus = "+" + digitsOnly;
    if (!variants.includes(withPlus)) {
      variants.push(withPlus);
    }
    
    // If 11 digits starting with 1, it's likely US with country code
    if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      const usFormat = "+" + digitsOnly;
      if (!variants.includes(usFormat)) {
        variants.push(usFormat);
      }
    }
    
    // If 10 digits, assume US and add +1 prefix
    if (digitsOnly.length === 10) {
      const usWithCountry = "+1" + digitsOnly;
      if (!variants.includes(usWithCountry)) {
        variants.push(usWithCountry);
      }
    }
  }
  
  return variants;
}
