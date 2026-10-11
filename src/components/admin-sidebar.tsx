"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  QrCode,
  Trophy,
  HelpCircle,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Radio,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    description: "Live overview & quick game controls",
  },
  {
    name: "QR Registration",
    href: "/admin/registration",
    icon: QrCode,
    description: "Student join QR code & LAN access",
  },
  {
    name: "Leaderboard",
    href: "/admin/leaderboard",
    icon: Trophy,
    description: "Rankings & classroom presentation mode",
  },
  {
    name: "Question Bank",
    href: "/admin/questions",
    icon: HelpCircle,
    description: "Create, edit, reorder & preview quiz",
  },
  {
    name: "Team Organization",
    href: "/admin/teams",
    icon: Users,
    description: "5 teams roster, rename & power-ups",
  },
  {
    name: "Game Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Timer, scoring rules & sound effects",
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const {
    isConnected,
    latency,
    currentSession,
    lobbyData,
    activeQuiz,
    isGameEnded,
    clincherState,
  } = useSocket("admin", "AdminNav");

  // Close mobile drawer on route change
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setIsMobileOpen(false);
  }

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {}
    router.replace("/admin/login");
  };

  // Determine game status badge
  let statusLabel = "Lobby";
  let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

  if (isGameEnded || currentSession?.status === "finished") {
    statusLabel = "Game Finished";
    statusColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
  } else if (clincherState) {
    statusLabel = `Clincher R${clincherState.roundNumber}`;
    statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse";
  } else if (activeQuiz) {
    statusLabel = "Quiz Active";
    statusColor = "bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse";
  } else if (currentSession?.status === "quiz_ended") {
    statusLabel = "Quiz Standby";
    statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  } else if (currentSession && !currentSession.is_registration_open) {
    statusLabel = "Registration Closed";
    statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }

  const registeredCount = lobbyData?.registeredCount ?? 0;
  const maxTeams = lobbyData?.maxTeams ?? 5;

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-sm font-bold text-white tracking-tight">Quiz Battle</h1>
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                    ADMIN
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400">Offline Classroom Suite</p>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile close toggle */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || (item.href === "/admin/teams" && pathname === "/admin/team-management");

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? `${item.name}: ${item.description}` : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/10 font-semibold"
                    : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200 border border-transparent"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                      : "bg-slate-900 text-slate-400 group-hover:bg-slate-800 group-hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{item.name}</span>
                      {item.href === "/admin/teams" && registeredCount > 0 && (
                        <span className="ml-1.5 rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] font-semibold text-slate-300">
                          {registeredCount}/{maxTeams}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-slate-500 font-normal">{item.description}</p>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status & Sign Out */}
      <div className="border-t border-slate-800/80 p-3 space-y-2">
        {/* Game Phase Card */}
        {!isCollapsed ? (
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Game Status</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusColor}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                {statusLabel}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 text-slate-500" />
                Teams
              </span>
              <span className="font-semibold text-slate-200">
                {registeredCount} / {maxTeams}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-1">
              <span className="flex items-center gap-1">
                <Radio className={`h-3 w-3 ${isConnected ? "text-emerald-400" : "text-red-400"}`} />
                LAN Socket
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {isConnected ? (latency !== null ? `${latency}ms` : "Active") : "Offline"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`Status: ${statusLabel} (${registeredCount}/${maxTeams} teams)`}>
            <div className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          </div>
        )}

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex w-full items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-xs font-medium text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
          title="Sign out of Admin Session"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs">
              QB
            </div>
            <span className="text-sm font-bold text-white">Quiz Battle Admin</span>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusColor}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel}
        </span>
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-md transition-all duration-200 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
