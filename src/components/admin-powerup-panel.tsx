"use client";

import React, { useState } from "react";
import {
  Zap,
  EyeOff,
  Lock,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type { TeamPowerUpAssignment, ActiveSpellEffect, PowerUpType } from "@/types/socket";

interface AdminPowerUpPanelProps {
  sessionId: string;
  allPowerUps: TeamPowerUpAssignment[];
  activeSpells: ActiveSpellEffect[];
  isQuizActive: boolean;
  onAssignPowerUps: () => void;
  onResolveStuck: () => void;
  isShuffling?: boolean;
}

export function AdminPowerUpPanel({
  allPowerUps,
  activeSpells,
  isQuizActive,
  onAssignPowerUps,
  onResolveStuck,
  isShuffling = false,
}: AdminPowerUpPanelProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [resolveMessage, setResolveMessage] = useState<string | null>(null);

  const getPowerUpIcon = (type: PowerUpType) => {
    switch (type) {
      case "invisibility":
        return <EyeOff className="w-4 h-4 text-sky-400" />;
      case "lockdown":
        return <Lock className="w-4 h-4 text-rose-400" />;
      case "back_to_sender":
        return <ShieldAlert className="w-4 h-4 text-emerald-400" />;
      case "riddle":
        return <HelpCircle className="w-4 h-4 text-amber-400" />;
      case "answer_reveal":
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      default:
        return <Zap className="w-4 h-4 text-indigo-400" />;
    }
  };

  const handleResolveClick = async () => {
    setIsResolving(true);
    try {
      onResolveStuck();
      setResolveMessage("Restrictions safely cleared.");
      setTimeout(() => setResolveMessage(null), 4000);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 backdrop-blur-md shadow-lg space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            Power-Up Management & Live Spells
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            5 unique spells shuffled and assigned 1-per-team. Monitor assignments, live activations, and reflection outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isQuizActive && (
            <button
              onClick={onAssignPowerUps}
              disabled={isShuffling || allPowerUps.some((p) => p.isUsed)}
              id="admin-assign-powerups-btn"
              title={
                allPowerUps.some((p) => p.isUsed)
                  ? "Cannot shuffle power-ups because one or more teams have already used their spell."
                  : allPowerUps.length === 0
                  ? "Randomly assign 1 unique power-up to each team"
                  : "Re-shuffle and distribute power-ups randomly among teams"
              }
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isShuffling ? "animate-spin" : ""}`} />
              {allPowerUps.length === 0 ? "Assign Power-Ups" : "Shuffle Power-Ups"}
            </button>
          )}

          {isQuizActive && (
            <button
              onClick={handleResolveClick}
              disabled={isResolving}
              id="admin-resolve-stuck-btn"
              className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-700/60 text-rose-300 rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition-all"
              title="Safely remove active locks and riddles without altering scores"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Resolve Stuck Question
            </button>
          )}
        </div>
      </div>

      {resolveMessage && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 px-3 py-2 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {resolveMessage}
        </div>
      )}

      {/* Grid of Team Assignments */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Team Power-Up Assignments ({allPowerUps.length}/5)
        </h4>

        {allPowerUps.length === 0 ? (
          <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-lg p-6 text-center text-xs text-slate-500">
            Power-ups will be automatically assigned once 5 teams register, or click &ldquo;Assign 5 Power-Ups&rdquo; above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {allPowerUps.map((pu) => (
              <div
                key={pu.teamId}
                className={`p-3.5 rounded-lg border flex flex-col justify-between transition-all ${
                  pu.isUsed
                    ? "bg-slate-950/40 border-slate-800/80 opacity-70"
                    : "bg-slate-800/40 border-slate-700/70 shadow-sm hover:border-slate-600"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Slot {pu.slotNumber}
                    </span>
                    {pu.isUsed ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        CONSUMED
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-400">
                        READY
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-200 truncate">{pu.teamName}</div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center gap-2">
                  <div className="p-1 rounded bg-slate-800/80">{getPowerUpIcon(pu.powerUpType)}</div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-300 truncate">{pu.powerUpName}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">{pu.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Active Spells Stream */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>Active Question Spell Stream</span>
          <span className="text-[11px] text-slate-500 font-normal">
            {activeSpells.length} spell{activeSpells.length === 1 ? "" : "s"} active
          </span>
        </h4>

        {activeSpells.length === 0 ? (
          <div className="bg-slate-950/30 border border-slate-800/60 rounded-lg p-4 text-center text-xs text-slate-500">
            No spells active on the current question. Spells are triggered by player smartphone activations.
          </div>
        ) : (
          <div className="space-y-2">
            {activeSpells.map((spell) => (
              <div
                key={spell.id}
                className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  spell.outcome === "reflected"
                    ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                    : spell.outcome === "shielded"
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                    : "bg-indigo-950/20 border-indigo-500/30 text-indigo-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-slate-900 border border-slate-700/60">
                    {getPowerUpIcon(spell.powerUpType)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <span>{spell.casterTeamName}</span>
                      <span className="text-slate-400 font-normal">&rarr;</span>
                      <span className="uppercase text-[11px] tracking-wider font-mono">
                        {spell.powerUpType.replace(/_/g, " ")}
                      </span>
                    </div>
                    {spell.isReflected && (
                      <div className="text-[11px] text-amber-400 font-medium">
                        🛡️ Reflected back to caster by {spell.reflectedByTeamName || "opponent"}!
                      </div>
                    )}
                    {spell.riddle && (
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        Riddle: &ldquo;{spell.riddle.questionText}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      spell.outcome === "reflected"
                        ? "bg-amber-900/60 text-amber-300 border border-amber-500/40"
                        : spell.outcome === "shielded"
                        ? "bg-emerald-900/60 text-emerald-300 border border-emerald-500/40"
                        : "bg-indigo-900/60 text-indigo-300 border border-indigo-500/40"
                    }`}
                  >
                    {spell.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
