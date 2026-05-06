import { NextRequest, NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";

/**
 * POST /api/gate/open
 * Body: { gate: "entrance" | "exit" }
 *
 * Sets `remote_open_entrance` or `remote_open_exit` to true
 * in Firestore `parking_config/current`.
 * The hardware listener picks this up, opens the gate,
 * and resets the field back to false.
 */
export async function POST(req: NextRequest) {
  try {
    const { gate } = await req.json();

    if (gate !== "entrance" && gate !== "exit") {
      return NextResponse.json(
        { error: "Invalid gate. Use 'entrance' or 'exit'." },
        { status: 400 }
      );
    }

    const field =
      gate === "entrance" ? "remote_open_entrance" : "remote_open_exit";

    await adminFirestore.doc("parking_config/current").set({
      [field]: true,
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: `Cancela de ${gate === "entrance" ? "entrada" : "saída"} aberta!`,
      field,
    });
  } catch (error) {
    console.error("[gate/open] Error:", error);
    return NextResponse.json(
      { error: "Falha ao abrir cancela" },
      { status: 500 }
    );
  }
}
