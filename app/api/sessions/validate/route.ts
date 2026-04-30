import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth/verify-api-key";
import { validateSession } from "@/lib/services/parking-validation-service";

export async function POST(req: NextRequest) {
  // Verify API key
  const authResult = await verifyApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { plate_normalized, identifier, ticketCode, locationId } = body;
    const targetId = identifier || plate_normalized || ticketCode;

    if (!targetId || !locationId) {
      return NextResponse.json(
        { error: "Missing identifier or locationId" },
        { status: 400 }
      );
    }

    const result = await validateSession(targetId, locationId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("[sessions/validate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
