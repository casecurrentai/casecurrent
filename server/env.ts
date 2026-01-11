/**
 * Centralized environment variable validation.
 * Import this module early in server startup to fail fast on missing required env vars.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, defaultValue: string = ""): string {
  return process.env[name] || defaultValue;
}

// Required environment variables - fail fast if missing
export const DATABASE_URL = requireEnv("DATABASE_URL");

// Optional environment variables with defaults
export const NODE_ENV = optionalEnv("NODE_ENV", "development");
export const PORT = optionalEnv("PORT", "5000");
export const PUBLIC_HOST = optionalEnv("PUBLIC_HOST", "");
export const STREAM_TOKEN_SECRET = optionalEnv("STREAM_TOKEN_SECRET", "");
export const OPENAI_API_KEY = optionalEnv("OPENAI_API_KEY", "");
