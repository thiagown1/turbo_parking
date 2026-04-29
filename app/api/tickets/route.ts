import { NextRequest, NextResponse } from "next/server";
import { listTickets } from "@/lib/services/parking-validation-service";
import type { TicketStatus } from "@/interfaces/parking-ticket";

export async function GET(req: NextRequest) {
  // TODO: Add admin auth check for dashboard access
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId") || undefined;
    const status = (searchParams.get("status") as TicketStatus) || undefined;
    const limit = Number(searchParams.get("limit")) || 50;

    const tickets = await listTickets({ locationId, status, limit });
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("[tickets] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
