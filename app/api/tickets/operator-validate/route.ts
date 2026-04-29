import { NextRequest, NextResponse } from "next/server";
import { operatorValidateTicket } from "@/lib/services/parking-validation-service";

export async function POST(req: NextRequest) {
  // TODO: Add admin auth check for dashboard access
  try {
    const body = await req.json();
    const { ticketCode, locationId, notes } = body;

    if (!ticketCode || !locationId) {
      return NextResponse.json(
        { error: "Missing ticketCode or locationId" },
        { status: 400 }
      );
    }

    // TODO: Get operator userId from session
    const operatorUserId = "admin";

    const result = await operatorValidateTicket(ticketCode, locationId, operatorUserId, notes);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("[tickets/operator-validate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
