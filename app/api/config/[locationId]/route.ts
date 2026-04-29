import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateConfig } from "@/lib/services/parking-validation-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const config = await getConfig(locationId);

    if (!config) {
      return NextResponse.json({ error: "LOCATION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[config/[locationId]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  // TODO: Add admin auth check
  try {
    const { locationId } = await params;
    const body = await req.json();

    await updateConfig(locationId, body);
    const updated = await getConfig(locationId);

    return NextResponse.json({ config: updated });
  } catch (error) {
    console.error("[config/[locationId]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
