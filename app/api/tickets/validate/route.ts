import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth/verify-api-key";
import { validateTicket } from "@/lib/services/parking-validation-service";

export async function POST(req: NextRequest) {
  // Verify API key
  const authResult = await verifyApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { ticketCode, locationId } = body;

    if (!ticketCode || !locationId) {
      return NextResponse.json(
        { error: "Missing ticketCode or locationId" },
        { status: 400 }
      );
    }

    const result = await validateTicket(ticketCode, locationId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("[tickets/validate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
