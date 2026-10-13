"use client";

import { useEffect, useRef, useContext } from "react";
import { SocketContext, type SocketContextValue } from "@/providers/socket-provider";
import type { ClientRole } from "@/types/socket";

/**
 * Primary hook to access real-time game socket state and actions.
 * Automatically delegates to the global SocketProvider context with deduplicated role registration.
 */
export function useSocket(
  initialRole?: ClientRole,
  initialName?: string,
  initialSessionId?: string,
  initialTeamId?: string
): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }

  const { registerRole, fetchQuestions, fetchAllPowerUpsAction, fetchLeaderboardAction } = context;
  const lastRegisteredRef = useRef<string>("");

  useEffect(() => {
    if (!initialRole) return;

    const registrationKey = `${initialRole}:${initialName || ""}:${initialTeamId || ""}:${initialSessionId || ""}`;
    if (lastRegisteredRef.current === registrationKey) {
      return;
    }
    lastRegisteredRef.current = registrationKey;

    registerRole(initialRole, initialName, initialTeamId, initialSessionId);

    if (initialRole === "admin") {
      fetchQuestions(initialSessionId);
      if (initialSessionId) {
        fetchAllPowerUpsAction(initialSessionId);
        fetchLeaderboardAction(initialSessionId);
      }
    }
  }, [
    registerRole,
    fetchQuestions,
    fetchAllPowerUpsAction,
    fetchLeaderboardAction,
    initialRole,
    initialName,
    initialSessionId,
    initialTeamId,
  ]);

  return context;
}
