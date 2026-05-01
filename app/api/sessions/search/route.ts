import { NextRequest, NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";
import type { ParkingSession } from "@/interfaces/parking-session";

/**
 * Dashboard-only search endpoint.
 * Supports partial plate prefix matching (e.g., "RED" matches "RED1D79").
 * No API key required — protected by session cookie via middleware.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toUpperCase().trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
    }

    // Firestore prefix range query: >= "RED" and < "REE" (next char after D)
    // We filter status client-side to avoid requiring a composite index.
    const endPrefix = q.slice(0, -1) + String.fromCharCode(q.charCodeAt(q.length - 1) + 1);

    const snap = await adminFirestore
      .collection("parking_sessions")
      .where("plate_normalized", ">=", q)
      .where("plate_normalized", "<", endPrefix)
      .orderBy("plate_normalized")
      .limit(50)
      .get();

    const activeDocs = snap.docs.filter((doc) => doc.data().status === "active");

    const sessions: ParkingSession[] = activeDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        plate: data.plate || "???",
        plate_normalized: data.plate_normalized || "???",
        ticket_id: data.ticket_id,
        vehicle_type: data.vehicle_type || "desconhecido",
        is_authorized: !!data.is_authorized,
        owner_name: data.owner_name,
        gate_opened_by: data.gate_opened_by || "auto_lpr",
        recognition_confidence: data.recognition_confidence || 0,
        status: data.status || "active",
        entry_time: toISO(data.entry_time),
        exit_time: data.exit_time ? toISO(data.exit_time) : null,
        duration_minutes: data.duration_minutes,
        payment_status: data.payment_status || "pending",
        amount_charged: data.amount_charged,
        ev_recharge_validated: data.ev_recharge_validated,
        ev_total_recharge_minutes: data.ev_total_recharge_minutes || 0,
        ev_total_parking_minutes_granted: data.ev_total_parking_minutes_granted || 0,
        ev_recharge_history: data.ev_recharge_history || [],
        ev_validated_at: data.ev_validated_at ? toISO(data.ev_validated_at) : undefined,
        ev_validated_by: data.ev_validated_by,
        created_at: toISO(data.created_at || data.entry_time),
        updated_at: toISO(data.updated_at),
      } as ParkingSession;
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[sessions/search] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function toISO(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate(): Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}
