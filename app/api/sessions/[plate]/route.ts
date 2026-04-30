import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth/verify-api-key";
import { getSessionByIdentifier } from "@/lib/services/parking-validation-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ plate: string }> }
) {
  const authResult = await verifyApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { plate } = await params; // Can be plate or ticket_id
    const session = await getSessionByIdentifier(plate);

    if (!session) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("[sessions/[plate]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
