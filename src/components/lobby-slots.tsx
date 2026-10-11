"use client";

import React from "react";
import { Users, WifiOff, X, Crown } from "lucide-react";
import type { TeamLobbyInfo } from "@/lib/db";

interface LobbySlotsProps {
  teams: TeamLobbyInfo[];
  maxTeams?: number;
  onKickTeam?: (teamId: string) => void;
  currentTeamId?: string;
  isAdmin?: boolean;
}

const SLOT_BORDER_COLORS = [
  "border-indigo-500/40 bg-indigo-500/5 hover:border-indigo-500/60",
  "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60",
  "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60",
  "border-cyan-500/40 bg-cyan-500/5 hover:border-cyan-500/60",
  "border-purple-500/40 bg-purple-500/5 hover:border-purple-500/60",
];

const SLOT_BADGE_COLORS = [
  "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "bg-purple-500/20 text-purple-300 border-purple-500/30",
];

export function LobbySlots({
  teams,
  maxTeams = 5,
  onKickTeam,
  currentTeamId,
  isAdmin = false,
}: LobbySlotsProps) {
  // Map teams into 5 fixed slots
  const slots = Array.from({ length: maxTeams }, (_, i) => {
    const slotNumber = i + 1;
    const team = teams.find((t) => t.slotNumber === slotNumber);
    return { slotNumber, team };
  });

  return (
    <div className="space-y-4">
      {/* Lobby Roster Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {slots.map(({ slotNumber, team }) => {
          const isCurrentPlayer = team && team.id === currentTeamId;
          const colorIndex = (slotNumber - 1) % SLOT_BORDER_COLORS.length;

          if (team) {
            return (
              <div
                key={team.id}
                className={`relative p-4 rounded-2xl border transition-all duration-200 shadow-md ${
                  SLOT_BORDER_COLORS[colorIndex]
                } ${isCurrentPlayer ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950 scale-[1.02]" : ""}`}
              >
                {/* Header: Slot Badge & Online Status */}
                <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-800/80">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${SLOT_BADGE_COLORS[colorIndex]}`}
                  >
                    <span>Slot {slotNumber}</span>
                  </span>

                  {/* Connected vs Disconnected status */}
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                      team.isConnected
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {team.isConnected ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        <span>Offline</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Team Info */}
                <div className="pt-3 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-extrabold text-sm text-white truncate" title={team.name}>
                      {team.name}
                    </h4>
                    {isCurrentPlayer && (
                      <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="truncate" title={`Leader: ${team.leaderName}`}>
                      {team.leaderName}
                    </span>
                  </div>
                </div>

                {/* Admin Kick Action */}
                {isAdmin && onKickTeam && (
                  <div className="pt-3 mt-3 border-t border-slate-800/80 flex justify-end">
                    <button
                      onClick={() => onKickTeam(team.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                      title="Remove team and free slot"
                    >
                      <X className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // Empty Slot Placeholder
          return (
            <div
              key={`empty-slot-${slotNumber}`}
              className="p-4 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 flex flex-col justify-between min-h-[120px] text-center"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">Slot {slotNumber}</span>
                <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">
                  Open
                </span>
              </div>

              <div className="my-auto py-2 space-y-1">
                <div className="w-7 h-7 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-slate-500 font-medium">Waiting for Team...</div>
              </div>

              <div className="text-[10px] text-slate-600 font-mono">Available</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
