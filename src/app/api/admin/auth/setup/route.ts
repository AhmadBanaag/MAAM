import { NextResponse } from "next/server";
import { hasAdminAccount, createInitialAdmin, createAdminSession } from "@/lib/db";
import { formatSessionCookie, getClientIp } from "@/lib/auth";

export async function POST(request: Request) {
  if (hasAdminAccount()) {
    return NextResponse.json(
      { success: false, error: "Setup is disabled: An administrator account already exists." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Username must be at least 3 characters long." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const result = createInitialAdmin(username.trim(), password);
    if (!result.success || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to configure administrator account." },
        { status: 400 }
      );
    }

    // Auto-login upon successful initial setup
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    const session = createAdminSession(result.user.id, ip, userAgent);

    const cookieHeader = formatSessionCookie(session.token);

    const response = NextResponse.json({
      success: true,
      message: "Administrator account created successfully.",
      user: result.user,
      redirect: "/admin",
    });

    response.headers.set("Set-Cookie", cookieHeader);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Initial setup error: ${msg}` },
      { status: 500 }
    );
  }
}
