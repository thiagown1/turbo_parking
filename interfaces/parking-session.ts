export interface RechargeEntry {
  transactionId: string;
  stationId: string;
  userId: string;
  rechargeDurationMinutes: number;
  parkingMinutesGranted: number;
  accumulatedAt: string; // ISO string (serialized from Firestore Timestamp)
}

export type PaymentStatus =
  | "exempt_resident"     // Morador cadastrado — abre cancela
  | "exempt_tolerance"    // Dentro dos 20min grátis — abre cancela
  | "exempt_store"        // Loja validou (dentro do prazo) — abre cancela
  | "exempt_test"         // Modo teste ativo — abre cancela
  | "paid"                // Pagou no totem — abre cancela
  | "pending"             // Não pagou — bloqueia
  | "pending_excess";     // Loja validou mas excedeu horas — bloqueia

/** Helper: statuses that allow the gate to open */
export const GATE_OPEN_STATUSES: PaymentStatus[] = [
  "exempt_resident",
  "exempt_tolerance",
  "exempt_store",
  "exempt_test",
  "paid",
];

/** Helper: check if a status allows the gate to open */
export function isGateOpenStatus(status: PaymentStatus): boolean {
  return GATE_OPEN_STATUSES.includes(status);
}

/** Human-readable labels for payment statuses */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  exempt_resident: "Morador",
  exempt_tolerance: "Tolerância",
  exempt_store: "Validado Loja",
  exempt_test: "Modo Teste",
  paid: "Pago",
  pending: "Pendente",
  pending_excess: "Excedido",
};

/** Badge style variant for each status */
export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  exempt_resident: "badge-info",
  exempt_tolerance: "badge-info",
  exempt_store: "badge-success",
  exempt_test: "badge-info",
  paid: "badge-success",
  pending: "badge-warning",
  pending_excess: "badge-error",
};

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
