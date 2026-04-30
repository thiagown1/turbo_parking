/**
 * Firebase Admin SDK for turbo_parking.
 *
 * Connects to the metropoleparking Firebase project.
 * Supports:
 *  1. firebase_credentials.json file (local dev / server)
 *  2. Environment variables (Vercel)
 *  3. Firebase emulators
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

function isEmulatorEnv(): boolean {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
}

let app: App;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "metropoleparking";

  // Try loading credentials from file first (local dev / server deployment)
  const credentialsPath = path.join(process.cwd(), "firebase_credentials.json");
  const hasCredentialsFile = fs.existsSync(credentialsPath);

  // Then check environment variables (Vercel deployment)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey =
    typeof rawPrivateKey === "string" && rawPrivateKey.length > 0
      ? rawPrivateKey.split("\\n").join("\n")
      : undefined;
  const canUseCertEnv = Boolean(projectId && clientEmail && privateKey);

  if (isEmulatorEnv()) {
    // Emulator mode — no credentials needed
    console.info("[firebase-admin] Using Firebase emulators");
    app = initializeApp({ projectId });
  } else if (hasCredentialsFile) {
    // Load from JSON file
    console.info("[firebase-admin] Using credentials from firebase_credentials.json");
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } else if (canUseCertEnv) {
    // Load from environment variables
    console.info("[firebase-admin] Using credentials from environment variables");
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    // Fallback: try without credentials (for Vercel with auto-provisioned creds)
    console.warn(
      "[firebase-admin] No explicit credentials — falling back to default init"
    );
    app = initializeApp({ projectId });
  }
} else {
  app = getApps()[0];
}

export const adminAuth: Auth = getAuth(app);
export const adminFirestore: Firestore = getFirestore(app);
