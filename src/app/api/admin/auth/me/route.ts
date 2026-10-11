import { NextResponse } from "next/server";
import { authenticateAdminRequest, formatClearSessionCookie } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await authenticateAdminRequest(request);

  if (!auth.authenticated || !auth.user) {
    const response = NextResponse.json(
      { authenticated: false, error: auth.error || "Unauthorized" },
      { status: 401 }
    );
    response.headers.set("Set-Cookie", formatClearSessionCookie());
    return response;
  }

  return NextResponse.json({
    authenticated: true,
    user: auth.user,
  });
}
