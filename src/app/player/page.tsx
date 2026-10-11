"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  Radio,
  Zap,
  Bell,
  ArrowLeft,
  Users,
  RefreshCw,
  AlertCircle,
  Crown,
  Lock,
  Sparkles,
  LogOut,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  EyeOff,
  HelpCircle,
  Trophy,
  Flame,
} from "lucide-react";
import { LeaderboardPodium } from "@/components/leaderboard-podium";
import { useSocket } from "@/hooks/use-socket";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { soundEffects } from "@/lib/sound-effects";
import type { TeamLobbyInfo } from "@/lib/db";
import type { QuizChoice, PowerUpType } from "@/types/socket";

interface SavedTeamAuth {
  teamId: string;
  token: string;
  sessionId: string;
  name: string;
  leaderName: string;
  slotNumber: number;
  color: string;
}

const OPTION_COLORS: Record<QuizChoice, { border: string; bg: string; text: string; hover: string }> = {
  A: {
    border: "border-indigo-500/60",
    bg: "bg-indigo-950/40",
    text: "text-indigo-300",
    hover: "hover:bg-indigo-900/60 hover:border-indigo-400 active:scale-98",
  },
  B: {
    border: "border-emerald-500/60",
    bg: "bg-emerald-950/40",
    text: "text-emerald-300",
    hover: "hover:bg-emerald-900/60 hover:border-emerald-400 active:scale-98",
  },
  C: {
    border: "border-amber-500/60",
    bg: "bg-amber-950/40",
    text: "text-amber-300",
    hover: "hover:bg-amber-900/60 hover:border-amber-400 active:scale-98",
  },
  D: {
    border: "border-cyan-500/60",
    bg: "bg-cyan-950/40",
    text: "text-cyan-300",
    hover: "hover:bg-cyan-900/60 hover:border-cyan-400 active:scale-98",
  },
};

