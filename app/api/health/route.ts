import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "turbo_parking",
    timestamp: new Date().toISOString(),
  });
}
