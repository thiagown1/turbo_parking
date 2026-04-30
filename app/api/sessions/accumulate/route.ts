import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth/verify-api-key";
import { accumulateRecharge } from "@/lib/services/parking-validation-service";

export async function POST(req: NextRequest) {
  const authResult = await verifyApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { plate_normalized, locationId, transactionId, stationId, userId, rechargeDurationMinutes } = body;

    if (!plate_normalized || !locationId || !transactionId || !stationId || !userId || !rechargeDurationMinutes) {
      return NextResponse.json(
        { error: "Missing required fields: plate_normalized, locationId, transactionId, stationId, userId, rechargeDurationMinutes" },
        { status: 400 }
      );
    }

    const result = await accumulateRecharge(plate_normalized, locationId, {
      transactionId,
      stationId,
      userId,
      rechargeDurationMinutes: Number(rechargeDurationMinutes),
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[tickets/accumulate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
