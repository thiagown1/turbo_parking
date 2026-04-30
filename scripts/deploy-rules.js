/**
 * Deploy Firestore security rules using the service account.
 * No need for firebase CLI login.
 */
const admin = require("firebase-admin");
const https = require("https");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("../firebase_credentials.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function deployRules() {
  const accessToken = await admin.app().options.credential.getAccessToken();
  const token = accessToken.access_token;
  const projectId = serviceAccount.project_id;

  // Read the rules file
  const rulesContent = fs.readFileSync(
    path.join(__dirname, "..", "firestore.rules"),
    "utf-8"
  );

  // Deploy via Firestore REST API
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;

  // First, create the ruleset
  const rulesetUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
  const rulesetBody = JSON.stringify({
    source: {
      files: [
        {
          name: "firestore.rules",
          content: rulesContent,
        },
      ],
    },
  });

  return new Promise((resolve, reject) => {
    // Step 1: Create ruleset
    const req = https.request(rulesetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.log(`❌ Failed to create ruleset (${res.statusCode}):`, data);
          return reject(new Error("Failed to create ruleset"));
        }

        const ruleset = JSON.parse(data);
        const rulesetName = ruleset.name;
        console.log(`✅ Ruleset created: ${rulesetName}`);

        // Step 2: Release the ruleset to cloud.firestore
        const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`;
        const releaseBody = JSON.stringify({
          release: {
            name: `projects/${projectId}/releases/cloud.firestore`,
            rulesetName: rulesetName,
          },
          updateMask: "rulesetName",
        });

        const releaseReq = https.request(releaseUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }, (releaseRes) => {
          let releaseData = "";
          releaseRes.on("data", (chunk) => releaseData += chunk);
          releaseRes.on("end", () => {
            if (releaseRes.statusCode === 200) {
              console.log("✅ Firestore rules deployed successfully!");
              console.log("   All collections are now locked to Admin SDK only.");
            } else {
              console.log(`❌ Failed to release rules (${releaseRes.statusCode}):`, releaseData);
            }
            resolve();
          });
        });
        releaseReq.write(releaseBody);
        releaseReq.end();
      });
    });
    req.on("error", reject);
    req.write(rulesetBody);
    req.end();
  });
}

deployRules().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
