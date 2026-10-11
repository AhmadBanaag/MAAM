"use client";

import React from "react";
import { Trophy, Award, Medal, Sparkles, CheckCircle2, Users, Flame } from "lucide-react";
import type { FinalLeaderboardPayload } from "@/types/socket";

interface LeaderboardPodiumProps {
  leaderboard: FinalLeaderboardPayload;
  onStartClincher?: () => void;
  isAdmin?: boolean;
}

const RANK_BADGES: Record<number, { bg: string; border: string; text: string; label: string; icon: React.ReactNode }> = {
  1: {
    bg: "from-amber-500/20 via-yellow-500/10 to-amber-950/40",
    border: "border-yellow-400/80 shadow-yellow-500/20",
    text: "text-yellow-300",
    label: "1st Place",
    icon: <Trophy className="w-6 h-6 text-yellow-400 animate-bounce" />,
  },
  2: {
    bg: "from-slate-300/20 via-slate-400/10 to-slate-900/40",
    border: "border-slate-300/60 shadow-slate-300/10",
    text: "text-slate-200",
    label: "2nd Place",
    icon: <Medal className="w-5 h-5 text-slate-300" />,
  },
  3: {
    bg: "from-amber-700/20 via-orange-800/10 to-slate-900/40",
    border: "border-amber-600/50 shadow-amber-700/10",
    text: "text-amber-400",
    label: "3rd Place",
    icon: <Award className="w-5 h-5 text-amber-500" />,
  },
};

export function LeaderboardPodium({ leaderboard, onStartClincher, isAdmin = false }: LeaderboardPodiumProps) {
  const { entries, hasTieForFirst, winner, isFinished } = leaderboard;

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      {/* Top Banner: Champion or Tie-Breaker Alert */}
      {winner ? (
        <div className="relative overflow-hidden p-6 md:p-8 rounded-3xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-slate-950 shadow-2xl shadow-yellow-500/30 text-center border-4 border-yellow-300">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 text-yellow-300 text-xs font-black tracking-widest uppercase shadow">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>PRESENTATION CHAMPION</span>
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-sm">
              🏆 {winner.teamName} 🏆
            </h2>
            <p className="text-sm md:text-base font-bold text-slate-900">
              Led by <span className="underline decoration-slate-950/40">{winner.leaderName}</span> &bull; {winner.totalScore} Points ({winner.correctCount} Correct)
            </p>
            {winner.isClincherWinner && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 text-amber-200 text-xs font-black tracking-wide border border-yellow-300 shadow">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Victorious via Clincher Tie-Breaker Round!
              </span>
            )}
          </div>
        </div>
      ) : hasTieForFirst ? (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-slate-950 border-2 border-rose-500/70 shadow-2xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black uppercase tracking-wider animate-pulse">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>TIE FOR 1ST PLACE DETECTED</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-white">
            Sudden-Death Clincher Required!
          </h2>
          <p className="text-xs md:text-sm text-slate-300 max-w-xl mx-auto">
            Multiple teams share the top score. A Clincher Round must be played exclusively among the tied contenders to determine the definitive Classroom Quiz Battle Champion.
          </p>

          {isAdmin && onStartClincher && (
            <div className="pt-2">
              <button
                onClick={onStartClincher}
                id="btn-admin-launch-clincher-banner"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-600/30 active:scale-95 transition-all flex items-center gap-2 mx-auto"
              >
                <Flame className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                <span>CONFIGURE & START CLINCHER ROUND</span>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Podium Cards (Top 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {topThree.map((entry, idx) => {
          const badgeTheme = RANK_BADGES[entry.rank] || RANK_BADGES[3];
          const isFirst = entry.rank === 1;

          return (
            <div
              key={entry.teamId}
              className={`relative overflow-hidden rounded-3xl p-6 border-2 bg-gradient-to-b ${badgeTheme.bg} ${badgeTheme.border} shadow-xl flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] ${
                isFirst ? "order-first md:order-2 md:-translate-y-2 ring-2 ring-yellow-400/40" : idx === 1 ? "order-2 md:order-1" : "order-3"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-950/80 border border-slate-700 ${badgeTheme.text} flex items-center gap-1.5 shadow`}>
                    {badgeTheme.icon}
                    <span>Rank {entry.rank}</span>
                  </span>
                  {entry.isTiedForFirst && (
                    <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase">
                      Tied
                    </span>
                  )}
                  {entry.isClincherWinner && (
                    <span className="px-2 py-0.5 rounded-lg bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-black uppercase">
                      Clincher Winner
                    </span>
                  )}
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner" style={{ backgroundColor: entry.color, color: "#fff" }}>
                  {entry.slotNumber}
                </div>
              </div>

              <div className="my-5 space-y-1">
                <h3 className="text-xl md:text-2xl font-black text-white truncate drop-shadow-sm">
                  {entry.teamName}
                </h3>
                <div className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Leader: <strong className="text-slate-200">{entry.leaderName}</strong></span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Score</div>
                  <div className={`text-3xl md:text-4xl font-black font-mono tracking-tight ${isFirst ? "text-yellow-400" : "text-white"}`}>
                    {entry.totalScore}
                    <span className="text-xs font-normal text-slate-500 ml-1">pts</span>
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 justify-end">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{entry.correctCount} Correct</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {entry.answeredCount} / {entry.totalQuestions} Answered
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Roster Table for Remaining Teams */}
      {remaining.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-400" />
            <span>Remaining Standings</span>
          </h4>

          <div className="space-y-2">
            {remaining.map((entry) => (
              <div
                key={entry.teamId}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-black text-xs text-slate-400">
                    #{entry.rank}
                  </span>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <div>
                    <div className="font-bold text-sm text-white">{entry.teamName}</div>
                    <div className="text-[11px] text-slate-400">Leader: {entry.leaderName}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-400">
                      {entry.correctCount} / {entry.answeredCount} Correct
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {entry.totalQuestions} Questions Total
                    </div>
                  </div>
                  <div className="text-right min-w-[70px]">
                    <span className="text-xl font-black font-mono text-white">
                      {entry.totalScore}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Notes */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-4 gap-2">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Server-Authoritative Scores & Tied Rank Resolution Active
        </span>
        <span>
          Status: {isFinished ? "Presentation Game Concluded" : "Live Game Standings"}
        </span>
      </div>
    </div>
  );
}
