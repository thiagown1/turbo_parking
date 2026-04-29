/**
 * Firebase Admin SDK for turbo_parking.
 *
 * Connects to the turbo-parking Firebase project (separate from turbostation).
 * Supports Firebase emulators for local development.
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function isEmulatorEnv(): boolean {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
}

let app: App;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "turbo-parking-dev";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey =
    typeof rawPrivateKey === "string"
      ? rawPrivateKey.split("\\n").join("\n")
      : undefined;

  const canUseCert = Boolean(projectId && clientEmail && privateKey);

  if (isEmulatorEnv()) {
    // Emulator mode — no credentials needed
    console.info("[firebase-admin] Using Firebase emulators");
    app = initializeApp({ projectId });
  } else if (canUseCert) {
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
