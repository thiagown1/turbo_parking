import crypto from "crypto";

const DEFAULT_PREFIX_BYTES = 4; // 8 hex chars
const DEFAULT_SECRET_BYTES = 24; // 48 hex chars

export function getApiKeysPepper(): string {
  const pepper = process.env.API_KEYS_PEPPER;
  if (!pepper || pepper.trim().length < 16) {
    throw new Error("API_KEYS_PEPPER is not configured (min length 16)");
  }
  return pepper;
}

export function hashApiKey(rawKey: string, pepper: string): string {
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${rawKey}`)
    .digest("hex");
}

export function extractApiKeyPrefix(rawKey: string): string | null {
  const trimmed = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!trimmed) return null;
  const idx = trimmed.indexOf(".");
  if (idx <= 0) return null;
  const prefix = trimmed.slice(0, idx);
  if (!/^[a-f0-9]{8}$/i.test(prefix)) return null;
  return prefix;
}

export interface GeneratedApiKey {
  rawKey: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(pepper: string): GeneratedApiKey {
  const prefix = crypto.randomBytes(DEFAULT_PREFIX_BYTES).toString("hex");
  const secret = crypto.randomBytes(DEFAULT_SECRET_BYTES).toString("hex");
  const rawKey = `${prefix}.${secret}`;
  const hash = hashApiKey(rawKey, pepper);
  return { rawKey, prefix, hash };
}
