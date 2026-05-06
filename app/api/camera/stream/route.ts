import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminFirestore } from "@/lib/firebase-admin";

/**
 * MJPEG streaming proxy for Hikvision cameras.
 *
 * Supports both entrance and exit cameras via ?camera=entrance|exit
 * Fetches tunnel URLs from Firestore parking_config/current.
 * Falls back to CAMERA_BASE_URL env var for the entrance camera.
 */

const CAMERA_USERNAME = process.env.CAMERA_USERNAME || "admin";
const CAMERA_PASSWORD = process.env.CAMERA_PASSWORD || "";
const CAMERA_BASE_URL = process.env.CAMERA_BASE_URL || "";

// Cache tunnel URLs for 30s to avoid Firestore reads on every request
let tunnelCache: { entrance: string; exit: string; ts: number } | null = null;
const CACHE_TTL = 30_000;

async function getTunnelUrls(): Promise<{ entrance: string; exit: string }> {
  if (tunnelCache && Date.now() - tunnelCache.ts < CACHE_TTL) {
    return tunnelCache;
  }
  try {
    const doc = await adminFirestore.doc("system_status/current").get();
    const data = doc.data();
    tunnelCache = {
      // Entrance: use tunnel URL from Firebase first, fallback to local
      entrance: data?.tunnel_entrance_url || CAMERA_BASE_URL || "",
      exit: data?.tunnel_exit_url || "",
      ts: Date.now(),
    };
    return tunnelCache;
  } catch {
    return { entrance: CAMERA_BASE_URL || "", exit: "" };
  }
}

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex");
}

function parseDigestChallenge(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]*)"|(\w+))/g;
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

  if (opaque) authHeader += `, opaque="${opaque}"`;
  return authHeader;
}

// MJPEG stream endpoints — Intelbras first, then Hikvision fallbacks
const MJPEG_PATHS = [
  // Intelbras / Dahua
  "/cgi-bin/mjpg/video.cgi?channel=1&subtype=1",
  "/cgi-bin/mjpg/video.cgi?channel=1&subtype=0",
  "/cgi-bin/snapshot.cgi?channel=1",
  // Hikvision
  "/ISAPI/Streaming/channels/1/httpPreview",
  "/ISAPI/Streaming/channels/101/httpPreview",
  "/ISAPI/Streaming/channels/102/httpPreview",
];

export async function GET(req: NextRequest) {
  const cameraParam = req.nextUrl.searchParams.get("camera") || "entrance";
  const tunnels = await getTunnelUrls();

  const baseUrl = cameraParam === "exit" ? tunnels.exit : tunnels.entrance;

  if (!baseUrl) {
    return NextResponse.json(
      { error: `No URL configured for ${cameraParam} camera` },
      { status: 503 }
    );
  }

  for (const path of MJPEG_PATHS) {
    const url = `${baseUrl}${path}`;

    try {
      console.log(`[stream] Trying ${cameraParam}: ${url}`);
      
      // Step 1: Try direct access
      const challengeRes = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

      console.log(`[stream] ${url} → status ${challengeRes.status}, content-type: ${challengeRes.headers.get("content-type")}`);

      if (challengeRes.ok && challengeRes.body) {
        const contentType =
          challengeRes.headers.get("content-type") ||
          "multipart/x-mixed-replace";
        console.log(`[stream] ✅ Streaming ${cameraParam} from ${url}`);
        return new NextResponse(challengeRes.body as ReadableStream, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "no-cache, no-store",
            Connection: "keep-alive",
          },
        });
      }

      if (challengeRes.status !== 401) {
        console.log(`[stream] ⏭️ Skipping ${url} (status ${challengeRes.status})`);
        continue;
      }

      // Step 2: Digest auth required
      const wwwAuth = challengeRes.headers.get("www-authenticate");
      if (!wwwAuth || !wwwAuth.toLowerCase().startsWith("digest")) {
        console.log(`[stream] ⏭️ No digest challenge at ${url}`);
        continue;
      }

      console.log(`[stream] 🔑 Digest auth for ${url}, challenge: ${wwwAuth.substring(0, 80)}...`);
      const challenge = parseDigestChallenge(wwwAuth);
      
      // Build auth using the FULL path as the camera sees it
      // Through Cloudflare tunnel, the camera sees the original path
      const urlObj = new URL(url);
      const uri = urlObj.pathname + (urlObj.search || "");
      
      const authHeader = buildDigestHeader(
        "GET",
        uri,
        CAMERA_USERNAME,
        CAMERA_PASSWORD,
        challenge
      );

      console.log(`[stream] 🔑 Sending auth for uri="${uri}"`);

      const streamRes = await fetch(url, {
        headers: { 
          Authorization: authHeader,
        },
        signal: AbortSignal.timeout(10000),
      });

      console.log(`[stream] Auth response: status ${streamRes.status}, content-type: ${streamRes.headers.get("content-type")}`);

      if (streamRes.ok && streamRes.body) {
        const contentType =
          streamRes.headers.get("content-type") ||
          "multipart/x-mixed-replace";
        console.log(`[stream] ✅ Authenticated stream from ${url}`);
        return new NextResponse(streamRes.body as ReadableStream, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "no-cache, no-store",
            Connection: "keep-alive",
          },
        });
      }
      
      // If still 401, log the response for debugging
      if (streamRes.status === 401) {
        const body = await streamRes.text();
        console.error(`[stream] ❌ Auth failed (401). Body: ${body.substring(0, 200)}`);
      }
    } catch (err) {
      console.error(`[stream] ❌ Error for ${url}:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  return NextResponse.json(
    { error: `MJPEG stream not available for ${cameraParam} camera` },
    { status: 502 }
  );
}
