import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";

/**
 * Unflatten dot-notation keys into nested objects.
 * e.g. { "devices.camera_entrada.ip": "1.2.3.4" }
 *   → { devices: { camera_entrada: { ip: "1.2.3.4" } } }
 *
 * Firestore may store nested maps OR flat dot-keys depending
 * on how the Python script writes them. This handles both.
 */
function unflatten(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const parts = key.split(".");
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];

    // If value is already a plain object (nested map from Firestore), merge it
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      typeof (value as Record<string, unknown>).toDate !== "function"
    ) {
      const existing = current[lastPart];
      if (typeof existing === "object" && existing !== null) {
        current[lastPart] = { ...(existing as Record<string, unknown>), ...unflatten(value as Record<string, unknown>) };
      } else {
        current[lastPart] = unflatten(value as Record<string, unknown>);
      }
    } else {
      current[lastPart] = value;
    }
  }

  return result;
}

export async function GET() {
  try {
    const doc = await adminFirestore.collection("system_status").doc("current").get();

    if (!doc.exists) {
      return NextResponse.json({ error: "No system status found" }, { status: 404 });
    }

    const rawData = doc.data()!;
    const status = unflatten(rawData);

    return NextResponse.json({ status });
  } catch (error) {
    console.error("[dashboard/system-status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
