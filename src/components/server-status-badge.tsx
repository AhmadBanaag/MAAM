"use client";

import React from "react";
import { Wifi, WifiOff, RefreshCw, Activity } from "lucide-react";

interface ServerStatusBadgeProps {
  isConnected: boolean;
  latency: number | null;
  serverIp?: string | null;
  socketId?: string | null;
  onPing?: () => void;
  compact?: boolean;
}

export function ServerStatusBadge({
  isConnected,
  latency,
  serverIp,
  socketId,
  onPing,
  compact = false,
}: ServerStatusBadgeProps) {
  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return "text-slate-400";
    if (ms < 30) return "text-emerald-400";
    if (ms < 100) return "text-amber-400";
    return "text-rose-400";
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs backdrop-blur-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
          }`}
        />
        <span className="font-medium text-slate-300">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
        {isConnected && latency !== null && (
          <span className={`font-mono text-[11px] ${getLatencyColor(latency)}`}>
            {latency}ms
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}
        >
          {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {isConnected ? "Local Server Online" : "Server Disconnected"}
            </span>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
            {serverIp && <span>IP: {serverIp}</span>}
            {socketId && <span className="hidden sm:inline">ID: {socketId.slice(0, 6)}...</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && latency !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/50 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className={getLatencyColor(latency)}>{latency} ms</span>
          </div>
        )}
        {onPing && isConnected && (
          <button
            onClick={onPing}
            title="Test ping & latency"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
