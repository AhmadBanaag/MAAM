import { NextResponse } from "next/server";
import { hasAdminAccount } from "@/lib/db";
import { authenticateAdminRequest, formatClearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: Request) {
  const hasAdmin = hasAdminAccount();
  const auth = await authenticateAdminRequest(request);

  const response = NextResponse.json({
    hasAdmin,
    isAuthenticated: auth.authenticated,
    user: auth.user || null,
  });

  // If client sent a stale or invalid session cookie, clear it so they aren't stuck in a zombie state
  const cookieHeader = request.headers.get("cookie") || "";
  if (!auth.authenticated && cookieHeader.includes(SESSION_COOKIE_NAME)) {
    response.headers.set("Set-Cookie", formatClearSessionCookie());
  }

  return response;
}
