// Quick script to check Firestore parking_config/current fields
import { adminFirestore } from "../lib/firebase-admin";

async function main() {
  const doc = await adminFirestore.doc("parking_config/current").get();
  const data = doc.data();
  console.log("Document exists:", doc.exists);
  console.log("Fields:", JSON.stringify(data, null, 2));
  console.log("---");
  console.log("tunnel_entrance_url:", data?.tunnel_entrance_url);
  console.log("tunnel_exit_url:", data?.tunnel_exit_url);
  process.exit(0);
}

main().catch(console.error);
