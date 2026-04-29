export interface RechargeEntry {
  transactionId: string;
  stationId: string;
  userId: string;
  rechargeDurationMinutes: number;
  parkingMinutesGranted: number;
  accumulatedAt: string; // ISO string (serialized from Firestore Timestamp)
}

export type TicketStatus =
  | "pending"
  | "validated"
  | "expired"
  | "requires_payment";

export interface ParkingTicket {
  id: string; // Firestore document ID
  ticketCode: string;
  locationId: string;

  // Entry
  entryTimestamp: string; // ISO string
  licensePlate?: string;
  vinCode?: string;

  // Validation
  status: TicketStatus;
  validatedAt?: string;
  validatedBy?: "system" | "operator";
  validatedByUserId?: string;
  validationNotes?: string;

  // Recharge accumulation
  totalRechargeMinutes: number;
  totalParkingMinutesGranted: number;
  rechargeHistory: RechargeEntry[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface TicketValidationRequest {
  ticketCode: string;
  locationId: string;
}

export interface TicketAccumulateRequest {
  ticketCode: string;
  locationId: string;
  transactionId: string;
  stationId: string;
  userId: string;
  rechargeDurationMinutes: number;
}

export interface TicketValidationResponse {
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
