/**
 * Script to enable Email/Password auth and create the first admin user.
 */
const admin = require("firebase-admin");
const serviceAccount = require("../firebase_credentials.json");
const https = require("https");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const ADMIN_EMAIL = "admin@turboparking.com";
const ADMIN_PASSWORD = "TurboParking2026!"; // Change this after first login!

async function enableEmailPasswordAuth() {
  const accessToken = await admin.app().options.credential.getAccessToken();
  const token = accessToken.access_token;
  const projectId = serviceAccount.project_id;

  // Enable Email/Password sign-in via Identity Platform API
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const body = JSON.stringify({
    signIn: {
      email: {
        enabled: true,
        passwordRequired: true,
      },
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200) {
          console.log("✅ Email/Password sign-in ENABLED");
        } else {
          console.log(`⚠️  Enable auth response (${res.statusCode}):`, data);
          console.log("   You may need to enable it manually in Firebase Console → Authentication → Sign-in method");
        }
        resolve();
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function createAdminUser() {
  try {
    // Check if user already exists
    try {
      const existing = await admin.auth().getUserByEmail(ADMIN_EMAIL);
      console.log(`✅ Admin user already exists: ${existing.email} (uid: ${existing.uid})`);
      return;
    } catch (e) {
      // User doesn't exist, create it
    }

    const user = await admin.auth().createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: "Admin",
      emailVerified: true,
    });

    console.log(`✅ Admin user created!`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   UID: ${user.uid}`);
    console.log(`\n⚠️  CHANGE THIS PASSWORD after first login!`);
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
  }
}

async function main() {
  console.log("=== Setting up Firebase Auth ===\n");

  console.log("1. Enabling Email/Password sign-in...");
  await enableEmailPasswordAuth();

  console.log("\n2. Creating admin user...");
  await createAdminUser();

  console.log("\n=== Setup Complete ===");
  console.log(`\nYou can now log in at /auth/login with:`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);

  process.exit(0);
}

main().catch(console.error);
