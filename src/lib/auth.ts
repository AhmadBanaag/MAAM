import { cookies } from "next/headers";
import { validateAdminSession } from "./db";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

/**
 * Extracts the client IP from request headers or socket.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Verifies an incoming HTTP request for a valid administrator session.
 */
export async function authenticateAdminRequest(request: Request): Promise<{
  authenticated: boolean;
  user?: { id: string; username: string };
  error?: string;
}> {
  // 1. Fast synchronous parse from incoming Request Cookie header
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      const token = decodeURIComponent(match[1].trim());
      const validation = validateAdminSession(token);
      if (validation.valid && validation.user) {
        return { authenticated: true, user: validation.user };
      }
      return { authenticated: false, error: validation.error || "Session invalid or expired" };
    }
  } catch {
    // Fallback to cookieStore
  }

  // 2. Fallback: Try reading from Next.js cookie store
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const validation = validateAdminSession(token);
      if (validation.valid && validation.user) {
        return { authenticated: true, user: validation.user };
      }
      return { authenticated: false, error: validation.error || "Session invalid or expired" };
    }
  } catch {
    // Context where cookies() is unavailable
  }

  // 3. Fallback: Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const validation = validateAdminSession(token);
    if (validation.valid && validation.user) {
      return { authenticated: true, user: validation.user };
    }
    return { authenticated: false, error: validation.error || "Session invalid or expired" };
  }

  return { authenticated: false, error: "Unauthorized: Admin session required." };
}

/**
 * Format Set-Cookie header for admin_session
 */
export function formatSessionCookie(token: string, maxAge = SESSION_MAX_AGE_SECONDS): string {
  // Use SameSite=Lax for compatibility with navigation and CSRF protection
  // In production over HTTPS or local HTTP LAN, configure appropriately
  const isSecure = process.env.NODE_ENV === "production" && process.env.ENABLE_HTTPS === "true";
  const secureFlag = isSecure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

/**
 * Format Set-Cookie header to clear admin_session
 */
export function formatClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
