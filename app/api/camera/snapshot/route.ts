import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminFirestore } from "@/lib/firebase-admin";

/**
 * Proxy endpoint that fetches a snapshot from a Hikvision camera
 * using HTTP Digest Authentication and serves it to the dashboard.
 * 
 * Hikvision cameras require Digest Auth, not Basic Auth.
 */

const CAMERA_BASE_URL = process.env.CAMERA_BASE_URL || "";
const CAMERA_USERNAME = process.env.CAMERA_USERNAME || "admin";
const CAMERA_PASSWORD = process.env.CAMERA_PASSWORD || "";

// Cache tunnel URLs
let snapshotTunnelCache: { entrance: string; exit: string; ts: number } | null = null;

async function getBaseUrl(camera: string): Promise<string> {
  if (!snapshotTunnelCache || Date.now() - snapshotTunnelCache.ts > 30_000) {
    try {
      const doc = await adminFirestore.doc("system_status/current").get();
      const data = doc.data();
      snapshotTunnelCache = {
        entrance: data?.tunnel_entrance_url || CAMERA_BASE_URL || "",
        exit: data?.tunnel_exit_url || "",
        ts: Date.now(),
      };
    } catch {
      snapshotTunnelCache = { entrance: CAMERA_BASE_URL || "", exit: "", ts: Date.now() };
    }
  }
  return camera === "exit" ? snapshotTunnelCache.exit : snapshotTunnelCache.entrance;
}

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex");
}

function parseDigestChallenge(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]*)"|([\w]+))/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    result[match[1]] = match[2] ?? match[3];
  }
  return result;
}

function buildDigestHeader(
  method: string,
  uri: string,
  username: string,
  password: string,
  challenge: Record<string, string>
): string {
  const { realm, nonce, qop, opaque } = challenge;

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  let authHeader: string;

  if (qop) {
    const nc = "00000001";
    const cnonce = md5(Date.now().toString());
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
    authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  }

  if (opaque) {
    authHeader += `, opaque="${opaque}"`;
  }

  return authHeader;
}

// ─── Digest Auth Cache ───
// Cache the challenge to avoid a 401 round-trip on every snapshot request.
// This roughly halves the time per frame.
let cachedChallenge: Record<string, string> | null = null;
let nonceCount = 0;

function buildDigestHeaderWithNc(
  method: string,
  uri: string,
  username: string,
  password: string,
  challenge: Record<string, string>,
  nc: number
): string {
  const { realm, nonce, qop, opaque } = challenge;
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const ncHex = nc.toString(16).padStart(8, "0");
  const cnonce = md5(`${Date.now()}-${nc}`);

  let response: string;
  let authHeader: string;

  if (qop) {
    response = md5(`${ha1}:${nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`);
    authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${ncHex}, cnonce="${cnonce}", response="${response}"`;
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
    authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  }

  if (opaque) authHeader += `, opaque="${opaque}"`;
  return authHeader;
}

async function fetchWithDigestAuth(url: string, username: string, password: string): Promise<Response | null> {
  const urlObj = new URL(url);
  const uri = urlObj.pathname + urlObj.search;

  // Try cached challenge first (skip the 401 round-trip)
  if (cachedChallenge) {
    nonceCount++;
    const authHeader = buildDigestHeaderWithNc("GET", uri, username, password, cachedChallenge, nonceCount);
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (res.ok) return res;
    // Cache miss / nonce expired — fall through to fresh challenge
    cachedChallenge = null;
    nonceCount = 0;
  }

  // Fresh challenge: send request without auth to get 401
  const challengeRes = await fetch(url, { redirect: "follow" });

  if (challengeRes.status !== 401) {
    if (challengeRes.ok) return challengeRes;
    return null;
  }

  const wwwAuth = challengeRes.headers.get("www-authenticate");
  if (!wwwAuth || !wwwAuth.toLowerCase().startsWith("digest")) {
    return null;
  }

  // Parse and cache the challenge
  cachedChallenge = parseDigestChallenge(wwwAuth);
  nonceCount = 1;

  const authHeader = buildDigestHeaderWithNc("GET", uri, username, password, cachedChallenge, nonceCount);
  const authRes = await fetch(url, { headers: { Authorization: authHeader } });

  if (!authRes.ok) {
    cachedChallenge = null;
    nonceCount = 0;
    return null;
  }

  return authRes;
}

/**
 * Snapshot path priority:
 * Intelbras/Dahua first, then Hikvision
 */
const SNAPSHOT_PATHS = [
  // Intelbras / Dahua
  "/cgi-bin/snapshot.cgi?channel=1",
  "/cgi-bin/snapshot.cgi",
  // Hikvision
  "/ISAPI/Streaming/channels/1/picture",
  "/ISAPI/Streaming/channels/101/picture",
  "/ISAPI/Streaming/channels/102/picture",
  "/Streaming/channels/1/picture",
];

// Cache which snapshot path works for each camera to avoid flickering between channels
const workingPathCache: Record<string, string> = {};

export async function GET(req: NextRequest) {
  const cameraParam = req.nextUrl.searchParams.get("camera") || "entrance";
  const baseUrl = await getBaseUrl(cameraParam);

  if (!baseUrl) {
    return NextResponse.json(
      { error: `No URL configured for ${cameraParam} camera` },
      { status: 503 }
    );
  }

  // If ?capabilities=1 is passed, return the camera's streaming capabilities for debugging
  if (req.nextUrl.searchParams.get("capabilities")) {
    try {
      const capUrl = `${baseUrl}/ISAPI/Streaming/channels/101/capabilities`;
      const capRes = await fetchWithDigestAuth(capUrl, CAMERA_USERNAME, CAMERA_PASSWORD);
      if (capRes) {
        const text = await capRes.text();
        return new NextResponse(text, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        });
      }
    } catch { /* fall through */ }
    return NextResponse.json({ error: "Could not fetch capabilities" }, { status: 502 });
  }

  // Cache: remember which path works for each camera to avoid flickering
  const cachedPath = workingPathCache[cameraParam];

  // If we have a cached working path, try it first
  if (cachedPath) {
    try {
      const separator = cachedPath.includes("?") ? "&" : "?";
      const url = `${baseUrl}${cachedPath}${separator}videoResolutionWidth=1920&videoResolutionHeight=1080`;
      const res = await fetchWithDigestAuth(url, CAMERA_USERNAME, CAMERA_PASSWORD);

      if (res) {
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const imageBuffer = await res.arrayBuffer();

        if (imageBuffer.byteLength > 0) {
          return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
        }
      }
    } catch {
      // Cached path failed, clear it and try all paths
      delete workingPathCache[cameraParam];
    }
  }

  // Try all paths in priority order
  for (const basePath of SNAPSHOT_PATHS) {
    try {
      const separator = basePath.includes("?") ? "&" : "?";
      const url = `${baseUrl}${basePath}${separator}videoResolutionWidth=1920&videoResolutionHeight=1080`;
      const res = await fetchWithDigestAuth(url, CAMERA_USERNAME, CAMERA_PASSWORD);

      if (res) {
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const imageBuffer = await res.arrayBuffer();

        if (imageBuffer.byteLength > 0) {
          // Cache this working path for future requests
          workingPathCache[cameraParam] = basePath;
          return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
        }
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "Failed to fetch camera snapshot" },
    { status: 502 }
  );
}
