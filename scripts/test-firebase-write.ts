/**
 * Quick test: write to pricing_config/current and read it back.
 * Run: npx tsx scripts/test-firebase-write.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Parse .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  let val = trimmed.slice(eqIdx + 1);
  // Remove surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const projectId = env.FIREBASE_PROJECT_ID || "metropoleparking";
const clientEmail = env.FIREBASE_CLIENT_EMAIL!;
const privateKey = env.FIREBASE_PRIVATE_KEY!.split("\\n").join("\n");

console.log("Project ID:", projectId);
console.log("Client Email:", clientEmail);
console.log("Private Key length:", privateKey.length);

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});

const db = getFirestore(app);

async function main() {
  const docRef = db.doc("pricing_config/current");

  // Read current state
  const before = await docRef.get();
  console.log("\n--- BEFORE ---");
  if (before.exists) {
    const data = before.data()!;
    // Convert Timestamp fields
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && typeof v.toDate === "function") {
        data[k] = v.toDate().toISOString();
      }
    }
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("Document does not exist!");
  }

  // Write test_mode = true + timestamp
  console.log("\n--- WRITING test_mode=true ---");
  await docRef.set(
    {
      test_mode: true,
      _test_write: "from-script-" + new Date().toISOString(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Read back
  const after = await docRef.get();
  console.log("\n--- AFTER ---");
  if (after.exists) {
    const data = after.data()!;
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && typeof v.toDate === "function") {
        data[k] = v.toDate().toISOString();
      }
    }
    console.log(JSON.stringify(data, null, 2));
  }

  console.log("\n✅ Write test complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
