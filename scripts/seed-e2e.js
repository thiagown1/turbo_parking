/**
 * Seed Firestore with known test data for E2E testing.
 * Creates parking sessions with predictable values we can assert against.
 */
const admin = require("firebase-admin");
const serviceAccount = require("../firebase_credentials.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const TEST_SESSIONS = [
  {
    id: "e2e-test-active-pending",
    plate: "TEST001",
    plate_normalized: "TEST001",
    vehicle_type: "visitante",
    is_authorized: false,
    gate_opened_by: "auto_lpr",
    recognition_confidence: 97.5,
    entry_time: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
    status: "active",
    payment_status: "pending",
    ev_total_recharge_minutes: 0,
    ev_total_parking_minutes_granted: 0,
    ev_recharge_history: [],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: "e2e-test-active-paid",
    plate: "TEST002",
    plate_normalized: "TEST002",
    vehicle_type: "visitante",
    is_authorized: false,
    gate_opened_by: "auto_lpr",
    recognition_confidence: 95.0,
    entry_time: new Date(Date.now() - 90 * 60 * 1000), // 90 min ago
    status: "active",
    payment_status: "paid",
    ev_total_recharge_minutes: 60,
    ev_total_parking_minutes_granted: 60,
    ev_recharge_validated: true,
    ev_validated_at: new Date().toISOString(),
    ev_recharge_history: [
      {
        transactionId: "tx-e2e-001",
        stationId: "metropole-01",
        userId: "user-e2e",
        rechargeDurationMinutes: 60,
        parkingMinutesGranted: 60,
        accumulatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: "e2e-test-authorized",
    plate: "TEST003",
    plate_normalized: "TEST003",
    vehicle_type: "morador",
    is_authorized: true,
    gate_opened_by: "auto_lpr",
    recognition_confidence: 99.1,
    entry_time: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
    status: "active",
    payment_status: "free",
    ev_total_recharge_minutes: 0,
    ev_total_parking_minutes_granted: 0,
    ev_recharge_history: [],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  },
];

async function seed() {
  console.log("Seeding test data...\n");

  for (const session of TEST_SESSIONS) {
    const { id, ...data } = session;
    await db.collection("parking_sessions").doc(id).set(data);
    console.log(`  ✅ ${id} → plate: ${data.plate} | status: ${data.status} | payment: ${data.payment_status}`);
  }

  console.log(`\n✅ Seeded ${TEST_SESSIONS.length} test sessions.`);
}

async function cleanup() {
  console.log("Cleaning up test data...\n");

  for (const session of TEST_SESSIONS) {
    await db.collection("parking_sessions").doc(session.id).delete();
    console.log(`  🗑️  Deleted ${session.id}`);
  }

  console.log("\n✅ Cleanup complete.");
}

const action = process.argv[2];
if (action === "cleanup") {
  cleanup().then(() => process.exit(0));
} else {
  seed().then(() => process.exit(0));
}
