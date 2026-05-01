import { execSync } from "child_process";

export default function globalSetup() {
  console.log("\n🌱 Seeding test data into Firestore...");
  execSync("node scripts/seed-e2e.js", { stdio: "inherit" });
}
