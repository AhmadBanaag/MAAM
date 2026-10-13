"use client";

import React from "react";
import { Flame, Trophy, ShieldAlert, ArrowRight } from "lucide-react";
import { CountdownTimer } from "@/components/countdown-timer";
import type {
  ClincherStatePayload,
  ClincherRoundResult,
  QuizChoice,
  FinalLeaderboardPayload,
} from "@/types/socket";

interface ClincherArenaProps {
  clincherState: ClincherStatePayload | null;
  lastClincherResult: ClincherRoundResult | null;
  leaderboard: FinalLeaderboardPayload | null;
  serverTimeOffset?: number;
  onAdvanceNextQuestion?: () => void;
  onEndGame?: () => void;
  isAdmin?: boolean;
}

const OPTION_THEMES: Record<QuizChoice, { badge: string; bg: string; border: string }> = {
  A: { badge: "bg-indigo-600 text-white", bg: "bg-indigo-950/30", border: "border-indigo-500/40" },
  B: { badge: "bg-emerald-600 text-white", bg: "bg-emerald-950/30", border: "border-emerald-500/40" },
  C: { badge: "bg-amber-600 text-white", bg: "bg-amber-950/30", border: "border-amber-500/40" },
  D: { badge: "bg-cyan-600 text-white", bg: "bg-cyan-950/30", border: "border-cyan-500/40" },
};

export function ClincherArena({
  clincherState,
  lastClincherResult,
  leaderboard,
  serverTimeOffset = 0,
  onAdvanceNextQuestion,
  onEndGame,
  isAdmin = false,
}: ClincherArenaProps) {
  // Active question view
  if (clincherState) {
    const question = clincherState.question;
    const contenderEntries = leaderboard?.entries.filter((e) =>
      clincherState.contendingTeamIds.includes(e.teamId)
    ) || [];

    return (
      <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-rose-950/30 to-slate-950 border-3 border-rose-500 shadow-2xl space-y-6 animate-in zoom-in-95">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rose-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1 rounded-full bg-rose-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-rose-600/30 animate-pulse">
                <Flame className="w-4 h-4 fill-white" />
                Sudden-Death Clincher &bull; Round {clincherState.roundNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-rose-500/30 text-rose-300 font-mono text-xs">
                Tie-Breaker Arena
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
              {question.questionText}
            </h2>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="px-6 py-3.5 rounded-2xl bg-slate-950 border-2 border-rose-500 text-center shadow-lg shadow-rose-600/20">
              <div className="text-[10px] text-rose-300 font-bold uppercase tracking-wider mb-1">
                Clincher Countdown
              </div>
              <CountdownTimer
                deadline={clincherState.deadline}
                timeLimit={clincherState.timeLimit}
                serverTimeOffset={serverTimeOffset}
                variant="rose"
                showLabel={false}
                className="!text-3xl md:!text-4xl !py-1 !px-2 justify-center !border-0 !bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Contending Teams Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-rose-500/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="text-xs font-bold text-slate-300">Contending 1st Place Teams:</span>
            <div className="flex flex-wrap gap-2">
              {contenderEntries.map((t) => (
                <span
                  key={t.teamId}
                  className="px-2.5 py-0.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs font-extrabold flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.teamName}
                </span>
              ))}
            </div>
          </div>
          <span className="text-[11px] text-slate-500 italic">
            Non-contending teams are spectating.
          </span>
        </div>

        {/* 4 Choices Grid (Projector View) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["A", "B", "C", "D"] as QuizChoice[]).map((choice) => {
            const theme = OPTION_THEMES[choice];
            return (
              <div
                key={choice}
                className={`p-5 rounded-2xl border ${theme.bg} ${theme.border} flex items-start gap-3 shadow-md`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 shadow ${theme.badge}`}
                >
                  {choice}
                </span>
                <span className="text-base md:text-lg font-bold text-white pt-1">
                  {question.options[choice]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Isolation Notice */}
        <div className="text-center text-xs text-slate-400 border-t border-slate-900 pt-3">
          ⚡ Clincher scoring is isolated from ordinary scores &bull; Power-ups are {clincherState.allowPowerUps ? "enabled" : "disabled"}
        </div>
      </div>
    );
  }

  // Round Results / Tied View / Winner View
  if (lastClincherResult) {
    const isWon = lastClincherResult.status === "won";

    return (
      <div
        className={`p-8 rounded-3xl border-3 shadow-2xl space-y-6 animate-in zoom-in-95 ${
          isWon
            ? "bg-gradient-to-br from-slate-950 via-yellow-950/40 to-slate-950 border-yellow-400"
            : "bg-gradient-to-br from-slate-950 via-rose-950/40 to-slate-950 border-rose-500"
        }`}
      >
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 w-fit ${
                isWon
                  ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              }`}
            >
              {isWon ? <Trophy className="w-4 h-4 text-yellow-400" /> : <Flame className="w-4 h-4 text-rose-400" />}
              {isWon ? "CLINCHER CHAMPION DECIDED!" : `ROUND ${lastClincherResult.roundNumber} TIED`}
            </span>
            <h2 className="text-2xl font-black text-white">
              {lastClincherResult.questionText}
            </h2>
            <p className="text-xs text-slate-300">{lastClincherResult.message}</p>
          </div>

          <div className="px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-center flex-shrink-0">
            <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
              Correct Answer
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              Option [{lastClincherResult.correctAnswer}]
            </div>
          </div>
        </div>

        {/* Contender Answers Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Contending Teams Submissions
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {lastClincherResult.submissions.map((sub) => (
              <div
                key={sub.teamId}
                className={`p-4 rounded-2xl border space-y-1.5 ${
                  sub.isCorrect
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : sub.selectedChoice === "NONE"
                    ? "bg-slate-900 border-slate-800 text-slate-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-white truncate">{sub.teamName}</span>
                  <span className="text-[10px] font-mono opacity-75">Slot {sub.slotNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Choice: [{sub.selectedChoice}]</span>
                  <span className="font-black">
                    {sub.isCorrect ? "Correct!" : sub.selectedChoice === "NONE" ? "No Answer" : "Incorrect"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls for Admin */}
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800">
            {!isWon && onAdvanceNextQuestion && (
              <button
                onClick={onAdvanceNextQuestion}
                id="btn-admin-next-clincher"
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-600/30 active:scale-98 transition-all flex items-center gap-2"
              >
                <Flame className="w-4 h-4 fill-white" />
                <span>START NEXT CLINCHER QUESTION</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {isWon && onEndGame && (
              <button
                onClick={onEndGame}
                id="btn-admin-finish-game"
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-yellow-500/30 active:scale-98 transition-all flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                <span>VIEW FINAL LEADERBOARD & PODIUM</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
