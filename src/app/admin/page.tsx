"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  HelpCircle,
  Clock,
  Trophy,
  Play,
  StopCircle,
  Lock,
  Unlock,
  PlusCircle,
  Flag,
  Radio,
  Send,
  Flame,
  Activity,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import { getSocket } from "@/lib/socket-client";
import { soundEffects } from "@/lib/sound-effects";
import { ClincherModal } from "@/components/clincher-modal";
import type {
  BroadcastTestPayload,
  LobbyUpdatedPayload,
  ClincherRoundConfig,
  ActiveSpellEffect,
} from "@/types/socket";

interface ActivityLogItem {
  id: string;
  time: string;
  type: "team" | "quiz" | "answer" | "powerup" | "system" | "broadcast";
  message: string;
}

export default function AdminDashboardPage() {
  const {
    isConnected,
    latency,
    serverIp,
    currentSession,
    lobbyData,
    activeQuiz,
    quizProgress,
    lastQuizResult,
    questions,
    allPowerUps,
    leaderboard,
    isGameEnded,
    clincherState,
    createSession,
    toggleRegistration,
    activateSurpriseQuiz,
    endActiveQuiz,
    endGameAction,
    sendTestBroadcast,
    fetchQuestions,
    fetchLeaderboardAction,
    startClincherRoundAction,
    shufflePowerUpsAction,
    fetchAllPowerUpsAction,
  } = useSocket("admin", "AdminMainDashboard");

  // State
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [broadcastInput, setBroadcastInput] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isShufflingPowerUps, setIsShufflingPowerUps] = useState(false);
  const [powerUpToast, setPowerUpToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [isEndGameConfirmOpen, setIsEndGameConfirmOpen] = useState(false);
  const [isEndQuestionConfirmOpen, setIsEndQuestionConfirmOpen] = useState(false);
  const [isClincherModalOpen, setIsClincherModalOpen] = useState(false);

  // Countdown timer for active question
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    if (!activeQuiz) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [activeQuiz]);

  const timeLeft = activeQuiz && now > 0
    ? Math.max(0, Math.ceil((activeQuiz.deadline - now) / 1000))
    : activeQuiz?.timeLimit ?? null;

  const activeSessionId = lobbyData?.session.id || currentSession?.id;

  // Add activity log
  const addLog = useCallback((type: ActivityLogItem["type"], message: string) => {
    const item: ActivityLogItem = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      type,
      message,
    };
    setLogs((prev) => [item, ...prev.slice(0, 49)]);
  }, []);

  // Sync initial questions, powerups, & leaderboard whenever connected or session changes
  useEffect(() => {
    if (isConnected) {
      fetchQuestions(activeSessionId || undefined);
      if (activeSessionId) {
        fetchLeaderboardAction(activeSessionId);
        fetchAllPowerUpsAction(activeSessionId);
      }
    }
  }, [isConnected, activeSessionId, fetchQuestions, fetchLeaderboardAction, fetchAllPowerUpsAction]);

  // Socket event listeners for real-time activity feed
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      addLog("system", "Connected to local game server.");
    };

    const handleDisconnect = () => {
      addLog("system", "Disconnected from server. Reconnecting...");
    };

    const handleLobbyUpdate = (payload: LobbyUpdatedPayload) => {
      addLog(
        "team",
        `Lobby updated: ${payload.registeredCount}/${payload.maxTeams} teams registered (${payload.session.is_registration_open ? "Registration Open" : "Registration Closed"}).`
      );
    };

    const handleQuizStarted = () => {
      soundEffects.playQuizStart();
      addLog("quiz", "🚨 New quiz question launched to player devices!");
    };

    const handleQuizEnded = () => {
      soundEffects.playTimesUp();
      addLog("quiz", "Quiz question ended. Scores evaluated.");
    };

    const handlePowerUpActivated = (payload: { spell: ActiveSpellEffect; message: string }) => {
      soundEffects.playSpellCast();
      addLog("powerup", `✨ Spell Activated: ${payload.message}`);
    };

    const handleLeaderboardUpdate = () => {
      addLog("system", "Leaderboard scores and rankings updated.");
    };

    const handleBroadcast = (payload: BroadcastTestPayload) => {
      addLog("broadcast", `📢 [Broadcast]: "${payload.message}"`);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("lobby:updated", handleLobbyUpdate);
    socket.on("quiz:started", handleQuizStarted);
    socket.on("quiz:ended", handleQuizEnded);
    socket.on("powerup:activated", handlePowerUpActivated);
    socket.on("leaderboard:updated", handleLeaderboardUpdate);
    socket.on("server:broadcast_test", handleBroadcast);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("lobby:updated", handleLobbyUpdate);
      socket.off("quiz:started", handleQuizStarted);
      socket.off("quiz:ended", handleQuizEnded);
      socket.off("powerup:activated", handlePowerUpActivated);
      socket.off("leaderboard:updated", handleLeaderboardUpdate);
      socket.off("server:broadcast_test", handleBroadcast);
    };
  }, [addLog]);

  // Summary Metrics
  const registeredCount = lobbyData?.registeredCount ?? 0;
  const maxTeams = lobbyData?.maxTeams ?? 5;
  const totalQuestions = questions.length;
  const session = lobbyData?.session || currentSession;
  const isRegistrationOpen = session ? session.is_registration_open === 1 && session.status !== "registration_closed" : true;

  // Leading Team calculation
  const topTeam = leaderboard?.entries[0];
  const hasLeader = topTeam && topTeam.totalScore > 0;

  // Handlers
  const handleToggleRegistration = () => {
    if (!activeSessionId) return;
    toggleRegistration(activeSessionId, !isRegistrationOpen);
  };

  const handleCreateSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSession(newSessionTitle.trim() || undefined, () => {
      setIsNewSessionModalOpen(false);
      setNewSessionTitle("");
      addLog("system", "Created new game tournament session.");
    });
  };

  const handleActivateQuestion = () => {
    if (!activeSessionId) return;
    if (activeQuiz) return;
    setIsSubmittingAction(true);
    activateSurpriseQuiz(activeSessionId, selectedQuestionId || undefined, (res) => {
      setIsSubmittingAction(false);
      if (res && !res.success) {
        alert(res.error || "Failed to activate question.");
      }
    });
  };

  const handleAssignOrShufflePowerUps = () => {
    if (!activeSessionId) return;
    if (activeQuiz) {
      setPowerUpToast({ type: "error", message: "Cannot shuffle power-ups while a question is actively running." });
      setTimeout(() => setPowerUpToast(null), 4000);
      return;
    }
    if (registeredCount === 0) {
      setPowerUpToast({ type: "error", message: "No teams registered yet. Teams must register before power-ups can be assigned." });
      setTimeout(() => setPowerUpToast(null), 4000);
      return;
    }

    setIsShufflingPowerUps(true);
    shufflePowerUpsAction(activeSessionId, (res) => {
      setIsShufflingPowerUps(false);
      if (res && res.success) {
        soundEffects.playSpellCast();
        addLog("powerup", `✨ Power-ups assigned/shuffled across ${res.assignments?.length || registeredCount} registered teams!`);
        setPowerUpToast({ type: "success", message: `Power-ups successfully assigned & distributed to all ${res.assignments?.length || registeredCount} team phones!` });
      } else {
        setPowerUpToast({ type: "error", message: res?.error || "Failed to assign power-ups." });
      }
      setTimeout(() => setPowerUpToast(null), 4000);
    });
  };

  const handleEndCurrentQuestion = () => {
    if (!activeSessionId) return;
    endActiveQuiz(activeSessionId, () => {
      setIsEndQuestionConfirmOpen(false);
    });
  };

  const handleEndGame = () => {
    if (!activeSessionId) return;
    endGameAction(activeSessionId, () => {
      setIsEndGameConfirmOpen(false);
      soundEffects.playVictory();
      addLog("system", "Tournament concluded! Final rankings established.");
    });
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim()) return;
    sendTestBroadcast(broadcastInput.trim());
    setBroadcastInput("");
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full">
      {/* Top Banner: Active Question Countdown (if running) */}
      {activeQuiz && (
        <div className="rounded-3xl border-2 border-purple-500/80 bg-gradient-to-r from-purple-950/80 via-slate-900 to-purple-950/80 p-5 md:p-6 shadow-2xl shadow-purple-500/20 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-purple-400 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                  QUIZ ROUND IN PROGRESS
                </span>
                <span className="text-xs font-mono text-purple-400">
                  ({quizProgress?.submittedCount ?? 0} of {quizProgress?.totalTeams ?? registeredCount} submitted)
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white leading-snug">
                {activeQuiz.questionText}
              </h2>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center bg-slate-950/70 border border-purple-500/30 rounded-2xl px-4 py-2 min-w-[90px]">
                <div className="font-mono text-2xl font-black text-purple-300">
                  {timeLeft !== null ? `${timeLeft}s` : "--"}
                </div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Remaining
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEndQuestionConfirmOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition flex items-center gap-2"
              >
                <StopCircle className="h-4 w-4" />
                <span>End Question</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Activity className="h-4 w-4" />
            <span>Classroom Live Control</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Presenter Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            High-level live game overview, rapid action controls, and real-time activity stream.
          </p>
        </div>

        {/* Server IP Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-xs">
            <Radio className={`h-3.5 w-3.5 ${isConnected ? "text-emerald-400 animate-pulse" : "text-rose-400"}`} />
            <span className="font-mono text-slate-300 font-bold">
              {serverIp ? `http://${serverIp}:3000` : "Connecting..."}
            </span>
            {latency !== null && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                {latency}ms
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsNewSessionModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
          >
            <PlusCircle className="h-4 w-4 text-indigo-400" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Registered Teams */}
        <Link
          href="/admin/teams"
          className="group rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-lg hover:border-indigo-500/40 transition flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Registered Teams</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">
              {registeredCount} <span className="text-slate-500 text-lg font-bold">/ {maxTeams}</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${(registeredCount / maxTeams) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span>{isRegistrationOpen ? "Registration Open" : "Registration Closed"}</span>
            <span className="text-indigo-400 group-hover:translate-x-0.5 transition-transform">Manage →</span>
          </div>
        </Link>

        {/* Card 2: Total Questions */}
        <Link
          href="/admin/questions"
          className="group rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-lg hover:border-indigo-500/40 transition flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Question Bank</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white transition">
              <HelpCircle className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">{totalQuestions}</div>
            <p className="text-xs text-slate-400 mt-1">Multiple-Choice Prepared</p>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span>Ready for presentation</span>
            <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform">Edit →</span>
          </div>
        </Link>

        {/* Card 3: Question Status */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Question</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div>
            {activeQuiz ? (
              <>
                <div className="text-2xl font-black text-purple-300 truncate">Active ({timeLeft}s)</div>
                <p className="text-xs text-purple-400 truncate mt-1">{activeQuiz.questionText}</p>
              </>
            ) : lastQuizResult ? (
              <>
                <div className="text-2xl font-black text-emerald-400">Question Ended</div>
                <p className="text-xs text-slate-400 mt-1">Answer: Choice {lastQuizResult.correctAnswer}</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-slate-300">Idle</div>
                <p className="text-xs text-slate-500 mt-1">Ready to activate next question</p>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            {activeQuiz ? "Awaiting answers..." : "Standby between questions"}
          </div>
        </div>

        {/* Card 4: Current Leading Team */}
        <Link
          href="/admin/leaderboard"
          className="group rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-lg hover:border-amber-500/40 transition flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tournament Leader</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div>
            {hasLeader ? (
              <>
                <div className="text-2xl font-black text-amber-400 truncate">{topTeam.teamName}</div>
                <p className="text-xs font-mono font-bold text-emerald-400 mt-1">{topTeam.totalScore} Points</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-slate-400">Tied (0 pts)</div>
                <p className="text-xs text-slate-500 mt-1">Tournament just beginning</p>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span>{leaderboard?.hasTieForFirst ? "Tie Detected!" : "Score rankings live"}</span>
            <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform">Leaderboard →</span>
          </div>
        </Link>
      </div>

      {/* Prominent Game Controls Section */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 backdrop-blur shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="h-5 w-5 text-indigo-400 fill-indigo-400/20" />
              Live Game Controls
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute tournament transitions. Actions are state-validated to prevent invalid activations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">State:</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 font-mono text-xs font-bold text-indigo-300 border border-slate-700">
              {activeQuiz ? "QUIZ_ACTIVE" : isGameEnded ? "FINISHED" : clincherState ? "CLINCHER_ACTIVE" : session?.status || "LOBBY"}
            </span>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Action 1: Registration Control */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Team Registration</h3>
              <p className="text-xs text-slate-300">
                {isRegistrationOpen
                  ? "Registration is currently OPEN. Students can scan the QR code."
                  : "Registration is CLOSED. Only registered teams can participate."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleRegistration}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow ${
                isRegistrationOpen
                  ? "bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
              }`}
            >
              {isRegistrationOpen ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Close Registration</span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" />
                  <span>Open Registration</span>
                </>
              )}
            </button>
          </div>

          {/* Action 2: Power-Up Spells Assignment & Shuffle */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Power-Up Spells</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  {allPowerUps.length} / {registeredCount} Assigned
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {allPowerUps.length === 0
                  ? "Assign unique mystery spells to participating team smartphones."
                  : `Unique spells active on ${allPowerUps.length} team phone(s). Can re-shuffle anytime.`}
              </p>
            </div>

            <div className="space-y-2">
              {allPowerUps.length > 0 && (
                <div className="text-[11px] bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 space-y-1 max-h-24 overflow-y-auto">
                  {allPowerUps.map((p) => (
                    <div key={p.teamId} className="flex items-center justify-between text-slate-300">
                      <span className="font-semibold truncate max-w-[90px]">{p.teamName}:</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${p.isUsed ? "text-slate-500 line-through bg-slate-800" : "text-amber-300 bg-amber-500/10 border border-amber-500/20"}`}>
                        {p.powerUpName} {p.isUsed ? "(Used)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {powerUpToast && (
                <div className={`text-[11px] p-2 rounded-lg font-medium animate-in fade-in ${powerUpToast.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  {powerUpToast.message}
                </div>
              )}

              <button
                type="button"
                onClick={handleAssignOrShufflePowerUps}
                disabled={isShufflingPowerUps || !!activeQuiz || registeredCount === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={
                  activeQuiz
                    ? "Cannot shuffle power-ups while question is running"
                    : registeredCount === 0
                    ? "No teams registered yet"
                    : "Assign or shuffle power-ups for registered teams"
                }
              >
                <Sparkles className={`h-4 w-4 ${isShufflingPowerUps ? "animate-spin" : ""}`} />
                <span>
                  {isShufflingPowerUps
                    ? "Shuffling..."
                    : allPowerUps.length === 0
                    ? `Assign Spells (${registeredCount} Teams)`
                    : `Shuffle Spells (${registeredCount} Teams)`}
                </span>
              </button>
            </div>
          </div>

          {/* Action 3: Activate Next Question */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Launch Quiz Question</h3>
                {totalQuestions === 0 && (
                  <button
                    type="button"
                    onClick={() => fetchQuestions(activeSessionId || undefined)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                    title="Reload questions from question bank"
                  >
                    <RefreshCw className="h-3 w-3" /> Reload Bank
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Push a question and synchronized countdown timer to all student phones.
              </p>
            </div>

            <div className="space-y-2">
              {questions.length > 0 && (
                <select
                  value={selectedQuestionId}
                  onChange={(e) => setSelectedQuestionId(e.target.value)}
                  disabled={!!activeQuiz}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Next in Sequence (Automatic)</option>
                  {questions.map((q, idx) => (
                    <option key={q.id} value={q.id}>
                      #{idx + 1}: {q.questionText.slice(0, 32)}...
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleActivateQuestion}
                disabled={!!activeQuiz || totalQuestions === 0 || isSubmittingAction}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:from-indigo-600 disabled:hover:to-violet-600 cursor-pointer disabled:cursor-not-allowed"
                title={
                  activeQuiz
                    ? "A question is already active"
                    : totalQuestions === 0
                    ? "No questions prepared in Question Bank"
                    : "Activate Question"
                }
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{activeQuiz ? "Question in Progress" : "Activate Question"}</span>
              </button>
            </div>
          </div>

          {/* Action 4: End Tournament / Clincher */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tournament Conclusion</h3>
              <p className="text-xs text-slate-300">
                {leaderboard?.hasTieForFirst
                  ? "Tie for 1st place! Clincher round required to crown champion."
                  : "Conclude game, freeze scores, and display victory podium."}
              </p>
            </div>

            {leaderboard?.hasTieForFirst ? (
              <button
                type="button"
                onClick={() => setIsClincherModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 animate-pulse"
              >
                <Flame className="h-4 w-4 fill-current" />
                <span>Launch Clincher Tie-Breaker</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEndGameConfirmOpen(true)}
                disabled={isGameEnded || registeredCount === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Flag className="h-4 w-4 text-amber-400" />
                <span>{isGameEnded ? "Game Concluded" : "End Game & Crown Winner"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Live Activity Feed Left, Quick Broadcast Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Live Activity Feed */}
        <div className="lg:col-span-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Live Activity Stream</h3>
            </div>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 font-medium transition"
            >
              Clear Feed
            </button>
          </div>

          <div className="h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40">
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500 italic">
                Awaiting game events (registrations, quiz launches, answer submissions, spells)...
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="pt-2 first:pt-0 flex items-start gap-2.5 text-xs">
                  <span className="font-mono text-[10px] text-slate-500 shrink-0 pt-0.5">{log.time}</span>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                      log.type === "quiz"
                        ? "bg-purple-400 animate-pulse"
                        : log.type === "powerup"
                        ? "bg-amber-400"
                        : log.type === "team"
                        ? "bg-emerald-400"
                        : log.type === "broadcast"
                        ? "bg-blue-400"
                        : "bg-slate-500"
                    }`}
                  />
                  <span className="text-slate-300 leading-relaxed">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Broadcast Announcement */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="h-4 w-4 text-indigo-400" />
              Send Live Announcement
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Displays a real-time banner across all student mobile portals.
            </p>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3">
            <textarea
              rows={3}
              value={broadcastInput}
              onChange={(e) => setBroadcastInput(e.target.value)}
              placeholder="e.g. Please quiet down! Surprise quiz starting in 1 minute."
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!broadcastInput.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Broadcast to Phones</span>
            </button>
          </form>
        </div>
      </div>

      {/* New Session Modal */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Create New Tournament Session</h3>
              <button
                type="button"
                onClick={() => setIsNewSessionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              This starts a new session with empty lobby slots, ready for a new presentation.
            </p>

            <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Session Title (Optional)
                </label>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="e.g. Period 3 CS Presentation"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 text-xs font-semibold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Question Confirmation Modal */}
      {isEndQuestionConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-red-500/40 bg-slate-950 p-6 shadow-2xl text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mx-auto">
              <StopCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">End Active Question Early?</h3>
              <p className="text-xs text-slate-400">
                This will immediately close answer submissions and calculate points for answers submitted so far.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEndQuestionConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                Keep Running
              </button>
              <button
                type="button"
                onClick={handleEndCurrentQuestion}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow"
              >
                Yes, End Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Game Confirmation Modal */}
      {isEndGameConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-slate-950 p-6 shadow-2xl text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mx-auto">
              <Flag className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Conclude Tournament & Crown Winner?</h3>
              <p className="text-xs text-slate-400">
                This locks all scores and displays the final presentation victory screen to all players.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEndGameConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndGame}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20"
              >
                Conclude Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clincher Modal */}
      {isClincherModalOpen && leaderboard && (
        <ClincherModal
          isOpen={isClincherModalOpen}
          onClose={() => setIsClincherModalOpen(false)}
          leaderboard={leaderboard}
          questions={questions}
          onStart={(config: ClincherRoundConfig) => {
            if (!activeSessionId) return;
            startClincherRoundAction(activeSessionId, config, () => {
              setIsClincherModalOpen(false);
            });
          }}
        />
      )}
    </div>
  );
}
