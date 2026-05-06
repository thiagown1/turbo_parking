import { NextRequest, NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const CONFIG_DOC = "parking_config/current";

export async function GET() {
  try {
    const doc = await adminFirestore.doc(CONFIG_DOC).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "CONFIG_NOT_FOUND" }, { status: 404 });
    }

    const data = doc.data()!;
    // Convert Firestore Timestamp to ISO string
    const config = {
      ...data,
      updated_at: data.updated_at?.toDate?.()
        ? data.updated_at.toDate().toISOString()
        : data.updated_at || null,
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[config/pricing] GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Only allow known fields to be updated
    const allowedFields = [
      "additional_hour",
      "entry_active",
      "exit_active",
      "first_hour",
      "free_day",
      "payment_exit_minutes",
      "test_mode",
      "ticketless",
      "tolerance_minutes",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    updates.updated_at = FieldValue.serverTimestamp();

    await adminFirestore.doc(CONFIG_DOC).set(updates, { merge: true });

    // Read back the updated config
    const doc = await adminFirestore.doc(CONFIG_DOC).get();
    const data = doc.data()!;
    const config = {
      ...data,
      updated_at: data.updated_at?.toDate?.()
        ? data.updated_at.toDate().toISOString()
        : data.updated_at || null,
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[config/pricing] PUT Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
