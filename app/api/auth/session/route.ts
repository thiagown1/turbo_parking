import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const SESSION_COOKIE_NAME = "tp_session";
const SESSION_EXPIRY_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

/**
 * Creates a session cookie from a Firebase ID token.
 * Called after the client successfully signs in with Firebase Auth.
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Verify the ID token first
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Create session cookie (server-side, HTTP-only)
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });

    const response = NextResponse.json({
      success: true,
      email: decodedToken.email,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRY_MS / 1000,
    });

    return response;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error("[auth/session] Error code:", err.code);
    console.error("[auth/session] Error message:", err.message);
    console.error("[auth/session] Full error:", error);
    return NextResponse.json(
      { error: err.message || "Invalid ID token", code: err.code },
      { status: 401 }
    );
  }
}

/**
 * Deletes the session cookie (logout).
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
