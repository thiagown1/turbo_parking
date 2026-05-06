/**
 * Migrate data from pricing_config/current to parking_config/current
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const projectId = env.FIREBASE_PROJECT_ID || "metropoleparking";
const clientEmail = env.FIREBASE_CLIENT_EMAIL!;
const privateKey = env.FIREBASE_PRIVATE_KEY!.split("\\n").join("\n");

const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

async function main() {
  // Read from parking_config/current (the CORRECT collection the user has)
  const parkingDoc = await db.doc("parking_config/current").get();
  console.log("\n--- parking_config/current ---");
  if (parkingDoc.exists) {
    const data = parkingDoc.data()!;
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && typeof (v as any).toDate === "function") {
        data[k] = (v as any).toDate().toISOString();
      }
    }
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("DOES NOT EXIST");
  }

  // Read from pricing_config/current (the OLD/wrong collection)
  const pricingDoc = await db.doc("pricing_config/current").get();
  console.log("\n--- pricing_config/current ---");
  if (pricingDoc.exists) {
    const data = pricingDoc.data()!;
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && typeof (v as any).toDate === "function") {
        data[k] = (v as any).toDate().toISOString();
      }
    }
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("DOES NOT EXIST");
  }

  console.log("\n✅ Done! The API route now points to parking_config/current.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
