#!/usr/bin/env npx tsx
/**
 * Preflight environment check script.
 * Run before migrations, seeding, tests, or builds to fail fast on missing env vars.
 * 
 * Usage: npx tsx scripts/preflight-env.ts
 * 
 * Exit codes:
 *   0 - All required environment variables are set
 *   1 - One or more required environment variables are missing
 */

const REQUIRED_VARS = ["DATABASE_URL"];
const OPTIONAL_VARS = ["OPENAI_API_KEY", "PUBLIC_HOST", "STREAM_TOKEN_SECRET"];

let hasErrors = false;

console.log("=== Environment Preflight Check ===\n");

for (const name of REQUIRED_VARS) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`[ERROR] Missing required environment variable: ${name}`);
    hasErrors = true;
  } else {
    const masked = value.length > 10 ? `${value.slice(0, 5)}...${value.slice(-3)}` : "***";
    console.log(`[OK] ${name} = ${masked}`);
  }
}

console.log("");

for (const name of OPTIONAL_VARS) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.log(`[WARN] Optional: ${name} is not set`);
  } else {
    console.log(`[OK] ${name} = ***`);
  }
}

console.log("");

if (hasErrors) {
  console.error("Preflight check FAILED. Set the missing environment variables and try again.");
  process.exit(1);
} else {
  console.log("Preflight check PASSED.");
  process.exit(0);
}
