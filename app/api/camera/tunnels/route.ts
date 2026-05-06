import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";

/**
 * GET /api/camera/tunnels
 *
 * Returns the Cloudflare Tunnel URLs for entrance and exit cameras
 * from Firestore `parking_config/current`.
 */
export async function GET() {
  try {
    const doc = await adminFirestore.doc("system_status/current").get();
    const data = doc.data();

    if (!data) {
      return NextResponse.json(
        { error: "parking_config/current not found", exists: doc.exists },
        { status: 404 }
      );
    }

    // Log all fields for debugging
    console.log("[camera/tunnels] Document fields:", Object.keys(data));
    console.log("[camera/tunnels] tunnel_entrance_url:", data.tunnel_entrance_url);
    console.log("[camera/tunnels] tunnel_exit_url:", data.tunnel_exit_url);

    return NextResponse.json({
      entrance: data.tunnel_entrance_url || null,
      exit: data.tunnel_exit_url || null,
      // Debug: show all field names
      _debug_fields: Object.keys(data),
    });
  } catch (error) {
    console.error("[camera/tunnels] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tunnel URLs", details: String(error) },
      { status: 500 }
    );
  }
}
