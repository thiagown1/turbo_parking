export interface ApiKeyEntry {
  hash: string;
  name: string;
  createdAt: string;
  active: boolean;
}

export interface ParkingConfig {
  id: string; // locationId (e.g., "metropole_shopping")
  name: string;
  enabled: boolean;

  // Validation rules
  toleranceMinutes: number;
  maxParkingDurationMinutes: number;
  minRechargeMinutes: number;
  rechargeToMinutesRatio: number;
  maxTicketAgeHours: number;

  // Linked stations
  linkedStationIds: string[];

  // API keys
  apiKeys: ApiKeyEntry[];

  // Camera
  cameraFeedUrl?: string;
  cameraFeedType?: "iframe" | "mjpeg" | "hls" | "image";

  // Testing / Overrides
  testModeAlwaysOpenGate?: boolean;

  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParkingDailyStats {
  date: string;
  locationId: string;
  totalEntries: number;
  totalValidated: number;
  totalOperatorValidated: number;
  totalExpired: number;
  totalRequiresPayment: number;
  totalRechargeMinutes: number;
  updatedAt: string;
}

export interface ParkingAdmin {
  uid: string;
  email: string;
  name: string;
  role: "admin" | "operator";
  locationIds: string[];
  createdAt: string;
}
