import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { invalidateAdminSession } from "@/lib/db";
import { formatClearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  let token: string | undefined;

  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {}

  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (token) {
    invalidateAdminSession(token);
    console.log("[Security] Admin session invalidated upon logout.");
  }

  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully.",
  });

  response.headers.set("Set-Cookie", formatClearSessionCookie());
  return response;
}