function PlayerContent() {
  const mounted = useIsMounted();
  const searchParams = useSearchParams();
  const querySessionId = searchParams.get("session");

  // Form State
  const [teamNameInput, setTeamNameInput] = useState("");
  const [leaderNameInput, setLeaderNameInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registered Team State
  const [registeredTeam, setRegisteredTeam] = useState<TeamLobbyInfo | null>(null);
  const [authToken, setAuthToken] = useState<string>("");
  const reconnectCheckedRef = useRef(false);
  const [buzzerTriggered, setBuzzerTriggered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Power-Up Local States
  const [riddleInput, setRiddleInput] = useState("");
  const [riddleError, setRiddleError] = useState<string | null>(null);
  const [isActivatingPowerUp, setIsActivatingPowerUp] = useState(false);
  const [powerUpMessage, setPowerUpMessage] = useState<string | null>(null);
  const [shuffleAlert, setShuffleAlert] = useState<string | null>(null);
  const prevPowerUpTypeRef = useRef<PowerUpType | null>(null);

  const {
    isConnected,
    socketId,
    latency,
    serverIp,
    transport,
    error: socketError,
    currentSession,
    lobbyData,
    lastBroadcast,
    activeQuiz,
    quizSubmission,
    lastQuizResult,
    myPowerUp,
    teamPowerUpStatus,
    revealedAnswer,
    spellNotification,
    leaderboard,
    isGameEnded,
    clincherState,
    lastClincherResult,
    clincherSubmission,
    submitClincherAnswerAction,
    fetchLeaderboardAction,
    sendPing,
    registerRole,
    registerTeamAction,
    reconnectTeamAction,
    sendBuzzerTest,
    submitQuizAnswer,
    manualReconnect,
    activatePowerUpAction,
    solveRiddleAction,
    fetchMyPowerUpAction,
  } = useSocket("player", registeredTeam?.name, registeredTeam?.sessionId, registeredTeam?.id);


  const activeSession = lobbyData?.session || currentSession;
  const targetSessionId = querySessionId || activeSession?.id;
  const registeredCount = lobbyData?.registeredCount || 0;
  const maxTeams = lobbyData?.maxTeams || 5;
  const isRegistrationOpen = activeSession
    ? activeSession.is_registration_open === 1 && activeSession.status !== "registration_closed"
    : true;
  const isLobbyFull = registeredCount >= maxTeams;

  // Deriving updated team info from lobby broadcast
  const displayTeam =
    (registeredTeam && lobbyData?.teams.find((t) => t.id === registeredTeam.id)) || registeredTeam;

  // Synchronized Quiz Countdown ticker
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    if (!activeQuiz) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [activeQuiz]);

  const timeLeft = activeQuiz && now > 0 ? Math.max(0, Math.ceil((activeQuiz.deadline - now) / 1000)) : activeQuiz?.timeLimit ?? null;

  // Clincher Countdown ticker
  const [clincherNow, setClincherNow] = useState<number>(0);

  useEffect(() => {
    if (!clincherState) return;
    const interval = setInterval(() => setClincherNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [clincherState]);

  const clincherTimeLeft =
    clincherState && clincherNow > 0
      ? Math.max(0, Math.ceil((clincherState.deadline - clincherNow) / 1000))
      : clincherState?.timeLimit ?? null;

  useEffect(() => {
    if (targetSessionId) {
      fetchLeaderboardAction(targetSessionId);
    }
  }, [targetSessionId, fetchLeaderboardAction]);

  const handleSubmitClincher = (choice: QuizChoice) => {
    if (!clincherState || !displayTeam || !authToken) return;
    setSubmitError(null);
    submitClincherAnswerAction(
      targetSessionId || "",
      displayTeam.id,
      authToken,
      clincherState.question.id,
      choice,
      (res) => {
        if (!res.success) {
          setSubmitError(res.error || "Failed to submit clincher answer.");
        }
      }
    );
  };

  // Auto-reconnect existing team identity from localStorage when connected and session is known
  useEffect(() => {
    if (!mounted || !isConnected || reconnectCheckedRef.current || !targetSessionId) return;

    try {
      const storageKey = `quiz_team_auth_${targetSessionId}`;
      const savedAuthStr = localStorage.getItem(storageKey);

      if (savedAuthStr) {
        const savedAuth: SavedTeamAuth = JSON.parse(savedAuthStr);
        if (savedAuth.teamId && savedAuth.token && savedAuth.sessionId === targetSessionId) {
          reconnectCheckedRef.current = true;
          reconnectTeamAction(targetSessionId, savedAuth.teamId, savedAuth.token, (res) => {
            if (res.success && res.team) {
              setRegisteredTeam(res.team);
              setAuthToken(savedAuth.token);
              registerRole("player", res.team.name, res.team.id, targetSessionId);
            } else if (res.error && res.error !== "Not connected to server") {
              // Token invalid or expired in database
              localStorage.removeItem(storageKey);
              setAuthToken("");
            } else {
              // Socket connection dropped before finishing; allow retry
              reconnectCheckedRef.current = false;
            }
          });
        }
      }
    } catch (e) {
      console.error("Failed to parse saved team auth:", e);
    }
  }, [mounted, isConnected, targetSessionId, reconnectTeamAction, registerRole]);

  // Fetch team's power-up assignment
  useEffect(() => {
    if (registeredTeam?.sessionId && registeredTeam?.id && authToken) {
      fetchMyPowerUpAction(registeredTeam.sessionId, registeredTeam.id, authToken);
    }
  }, [registeredTeam?.sessionId, registeredTeam?.id, authToken, fetchMyPowerUpAction]);

  // Listen for changes in assigned power-up (e.g. from shuffling)
  useEffect(() => {
    if (myPowerUp) {
      if (prevPowerUpTypeRef.current && prevPowerUpTypeRef.current !== myPowerUp.powerUpType) {
        soundEffects.playSpellCast();
        setShuffleAlert(`✨ Power-up shuffled! Your new spell: ${myPowerUp.powerUpName}`);
        const timer = setTimeout(() => setShuffleAlert(null), 5000);
        return () => clearTimeout(timer);
      }
      prevPowerUpTypeRef.current = myPowerUp.powerUpType;
    }
  }, [myPowerUp]);

  // Handle new team registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTeam = teamNameInput.trim();
    const trimmedLeader = leaderNameInput.trim();

    if (!trimmedTeam || trimmedTeam.length < 2 || trimmedTeam.length > 30) {
      setFormError("Team name must be between 2 and 30 characters.");
      return;
    }

    if (!trimmedLeader || trimmedLeader.length < 2 || trimmedLeader.length > 30) {
      setFormError("Leader name must be between 2 and 30 characters.");
      return;
    }

    if (!targetSessionId) {
      setFormError("No active game session found. Please wait for presenter to start.");
      return;
    }

    setIsSubmitting(true);

    registerTeamAction(targetSessionId, trimmedTeam, trimmedLeader, (res) => {
      setIsSubmitting(false);
      if (res.success && res.team && res.token) {
        setRegisteredTeam(res.team);
        setAuthToken(res.token);
        registerRole("player", res.team.name, res.team.id, targetSessionId);

        const authData: SavedTeamAuth = {
          teamId: res.team.id,
          token: res.token,
          sessionId: targetSessionId,
          name: res.team.name,
          leaderName: res.team.leaderName,
          slotNumber: res.team.slotNumber,
          color: res.team.color,
        };
        try {
          localStorage.setItem(`quiz_team_auth_${targetSessionId}`, JSON.stringify(authData));
        } catch (e) {
          console.error("Failed to save auth to localStorage:", e);
        }
      } else {
        setFormError(res.error || "Failed to register team. Please try again.");
      }
    });
  };

  // Activate Power-Up
  const handleActivatePowerUp = () => {
    if (!registeredTeam || !authToken || !activeQuiz || isActivatingPowerUp) return;
    setIsActivatingPowerUp(true);
    setPowerUpMessage(null);
    activatePowerUpAction(
      registeredTeam.sessionId,
      registeredTeam.id,
      authToken,
      activeQuiz.id,
      (res) => {
        setIsActivatingPowerUp(false);
        if (res.success) {
          setPowerUpMessage("⚡ Power-up unleashed successfully!");
          setTimeout(() => setPowerUpMessage(null), 5000);
        } else {
          setPowerUpMessage(res.error || "Failed to activate power-up.");
          setTimeout(() => setPowerUpMessage(null), 5000);
        }
      }
    );
  };

  // Solve Riddle
  const handleSolveRiddle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeredTeam || !authToken || !activeQuiz || !teamPowerUpStatus?.activeRiddle) return;
    if (!riddleInput.trim()) return;

    setRiddleError(null);
    solveRiddleAction(
      registeredTeam.sessionId,
      registeredTeam.id,
      authToken,
      activeQuiz.id,
      teamPowerUpStatus.activeRiddle.id,
      riddleInput.trim(),
      (res) => {
        if (!res.success) {
          setRiddleError(res.error || "Incorrect riddle answer. Try again!");
        } else {
          setRiddleInput("");
        }
      }
    );
  };

  // Submit Answer Action
  const handleSubmitChoice = (choice: QuizChoice) => {
    if (!registeredTeam || !authToken || !activeQuiz || !targetSessionId) return;
    if (quizSubmission.hasSubmitted) return;

    if (teamPowerUpStatus?.isLockedDown) {
      setSubmitError("Your team is locked down by a Lockdown Spell for this question!");
      return;
    }

    if (teamPowerUpStatus?.isRiddleActive && !teamPowerUpStatus.isRiddleSolved) {
      setSubmitError("You must solve the active riddle before submitting your answer!");
      return;
    }

    setSubmitError(null);
    submitQuizAnswer(
      targetSessionId,
      registeredTeam.id,
      authToken,
      activeQuiz.id,
      choice,
      (res) => {
        if (!res.success) {
          setSubmitError(res.error || "Submission failed. Please try again.");
        }
      }
    );
  };


  // Switch or Leave Team
  const handleLeaveTeam = () => {
    if (confirm("Leave this team? You can register again if slots remain open.")) {
      if (targetSessionId) {
        localStorage.removeItem(`quiz_team_auth_${targetSessionId}`);
      }
      setRegisteredTeam(null);
      setAuthToken("");
    }
  };

  // Test Buzzer
  const handleTestBuzzer = () => {
    sendPing();
    sendBuzzerTest(registeredTeam ? registeredTeam.name : "Team Player");
    setBuzzerTriggered(true);
    setTimeout(() => {
      setBuzzerTriggered(false);
    }, 1000);
  };

  // Check personal submission result for concluded question
  const myResult =
    registeredTeam && lastQuizResult
      ? lastQuizResult.submissions.find((s) => s.teamId === registeredTeam.id)
      : null;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Mobile Top Bar */}
      <header className="space-y-3 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !mounted
                  ? "bg-slate-500"
                  : isConnected
                  ? "bg-emerald-400 animate-pulse"
                  : socketError
                  ? "bg-rose-500"
                  : "bg-amber-400 animate-ping"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {!mounted
                ? "Connecting..."
                : isConnected
                ? "Live Connected"
                : socketError
                ? "Connection Error"
                : "Connecting..."}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span
              className={
                latency === null
                  ? "text-slate-400"
                  : latency < 40
                  ? "text-emerald-400"
                  : "text-amber-400"
              }
            >
              {mounted && latency !== null ? `${latency}ms` : "--"}
            </span>
          </div>
        </div>

        {/* Server & Client ID Badge */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
          <span>Server: {mounted && serverIp ? serverIp : "192.168.1.6"}</span>
          <span className="flex items-center gap-1.5">
            {mounted && transport && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-semibold">
                {transport}
              </span>
            )}
            <span>{mounted && socketId ? socketId.slice(0, 6) : "..."}</span>
          </span>
        </div>

        {/* Socket Error Banner */}
        {mounted && (!isConnected || socketError) && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
              <span className="truncate">
                {socketError ? `Error: ${socketError}` : "Connecting to host server..."}
              </span>
            </div>
            <button
              onClick={manualReconnect}
              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] flex items-center gap-1 flex-shrink-0 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Interaction Area */}
      <main className="my-auto py-4 space-y-4">
        {/* VIEW 1: REGISTERED PLAYER INTERACTION */}
        {registeredTeam ? (
          <div className="space-y-4">
            {/* Team Identity Banner */}
            {displayTeam && (
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-lg ${displayTeam.color}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{displayTeam.name}</h2>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-950/40 text-slate-200">
                      Slot {displayTeam.slotNumber}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span>Leader: {displayTeam.leaderName}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Total Score</div>
                  <div className="text-lg font-black font-mono text-amber-400">
                    {displayTeam.score} pts
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 0: GAME ENDED & FINAL STANDINGS */}
            {isGameEnded && leaderboard ? (
              <div className="p-6 rounded-3xl bg-slate-900 border-2 border-yellow-500/50 space-y-5 shadow-2xl animate-in zoom-in-95">
                {(() => {
                  const myEntry = displayTeam
                    ? leaderboard.entries.find((e) => e.teamId === displayTeam.id)
                    : null;
                  const isWinner =
                    myEntry &&
                    myEntry.rank === 1 &&
                    (!leaderboard.hasTieForFirst || myEntry.isClincherWinner);

                  return (
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center mx-auto text-yellow-400">
                        <Trophy className="w-8 h-8 animate-bounce" />
                      </div>
                      <h2 className="text-2xl font-black text-white">
                        {isWinner ? "🎉 PRESENTATION CHAMPION! 🎉" : "Presentation Game Concluded"}
                      </h2>
                      <p className="text-xs text-slate-300">
                        {isWinner
                          ? `Incredible! Your team "${displayTeam?.name}" took 1st Place with ${myEntry?.totalScore} points!`
                          : `Your team finished Rank #${myEntry?.rank ?? "--"} with ${displayTeam?.score} points.`}
                      </p>
                    </div>
                  );
                })()}

                <LeaderboardPodium leaderboard={leaderboard} />
              </div>
            ) : clincherState ? (
              /* SUB-VIEW CLINCHER: SUDDEN-DEATH TIE-BREAKER */
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-rose-950/40 border-2 border-rose-500 shadow-2xl space-y-4 animate-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-rose-900/50">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider animate-pulse">
                    <Flame className="w-3.5 h-3.5 fill-white" />
                    Clincher &bull; Round {clincherState.roundNumber}
                  </span>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-rose-500 font-mono text-rose-400 font-black text-sm">
                    <Clock className="w-4 h-4 text-rose-500 animate-spin" />
                    <span>{clincherTimeLeft ?? clincherState.timeLimit}s</span>
                  </div>
                </div>

                {displayTeam && clincherState.contendingTeamIds.includes(displayTeam.id) ? (
                  /* Contending Team answering view */
                  <>
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono text-rose-300 uppercase font-black">
                        ⚡ Sudden-Death Tie-Breaker Question
                      </div>
                      <h3 className="text-base font-extrabold text-white leading-snug">
                        {clincherState.question.questionText}
                      </h3>
                    </div>

                    {submitError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    {clincherSubmission.hasSubmitted ? (
                      <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-center space-y-2 animate-in fade-in">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                        <div className="text-sm font-bold text-emerald-300">Clincher Answer Locked!</div>
                        <div className="text-xs text-slate-300">
                          Option <span className="font-black text-white font-mono">[{clincherSubmission.selectedChoice}]</span> recorded.
                        </div>
                        <p className="text-[11px] text-slate-400 pt-1">
                          Waiting for other contending teams or timer conclusion...
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5 pt-1">
                        {(["A", "B", "C", "D"] as QuizChoice[]).map((choice) => {
                          const theme = OPTION_COLORS[choice];
                          return (
                            <button
                              key={choice}
                              type="button"
                              onClick={() => handleSubmitClincher(choice)}
                              disabled={!isConnected || clincherSubmission.hasSubmitted}
                              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${theme.border} ${theme.bg} ${theme.hover}`}
                            >
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shrink-0 bg-slate-900 border ${theme.border} ${theme.text}`}
                              >
                                {choice}
                              </span>
                              <span className="text-sm font-bold text-white pt-0.5">
                                {clincherState.question.options[choice]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  /* Non-contending spectator view */
                  <div className="py-4 text-center space-y-2">
                    <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Sudden-Death Tie-Breaker in Progress</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Teams tied for 1st Place are answering this tie-breaker question. Your team is spectating.
                    </p>
                  </div>
                )}
              </div>
            ) : lastClincherResult && !activeQuiz ? (
              /* SUB-VIEW CLINCHER RESULT */
              <div
                className={`p-5 rounded-2xl border space-y-3 shadow-xl animate-in zoom-in-95 ${
                  lastClincherResult.status === "won"
                    ? "bg-gradient-to-b from-yellow-950/40 to-slate-950 border-yellow-500/50"
                    : "bg-gradient-to-b from-rose-950/40 to-slate-950 border-rose-500/50"
                }`}
              >
                <div className="text-center space-y-1">
                  <div className="inline-flex p-2.5 rounded-2xl bg-slate-950/60 mx-auto">
                    {lastClincherResult.status === "won" ? (
                      <Trophy className="w-7 h-7 text-yellow-400" />
                    ) : (
                      <Flame className="w-7 h-7 text-rose-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {lastClincherResult.status === "won"
                      ? `🏆 Clincher Champion: ${lastClincherResult.winnerTeamName}!`
                      : `Round ${lastClincherResult.roundNumber} Ended in a Tie!`}
                  </h3>
                  <p className="text-xs text-slate-300">{lastClincherResult.message}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Correct Answer:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                    Option [{lastClincherResult.correctAnswer}]
                  </span>
                </div>
              </div>
            ) : activeQuiz ? (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 shadow-2xl space-y-4 animate-in zoom-in-95">
                {/* Active Notification Banner */}
                {spellNotification && (
                  <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs font-semibold flex items-center gap-2 shadow-lg animate-in slide-in-from-top">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{spellNotification}</span>
                  </div>
                )}

                {/* Back to Sender Active Shield Indicator */}
                {teamPowerUpStatus?.hasBackToSenderShield && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>🛡️ Reflection Shield Active: Opposing spells will be reflected back to caster!</span>
                  </div>
                )}

                {/* Quiz Header & Synchronized Timer */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider animate-pulse">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Surprise Quiz
                  </span>

                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/40 font-mono text-amber-400 font-black text-sm">
                    <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                    <span>{timeLeft ?? activeQuiz.timeLimit}s Left</span>
                  </div>
                </div>

                {/* Question Text */}
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Question {activeQuiz.questionNumber} of {activeQuiz.totalQuestions}</span>
                    <span className="text-amber-400 font-bold">+{activeQuiz.points} Points</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white leading-snug">
                    {activeQuiz.questionText}
                  </h3>
                </div>

                {/* Submission Error Banner */}
                {submitError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* RIDDLE GATE OVERLAY (If affected by Riddle Spell and not yet solved) */}
                {teamPowerUpStatus?.isRiddleActive && !teamPowerUpStatus.isRiddleSolved ? (
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                      <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
                      <span>🧙 Riddle Gatekeeper Spell Active!</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      All opposing teams must solve this riddle before unlocking the question:
                    </p>
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-amber-500/30 text-xs font-medium text-amber-200 italic">
                      &ldquo;{teamPowerUpStatus.activeRiddle?.questionText}&rdquo;
                    </div>
                    {teamPowerUpStatus.activeRiddle?.hint && (
                      <p className="text-[11px] text-slate-400">💡 Hint: {teamPowerUpStatus.activeRiddle.hint}</p>
                    )}
                    <form onSubmit={handleSolveRiddle} className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={riddleInput}
                        onChange={(e) => setRiddleInput(e.target.value)}
                        placeholder="Type riddle answer..."
                        id="player-riddle-input"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      {riddleError && (
                        <div className="text-[11px] text-rose-400 font-semibold">{riddleError}</div>
                      )}
                      <button
                        type="submit"
                        id="player-submit-riddle-btn"
                        className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow"
                      >
                        Solve Riddle &amp; Unlock Question
                      </button>
                    </form>
                  </div>
                ) : (
                  <>
                    {/* Lockdown Notice */}
                    {teamPowerUpStatus?.isLockedDown && (
                      <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2">
                        <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{teamPowerUpStatus.lockedDownReason || "🔒 Lockdown Spell Active: Your team is locked down for this question!"}</span>
                      </div>
                    )}

                    {/* Invisibility Notice */}
                    {(teamPowerUpStatus?.isInvisibilityActive || activeQuiz.options.A === "") && (
                      <div className="p-2.5 rounded-xl bg-sky-950/70 border border-sky-500/50 text-sky-200 text-xs font-semibold flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>👁️ Invisibility Spell Active: Answer text is hidden! Select A, B, C, or D blindly.</span>
                      </div>
                    )}

                    {/* Four Answer Choices Buttons */}
                    <div className="grid grid-cols-1 gap-2.5 pt-1">
                      {(["A", "B", "C", "D"] as QuizChoice[]).map((choice) => {
                        const isSelected = quizSubmission.selectedChoice === choice;
                        const isLocked = quizSubmission.hasSubmitted;
                        const isRevealed = revealedAnswer === choice;
                        const optColor = OPTION_COLORS[choice];
                        const isDisabled = isLocked || (timeLeft !== null && timeLeft <= 0) || teamPowerUpStatus?.isLockedDown;

                        return (
                          <button
                            key={choice}
                            onClick={() => handleSubmitChoice(choice)}
                            disabled={isDisabled}
                            className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all duration-150 relative ${
                              isRevealed
                                ? "bg-purple-950/60 border-purple-400 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400"
                                : isSelected
                                ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400 scale-[1.01]"
                                : isDisabled
                                ? "bg-slate-950/40 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
                                : `${optColor.bg} ${optColor.border} text-slate-100 ${optColor.hover}`
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                isSelected
                                  ? "bg-white text-indigo-700"
                                  : isRevealed
                                  ? "bg-purple-500 text-white"
                                  : "bg-slate-900 border border-slate-700 text-slate-300"
                              }`}
                            >
                              {choice}
                            </span>
                            <span className="text-xs md:text-sm font-semibold pt-0.5 leading-snug">
                              {activeQuiz.options[choice] ? activeQuiz.options[choice] : `Option ${choice} (Text Hidden)`}
                            </span>

                            {isRevealed && (
                              <span className="ml-auto px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/60 text-purple-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                <Sparkles className="w-3 h-3 text-purple-300" />
                                Revealed Answer
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Submission Status Confirmation */}
                    {quizSubmission.hasSubmitted ? (
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-black text-sm">
                          <Lock className="w-4 h-4" />
                          <span>Choice [{quizSubmission.selectedChoice}] Locked In!</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Answer recorded on server. Results will reveal when the question timer expires.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center text-[11px] text-slate-400 pt-1">
                        {teamPowerUpStatus?.isLockedDown
                          ? "Submission is blocked due to active Lockdown Spell."
                          : "Tap your team's answer choice. Only one submission is permitted."}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : myResult ? (

              /* SUB-VIEW B: PREVIOUS QUESTION RESULTS */
              <div
                className={`p-5 rounded-2xl border space-y-4 shadow-xl animate-in zoom-in-95 ${
                  myResult.isCorrect
                    ? "bg-gradient-to-b from-emerald-950/40 to-slate-900 border-emerald-500/50"
                    : myResult.selectedChoice === "NONE"
                    ? "bg-gradient-to-b from-slate-900 to-slate-950 border-slate-700"
                    : "bg-gradient-to-b from-rose-950/40 to-slate-900 border-rose-500/50"
                }`}
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 rounded-2xl bg-slate-950/60 mx-auto">
                    {myResult.isCorrect ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    ) : myResult.selectedChoice === "NONE" ? (
                      <Clock className="w-8 h-8 text-slate-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-rose-400" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white">
                      {myResult.isCorrect
                        ? `🎉 CORRECT! +${myResult.pointsAwarded} PTS`
                        : myResult.selectedChoice === "NONE"
                        ? "⏱️ TIME EXPIRED (+0 PTS)"
                        : "❌ INCORRECT (+0 PTS)"}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      {myResult.selectedChoice === "NONE"
                        ? "No submission received before the question deadline."
                        : `Your team selected [${myResult.selectedChoice}].`}
                    </p>
                  </div>
                </div>

                {/* Correct Answer Box */}
                {lastQuizResult && (
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Correct Answer:</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                        Option [{lastQuizResult.correctAnswer}]
                      </span>
                    </div>
                    <div className="text-slate-300 font-medium">
                      {lastQuizResult.options[lastQuizResult.correctAnswer]}
                    </div>
                  </div>
                )}

                <div className="text-center text-xs text-slate-400 pt-1">
                  Standby! The presenter may activate the next surprise quiz at any moment.
                </div>
              </div>
            ) : (
              /* SUB-VIEW C: STANDBY WAITING ROOM */
              <div className="space-y-4">
                {/* Battle Lobby Status Panel */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-400" />
                      Battle Lobby Roster
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {registeredCount} / {maxTeams} Teams
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${(registeredCount / maxTeams) * 100}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>Session: {targetSessionId}</span>
                    <span>
                      {isRegistrationOpen ? "Registration Open" : "Registration Locked"}
                    </span>
                  </div>
                </div>

                {/* Real-time Buzzer Readiness Test */}
                <button
                  onClick={handleTestBuzzer}
                  disabled={!isConnected}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-base shadow-xl transition-all duration-150 flex items-center justify-center gap-2 ${
                    buzzerTriggered
                      ? "bg-amber-500 text-slate-950 scale-95"
                      : isConnected
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 active:scale-95 shadow-emerald-500/20"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Zap className={`w-5 h-5 ${buzzerTriggered ? "animate-bounce" : ""}`} />
                  <span>
                    {buzzerTriggered
                      ? "BUZZER SIGNAL TRANSMITTED!"
                      : "TEST TEAM BUZZER"}
                  </span>
                </button>

                {/* Presenter Announcements Broadcast Receiver */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-indigo-400" />
                      Presenter Announcements
                    </span>
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 min-h-[50px] flex items-center">
                    {lastBroadcast ? (
                      <div className="space-y-0.5 text-left w-full">
                        <div className="text-xs text-indigo-300 font-medium">
                          &ldquo;{lastBroadcast.message}&rdquo;
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Received from {lastBroadcast.from} &bull;{" "}
                          {new Date(lastBroadcast.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">
                        Waiting for presenter to activate the quiz...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Shuffle Alert Banner */}
            {shuffleAlert && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2.5 shadow-lg shadow-amber-500/10 animate-in zoom-in-95">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
                <span>{shuffleAlert}</span>
              </div>
            )}

            {/* PLAYER'S UNIQUE ASSIGNED POWER-UP CARD */}
            {myPowerUp ? (
              <div
                className={`p-4 rounded-2xl border transition-all animate-in fade-in ${
                  myPowerUp.isUsed
                    ? "bg-slate-950/50 border-slate-800 text-slate-500"
                    : "bg-slate-900/90 border-slate-700/80 shadow-lg"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                      {myPowerUp.powerUpType === "invisibility" && <EyeOff className="w-5 h-5 text-sky-400" />}
                      {myPowerUp.powerUpType === "lockdown" && <Lock className="w-5 h-5 text-rose-400" />}
                      {myPowerUp.powerUpType === "back_to_sender" && <ShieldAlert className="w-5 h-5 text-emerald-400" />}
                      {myPowerUp.powerUpType === "riddle" && <HelpCircle className="w-5 h-5 text-amber-400" />}
                      {myPowerUp.powerUpType === "answer_reveal" && <Sparkles className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Your Assigned Spell</div>
                      <div className="text-sm font-black text-white">{myPowerUp.powerUpName}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      myPowerUp.isUsed
                        ? "bg-slate-800 text-slate-400"
                        : "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40"
                    }`}
                  >
                    {myPowerUp.isUsed ? "Consumed" : "Ready"}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-3">{myPowerUp.description}</p>

                {powerUpMessage && (
                  <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 font-medium mb-3">
                    {powerUpMessage}
                  </div>
                )}

                {activeQuiz && !myPowerUp.isUsed && (
                  <button
                    onClick={handleActivatePowerUp}
                    disabled={isActivatingPowerUp}
                    id="player-activate-powerup-btn"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Zap className="w-4 h-4" />
                    <span>UNLEASH {myPowerUp.powerUpName.toUpperCase()}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-center gap-2 text-indigo-400">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Secret Power-Up</span>
                </div>
                <p className="text-xs text-slate-400">
                  Waiting for presenter to assign or shuffle team power-ups...
                </p>
              </div>
            )}

            {/* Waiting Notice & Switch Option */}

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-500">
                Refreshing this page keeps your team identity intact.
              </div>
              <button
                onClick={handleLeaveTeam}
                className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Switch Team</span>
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: REGISTRATION FORM (If not registered) */
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="space-y-1 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>{targetSessionId || "Connecting to Session..."}</span>
              </div>
              <h2 className="text-xl font-black text-white">Register Team</h2>
              <p className="text-xs text-slate-400">
                Enter your team details to join the live classroom quiz battle.
              </p>
            </div>

            {/* Status Notices (Closed or Full) */}
            {!isRegistrationOpen ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
                <Lock className="w-6 h-6 text-rose-400 mx-auto" />
                <div className="text-sm font-bold text-rose-300">Registration is Closed</div>
                <p className="text-xs text-slate-400">
                  The presenter has closed team registration for this session. Please ask the
                  presenter to reopen registration.
                </p>
              </div>
            ) : isLobbyFull ? (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center space-y-2">
                <ShieldAlert className="w-6 h-6 text-purple-400 mx-auto" />
                <div className="text-sm font-bold text-purple-300">Battle Lobby is Full</div>
                <p className="text-xs text-slate-400">
                  All 5 team slots have already been filled for this session ({registeredCount}/5).
                </p>
              </div>
            ) : (
              /* Registration Inputs */
              <form onSubmit={handleRegister} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={teamNameInput}
                    onChange={(e) => setTeamNameInput(e.target.value)}
                    placeholder="e.g. Cyber Eagles"
                    maxLength={30}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                  <div className="text-[10px] text-slate-500">
                    Must be unique among the 5 competing teams.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Team Leader Name
                  </label>
                  <input
                    type="text"
                    value={leaderNameInput}
                    onChange={(e) => setLeaderNameInput(e.target.value)}
                    placeholder="e.g. Alex"
                    maxLength={30}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                  <div className="text-[10px] text-slate-500">
                    Your name or student ID representative.
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !isConnected}
                    className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-98 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Registering Team...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Join Battle Lobby ({registeredCount}/{maxTeams})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="pt-2 text-center border-t border-slate-800 text-[11px] text-slate-500">
              Only 5 team leaders can participate &bull; No login required
            </div>
          </div>
        )}
      </main>

      {/* Mobile Footer */}
      <footer className="text-center text-[11px] text-slate-600 border-t border-slate-800/80 pt-3">
        Classroom Quiz Battle &bull; Team Leader Smartphone Client
      </footer>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400 text-xs">
          Loading player portal...
        </div>
      }
    >
      <PlayerContent />
    </Suspense>
  );
}
