import { adminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ParkingSession, SessionStatus, RechargeEntry, PaymentStatus } from "@/interfaces/parking-session";
import type { ParkingConfig } from "@/interfaces/parking-config";

/**
 * Core parking validation logic for the Python LPR system.
 */

const SESSIONS_COLLECTION = "parking_sessions";
const CONFIG_COLLECTION = "pricing_config"; // Python uses pricing_config for prices, but we might have our own config or merge it.

// ─── Config ───

export async function getConfig(locationId: string): Promise<ParkingConfig | null> {
  // Using our own parking_config for turbo_parking specific settings (like enabled, ratio)
  // Python uses `pricing_config/current` for pricing. We'll use our own collection for our configs.
  const doc = await adminFirestore.collection("parking_config").doc(locationId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ParkingConfig;
}

export async function updateConfig(locationId: string, updates: Partial<ParkingConfig>): Promise<void> {
  const { id, ...data } = updates as ParkingConfig & { id?: string };
  await adminFirestore.collection("parking_config").doc(locationId).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // Sync test mode to the Python script's configuration
  if (data.testModeAlwaysOpenGate !== undefined) {
    await adminFirestore.collection("pricing_config").doc("current").set(
      { always_open_gate: data.testModeAlwaysOpenGate, updated_at: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
}

// ─── Session CRUD ───

export async function getSessionByIdentifier(identifier: string): Promise<ParkingSession | null> {
  // Try plate first
  let snap = await adminFirestore
    .collection(SESSIONS_COLLECTION)
    .where("plate_normalized", "==", identifier)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snap.empty) {
    // Try ticket_id
    snap = await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .where("ticket_id", "==", identifier)
      .where("status", "==", "active")
      .limit(1)
      .get();
  }

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return serializeSession(doc.id, doc.data());
}

export async function listSessions(opts: {
  status?: SessionStatus;
  limit?: number;
}): Promise<ParkingSession[]> {
  let query = adminFirestore.collection(SESSIONS_COLLECTION).orderBy("created_at", "desc");

  if (opts.status) query = query.where("status", "==", opts.status);

  const snap = await query.limit(opts.limit || 50).get();
  return snap.docs.map((doc) => serializeSession(doc.id, doc.data()));
}

// ─── Accumulate ───

export interface AccumulateResult {
  success: boolean;
  session: ParkingSession;
}

export async function accumulateRecharge(
  plate_normalized: string,
  locationId: string,
  entry: Omit<RechargeEntry, "parkingMinutesGranted" | "accumulatedAt">
): Promise<AccumulateResult | { success: false; error: string }> {
  const config = await getConfig(locationId);
  if (!config) return { success: false, error: "LOCATION_NOT_FOUND" };
  if (!config.enabled) return { success: false, error: "LOCATION_DISABLED" };

  const parkingMinutesGranted = entry.rechargeDurationMinutes * config.rechargeToMinutesRatio;

  const sessionSnap = await adminFirestore
    .collection(SESSIONS_COLLECTION)
    .where("plate_normalized", "==", plate_normalized)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (sessionSnap.empty) {
    return { success: false, error: "SESSION_NOT_FOUND" };
  }

  const doc = sessionSnap.docs[0];
  const existing = doc.data() as ParkingSession;

  if (existing.payment_status === "paid") {
    return { success: false, error: "ALREADY_VALIDATED" };
  }

  const rechargeEntry: RechargeEntry = {
    ...entry,
    parkingMinutesGranted,
    accumulatedAt: new Date().toISOString(),
  };

  // Check if this new accumulation covers the duration
  let payment_status: PaymentStatus = existing.payment_status;
  const totalRechargeMinutes = (existing.ev_total_recharge_minutes || 0) + entry.rechargeDurationMinutes;
  const totalParkingMinutesGranted = (existing.ev_total_parking_minutes_granted || 0) + parkingMinutesGranted;

  // Calculate parking duration so far
  let durationMinutes = existing.duration_minutes || 0;
  if (existing.entry_time) {
    const entryTime = new Date(existing.entry_time).getTime();
    durationMinutes = (Date.now() - entryTime) / (1000 * 60);
  }

  const coverageMinutes = totalParkingMinutesGranted + config.toleranceMinutes;
  
  if (durationMinutes <= coverageMinutes && totalRechargeMinutes >= config.minRechargeMinutes) {
    payment_status = "paid" as PaymentStatus;
  }

  await doc.ref.update({
    ev_total_recharge_minutes: FieldValue.increment(entry.rechargeDurationMinutes),
    ev_total_parking_minutes_granted: FieldValue.increment(parkingMinutesGranted),
    ev_recharge_history: FieldValue.arrayUnion(rechargeEntry),
    payment_status: payment_status,
    ev_recharge_validated: payment_status === "paid" ? true : existing.ev_recharge_validated,
    ev_validated_at: payment_status === "paid" ? new Date().toISOString() : existing.ev_validated_at,
    ev_validated_by: payment_status === "paid" ? "system" : existing.ev_validated_by,
    updated_at: FieldValue.serverTimestamp(),
  });

  const updated = await doc.ref.get();
  return { success: true, session: serializeSession(doc.id, updated.data()!) };
}

// ─── Validate ───

export interface ValidationResult {
  success: boolean;
  session?: ParkingSession;
  error?: string;
  details?: {
    parkingDurationMinutes: number;
    totalParkingMinutesGranted: number;
    toleranceMinutes: number;
    shortfallMinutes: number;
  };
}

export async function validateSession(
  identifier: string,
  locationId: string
): Promise<ValidationResult> {
  const config = await getConfig(locationId);
  if (!config) return { success: false, error: "LOCATION_NOT_FOUND" };
  if (!config.enabled) return { success: false, error: "LOCATION_DISABLED" };

  const session = await getSessionByIdentifier(identifier);
  if (!session) return { success: false, error: "SESSION_NOT_FOUND" };

  if (session.payment_status === "paid" || session.payment_status === "free") {
    return { success: true, session }; // Idempotent
  }

  if (session.status === "completed") {
    return { success: false, error: "SESSION_COMPLETED" };
  }

  // Calculate parking duration
  const entryTime = new Date(session.entry_time).getTime();
  const now = Date.now();
  const parkingDurationMinutes = (now - entryTime) / (1000 * 60);

  const totalParkingMinutesGranted = session.ev_total_parking_minutes_granted || 0;
  const totalRechargeMinutes = session.ev_total_recharge_minutes || 0;

  // Check max parking duration
  if (parkingDurationMinutes > config.maxParkingDurationMinutes) {
    return {
      success: false,
      error: "REQUIRES_PAYMENT",
      details: {
        parkingDurationMinutes: Math.round(parkingDurationMinutes),
        totalParkingMinutesGranted,
        toleranceMinutes: config.toleranceMinutes,
        shortfallMinutes: Math.round(parkingDurationMinutes - totalParkingMinutesGranted - config.toleranceMinutes),
      },
    };
  }

  // Check minimum recharge
  if (totalRechargeMinutes < config.minRechargeMinutes) {
    return {
      success: false,
      error: "INSUFFICIENT_RECHARGE",
      details: {
        parkingDurationMinutes: Math.round(parkingDurationMinutes),
        totalParkingMinutesGranted,
        toleranceMinutes: config.toleranceMinutes,
        shortfallMinutes: Math.round(config.minRechargeMinutes - totalRechargeMinutes),
      },
    };
  }

  // Check coverage
  const coverageMinutes = totalParkingMinutesGranted + config.toleranceMinutes;
  if (parkingDurationMinutes > coverageMinutes) {
    return {
      success: false,
      error: "INSUFFICIENT_RECHARGE_TIME",
      details: {
        parkingDurationMinutes: Math.round(parkingDurationMinutes),
        totalParkingMinutesGranted,
        toleranceMinutes: config.toleranceMinutes,
        shortfallMinutes: Math.round(parkingDurationMinutes - coverageMinutes),
      },
    };
  }

  // ✅ Validate — atomic update
  const docRef = adminFirestore.collection(SESSIONS_COLLECTION).doc(session.id);
  const ev_validated_at = new Date().toISOString();

  await adminFirestore.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data();
    if (data?.payment_status !== "pending") {
      throw new Error("SESSION_STATUS_CHANGED");
    }
    tx.update(docRef, {
      payment_status: "paid",
      ev_recharge_validated: true,
      ev_validated_at,
      ev_validated_by: "system",
      updated_at: FieldValue.serverTimestamp(),
    });
  });

  return {
    success: true,
    session: { ...session, payment_status: "paid", ev_recharge_validated: true, ev_validated_at, ev_validated_by: "system" },
  };
}

export async function operatorValidateSession(
  identifier: string,
  locationId: string,
  operatorUserId: string,
  notes?: string
): Promise<ValidationResult> {
  const session = await getSessionByIdentifier(identifier);
  if (!session) return { success: false, error: "SESSION_NOT_FOUND" };

  if (session.payment_status === "paid" || session.payment_status === "free") {
    return { success: true, session }; // Idempotent
  }

  const docRef = adminFirestore.collection(SESSIONS_COLLECTION).doc(session.id);
  const ev_validated_at = new Date().toISOString();

  await docRef.update({
    payment_status: "paid",
    ev_recharge_validated: true,
    ev_validated_at,
    ev_validated_by: "operator",
    updated_at: FieldValue.serverTimestamp(),
    // We could add notes to a specific field if needed
  });

  return {
    success: true,
    session: {
      ...session,
      payment_status: "paid",
      ev_recharge_validated: true,
      ev_validated_at,
      ev_validated_by: "operator",
    },
  };
}

// ─── Helpers ───

function serializeSession(id: string, data: FirebaseFirestore.DocumentData): ParkingSession {
  return {
    id,
    plate: data.plate || "???",
    plate_normalized: data.plate_normalized || "???",
    ticket_id: data.ticket_id,
    vehicle_type: data.vehicle_type || "desconhecido",
    is_authorized: !!data.is_authorized,
    owner_name: data.owner_name,
    gate_opened_by: data.gate_opened_by || "auto_lpr",
    recognition_confidence: data.recognition_confidence || 0,
    status: data.status || "active",
    entry_time: toISOString(data.entry_time),
    exit_time: data.exit_time ? toISOString(data.exit_time) : null,
    duration_minutes: data.duration_minutes,
    payment_status: data.payment_status || "pending",
    amount_charged: data.amount_charged,
    auto_closed: data.auto_closed,
    auto_close_reason: data.auto_close_reason,
    ev_recharge_validated: data.ev_recharge_validated,
    ev_total_recharge_minutes: data.ev_total_recharge_minutes || 0,
    ev_total_parking_minutes_granted: data.ev_total_parking_minutes_granted || 0,
    ev_recharge_history: data.ev_recharge_history || [],
    ev_validated_at: data.ev_validated_at ? toISOString(data.ev_validated_at) : undefined,
    ev_validated_by: data.ev_validated_by,
    created_at: toISOString(data.created_at || data.entry_time),
    updated_at: toISOString(data.updated_at),
  };
}

function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate(): Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

// ─── Dashboard Stats ───

export interface DashboardStats {
  activeInLot: number;
  validatedEV: number;
  pendingPayment: number;
  totalDetectionsToday: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const sessionsRef = adminFirestore.collection(SESSIONS_COLLECTION);

  // Active sessions (vehicles currently in the lot)
  const activeSnap = await sessionsRef
    .where("status", "==", "active")
    .get();

  let validatedEV = 0;
  let pendingPayment = 0;

  activeSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.payment_status === "paid") validatedEV++;
    if (data.payment_status === "pending") pendingPayment++;
  });

  // Today's detections (entries created today)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todaySnap = await sessionsRef
    .where("entry_time", ">=", todayStart)
    .get();

  return {
    activeInLot: activeSnap.size,
    validatedEV,
    pendingPayment,
    totalDetectionsToday: todaySnap.size,
  };
}

export async function getRecentSessions(limit = 5): Promise<ParkingSession[]> {
  const snap = await adminFirestore
    .collection(SESSIONS_COLLECTION)
    .orderBy("entry_time", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => serializeSession(doc.id, doc.data()));
}
