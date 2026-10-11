import { NextResponse } from "next/server";
import {
  verifyAdminCredentials,
  createAdminSession,
  checkLoginRateLimit,
  recordLoginAttempt,
  hasAdminAccount,
} from "@/lib/db";
import { formatSessionCookie, getClientIp } from "@/lib/auth";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // 1. Rate Limiting Check
  const rateLimit = checkLoginRateLimit(ip);
  if (rateLimit.limited) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many failed login attempts. Please try again in ${rateLimit.retryAfterSeconds || 60} seconds.`,
        retryAfter: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds || 60),
        },
      }
    );
  }

  // 2. Check if setup is needed
  if (!hasAdminAccount()) {
    return NextResponse.json(
      {
        success: false,
        error: "No administrator account configured yet. Please complete initial setup.",
        needsSetup: true,
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      recordLoginAttempt(ip, false);
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // 3. Verify credentials
    const verification = verifyAdminCredentials(username, password);
    if (!verification.success || !verification.user) {
      recordLoginAttempt(ip, false);
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // 4. Record successful login attempt
    recordLoginAttempt(ip, true);

    // 5. Create new session (regenerates session identifier)
    const userAgent = request.headers.get("user-agent") || undefined;
    const session = createAdminSession(verification.user.id, ip, userAgent);

    const cookieHeader = formatSessionCookie(session.token);

    const response = NextResponse.json({
      success: true,
      message: "Logged in successfully.",
      user: verification.user,
      redirect: "/admin",
    });

    response.headers.set("Set-Cookie", cookieHeader);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Login error: ${msg}` },
      { status: 500 }
    );
  }
}
