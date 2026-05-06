// Quick script to list Firestore collections and check for sessions data
const admin = require("firebase-admin");

// Init using env vars
const serviceAccount = {
  projectId: "metropoleparking",
  clientEmail: "firebase-adminsdk-fbsvc@metropoleparking.iam.gserviceaccount.com",
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function main() {
  console.log("=== Listing Root Collections ===");
  const collections = await db.listCollections();
  for (const col of collections) {
    const snap = await col.limit(3).get();
    console.log(`\n📁 ${col.id} (${snap.size} docs shown, limit 3)`);
    for (const doc of snap.docs) {
      const data = doc.data();
      console.log(`  📄 ${doc.id}:`, JSON.stringify(data).slice(0, 200));
      
      // Check for subcollections
      const subcols = await doc.ref.listCollections();
      for (const sub of subcols) {
        const subSnap = await sub.limit(3).get();
        console.log(`    📂 ${sub.id} (${subSnap.size} docs shown)`);
        for (const subDoc of subSnap.docs) {
          console.log(`      📄 ${subDoc.id}:`, JSON.stringify(subDoc.data()).slice(0, 200));
        }
      }
    }
  }

  // Specifically check collectionGroup("sessions")
  console.log("\n\n=== CollectionGroup 'sessions' ===");
  const sessionsSnap = await db.collectionGroup("sessions").limit(5).get();
  console.log(`Found ${sessionsSnap.size} docs`);
  for (const doc of sessionsSnap.docs) {
    console.log(`  📄 ${doc.ref.path}:`, JSON.stringify(doc.data()).slice(0, 200));
  }
}

main().catch(console.error);
