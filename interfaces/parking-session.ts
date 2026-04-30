export interface RechargeEntry {
  transactionId: string;
  stationId: string;
  userId: string;
  rechargeDurationMinutes: number;
  parkingMinutesGranted: number;
  accumulatedAt: string; // ISO string (serialized from Firestore Timestamp)
}

export type PaymentStatus = "free" | "pending" | "paid";

export type SessionStatus = "active" | "completed";

export interface ParkingSession {
  id: string; // Firestore document ID
  plate: string; // "SGT7D71"
  plate_normalized: string; // "SGT7D71"
  ticket_id?: string; // Visitor ticket ID from LPR system if applicable

  // Classification
  vehicle_type: "admin" | "morador" | "loja" | "visitante" | string;
  is_authorized: boolean; // true for residents, false for visitors
  owner_name?: string;

  // Gate
  gate_opened_by: "auto_lpr" | "manual" | "auto" | string;
  recognition_confidence: number;

  // Lifecycle
  status: SessionStatus;
  entry_time: string; // ISO string
  exit_time?: string | null; // ISO string
  duration_minutes?: number | null;

  // Payment
  payment_status: PaymentStatus;
  amount_charged?: number | null;

  // Auto-close
  auto_closed?: boolean;
  auto_close_reason?: string;

  // EV Recharge Integration (turbo_parking extension)
  ev_recharge_validated?: boolean;
  ev_total_recharge_minutes?: number;
  ev_total_parking_minutes_granted?: number;
  ev_recharge_history?: RechargeEntry[];
  ev_validated_at?: string; // ISO string
  ev_validated_by?: "system" | "operator";

  // Timestamps
  created_at: string;
  updated_at?: string;
}

export interface SessionValidationRequest {
  plate_normalized: string;
  locationId: string; // Left here if needed for API keys / config
}

export interface SessionAccumulateRequest {
  plate_normalized: string;
  locationId: string;
  transactionId: string;
  stationId: string;
  userId: string;
  rechargeDurationMinutes: number;
}

export interface SessionValidationResponse {
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
