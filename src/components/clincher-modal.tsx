"use client";

import React, { useState } from "react";
import { Flame, Zap, X, ShieldAlert } from "lucide-react";
import type { QuizQuestion, FinalLeaderboardPayload, ClincherRoundConfig } from "@/types/socket";

interface ClincherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: ClincherRoundConfig) => void;
  leaderboard: FinalLeaderboardPayload;
  questions: QuizQuestion[];
}

export function ClincherModal({
  isOpen,
  onClose,
  onStart,
  leaderboard,
  questions,
}: ClincherModalProps) {
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [allowPowerUps, setAllowPowerUps] = useState<boolean>(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  if (!isOpen) return null;

  const contendingTeams = leaderboard.entries.filter((e) =>
    leaderboard.tiedFirstPlaceTeamIds.includes(e.teamId)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({
      sessionId: leaderboard.sessionId,
      questionId: selectedQuestionId || undefined,
      timeLimit,
      allowPowerUps,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-6 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Start Clincher Round</h2>
              <p className="text-xs text-slate-400">Sudden-Death Tie-Breaker Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contending Teams Banner */}
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-rose-300 tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Contending Teams in 1st Place ({contendingTeams.length})
            </span>
            <span className="text-[10px] text-slate-400">Only these teams will answer</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {contendingTeams.map((t) => (
              <div
                key={t.teamId}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <div className="truncate">
                  <div className="text-xs font-black text-white truncate">{t.teamName}</div>
                  <div className="text-[10px] text-slate-400 truncate">{t.leaderName} ({t.totalScore} pts)</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Clincher Question
            </label>
            <select
              value={selectedQuestionId}
              onChange={(e) => setSelectedQuestionId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
            >
              <option value="">-- Random Clincher Question from Bank --</option>
              {questions.map((q, idx) => (
                <option key={q.id} value={q.id}>
                  Q{idx + 1}: {q.questionText.slice(0, 50)}... ({q.correctAnswer})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Leave on Random to let the server pick an unused or clincher-designated question.
            </p>
          </div>

          {/* Time Limit Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Time Limit (Seconds)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 20, 30, 45].map((sec) => (
                <button
                  type="button"
                  key={sec}
                  onClick={() => setTimeLimit(sec)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    timeLimit === sec
                      ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Power-Up Rules Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                <input
                  type="checkbox"
                  checked={allowPowerUps}
                  onChange={(e) => setAllowPowerUps(e.target.checked)}
                  className="rounded border-slate-700 text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Allow Power-Ups during Clincher
                </span>
              </label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${allowPowerUps ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"}`}>
                {allowPowerUps ? "Enabled" : "Disabled (Default)"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Per competitive rules, power-ups are disabled by default so the sudden-death tie-breaker tests pure knowledge.
            </p>
          </div>

          {/* Submit & Cancel */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-confirm-start-clincher"
              className="flex-[2] py-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-600/30 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Flame className="w-4 h-4 fill-white" />
              <span>LAUNCH CLINCHER ROUND</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
