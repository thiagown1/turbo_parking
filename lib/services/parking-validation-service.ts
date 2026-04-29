import { adminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ParkingTicket, TicketStatus, RechargeEntry } from "@/interfaces/parking-ticket";
import type { ParkingConfig } from "@/interfaces/parking-config";

/**
 * Core parking validation logic.
 *
 * Validation rules:
 * - parkingDuration = now - entryTimestamp
 * - coverageMinutes = totalParkingMinutesGranted + toleranceMinutes
 * - if parkingDuration > maxParkingDurationMinutes → REQUIRES_PAYMENT
 * - if totalRechargeMinutes < minRechargeMinutes → INSUFFICIENT_RECHARGE
 * - if parkingDuration <= coverageMinutes → VALIDATE ✅
 * - else → INSUFFICIENT_RECHARGE_TIME
 */

const TICKETS_COLLECTION = "parking_tickets";
const CONFIG_COLLECTION = "parking_config";

// ─── Config ───

export async function getConfig(locationId: string): Promise<ParkingConfig | null> {
  const doc = await adminFirestore.collection(CONFIG_COLLECTION).doc(locationId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ParkingConfig;
}

export async function updateConfig(locationId: string, updates: Partial<ParkingConfig>): Promise<void> {
  const { id, ...data } = updates as ParkingConfig & { id?: string };
  await adminFirestore.collection(CONFIG_COLLECTION).doc(locationId).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

// ─── Ticket CRUD ───

export async function getTicketByCode(ticketCode: string): Promise<ParkingTicket | null> {
  const snap = await adminFirestore
    .collection(TICKETS_COLLECTION)
    .where("ticketCode", "==", ticketCode)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return serializeTicket(doc.id, doc.data());
}

export async function listTickets(opts: {
  locationId?: string;
  status?: TicketStatus;
  limit?: number;
}): Promise<ParkingTicket[]> {
  let query = adminFirestore.collection(TICKETS_COLLECTION).orderBy("createdAt", "desc");

  if (opts.locationId) query = query.where("locationId", "==", opts.locationId);
  if (opts.status) query = query.where("status", "==", opts.status);

  const snap = await query.limit(opts.limit || 50).get();
  return snap.docs.map((doc) => serializeTicket(doc.id, doc.data()));
}

// ─── Accumulate ───

export interface AccumulateResult {
  success: boolean;
  ticket: ParkingTicket;
}

export async function accumulateRecharge(
  ticketCode: string,
  locationId: string,
  entry: Omit<RechargeEntry, "parkingMinutesGranted" | "accumulatedAt">
): Promise<AccumulateResult | { success: false; error: string }> {
  const config = await getConfig(locationId);
  if (!config) return { success: false, error: "LOCATION_NOT_FOUND" };
  if (!config.enabled) return { success: false, error: "LOCATION_DISABLED" };

  const parkingMinutesGranted = entry.rechargeDurationMinutes * config.rechargeToMinutesRatio;

  const ticketSnap = await adminFirestore
    .collection(TICKETS_COLLECTION)
    .where("ticketCode", "==", ticketCode)
    .limit(1)
    .get();

  if (ticketSnap.empty) {
    // Create ticket if it doesn't exist (first recharge creates the ticket)
    const now = new Date().toISOString();
    const newTicket: Omit<ParkingTicket, "id"> = {
      ticketCode,
      locationId,
      entryTimestamp: now,
      status: "pending",
      totalRechargeMinutes: entry.rechargeDurationMinutes,
      totalParkingMinutesGranted: parkingMinutesGranted,
      rechargeHistory: [
        {
          ...entry,
          parkingMinutesGranted,
          accumulatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminFirestore.collection(TICKETS_COLLECTION).add({
      ...newTicket,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, ticket: { id: docRef.id, ...newTicket } };
  }

  // Update existing ticket
  const doc = ticketSnap.docs[0];
  const existing = doc.data();

  if (existing.status === "validated") {
    return { success: false, error: "ALREADY_VALIDATED" };
  }

  const rechargeEntry: RechargeEntry = {
    ...entry,
    parkingMinutesGranted,
    accumulatedAt: new Date().toISOString(),
  };

  await doc.ref.update({
    totalRechargeMinutes: FieldValue.increment(entry.rechargeDurationMinutes),
    totalParkingMinutesGranted: FieldValue.increment(parkingMinutesGranted),
    rechargeHistory: FieldValue.arrayUnion(rechargeEntry),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updated = await doc.ref.get();
  return { success: true, ticket: serializeTicket(doc.id, updated.data()!) };
}

// ─── Validate ───

export interface ValidationResult {
  success: boolean;
  ticket?: ParkingTicket;
  error?: string;
  details?: {
    parkingDurationMinutes: number;
    totalParkingMinutesGranted: number;
    toleranceMinutes: number;
    shortfallMinutes: number;
  };
}

export async function validateTicket(
  ticketCode: string,
  locationId: string
): Promise<ValidationResult> {
  const config = await getConfig(locationId);
  if (!config) return { success: false, error: "LOCATION_NOT_FOUND" };
  if (!config.enabled) return { success: false, error: "LOCATION_DISABLED" };

  const ticket = await getTicketByCode(ticketCode);
  if (!ticket) return { success: false, error: "TICKET_NOT_FOUND" };

  if (ticket.status === "validated") {
    return { success: true, ticket }; // Idempotent
  }

  if (ticket.status === "expired") {
    return { success: false, error: "TICKET_EXPIRED" };
  }

  // Calculate parking duration
  const entryTime = new Date(ticket.entryTimestamp).getTime();
  const now = Date.now();
  const parkingDurationMinutes = (now - entryTime) / (1000 * 60);

  // Check max parking duration
  if (parkingDurationMinutes > config.maxParkingDurationMinutes) {
    return {
      success: false,
      error: "REQUIRES_PAYMENT",
      details: {
        parkingDurationMinutes: Math.round(parkingDurationMinutes),
        totalParkingMinutesGranted: ticket.totalParkingMinutesGranted,
        toleranceMinutes: config.toleranceMinutes,
        shortfallMinutes: Math.round(parkingDurationMinutes - ticket.totalParkingMinutesGranted - config.toleranceMinutes),
      },
    };
  }

  // Check minimum recharge
  if (ticket.totalRechargeMinutes < config.minRechargeMinutes) {
    return {
      success: false,
      error: "INSUFFICIENT_RECHARGE",
      details: {
        parkingDurationMinutes: Math.round(parkingDurationMinutes),
        totalParkingMinutesGranted: ticket.totalParkingMinutesGranted,
        toleranceMinutes: config.toleranceMinutes,
        shortfallMinutes: Math.round(config.minRechargeMinutes - ticket.totalRechargeMinutes),
      },
    };
  }

  // Check coverage
  const coverageMinutes = ticket.totalParkingMinutesGranted + config.toleranceMinutes;
  if (parkingDurationMinutes > coverageMinutes) {
    return {
      success: false,
      error: "INSUFFICIENT_RECHARGE_TIME",
      details: {
        parkingDurationMinutes: Math.round(parkingDurationMinutes),
        totalParkingMinutesGranted: ticket.totalParkingMinutesGranted,
        toleranceMinutes: config.toleranceMinutes,
        shortfallMinutes: Math.round(parkingDurationMinutes - coverageMinutes),
      },
    };
  }

  // ✅ Validate — atomic update
  const ticketSnap = await adminFirestore
    .collection(TICKETS_COLLECTION)
    .where("ticketCode", "==", ticketCode)
    .limit(1)
    .get();

  if (ticketSnap.empty) return { success: false, error: "TICKET_NOT_FOUND" };

  const docRef = ticketSnap.docs[0].ref;
  const validatedAt = new Date().toISOString();

  await adminFirestore.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data();
    if (data?.status !== "pending") {
      throw new Error("TICKET_STATUS_CHANGED");
    }
    tx.update(docRef, {
      status: "validated",
      validatedAt,
      validatedBy: "system",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    success: true,
    ticket: { ...ticket, status: "validated", validatedAt, validatedBy: "system" },
  };
}

export async function operatorValidateTicket(
  ticketCode: string,
  locationId: string,
  operatorUserId: string,
  notes?: string
): Promise<ValidationResult> {
  const ticket = await getTicketByCode(ticketCode);
  if (!ticket) return { success: false, error: "TICKET_NOT_FOUND" };

  if (ticket.status === "validated") {
    return { success: true, ticket }; // Idempotent
  }

  const ticketSnap = await adminFirestore
    .collection(TICKETS_COLLECTION)
    .where("ticketCode", "==", ticketCode)
    .limit(1)
    .get();

  if (ticketSnap.empty) return { success: false, error: "TICKET_NOT_FOUND" };

  const docRef = ticketSnap.docs[0].ref;
  const validatedAt = new Date().toISOString();

  await docRef.update({
    status: "validated",
    validatedAt,
    validatedBy: "operator",
    validatedByUserId: operatorUserId,
    validationNotes: notes || null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    ticket: {
      ...ticket,
      status: "validated",
      validatedAt,
      validatedBy: "operator",
      validatedByUserId: operatorUserId,
      validationNotes: notes,
    },
  };
}

// ─── Helpers ───

function serializeTicket(id: string, data: FirebaseFirestore.DocumentData): ParkingTicket {
  return {
    id,
    ticketCode: data.ticketCode,
    locationId: data.locationId,
    entryTimestamp: toISOString(data.entryTimestamp),
    licensePlate: data.licensePlate,
    vinCode: data.vinCode,
    status: data.status,
    validatedAt: data.validatedAt ? toISOString(data.validatedAt) : undefined,
    validatedBy: data.validatedBy,
    validatedByUserId: data.validatedByUserId,
    validationNotes: data.validationNotes,
    totalRechargeMinutes: data.totalRechargeMinutes || 0,
    totalParkingMinutesGranted: data.totalParkingMinutesGranted || 0,
    rechargeHistory: data.rechargeHistory || [],
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
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
