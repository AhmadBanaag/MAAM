"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket, reconnectSocket } from "@/lib/socket-client";
import type {
  ClientRole,
  BroadcastTestPayload,
  ClientsUpdatedPayload,
  LobbyUpdatedPayload,
  TeamRegisterResponse,
  TeamReconnectResponse,
  QuizChoice,
  QuizQuestion,
  ClientQuizQuestion,
  QuestionResultsPayload,
  QuizProgressPayload,
  QuizSubmitResponse,
  ActiveQuizStatePayload,
  TeamPowerUpAssignment,
  ActiveSpellEffect,
  TeamPowerUpStatus,
  LeaderboardEntry,
  FinalLeaderboardPayload,
  ClincherRoundConfig,
  ClincherRoundResult,
  ClincherStatePayload,
} from "@/types/socket";
import type { GameSession } from "@/lib/db";

export function useSocket(
  initialRole?: ClientRole,
  initialName?: string,
  initialSessionId?: string,
  initialTeamId?: string
) {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [transport, setTransport] = useState<string>("connecting");
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [lobbyData, setLobbyData] = useState<LobbyUpdatedPayload | null>(null);
  const [activeClients, setActiveClients] = useState<ClientsUpdatedPayload>({
    admins: 0,
    players: 0,
    total: 0,
  });
  const [lastBroadcast, setLastBroadcast] = useState<BroadcastTestPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quiz Engine States
  const [activeQuiz, setActiveQuiz] = useState<ClientQuizQuestion | null>(null);
  const [quizProgress, setQuizProgress] = useState<QuizProgressPayload | null>(null);
  const [lastQuizResult, setLastQuizResult] = useState<QuestionResultsPayload | null>(null);
  const [quizSubmission, setQuizSubmission] = useState<{
    hasSubmitted: boolean;
    selectedChoice: QuizChoice | null;
    submittedAt?: number;
  }>({
    hasSubmitted: false,
    selectedChoice: null,
  });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Power-Up System States
  const [myPowerUp, setMyPowerUp] = useState<TeamPowerUpAssignment | null>(null);
  const [allPowerUps, setAllPowerUps] = useState<TeamPowerUpAssignment[]>([]);
  const [activeSpells, setActiveSpells] = useState<ActiveSpellEffect[]>([]);
  const [teamPowerUpStatus, setTeamPowerUpStatus] = useState<TeamPowerUpStatus | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<QuizChoice | null>(null);
  const [spellNotification, setSpellNotification] = useState<string | null>(null);

  // Leaderboard & Clincher States
  const [leaderboard, setLeaderboard] = useState<FinalLeaderboardPayload | null>(null);
  const [isGameEnded, setIsGameEnded] = useState<boolean>(false);
  const [clincherState, setClincherState] = useState<ClincherStatePayload | null>(null);
  const [clincherProgress, setClincherProgress] = useState<{
    roundNumber: number;
    submittedCount: number;
    totalContenders: number;
  } | null>(null);
  const [lastClincherResult, setLastClincherResult] = useState<ClincherRoundResult | null>(null);
  const [clincherChampion, setClincherChampion] = useState<LeaderboardEntry | null>(null);
  const [clincherSubmission, setClincherSubmission] = useState<{
    hasSubmitted: boolean;
    selectedChoice: QuizChoice | null;
  }>({
    hasSubmitted: false,
    selectedChoice: null,
  });

  const pingStartTimeRef = useRef<number>(0);
  const roleRef = useRef<{
    role?: ClientRole;
    name?: string;
    sessionId?: string;
    teamId?: string;
  }>({
    role: initialRole,
    name: initialName,
    sessionId: initialSessionId,
    teamId: initialTeamId,
  });

  useEffect(() => {
    roleRef.current = {
      role: initialRole,
      name: initialName,
      sessionId: initialSessionId,
      teamId: initialTeamId || roleRef.current.teamId,
    };
  }, [initialRole, initialName, initialSessionId, initialTeamId]);

  const sendPing = useCallback(() => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    pingStartTimeRef.current = Date.now();
    socket.emit("client:ping", { clientTimestamp: pingStartTimeRef.current });
  }, []);

  const registerRole = useCallback((role: ClientRole, name?: string, teamId?: string, sessionId?: string) => {
    roleRef.current = { role, name, teamId, sessionId };
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("client:register", { role, name, teamId, sessionId });
  }, []);

  const createSession = useCallback((title?: string, callback?: (session: GameSession) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("session:create", { title }, callback);
  }, []);

  const toggleRegistration = useCallback((sessionId: string, isOpen: boolean, callback?: (success: boolean) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("session:toggle_registration", { sessionId, isOpen }, callback);
  }, []);

  const registerTeamAction = useCallback(
    (sessionId: string, teamName: string, leaderName: string, callback?: (res: TeamRegisterResponse) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server" });
        return;
      }
      socket.emit("team:register", { sessionId, teamName, leaderName }, (res) => {
        if (res.success && res.team) {
          roleRef.current = {
            role: "player",
            name: res.team.name,
            teamId: res.team.id,
            sessionId: sessionId,
          };
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const reconnectTeamAction = useCallback(
    (sessionId: string, teamId: string, token: string, callback?: (res: TeamReconnectResponse) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server" });
        return;
      }
      socket.emit("team:reconnect", { sessionId, teamId, token }, (res) => {
        if (res.success && res.team) {
          roleRef.current = {
            role: "player",
            name: res.team.name,
            teamId: res.team.id,
            sessionId: sessionId,
          };
          if (res.activeQuiz) {
            setActiveQuiz(res.activeQuiz);
          }
          if (res.hasSubmitted && res.submittedChoice) {
            setQuizSubmission({
              hasSubmitted: true,
              selectedChoice: res.submittedChoice,
            });
          }
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const kickTeamAction = useCallback((sessionId: string, teamId: string, callback?: (success: boolean) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("admin:kick_team", { sessionId, teamId }, callback);
  }, []);

  const renameTeamAction = useCallback(
    (sessionId: string, teamId: string, newName: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server" });
        return;
      }
      socket.emit("admin:rename_team", { sessionId, teamId, newName }, callback);
    },
    []
  );

  const resetRegistrationAction = useCallback(
    (sessionId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server" });
        return;
      }
      socket.emit("admin:reset_registration", { sessionId }, callback);
    },
    []
  );

  const fetchQuestionsAction = useCallback((sessionId?: string) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("quiz:get_questions", { sessionId }, (res) => {
      setQuestions(res);
    });
  }, []);

  const reorderQuestionsAction = useCallback(
    (questionIds: string[], callback?: (success: boolean) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback(false);
        return;
      }
      socket.emit("quiz:reorder_questions", { questionIds }, (success) => {
        if (success) {
          socket.emit("quiz:get_questions", {}, (res) => {
            setQuestions(res);
          });
        }
        if (callback) callback(success);
      });
    },
    []
  );

  const sendTestBroadcast = useCallback((message: string) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("admin:test_broadcast", { message });
  }, []);

  const sendBuzzerTest = useCallback((playerName?: string) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("player:test_buzzer", { playerName });
  }, []);

  const saveQuestionAction = useCallback(
    (
      question: Partial<QuizQuestion>,
      callback?: (result: { success: boolean; question?: QuizQuestion; error?: string }) => void
    ) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("quiz:save_question", { question }, (res) => {
        if (res.success && res.question) {
          setQuestions((prev) => {
            const idx = prev.findIndex((q) => q.id === res.question!.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = res.question!;
              return next;
            }
            return [...prev, res.question!];
          });
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const deleteQuestionAction = useCallback((questionId: string, callback?: (success: boolean) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("quiz:delete_question", { questionId }, (success) => {
      if (success) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      }
      if (callback) callback(success);
    });
  }, []);

  const activateSurpriseQuiz = useCallback(
    (sessionId: string, questionId?: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("quiz:activate_surprise", { sessionId, questionId }, callback);
    },
    []
  );

  const endActiveQuiz = useCallback(
    (sessionId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("quiz:end_question", { sessionId }, callback);
    },
    []
  );

  const submitQuizAnswer = useCallback(
    (
      sessionId: string,
      teamId: string,
      token: string,
      questionId: string,
      choice: QuizChoice,
      callback?: (res: QuizSubmitResponse) => void
    ) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server" });
        return;
      }
      socket.emit("quiz:submit_answer", { sessionId, teamId, token, questionId, choice }, (res) => {
        if (res.success && res.selectedChoice) {
          setQuizSubmission({
            hasSubmitted: true,
            selectedChoice: res.selectedChoice,
            submittedAt: res.submittedAt,
          });
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const queryQuizState = useCallback((sessionId: string, teamId?: string, callback?: (state: ActiveQuizStatePayload) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("quiz:get_state", { sessionId, teamId }, (state) => {
      setActiveQuiz(state.currentQuestion);
      setLastQuizResult(state.lastResult);
      if (state.hasSubmitted && state.submittedChoice) {
        setQuizSubmission({
          hasSubmitted: true,
          selectedChoice: state.submittedChoice,
        });
      }
      if (callback) callback(state);
    });
  }, []);

  const assignPowerUpsAction = useCallback((sessionId: string, callback?: (assignments: TeamPowerUpAssignment[]) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("powerup:assign_all", { sessionId, shuffle: true }, (res) => {
      setAllPowerUps(res);
      if (callback) callback(res);
    });
  }, []);

  const shufflePowerUpsAction = useCallback(
    (sessionId: string, callback?: (res: { success: boolean; assignments?: TeamPowerUpAssignment[]; error?: string }) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("powerup:shuffle", { sessionId }, (res) => {
        if (res && res.success && res.assignments) {
          setAllPowerUps(res.assignments);
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const fetchAllPowerUpsAction = useCallback((sessionId: string, callback?: (assignments: TeamPowerUpAssignment[]) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("powerup:get_all", { sessionId }, (res) => {
      setAllPowerUps(res);
      if (callback) callback(res);
    });
  }, []);

  const fetchMyPowerUpAction = useCallback(
    (sessionId: string, teamId: string, token: string, callback?: (assignment: TeamPowerUpAssignment | null) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("powerup:get_my", { sessionId, teamId, token }, (res) => {
        if (res) {
          setMyPowerUp(res);
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const activatePowerUpAction = useCallback(
    (
      sessionId: string,
      teamId: string,
      token: string,
      questionId: string,
      callback?: (res: { success: boolean; error?: string; spell?: ActiveSpellEffect; answerReveal?: QuizChoice }) => void
    ) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server." });
        return;
      }
      socket.emit("powerup:activate", { sessionId, teamId, token, questionId }, (res) => {
        if (res.success) {
          setMyPowerUp((prev) => (prev ? { ...prev, isUsed: true } : prev));
          if (res.answerReveal) {
            setRevealedAnswer(res.answerReveal);
          }
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const solveRiddleAction = useCallback(
    (
      sessionId: string,
      teamId: string,
      token: string,
      questionId: string,
      riddleId: string,
      answer: string,
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server." });
        return;
      }
      socket.emit("powerup:solve_riddle", { sessionId, teamId, token, questionId, riddleId, answer }, (res) => {
        if (res.success) {
          setTeamPowerUpStatus((prev) => (prev ? { ...prev, isRiddleSolved: true } : prev));
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const adminResolveStuckAction = useCallback((sessionId: string, callback?: (res: { success: boolean; message: string }) => void) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit("powerup:admin_resolve_stuck", { sessionId }, (res) => {
      if (callback) callback(res);
    });
  }, []);

  const endGameAction = useCallback(
    (sessionId: string, callback?: (payload: FinalLeaderboardPayload) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("session:end_game", { sessionId }, (res) => {
        setLeaderboard(res);
        setIsGameEnded(true);
        if (res.winner) {
          setClincherChampion(res.winner);
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const fetchLeaderboardAction = useCallback(
    (sessionId: string, callback?: (payload: FinalLeaderboardPayload) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("session:get_leaderboard", { sessionId }, (res) => {
        setLeaderboard(res);
        if (res.isFinished) {
          setIsGameEnded(true);
        }
        if (res.winner) {
          setClincherChampion(res.winner);
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const startClincherRoundAction = useCallback(
    (
      sessionId: string,
      config?: Partial<ClincherRoundConfig>,
      callback?: (res: { success: boolean; error?: string; clincher?: ClincherStatePayload }) => void
    ) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit(
        "clincher:start_round",
        {
          sessionId,
          questionId: config?.questionId,
          timeLimit: config?.timeLimit,
          allowPowerUps: config?.allowPowerUps ?? false,
        },
        (res) => {
          if (res.success && res.clincher) {
            setClincherState(res.clincher);
            setClincherSubmission({ hasSubmitted: false, selectedChoice: null });
          }
          if (callback) callback(res);
        }
      );
    },
    []
  );

  const submitClincherAnswerAction = useCallback(
    (
      sessionId: string,
      teamId: string,
      token: string,
      questionId: string,
      choice: QuizChoice,
      callback?: (res: { success: boolean; error?: string; selectedChoice?: QuizChoice }) => void
    ) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        if (callback) callback({ success: false, error: "Not connected to server." });
        return;
      }
      socket.emit("clincher:submit_answer", { sessionId, teamId, token, questionId, choice }, (res) => {
        if (res.success) {
          setClincherSubmission({
            hasSubmitted: true,
            selectedChoice: choice,
          });
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const endClincherRoundAction = useCallback(
    (
      sessionId: string,
      callback?: (res: { success: boolean; error?: string; result?: ClincherRoundResult }) => void
    ) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("clincher:end_round", { sessionId }, (res) => {
        if (res.success && res.result) {
          setLastClincherResult(res.result);
        }
        if (callback) callback(res);
      });
    },
    []
  );

  const fetchClincherStateAction = useCallback(
    (sessionId: string, teamId?: string, callback?: (state: ClincherStatePayload | null) => void) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit("clincher:get_state", { sessionId, teamId }, (state) => {
        if (state) {
          setClincherState(state);
        }
        if (callback) callback(state);
      });
    },
    []
  );

  const manualReconnect = useCallback(() => {
    setError(null);
    reconnectSocket();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleConnect() {
      setIsConnected(true);
      setError(null);
      setSocketId(socket.id || null);

      const engine = (socket.io as unknown as { engine?: { transport?: { name?: string } } }).engine;
      if (engine?.transport?.name) {
        setTransport(engine.transport.name);
      }

      if (roleRef.current.role) {
        socket.emit("client:register", {
          role: roleRef.current.role,
          name: roleRef.current.name,
          sessionId: roleRef.current.sessionId,
          teamId: roleRef.current.teamId,
        });
      }

      // Automatically sync questions and power-ups for admin on connection/reconnection
      if (roleRef.current.role === "admin") {
        socket.emit("quiz:get_questions", { sessionId: roleRef.current.sessionId }, (res) => {
          if (Array.isArray(res)) setQuestions(res);
        });
        if (roleRef.current.sessionId) {
          socket.emit("powerup:get_all", { sessionId: roleRef.current.sessionId }, (res) => {
            if (Array.isArray(res)) setAllPowerUps(res);
          });
          socket.emit("session:get_leaderboard", { sessionId: roleRef.current.sessionId }, (res) => {
            if (res) setLeaderboard(res);
          });
        }
      }

      sendPing();
    }

    function handleDisconnect(reason: string) {
      setIsConnected(false);
      setLatency(null);
      setTransport("disconnected");
      if (reason === "io server disconnect") {
        socket.connect();
      }
    }

    function handleConnectError(err: Error) {
      setError(err.message || "Connection failed");
      setIsConnected(false);
      setTransport("error");
    }

    function handleServerConnected(payload: {
      socketId: string;
      serverIp: string;
      activeClients: ClientsUpdatedPayload;
      currentSession: GameSession | null;
    }) {
      setSocketId(payload.socketId);
      setServerIp(payload.serverIp);
      setActiveClients(payload.activeClients);
      if (payload.currentSession) {
        setCurrentSession(payload.currentSession);
        if (roleRef.current.role === "admin") {
          socket.emit("quiz:get_questions", { sessionId: payload.currentSession.id }, (res) => {
            if (Array.isArray(res)) setQuestions(res);
          });
          socket.emit("powerup:get_all", { sessionId: payload.currentSession.id }, (res) => {
            if (Array.isArray(res)) setAllPowerUps(res);
          });
          socket.emit("session:get_leaderboard", { sessionId: payload.currentSession.id }, (res) => {
            if (res) setLeaderboard(res);
          });
        }
      }
    }

    function handleLobbyUpdated(payload: LobbyUpdatedPayload) {
      setLobbyData(payload);
      setCurrentSession(payload.session);
    }

    function handlePong(payload: { clientTimestamp: number; serverTimestamp: number; latencyMs: number }) {
      const now = Date.now();
      const roundTrip = now - payload.clientTimestamp;
      setLatency(roundTrip);
    }

    function handleClientsUpdated(payload: ClientsUpdatedPayload) {
      setActiveClients(payload);
    }

    function handleBroadcastTest(payload: BroadcastTestPayload) {
      setLastBroadcast(payload);
    }

    function handleQuizStarted(clientQ: ClientQuizQuestion) {
      setActiveQuiz(clientQ);
      setQuizSubmission({ hasSubmitted: false, selectedChoice: null });
      setQuizProgress(null);
      setLastQuizResult(null);
      setRevealedAnswer(null); // Reset private answer reveal for each new question
    }

    function handleQuizProgress(progress: QuizProgressPayload) {
      setQuizProgress(progress);
    }

    function handleQuizEnded(results: QuestionResultsPayload) {
      setActiveQuiz(null);
      setLastQuizResult(results);
      setQuizProgress(null);
    }

    function handleQuizState(state: ActiveQuizStatePayload) {
      setActiveQuiz(state.currentQuestion);
      setLastQuizResult(state.lastResult);
      if (state.hasSubmitted && state.submittedChoice) {
        setQuizSubmission({
          hasSubmitted: true,
          selectedChoice: state.submittedChoice,
        });
      }
    }

    function handlePowerUpAssigned(assignment: TeamPowerUpAssignment) {
      setMyPowerUp(assignment);
    }

    function handlePowerUpAllAssigned(assignments: TeamPowerUpAssignment[]) {
      setAllPowerUps(assignments);
      setMyPowerUp((prev) => {
        if (!prev) return prev;
        const updated = assignments.find((a) => a.teamId === prev.teamId);
        return updated || prev;
      });
    }

    function handlePowerUpActivated(payload: { spell: ActiveSpellEffect; message: string }) {
      setSpellNotification(payload.message);
      setActiveSpells((prev) => {
        const idx = prev.findIndex((s) => s.id === payload.spell.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload.spell;
          return next;
        }
        return [...prev, payload.spell];
      });
      setTimeout(() => {
        setSpellNotification(null);
      }, 6000);
    }

    function handleAnswerRevealed(payload: { questionId: string; correctAnswer: QuizChoice; points: number }) {
      setRevealedAnswer(payload.correctAnswer);
    }

    function handleRiddleUnlocked(payload: { questionId: string; success: boolean }) {
      if (payload.success) {
        setTeamPowerUpStatus((prev) => (prev ? { ...prev, isRiddleSolved: true } : prev));
      }
    }

    function handlePowerUpStateUpdated(payload: { activeSpells: ActiveSpellEffect[]; teamStatus?: TeamPowerUpStatus }) {
      setActiveSpells(payload.activeSpells);
      if (payload.teamStatus !== undefined) {
        setTeamPowerUpStatus(payload.teamStatus);
      }
    }

    function handleLeaderboardUpdated(payload: FinalLeaderboardPayload) {
      setLeaderboard(payload);
      if (payload.isFinished) {
        setIsGameEnded(true);
      }
      if (payload.winner) {
        setClincherChampion(payload.winner);
      }
    }

    function handleGameEnded(payload: FinalLeaderboardPayload) {
      setLeaderboard(payload);
      setIsGameEnded(true);
      if (payload.winner) {
        setClincherChampion(payload.winner);
      }
    }

    function handleClincherStarted(payload: ClincherStatePayload) {
      setClincherState(payload);
      setClincherSubmission({ hasSubmitted: false, selectedChoice: null });
      setClincherProgress(null);
      setActiveQuiz(null);
    }

    function handleClincherProgress(payload: { roundNumber: number; submittedCount: number; totalContenders: number }) {
      setClincherProgress(payload);
    }

    function handleClincherEnded(payload: ClincherRoundResult) {
      setLastClincherResult(payload);
      setClincherState(null);
      setClincherProgress(null);
    }

    function handleClincherChampionCrowned(payload: { winner: LeaderboardEntry; leaderboard: FinalLeaderboardPayload }) {
      setClincherChampion(payload.winner);
      setLeaderboard(payload.leaderboard);
      setIsGameEnded(true);
      setClincherState(null);
      setClincherProgress(null);
    }

    if (socket.connected) {
      handleConnect();
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("server:connected", handleServerConnected);
    socket.on("lobby:updated", handleLobbyUpdated);
    socket.on("server:pong", handlePong);
    socket.on("server:clients_updated", handleClientsUpdated);
    socket.on("server:broadcast_test", handleBroadcastTest);

    socket.on("quiz:started", handleQuizStarted);
    socket.on("quiz:progress", handleQuizProgress);
    socket.on("quiz:ended", handleQuizEnded);
    socket.on("quiz:state", handleQuizState);

    socket.on("powerup:assigned", handlePowerUpAssigned);
    socket.on("powerup:all_assigned", handlePowerUpAllAssigned);
    socket.on("powerup:activated", handlePowerUpActivated);
    socket.on("powerup:answer_revealed", handleAnswerRevealed);
    socket.on("powerup:riddle_unlocked", handleRiddleUnlocked);
    socket.on("powerup:state_updated", handlePowerUpStateUpdated);

    socket.on("leaderboard:updated", handleLeaderboardUpdated);
    socket.on("session:game_ended", handleGameEnded);
    socket.on("clincher:started", handleClincherStarted);
    socket.on("clincher:progress", handleClincherProgress);
    socket.on("clincher:ended", handleClincherEnded);
    socket.on("clincher:champion_crowned", handleClincherChampionCrowned);

    const engine = (socket.io as unknown as { engine?: { on?: (event: string, fn: () => void) => void } }).engine;
    if (engine && typeof engine.on === "function") {
      engine.on("upgrade", () => {
        const currentEngine = (socket.io as unknown as { engine?: { transport?: { name?: string } } }).engine;
        if (currentEngine?.transport?.name) {
          setTransport(currentEngine.transport.name);
        }
      });
    }

    const interval = setInterval(() => {
      if (socket.connected) {
        sendPing();
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("server:connected", handleServerConnected);
      socket.off("lobby:updated", handleLobbyUpdated);
      socket.off("server:pong", handlePong);
      socket.off("server:clients_updated", handleClientsUpdated);
      socket.off("server:broadcast_test", handleBroadcastTest);

      socket.off("quiz:started", handleQuizStarted);
      socket.off("quiz:progress", handleQuizProgress);
      socket.off("quiz:ended", handleQuizEnded);
      socket.off("quiz:state", handleQuizState);

      socket.off("powerup:assigned", handlePowerUpAssigned);
      socket.off("powerup:all_assigned", handlePowerUpAllAssigned);
      socket.off("powerup:activated", handlePowerUpActivated);
      socket.off("powerup:answer_revealed", handleAnswerRevealed);
      socket.off("powerup:riddle_unlocked", handleRiddleUnlocked);
      socket.off("powerup:state_updated", handlePowerUpStateUpdated);

      socket.off("leaderboard:updated", handleLeaderboardUpdated);
      socket.off("session:game_ended", handleGameEnded);
      socket.off("clincher:started", handleClincherStarted);
      socket.off("clincher:progress", handleClincherProgress);
      socket.off("clincher:ended", handleClincherEnded);
      socket.off("clincher:champion_crowned", handleClincherChampionCrowned);
    };
  }, [sendPing]);

  return {
    isConnected,
    socketId,
    latency,
    serverIp,
    transport,
    currentSession,
    lobbyData,
    activeClients,
    lastBroadcast,
    error,
    activeQuiz,
    quizProgress,
    lastQuizResult,
    quizSubmission,
    questions,
    // Power-Up States
    myPowerUp,
    allPowerUps,
    activeSpells,
    teamPowerUpStatus,
    revealedAnswer,
    spellNotification,
    // Leaderboard & Clincher States
    leaderboard,
    isGameEnded,
    clincherState,
    clincherProgress,
    lastClincherResult,
    clincherChampion,
    clincherSubmission,
    // Base actions
    sendPing,
    registerRole,
    createSession,
    toggleRegistration,
    registerTeamAction,
    reconnectTeamAction,
    kickTeamAction,
    renameTeamAction,
    resetRegistrationAction,
    reorderQuestionsAction,
    sendTestBroadcast,
    sendBuzzerTest,
    manualReconnect,
    fetchQuestions: fetchQuestionsAction,
    fetchQuestionsAction,
    saveQuestionAction,
    deleteQuestionAction,
    activateSurpriseQuiz,
    endActiveQuiz,
    submitQuizAnswer,
    queryQuizState,
    // Power-Up actions
    assignPowerUpsAction,
    shufflePowerUpsAction,
    fetchAllPowerUpsAction,
    fetchMyPowerUpAction,
    activatePowerUpAction,
    solveRiddleAction,
    adminResolveStuckAction,
    // Leaderboard & Clincher actions
    endGameAction,
    fetchLeaderboardAction,
    startClincherRoundAction,
    submitClincherAnswerAction,
    endClincherRoundAction,
    fetchClincherStateAction,
  };
}


