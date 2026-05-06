/**
 * Limpa TODAS as sessões do parking_sessions para recomeçar do zero.
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Parse .env.local
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

async function deleteCollection(collectionPath: string) {
  const collectionRef = db.collection(collectionPath);
  const batchSize = 500;
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`  Deletados ${totalDeleted} documentos...`);
  }

  return totalDeleted;
}

async function main() {
  console.log("🧹 Limpando banco para testes...\n");

  // 1. parking_sessions
  console.log("--- parking_sessions ---");
  const sessions = await deleteCollection("parking_sessions");
  console.log(`✅ ${sessions} sessões deletadas\n`);

  // 2. daily_stats
  console.log("--- daily_stats ---");
  const stats = await deleteCollection("daily_stats");
  console.log(`✅ ${stats} registros de stats deletados\n`);

  // 3. errors
  console.log("--- errors ---");
  const errors = await deleteCollection("errors");
  console.log(`✅ ${errors} erros deletados\n`);

  console.log("🎉 Banco limpo! Pronto para testar do zero.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
