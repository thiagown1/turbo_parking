import { accumulateRecharge, validateSession, getSessionByIdentifier } from "@/lib/services/parking-validation-service";
import type { ParkingSession } from "@/interfaces/parking-session";

// Mock the firebase admin module so tests don't try to connect to the emulator/prod
jest.mock("@/lib/firebase-admin", () => {
  return {
    adminFirestore: {
      collection: jest.fn(),
      runTransaction: jest.fn(),
    },
    adminAuth: {},
  };
});

import { adminFirestore } from "@/lib/firebase-admin";

const MOCK_CONFIG = {
  id: "metropole_shopping",
  name: "Metropole",
  enabled: true,
  toleranceMinutes: 10,
  maxParkingDurationMinutes: 240,
  minRechargeMinutes: 10,
  rechargeToMinutesRatio: 1.0,
  maxTicketAgeHours: 24,
  linkedStationIds: ["station-1"],
  apiKeys: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("Parking Validation Service", () => {
  let mockDocGet: jest.Mock;
  let mockDocUpdate: jest.Mock;
  let mockCollectionGet: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();

    mockDocUpdate = jest.fn().mockResolvedValue(true);
    
    // Default mock behavior for getting config
    const mockConfigDoc = {
      exists: true,
      id: MOCK_CONFIG.id,
      data: () => MOCK_CONFIG,
    };

    // Default mock for a parking session
    const mockSessionDoc = {
      empty: false,
      docs: [{
        id: "session-123",
        ref: { update: mockDocUpdate, get: jest.fn().mockResolvedValue({ data: () => ({ payment_status: "pending" }) }) },
        data: () => ({
          plate: "ABC1234",
          plate_normalized: "ABC1234",
          status: "active",
          payment_status: "pending",
          entry_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
          ev_total_recharge_minutes: 0,
          ev_total_parking_minutes_granted: 0,
          ev_recharge_history: []
        }),
      }],
    };

    const mockCollection = {
      doc: jest.fn().mockImplementation((id) => ({
        get: jest.fn().mockResolvedValue(id === "metropole_shopping" ? mockConfigDoc : mockSessionDoc.docs[0]),
        update: mockDocUpdate,
        ref: { update: mockDocUpdate },
      })),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(mockSessionDoc),
    };

    (adminFirestore.collection as jest.Mock).mockReturnValue(mockCollection);
    (adminFirestore.runTransaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        get: jest.fn().mockResolvedValue({ data: () => ({ payment_status: "pending" }) }),
        update: jest.fn(),
      });
    });
  });

  describe("accumulateRecharge", () => {
    it("should accumulate recharge minutes and NOT set status to paid if duration exceeds granted minutes", async () => {
      const entry = {
        transactionId: "tx-1",
        stationId: "station-1",
        userId: "user-1",
        rechargeDurationMinutes: 10, // 10 minutes granted
      };

      const result = await accumulateRecharge("ABC1234", "metropole_shopping", entry);
      
      expect(result.success).toBe(true);
      // Since it's been 60 minutes, and we only grant 10 + 10 tolerance = 20 coverage, it shouldn't be paid yet
      expect((adminFirestore.collection("parking_sessions").doc("session-123") as any).ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_status: "pending",
        })
      );
    });

    it("should set payment_status to paid if accumulated minutes cover the parking duration", async () => {
      const entry = {
        transactionId: "tx-2",
        stationId: "station-1",
        userId: "user-1",
        rechargeDurationMinutes: 60, // 60 minutes granted
      };

      const result = await accumulateRecharge("ABC1234", "metropole_shopping", entry);
      
      expect(result.success).toBe(true);
      // 60 minutes granted + 10 tolerance = 70 minutes coverage. Duration is 60. Should be paid!
      expect((adminFirestore.collection("parking_sessions").doc("session-123") as any).ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_status: "paid",
        })
      );
    });
  });

  describe("validateSession", () => {
    it("should fail validation if parking duration exceeds coverage", async () => {
      // Current session has 0 granted minutes, 60 minutes duration. 60 > 10 (tolerance)
      const result = await validateSession("ABC1234", "metropole_shopping");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_RECHARGE");
    });
  });
});
