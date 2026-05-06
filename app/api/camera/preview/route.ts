import { NextResponse } from "next/server";
import { createHash } from "crypto";

/**
 * Proxies the Hikvision DVR preview page which shows the full camera view
 * with overlays (timestamp, detection lines, etc).
 * Returns HTML that auto-refreshes a snapshot from the DVR's decoded output.
 */

const CAMERA_BASE_URL = process.env.CAMERA_BASE_URL || "";
const CAMERA_USERNAME = process.env.CAMERA_USERNAME || "admin";
const CAMERA_PASSWORD = process.env.CAMERA_PASSWORD || "";

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

  if (opaque) authHeader += `, opaque="${opaque}"`;
  return authHeader;
}

async function fetchDigest(url: string, username: string, password: string): Promise<Response | null> {
  const challengeRes = await fetch(url, { redirect: "manual" });
  if (challengeRes.status !== 401) return challengeRes.ok ? challengeRes : null;

  const wwwAuth = challengeRes.headers.get("www-authenticate");
  if (!wwwAuth || !wwwAuth.toLowerCase().startsWith("digest")) return null;

  const challenge = parseDigestChallenge(wwwAuth);
  const urlObj = new URL(url);
  const uri = urlObj.pathname + urlObj.search;
  const authHeader = buildDigestHeader("GET", uri, username, password, challenge);

  const authRes = await fetch(url, { headers: { Authorization: authHeader } });
  return authRes.ok ? authRes : null;
}

export async function GET() {
  if (!CAMERA_BASE_URL) {
    return NextResponse.json({ error: "CAMERA_BASE_URL not configured" }, { status: 503 });
  }

  // Try to get the DVR's decoded snapshot (includes overlays)
  const endpoints = [
    "/ISAPI/ContentMgmt/InputProxy/channels/1/video/displayPicture",
    "/ISAPI/Streaming/channels/101/picture?overlayEnabled=true",
    "/ISAPI/Streaming/channels/101/picture",
  ];

  for (const path of endpoints) {
    try {
      const res = await fetchDigest(`${CAMERA_BASE_URL}${path}`, CAMERA_USERNAME, CAMERA_PASSWORD);
      if (res) {
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 1000) {
          return new NextResponse(buf, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        }
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "Failed" }, { status: 502 });
}
