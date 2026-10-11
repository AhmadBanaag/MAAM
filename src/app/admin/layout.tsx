"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = Boolean(pathname?.startsWith("/admin/login"));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => (isLoginPage ? true : null));

  useEffect(() => {
    if (isLoginPage || pathname?.startsWith("/admin/login")) return;

    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted && isAuthenticated === null) {
        setIsAuthenticated(false);
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/admin/login?redirect=${encodeURIComponent(pathname || "/admin")}`;
      }
    }, 3500);

    // Verify session
    fetch("/api/admin/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!isMounted) return;
        if (!res.ok) {
          setIsAuthenticated(false);
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = `/admin/login?redirect=${encodeURIComponent(pathname || "/admin")}`;
        } else {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAuthenticated(false);
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/admin/login?redirect=${encodeURIComponent(pathname || "/admin")}`;
      })
      .finally(() => {
        clearTimeout(safetyTimer);
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [isLoginPage, pathname, isAuthenticated]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isAuthenticated !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-xs text-slate-400 font-medium">
            {isAuthenticated === false
              ? "Redirecting to administrator sign in..."
              : "Verifying administrator session..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased">
      <AdminSidebar />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950">
        {children}
      </main>
    </div>
  );
}
