import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth/verify-api-key";
import { getTicketByCode } from "@/lib/services/parking-validation-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> }
) {
  const authResult = await verifyApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { ticketCode } = await params;
    const ticket = await getTicketByCode(ticketCode);

    if (!ticket) {
      return NextResponse.json({ error: "TICKET_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("[tickets/[ticketCode]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
