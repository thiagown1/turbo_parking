import { execSync } from "child_process";

export default function globalTeardown() {
  console.log("\n🧹 Cleaning up test data from Firestore...");
  execSync("node scripts/seed-e2e.js cleanup", { stdio: "inherit" });
}
