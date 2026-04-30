import { NextRequest, NextResponse } from "next/server";
import { listSessions } from "@/lib/services/parking-validation-service";
import type { SessionStatus } from "@/interfaces/parking-session";

export async function GET(req: NextRequest) {
  // TODO: Add admin auth check for dashboard access
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId") || undefined;
    const status = (searchParams.get("status") as SessionStatus) || undefined;
    const limit = Number(searchParams.get("limit")) || 50;

    const sessions = await listSessions({ status, limit });
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[tickets] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
