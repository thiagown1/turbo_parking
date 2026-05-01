import { NextRequest, NextResponse } from "next/server";
import { operatorValidateSession } from "@/lib/services/parking-validation-service";

export async function POST(req: NextRequest) {
  // TODO: Add admin auth check for dashboard access
  try {
    const body = await req.json();
    const { plate_normalized, identifier, ticketCode, locationId, notes } = body;
    const targetId = identifier || plate_normalized || ticketCode;

    if (!targetId || !locationId) {
      return NextResponse.json(
        { error: "Missing identifier or locationId" },
        { status: 400 }
      );
    }

    // TODO: Get operator userId from session
    const operatorUserId = "admin";

    const result = await operatorValidateSession(targetId, locationId, operatorUserId, notes);
    console.log("[operator-validate] targetId:", targetId, "result:", result.success, result.error || "");
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("[sessions/operator-validate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
