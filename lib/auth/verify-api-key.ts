import { NextRequest, NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";
import { hashApiKey, extractApiKeyPrefix, getApiKeysPepper } from "@/lib/auth/api-key-crypto";

/**
 * Verifies an API key from the Authorization header against stored hashes
 * in the parking_config collection.
 *
 * Returns the locationId if valid, or a NextResponse error.
 */
export async function verifyApiKey(
  req: NextRequest
): Promise<{ locationId: string } | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  const rawKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!rawKey) {
    return NextResponse.json({ error: "Empty API key" }, { status: 401 });
  }

  const prefix = extractApiKeyPrefix(rawKey);
  if (!prefix) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
  }

  let pepper: string;
  try {
    pepper = getApiKeysPepper();
  } catch {
    console.error("[verify-api-key] API_KEYS_PEPPER not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const keyHash = hashApiKey(rawKey, pepper);

  // Search all parking_config documents for a matching API key hash
  const configsSnap = await adminFirestore.collection("parking_config").get();

  for (const doc of configsSnap.docs) {
    const data = doc.data();
    const apiKeys = data.apiKeys || [];

    for (const key of apiKeys) {
      if (key.active && key.hash === keyHash) {
        return { locationId: doc.id };
      }
    }
  }

  return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
}
