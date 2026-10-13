"use client";

import React, { useEffect, useState } from "react";
import {
  Gamepad2,
  Shield,
  Server,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  Award,
  EyeOff,
  Lock,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Trophy,
} from "lucide-react";
import { LeaderboardPodium } from "@/components/leaderboard-podium";
import { ClincherArena } from "@/components/clincher-arena";
import { CountdownTimer } from "@/components/countdown-timer";
import { useSocket } from "@/hooks/use-socket";
import { ServerStatusBadge } from "@/components/server-status-badge";
import { NetworkInfoCard } from "@/components/network-info-card";
import { LobbySlots } from "@/components/lobby-slots";
import type { QuizChoice } from "@/types/socket";
import { POWER_UP_DEFINITIONS } from "@/types/socket";

interface ServerInfo {
  serverIp: string;
  port: number;
  uptime: number;
}

const OPTION_THEMES: Record<QuizChoice, { badge: string; bg: string; border: string }> = {
  A: { badge: "bg-indigo-600 text-white", bg: "bg-indigo-950/30", border: "border-indigo-500/40" },
  B: { badge: "bg-emerald-600 text-white", bg: "bg-emerald-950/30", border: "border-emerald-500/40" },
  C: { badge: "bg-amber-600 text-white", bg: "bg-amber-950/30", border: "border-amber-500/40" },
  D: { badge: "bg-cyan-600 text-white", bg: "bg-cyan-950/30", border: "border-cyan-500/40" },
};

