import { NextResponse } from "next/server";
import { authenticateAdminRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Administrator session required to modify scores." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { teamId, scoreDelta } = body || {};

    if (!teamId || typeof scoreDelta !== "number") {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    const db = getDb();
    const res = db.prepare("UPDATE teams SET score = score + ? WHERE id = ?").run(scoreDelta, teamId);
    return NextResponse.json({ success: res.changes > 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
