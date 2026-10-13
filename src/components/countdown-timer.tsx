"use client";

import React, { useState, useEffect, memo } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  deadline: number;
  timeLimit?: number;
  serverTimeOffset?: number;
  variant?: "amber" | "rose" | "indigo";
  showLabel?: boolean;
  className?: string;
  onExpire?: () => void;
}

/**
 * Isolated high-FPS countdown timer.
 * Prevents re-rendering parent components (PlayerPage, SpectatorView) on every timer tick.
 * Calibrated with serverTimeOffset for NTP-accurate clock synchronization.
 */
export const CountdownTimer = memo(function CountdownTimer({
  deadline,
  timeLimit = 30,
  serverTimeOffset = 0,
  variant = "amber",
  showLabel = true,
  className = "",
  onExpire,
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const diff = Math.ceil((deadline - (Date.now() + serverTimeOffset)) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    let fired = false;
    const updateTime = () => {
      const now = Date.now() + serverTimeOffset;
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 250);
    return () => clearInterval(interval);
  }, [deadline, serverTimeOffset, onExpire]);

  const colorClasses = {
    amber: {
      border: "border-amber-500/40",
      text: "text-amber-400",
      icon: "text-amber-500",
    },
    rose: {
      border: "border-rose-500/50",
      text: "text-rose-400",
      icon: "text-rose-500",
    },
    indigo: {
      border: "border-indigo-500/40",
      text: "text-indigo-400",
      icon: "text-indigo-500",
    },
  }[variant];

  const displaySeconds = secondsLeft > 0 ? secondsLeft : (secondsLeft === 0 ? 0 : timeLimit);
  const isUrgent = displaySeconds <= 5 && displaySeconds > 0;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 font-mono font-black text-sm border transition-colors ${
        colorClasses.border
      } ${colorClasses.text} ${
        isUrgent ? "animate-pulse !border-rose-500 !text-rose-400" : ""
      } ${className}`}
    >
      <Clock className={`w-4 h-4 ${colorClasses.icon} ${displaySeconds > 0 ? "animate-spin" : ""}`} />
      <span>
        {displaySeconds}s{showLabel ? " Left" : ""}
      </span>
    </div>
  );
});
