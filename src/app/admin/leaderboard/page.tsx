"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Maximize2,
  Minimize2,
  Flame,
  Award,
  Zap,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import { LeaderboardPodium } from "@/components/leaderboard-podium";
import { ClincherModal } from "@/components/clincher-modal";
import { ClincherArena } from "@/components/clincher-arena";
import type { ClincherRoundConfig } from "@/types/socket";

export default function AdminLeaderboardPage() {
  const {
    currentSession,
    lobbyData,
    leaderboard,
    questions,
    fetchLeaderboardAction,
    clincherState,
    lastClincherResult,
    startClincherRoundAction,
    endClincherRoundAction,
  } = useSocket("admin", "AdminLeaderboardView");

  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isClincherModalOpen, setIsClincherModalOpen] = useState(false);

  const activeSessionId = lobbyData?.session.id || currentSession?.id;

  // Poll/fetch leaderboard on mount & session change
  useEffect(() => {
    if (activeSessionId) {
      fetchLeaderboardAction(activeSessionId);
    }
  }, [activeSessionId, fetchLeaderboardAction]);

  const handleStartClincher = (config: ClincherRoundConfig) => {
    if (!activeSessionId) return;
    startClincherRoundAction(activeSessionId, config, () => {
      setIsClincherModalOpen(false);
    });
  };

  const handleEndClincher = () => {
    if (!activeSessionId) return;
    endClincherRoundAction(activeSessionId);
  };

  const togglePresentation = () => {
    setIsPresentationMode(!isPresentationMode);
  };

  // If in Presentation Mode, render full-screen immersive view
  if (isPresentationMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6 md:p-12 flex flex-col justify-between">
        {/* Presentation Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black shadow-xl shadow-amber-500/20">
              <Trophy className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Classroom Quiz Battle</h1>
              <p className="text-sm font-medium text-amber-400">Live Championship Standings</p>
            </div>
          </div>

          <button
            type="button"
            onClick={togglePresentation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-semibold"
          >
            <Minimize2 className="h-4 w-4" />
            <span>Exit Presentation</span>
          </button>
        </div>

        {/* Presentation Podium & Table */}
        <div className="flex-1 max-w-6xl mx-auto w-full space-y-8">
          {leaderboard ? (
            <LeaderboardPodium
              leaderboard={leaderboard}
              onStartClincher={() => setIsClincherModalOpen(true)}
              isAdmin={true}
            />
          ) : (
            <div className="text-center py-20 text-slate-500 text-lg">
              Waiting for quiz questions and submissions to populate the leaderboard...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-8 border-t border-slate-800/60 mt-8">
          Server-Authoritative Real-Time Scores &bull; 5-Team Classroom Tournament
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Trophy className="h-4 w-4" />
            <span>Rankings & Scoring Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Leaderboard & Standings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Live team standings sorted by server-authoritative scores with tie-breaker detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePresentation}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95"
            title="Open projector presentation mode (hides controls)"
          >
            <Maximize2 className="h-4 w-4" />
            <span>Presentation Mode</span>
          </button>

          {leaderboard?.hasTieForFirst && (
            <button
              type="button"
              onClick={() => setIsClincherModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition animate-pulse"
            >
              <Flame className="h-4 w-4" />
              <span>Launch Clincher</span>
            </button>
          )}
        </div>
      </div>

      {/* Clincher Live Arena if active */}
      {clincherState && (
        <div className="rounded-3xl border-2 border-amber-500/50 bg-slate-900/90 p-6 shadow-2xl">
          <ClincherArena
            clincherState={clincherState}
            lastClincherResult={lastClincherResult}
            leaderboard={leaderboard}
            onEndGame={handleEndClincher}
            isAdmin={true}
          />
        </div>
      )}

      {/* Podium Component */}
      {leaderboard ? (
        <div className="space-y-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur shadow-xl">
            <LeaderboardPodium
              leaderboard={leaderboard}
              onStartClincher={() => setIsClincherModalOpen(true)}
              isAdmin={true}
            />
          </div>

          {/* Detailed Statistics Table */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Full Team Performance Metrics</h3>
              </div>
              <span className="text-xs text-slate-400">
                {leaderboard.entries.length} Teams Registered
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Leader</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-center">Correct</th>
                    <th className="py-3 px-4 text-center">Incorrect</th>
                    <th className="py-3 px-4 text-center">Answered</th>
                    <th className="py-3 px-4 text-right">Power-Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {leaderboard.entries.map((entry) => {
                    const isFirst = entry.rank === 1;
                    return (
                      <tr
                        key={entry.teamId}
                        className={`transition hover:bg-slate-800/30 ${
                          isFirst ? "bg-amber-500/5 font-semibold" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold">
                          {entry.rank === 1 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400">
                              <Trophy className="h-4 w-4" /> 1st
                            </span>
                          ) : entry.rank === 2 ? (
                            <span className="text-slate-300">2nd</span>
                          ) : entry.rank === 3 ? (
                            <span className="text-amber-600">3rd</span>
                          ) : (
                            <span className="text-slate-500">#{entry.rank}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{entry.teamName}</span>
                            {isFirst && (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                LEADER
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{entry.leaderName}</td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                          {entry.totalScore} pts
                        </td>
                        <td className="py-3.5 px-4 text-center text-emerald-400 font-semibold">
                          {entry.correctCount}
                        </td>
                        <td className="py-3.5 px-4 text-center text-rose-400 font-semibold">
                          {Math.max(0, entry.answeredCount - entry.correctCount)}
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-300 font-mono">
                          {entry.answeredCount}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                            title="Private power-up status"
                          >
                            <Zap className="h-3 w-3 text-indigo-400" />
                            Assigned
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400 space-y-3">
          <Trophy className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Scores Recorded Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once teams register and answer quiz questions, live standings, correct/incorrect ratios, and rank badges will appear here.
          </p>
        </div>
      )}

      {/* Clincher Setup Modal */}
      {isClincherModalOpen && leaderboard && (
        <ClincherModal
          isOpen={isClincherModalOpen}
          onClose={() => setIsClincherModalOpen(false)}
          leaderboard={leaderboard}
          questions={questions}
          onStart={handleStartClincher}
        />
      )}
    </div>
  );
}
