import { NextResponse } from "next/server";
import { getDashboardStats, getRecentSessions } from "@/lib/services/parking-validation-service";

export async function GET() {
  try {
    const [stats, recentSessions] = await Promise.all([
      getDashboardStats(),
      getRecentSessions(5),
    ]);

    return NextResponse.json({ stats, recentSessions });
  } catch (error) {
    console.error("[dashboard/stats] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