export default function HomePage() {
  const {
    isConnected,
    latency,
    serverIp: socketServerIp,
    socketId,
    activeClients,
    currentSession,
    lobbyData,
    activeQuiz,
    quizProgress,
    lastQuizResult,
    sendPing,
    activeSpells,
    spellNotification,
    leaderboard,
    isGameEnded,
    clincherState,
    lastClincherResult,
    serverTimeOffset,
    fetchLeaderboardAction,
  } = useSocket("spectator");
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [viewMode, setViewMode] = useState<"roster" | "leaderboard">("roster");



  useEffect(() => {
    const sId = lobbyData?.session.id || currentSession?.id;
    if (sId) {
      fetchLeaderboardAction(sId);
    }
  }, [lobbyData?.session.id, currentSession?.id, fetchLeaderboardAction]);

  useEffect(() => {
    fetch("/api/server-info")
      .then((res) => res.json())
      .then((data) => setServerInfo(data))
      .catch((err) => console.error("Error fetching server info:", err));
  }, []);

  const displayIp = socketServerIp || serverInfo?.serverIp || "Detecting...";
  const displayPort = serverInfo?.port || 3000;

  const session = lobbyData?.session || currentSession;
  const teams = lobbyData?.teams || [];
  const registeredCount = lobbyData?.registeredCount || 0;
  const maxTeams = lobbyData?.maxTeams || 5;

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-8 max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Gamepad2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  Classroom Quiz Battle
                </h1>
                {session && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-xs text-indigo-300 font-bold border border-slate-700">
                    {session.id}
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-slate-400 font-medium">
                Local-Network Real-Time Quiz Presentation &bull; University Classroom Mode
              </p>
            </div>
          </div>

          <ServerStatusBadge
            isConnected={isConnected}
            latency={latency}
            serverIp={displayIp}
            socketId={socketId}
            onPing={sendPing}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="my-8 space-y-8">
        {/* CLINCHER ARENA (If Clincher is active or just completed) */}
        {(clincherState || (lastClincherResult && !isGameEnded)) && (
          <ClincherArena
            clincherState={clincherState}
            lastClincherResult={lastClincherResult}
            leaderboard={leaderboard}
            serverTimeOffset={serverTimeOffset}
          />
        )}

        {/* PRESENTATION FINALE: FINAL LEADERBOARD & PODIUM (If game ended) */}
        {isGameEnded && leaderboard && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-yellow-500/30">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <h2 className="text-xl md:text-2xl font-black text-white">Final Presentation Leaderboard</h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-xs font-black uppercase tracking-wider">
                Official Results
              </span>
            </div>
            <LeaderboardPodium leaderboard={leaderboard} />
          </div>
        )}

        {/* ACTIVE QUIZ PRESENTATION BOARD (Main Screen View) */}
        {activeQuiz ? (
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 border-2 border-amber-500/60 shadow-2xl space-y-6 animate-in zoom-in-95">
            {/* Live Spell Notification Toast */}
            {spellNotification && (
              <div className="p-4 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 text-amber-200 text-sm font-bold flex items-center gap-3 animate-pulse">
                <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>{spellNotification}</span>
              </div>
            )}

            {/* Active Battlefield Spells */}
            {activeSpells && activeSpells.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-slate-950/80 border border-indigo-500/30">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mr-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Battlefield Spells:
                </span>
                {activeSpells.map((spell, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center gap-2 shadow"
                  >
                    {spell.powerUpType === "invisibility" && <EyeOff className="w-3.5 h-3.5 text-purple-400" />}
                    {spell.powerUpType === "lockdown" && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                    {spell.powerUpType === "back_to_sender" && <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />}
                    {spell.powerUpType === "riddle" && <HelpCircle className="w-3.5 h-3.5 text-amber-400" />}
                    {spell.powerUpType === "answer_reveal" && <Sparkles className="w-3.5 h-3.5 text-yellow-400" />}
                    <span>{POWER_UP_DEFINITIONS[spell.powerUpType]?.name || spell.powerUpType}</span>
                    <span className="text-[10px] text-slate-400">({spell.casterTeamName})</span>
                    {spell.isReflected && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 text-[9px] uppercase font-black">
                        Reflected
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Top Bar: Surprise Quiz Status & Big Countdown */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Surprise Quiz Active
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Question {activeQuiz.questionNumber} of {activeQuiz.totalQuestions}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                  {activeQuiz.questionText}
                </h2>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="px-5 py-3 rounded-2xl bg-slate-950 border border-amber-500/40 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Countdown
                  </div>
                  <CountdownTimer
                    deadline={activeQuiz.deadline}
                    timeLimit={activeQuiz.timeLimit}
                    serverTimeOffset={serverTimeOffset}
                    variant="amber"
                    showLabel={false}
                    className="!text-3xl !py-1.5 !px-3 justify-center !border-0 !bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 4 Choices Grid (Projector View) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["A", "B", "C", "D"] as QuizChoice[]).map((choice) => {
                const theme = OPTION_THEMES[choice];
                return (
                  <div
                    key={choice}
                    className={`p-4 rounded-2xl border ${theme.bg} ${theme.border} flex items-start gap-3 shadow-md`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 shadow ${theme.badge}`}
                    >
                      {choice}
                    </span>
                    <span className="text-base md:text-lg font-bold text-white pt-1">
                      {activeQuiz.options[choice]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Live Submissions Tracker Bar */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Live Team Submissions
                </span>
                <span className="font-mono text-amber-400 font-black">
                  {quizProgress?.submittedCount ?? 0} / {registeredCount} Teams Answered
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                  style={{
                    width: `${
                      registeredCount > 0
                        ? ((quizProgress?.submittedCount ?? 0) / registeredCount) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : lastQuizResult ? (
          /* QUESTION RESULTS REVEAL (Main Projector View) */
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 border-2 border-emerald-500/50 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 w-fit">
                  <Award className="w-4 h-4 text-emerald-400" />
                  Quiz Results
                </span>
                <h2 className="text-2xl font-black text-white">
                  {lastQuizResult.questionText}
                </h2>
              </div>

              <div className="px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-center flex-shrink-0">
                <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                  Correct Answer
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  Option [{lastQuizResult.correctAnswer}]
                </div>
              </div>
            </div>

            {/* Team Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
              {lastQuizResult.submissions.map((sub) => (
                <div
                  key={sub.teamId}
                  className={`p-4 rounded-2xl border space-y-1.5 ${
                    sub.isCorrect
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : sub.selectedChoice === "NONE"
                      ? "bg-slate-950/60 border-slate-800 text-slate-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-white truncate">
                      {sub.teamName}
                    </span>
                    <span className="text-[10px] font-mono opacity-75">Slot {sub.slotNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Choice: [{sub.selectedChoice}]</span>
                    <span className="font-black">
                      {sub.isCorrect ? `+${sub.pointsAwarded} pts` : "+0 pts"}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold flex items-center gap-1">
                    {sub.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Correct!</span>
                      </>
                    ) : sub.selectedChoice === "NONE" ? (
                      <span>No Answer</span>
                    ) : (
                      <span>Incorrect</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Users className="w-4 h-4 text-indigo-400" />
              Registered Teams
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">
              {registeredCount}
              <span className="text-xs font-normal text-slate-500 ml-1.5">/ {maxTeams} Slots</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Shield className="w-4 h-4 text-emerald-400" />
              Connected Phones
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white">
              {activeClients.players}
              <span className="text-xs font-normal text-slate-500 ml-1.5">Active</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-amber-400" />
              Socket Latency
            </div>
            <div className="mt-2 text-3xl font-extrabold text-white font-mono">
              {latency !== null ? `${latency}ms` : "--"}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Server className="w-4 h-4 text-cyan-400" />
              Local Wi-Fi IP
            </div>
            <div className="mt-2 text-lg md:text-xl font-bold text-white font-mono truncate">
              {displayIp}
            </div>
          </div>
        </div>

        {/* Live Lobby Roster Grid & Standings */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base md:text-lg font-extrabold text-white">Live Battle Lobby & Standings</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode("roster")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    viewMode === "roster"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Lobby Slots ({registeredCount}/{maxTeams})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("leaderboard")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    viewMode === "leaderboard"
                      ? "bg-amber-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Standings {leaderboard?.hasTieForFirst ? "🔥 (Tie!)" : ""}
                </button>
              </div>
            </div>
          </div>

          {viewMode === "roster" ? (
            <LobbySlots teams={teams} maxTeams={maxTeams} isAdmin={false} />
          ) : leaderboard ? (
            <LeaderboardPodium leaderboard={leaderboard} />
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No quiz questions answered yet. Standings will be computed live once scores are awarded!
            </div>
          )}
        </div>

        {/* QR Code and Wi-Fi connection card */}
        <NetworkInfoCard serverIp={displayIp} port={displayPort} sessionId={session?.id} />



        {/* Foundation & Power-Up Architecture Verification */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Phase 4 Five-Power-Up & Engine Architecture Verification
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>5 Unique Shuffled Power-Ups in SQLite</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Server-Authoritative Choice Masking</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Back to Sender Loop Prevention</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Server-Enforced Riddle & Lockdown Gate</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 pt-6 text-center text-xs text-slate-500">
        Classroom Quiz Battle &bull; Built for Local-Network University Presentations &bull; No Internet Required
      </footer>
    </div>
  );
}
