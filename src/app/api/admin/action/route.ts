import { NextResponse } from "next/server";
import { authenticateAdminRequest } from "@/lib/auth";
import {
  setSessionActiveQuiz,
  setRegistrationOpen,
  removeTeam,
  endGameSession,
  getDb,
} from "@/lib/db";

export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request);

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Administrator session required." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action, sessionId, questionId, teamId, scoreDelta, isOpen } = body || {};

    switch (action) {
      case "activate_question": {
        if (!sessionId || !questionId) {
          return NextResponse.json({ success: false, error: "Missing sessionId or questionId" }, { status: 400 });
        }
        const success = setSessionActiveQuiz(sessionId, questionId);
        return NextResponse.json({ success, message: "Question activated by admin." });
      }

      case "change_score": {
        if (!teamId || typeof scoreDelta !== "number") {
          return NextResponse.json({ success: false, error: "Missing teamId or numeric scoreDelta" }, { status: 400 });
        }
        const db = getDb();
        const res = db.prepare("UPDATE teams SET score = score + ? WHERE id = ?").run(scoreDelta, teamId);
        return NextResponse.json({ success: res.changes > 0, message: "Score updated by admin." });
      }

      case "toggle_registration": {
        if (!sessionId || typeof isOpen !== "boolean") {
          return NextResponse.json({ success: false, error: "Missing sessionId or boolean isOpen" }, { status: 400 });
        }
        const success = setRegistrationOpen(sessionId, isOpen);
        return NextResponse.json({ success });
      }

      case "kick_team": {
        if (!sessionId || !teamId) {
          return NextResponse.json({ success: false, error: "Missing sessionId or teamId" }, { status: 400 });
        }
        const success = removeTeam(sessionId, teamId);
        return NextResponse.json({ success });
      }

      case "end_game": {
        if (!sessionId) {
          return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
        }
        const leaderboard = endGameSession(sessionId);
        return NextResponse.json({ success: true, leaderboard });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
