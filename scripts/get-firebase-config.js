/**
 * Script to fetch Firebase Web App config using the service account.
 * This gets us the API key we need for the client SDK.
 */
const admin = require("firebase-admin");
const https = require("https");

const serviceAccount = require("../firebase_credentials.json");

// Initialize admin if not already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function getFirebaseConfig() {
  // Get an access token from the service account
  const accessToken = await admin.app().options.credential.getAccessToken();
  const token = accessToken.access_token;
  const projectId = serviceAccount.project_id;

  console.log("Project ID:", projectId);
  console.log("");

  // 1. List web apps to find existing ones
  const listUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`;

  return new Promise((resolve, reject) => {
    const req = https.get(listUrl, {
      headers: { Authorization: `Bearer ${token}` }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", async () => {
        if (res.statusCode !== 200) {
          console.log("Response status:", res.statusCode);
          console.log("Response:", data);

          // If no web apps exist, try getting the API key from the Identity Platform
          console.log("\nTrying to get API key from Google Cloud...");
          await getApiKeyFromCloud(token, projectId);
          return resolve();
        }

        const result = JSON.parse(data);
        const apps = result.apps || [];

        if (apps.length === 0) {
          console.log("No web apps found. Let me create one...");
          await createWebApp(token, projectId);
          return resolve();
        }

        // Get config for the first web app
        const appId = apps[0].appId;
        const configUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${appId}/config`;

        https.get(configUrl, {
          headers: { Authorization: `Bearer ${token}` }
        }, (configRes) => {
          let configData = "";
          configRes.on("data", (chunk) => configData += chunk);
          configRes.on("end", () => {
            const config = JSON.parse(configData);
            console.log("=== Firebase Web App Config ===");
            console.log(JSON.stringify(config, null, 2));
            console.log("");
            console.log("=== Environment Variables ===");
            console.log(`NEXT_PUBLIC_FIREBASE_API_KEY=${config.apiKey}`);
            console.log(`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${config.authDomain}`);
            console.log(`NEXT_PUBLIC_FIREBASE_PROJECT_ID=${config.projectId}`);
            resolve(config);
          });
        });
      });
    });
    req.on("error", reject);
  });
}

async function getApiKeyFromCloud(token, projectId) {
  // Try the browser key endpoint
  const url = `https://firebase.googleapis.com/v1beta1/projects/${projectId}`;

  return new Promise((resolve) => {
    https.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        console.log("Project info:", data);
        resolve();
      });
    });
  });
}

async function createWebApp(token, projectId) {
  const url = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`;
  const body = JSON.stringify({ displayName: "turbo_parking_dashboard" });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        console.log("Create result:", data);
        console.log("\nPlease run this script again in a few seconds to get the config.");
        resolve();
      });
    });
    req.write(body);
    req.end();
  });
}

getFirebaseConfig().catch(console.error);
