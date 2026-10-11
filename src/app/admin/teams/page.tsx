"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Edit2,
  Trash2,
  RotateCcw,
  Zap,
  AlertTriangle,
  EyeOff,
  Lock,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  Award,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import { AdminPowerUpPanel } from "@/components/admin-powerup-panel";
import type { PowerUpType, TeamPowerUpAssignment } from "@/types/socket";
import { POWER_UP_DEFINITIONS } from "@/types/socket";
import type { TeamLobbyInfo } from "@/lib/db";

export default function AdminTeamsPage() {
  const {
    currentSession,
    lobbyData,
    allPowerUps,
    activeSpells,
    activeQuiz,
    kickTeamAction,
    renameTeamAction,
    resetRegistrationAction,
    shufflePowerUpsAction,
    fetchAllPowerUpsAction,
    adminResolveStuckAction,
  } = useSocket("admin", "AdminTeamOrganizationView");

  const activeSessionId = lobbyData?.session.id || currentSession?.id;

  // Rename Dialog State
  const [renamingTeam, setRenamingTeam] = useState<TeamLobbyInfo | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  // Reset Confirmation Modal State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleToast, setShuffleToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Refresh power-up table
  useEffect(() => {
    if (activeSessionId) {
      fetchAllPowerUpsAction(activeSessionId);
    }
  }, [activeSessionId, fetchAllPowerUpsAction]);

  const maxTeams = lobbyData?.maxTeams ?? 5;
  const teams = lobbyData?.teams ?? [];
  const isQuestionActive = !!activeQuiz;
  const anyPowerUpUsed = allPowerUps.some((p) => p.isUsed);
  const isShuffleDisabled = isShuffling || isQuestionActive || anyPowerUpUsed || teams.length === 0;

  const getShuffleTooltip = () => {
    if (teams.length === 0) return "No teams registered yet. Teams must register before power-ups can be shuffled.";
    if (isQuestionActive) return "Cannot shuffle power-ups while a question is actively running.";
    if (anyPowerUpUsed) return "Cannot shuffle power-ups because one or more teams have already used their spell.";
    return "Randomly shuffle and assign 1 unique power-up to each team";
  };

  const getPowerUpForTeam = (teamId: string): TeamPowerUpAssignment | undefined => {
    return allPowerUps.find((p) => p.teamId === teamId);
  };

  const getPowerUpIcon = (type: PowerUpType) => {
    switch (type) {
      case "invisibility":
        return <EyeOff className="h-4 w-4 text-sky-400" />;
      case "lockdown":
        return <Lock className="h-4 w-4 text-rose-400" />;
      case "back_to_sender":
        return <ShieldAlert className="h-4 w-4 text-emerald-400" />;
      case "riddle":
        return <HelpCircle className="h-4 w-4 text-amber-400" />;
      case "answer_reveal":
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      default:
        return <Zap className="h-4 w-4 text-indigo-400" />;
    }
  };

  const openRename = (team: TeamLobbyInfo) => {
    setRenamingTeam(team);
    setNewTeamName(team.name);
    setRenameError(null);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId || !renamingTeam) return;
    if (newTeamName.trim().length < 2) {
      setRenameError("Team name must be at least 2 characters.");
      return;
    }

    renameTeamAction(activeSessionId, renamingTeam.id, newTeamName.trim(), (res) => {
      if (res && !res.success) {
        setRenameError(res.error || "Failed to rename team.");
      } else {
        setRenamingTeam(null);
      }
    });
  };

  const handleRemoveTeam = (team: TeamLobbyInfo) => {
    if (isQuestionActive) {
      alert("Cannot remove teams while a question is actively in progress!");
      return;
    }
    if (!activeSessionId) return;

    if (confirm(`Are you sure you want to remove team "${team.name}"?`)) {
      kickTeamAction(activeSessionId, team.id);
    }
  };

  const handleResetRegistrations = () => {
    if (isQuestionActive) {
      alert("Cannot reset registrations while a question is actively in progress!");
      return;
    }
    if (!activeSessionId) return;
    setIsResetting(true);
    resetRegistrationAction(activeSessionId, () => {
      setIsResetting(false);
      setIsResetConfirmOpen(false);
    });
  };

  const handleAssignPowerUps = () => {
    if (!activeSessionId) return;
    if (teams.length === 0) {
      setShuffleToast({
        type: "error",
        message: "No teams registered yet. Teams must register before power-ups can be shuffled.",
      });
      setTimeout(() => setShuffleToast(null), 4000);
      return;
    }
    if (isQuestionActive) {
      setShuffleToast({
        type: "error",
        message: "Cannot shuffle power-ups while a question is actively in progress.",
      });
      setTimeout(() => setShuffleToast(null), 4000);
      return;
    }
    if (anyPowerUpUsed) {
      setShuffleToast({
        type: "error",
        message: "Cannot shuffle power-ups because one or more teams have already used their spell.",
      });
      setTimeout(() => setShuffleToast(null), 4000);
      return;
    }

    setIsShuffling(true);
    shufflePowerUpsAction(activeSessionId, (res) => {
      setIsShuffling(false);
      if (res && res.success) {
        setShuffleToast({
          type: "success",
          message: "Power-ups successfully shuffled and distributed to players!",
        });
      } else {
        setShuffleToast({
          type: "error",
          message: res?.error || "Failed to shuffle power-ups.",
        });
      }
      setTimeout(() => setShuffleToast(null), 4000);
    });
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Users className="h-4 w-4" />
            <span>Roster & Slot Management</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Team Organization</h1>
          <p className="text-sm text-slate-400 mt-1">
            View registered teams, monitor connection heartbeats, rename teams, and oversee power-up assignments.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAssignPowerUps}
            disabled={isShuffleDisabled}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition shadow-sm disabled:opacity-40"
            title={getShuffleTooltip()}
          >
            <RotateCcw className={`h-4 w-4 ${isShuffling ? "animate-spin text-indigo-400" : ""}`} />
            <span>{isShuffling ? "Shuffling..." : "Shuffle Power-Ups"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            disabled={isQuestionActive}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold transition disabled:opacity-40"
            title={isQuestionActive ? "Cannot reset while question is in progress" : "Clear all registrations"}
          >
            <Trash2 className="h-4 w-4" />
            <span>Reset Registration</span>
          </button>
        </div>
      </div>

      {/* Shuffle Feedback Toast */}
      {shuffleToast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 shadow-lg transition-all animate-in fade-in duration-200 ${
            shuffleToast.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10"
              : "bg-rose-950/60 border-rose-500/40 text-rose-300 shadow-rose-500/10"
          }`}
        >
          {shuffleToast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{shuffleToast.message}</span>
        </div>
      )}

      {/* 5 Team Slots Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Registered Team Slots</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              {teams.length} / {maxTeams}
            </span>
          </h2>
          <span className="text-xs text-slate-500">
            {maxTeams - teams.length} available slot(s) remaining
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: maxTeams }).map((_, idx) => {
            const slotNum = idx + 1;
            const team = teams.find((t) => t.slotNumber === slotNum);
            const powerUp = team ? getPowerUpForTeam(team.id) : undefined;

            if (team) {
              return (
                <div
                  key={team.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg relative flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
                >
                  {/* Top Bar: Slot and Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white font-black text-xs shadow"
                        style={{ backgroundColor: team.color || "#6366f1" }}
                      >
                        #{slotNum}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Slot {slotNum}
                      </span>
                    </div>

                    {/* Connection heartbeat */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                        team.isConnected
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          team.isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                        }`}
                      />
                      {team.isConnected ? "Online" : "Offline"}
                    </span>
                  </div>

                  {/* Team Info */}
                  <div>
                    <h3 className="text-lg font-bold text-white truncate">{team.name}</h3>
                    <p className="text-xs text-slate-400">Leader: {team.leaderName}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                      <Award className="h-4 w-4" />
                      <span>{team.score} Points</span>
                    </div>
                  </div>

                  {/* Assigned Power-Up Banner (Admin Eyes Only) */}
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        Assigned Power-Up
                      </span>
                      {powerUp && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            powerUp.isUsed
                              ? "bg-slate-800 text-slate-400"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {powerUp.isUsed ? "EXPENDED" : "READY"}
                        </span>
                      )}
                    </div>

                    {powerUp ? (
                      <div className="flex items-center gap-2 pt-0.5">
                        {getPowerUpIcon(powerUp.powerUpType)}
                        <span className="font-semibold text-white truncate">
                          {POWER_UP_DEFINITIONS[powerUp.powerUpType]?.name || powerUp.powerUpType}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">Not assigned yet</div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => openRename(team)}
                      className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Rename</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveTeam(team)}
                      disabled={isQuestionActive}
                      className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 font-semibold transition disabled:opacity-30 disabled:hover:text-red-400"
                      title={isQuestionActive ? "Cannot remove team during active question" : "Remove team"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Empty Slot Placeholder
            return (
              <div
                key={`empty-slot-${slotNum}`}
                className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 flex flex-col items-center justify-center text-center space-y-2 min-h-[220px]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-slate-800 text-slate-600 font-bold text-sm">
                  #{slotNum}
                </div>
                <h4 className="text-sm font-bold text-slate-400">Slot {slotNum} Available</h4>
                <p className="text-[11px] text-slate-600 max-w-[200px]">
                  Waiting for a student team to scan the QR code and register.
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Power-Up Panel Component Embedded */}
      <div className="pt-4">
        <AdminPowerUpPanel
          sessionId={activeSessionId || ""}
          allPowerUps={allPowerUps}
          activeSpells={activeSpells}
          isQuizActive={!!activeQuiz}
          isShuffling={isShuffling}
          onAssignPowerUps={handleAssignPowerUps}
          onResolveStuck={() => {
            if (activeSessionId) adminResolveStuckAction(activeSessionId);
          }}
        />
      </div>

      {/* Rename Dialog Modal */}
      {renamingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Rename Team</h3>
              <button
                type="button"
                onClick={() => setRenamingTeam(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {renameError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                {renameError}
              </div>
            )}

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-bold"
                  placeholder="Enter new team name..."
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRenamingTeam(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 text-xs font-semibold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-slate-950 p-6 shadow-2xl space-y-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mx-auto border border-red-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Reset All Team Registrations?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This action will delete all registered teams, reset score counters, and clear power-up assignments for this session. This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetRegistrations}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30"
              >
                {isResetting ? "Resetting..." : "Yes, Reset All Teams"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
