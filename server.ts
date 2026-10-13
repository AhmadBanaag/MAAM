import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ClientRole,
  LobbyUpdatedPayload,
  QuizChoice,
  QuizQuestion,
  ClientQuizQuestion,
  QuestionResultsPayload,
  QuizProgressPayload,
  ActiveSpellEffect,
  TeamPowerUpStatus,
  RiddleClientData,
} from "./src/types/socket";
import {
  getDb,
  getActiveSession,
  getSessionById,
  createNewSession,
  setRegistrationOpen,
  getTeamsForSession,
  getTeamById,
  registerTeam,
  reconnectTeam,
  updateTeamConnection,
  removeTeam,
  renameTeam,
  resetSessionTeams,
  getQuestions,
  getQuestionById,
  saveQuestion,
  deleteQuestion,
  clearAllQuestions,
  reorderQuestions,
  setSessionActiveQuiz,
  recordSubmission,
  getQuestionSubmissions,
  getTeamSubmission,
  finalizeQuestionScores,
  assignPowerUpsToTeams,
  shufflePowerUpsToTeams,
  getAllTeamPowerUps,
  getTeamPowerUp,
  markPowerUpUsed,
  recordSpellEffect,
  getRandomRiddle,
  checkAndSolveRiddle,
  getTeamRiddleStatus,
  resolveStuckQuestionDb,
  getLeaderboard,
  endGameSession,
  createClincherRound,
  recordClincherSubmission,
  getClincherSubmissionsForRound,
  resolveClincherRound,
  validateAdminSession,
} from "./src/lib/db";
import { getSortedNetworkInterfaces, getPrimaryIpAddress } from "./src/lib/network";
import { createClientQuestion, isTeamEligibleToAnswer } from "./src/lib/quiz-engine";
import type { ClincherRoundResult, ClincherStatePayload } from "./src/types/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

interface ConnectedClient {
  id: string;
  role: ClientRole;
  name?: string;
  teamId?: string;
  sessionId?: string;
  connectedAt: number;
}

interface ActiveQuizState {
  sessionId: string;
  questionId: string;
  startedAt: number;
  deadline: number;
  timer: NodeJS.Timeout | null;
  lastResults: QuestionResultsPayload | null;
}

interface ActiveClincherState {
  sessionId: string;
  clincherRoundId: string;
  roundNumber: number;
  questionId: string;
  contendingTeamIds: string[];
  allowPowerUps: boolean;
  startedAt: number;
  deadline: number;
  timeLimit: number;
  timer: NodeJS.Timeout | null;
  lastRoundResult?: ClincherRoundResult | null;
}

const connectedClients = new Map<string, ConnectedClient>();
const activeQuizMap = new Map<string, ActiveQuizState>();
const activeClincherMap = new Map<string, ActiveClincherState>();
const lastClincherResultMap = new Map<string, ClincherRoundResult>();

interface QuestionSpellState {
  sessionId: string;
  questionId: string;
  activeSpells: ActiveSpellEffect[];
  shieldedTeamIds: Set<string>;
  lockedDownTeamIds: Set<string>;
  invisibilityAffectedTeamIds: Set<string>;
  activeRiddle: {
    riddleId: string;
    riddleClient: RiddleClientData;
    exemptTeamIds: Set<string>;
  } | null;
}

const questionSpellsMap = new Map<string, QuestionSpellState>();

function resetQuestionSpells(sessionId: string, questionId: string) {
  questionSpellsMap.set(sessionId, {
    sessionId,
    questionId,
    activeSpells: [],
    shieldedTeamIds: new Set<string>(),
    lockedDownTeamIds: new Set<string>(),
    invisibilityAffectedTeamIds: new Set<string>(),
    activeRiddle: null,
  });
}

function getTeamStatusForQuestion(sessionId: string, questionId: string, teamId: string): TeamPowerUpStatus {
  const spellState = questionSpellsMap.get(sessionId);
  if (!spellState || spellState.questionId !== questionId) {
    return {
      isLockedDown: false,
      isInvisibilityActive: false,
      isRiddleActive: false,
      isRiddleSolved: false,
      hasBackToSenderShield: false,
    };
  }

  const isLockedDown = spellState.lockedDownTeamIds.has(teamId);
  const isInvisibilityActive = spellState.invisibilityAffectedTeamIds.has(teamId);
  const hasBackToSenderShield = spellState.shieldedTeamIds.has(teamId);

  let isRiddleActive = false;
  let isRiddleSolved = false;
  let activeRiddle: RiddleClientData | undefined = undefined;

  if (spellState.activeRiddle && !spellState.activeRiddle.exemptTeamIds.has(teamId)) {
    isRiddleActive = true;
    activeRiddle = spellState.activeRiddle.riddleClient;
    const riddleStatus = getTeamRiddleStatus(sessionId, questionId, teamId);
    isRiddleSolved = riddleStatus.isSolved;
  }

  return {
    isLockedDown,
    lockedDownReason: isLockedDown ? "Your team is locked down by a Lockdown Spell for this question!" : undefined,
    isInvisibilityActive,
    isRiddleActive,
    isRiddleSolved,
    activeRiddle,
    hasBackToSenderShield,
  };
}

function createSanitizedClientQuestion(
  question: QuizQuestion,
  sessionId: string,
  startedAt: number,
  deadline: number,
  questionNumber: number,
  totalQuestions: number,
  targetTeamId?: string
): ClientQuizQuestion {
  const clientQ = createClientQuestion(
    question,
    sessionId,
    startedAt,
    deadline,
    questionNumber,
    totalQuestions,
    targetTeamId
  );

  if (targetTeamId) {
    const spellState = questionSpellsMap.get(sessionId);
    if (spellState && spellState.questionId === question.id && spellState.invisibilityAffectedTeamIds.has(targetTeamId)) {
      // Invisibility Spell: Hide the answer-choice text from opposing teams.
      // Opposing teams see clickable buttons A, B, C, D without the choice string.
      clientQ.options = {
        A: "",
        B: "",
        C: "",
        D: "",
      };
    }
  }

  return clientQ;
}

function getClientCounts() {

  let admins = 0;
  let players = 0;
  for (const client of connectedClients.values()) {
    if (client.role === "admin") admins++;
    else if (client.role === "player") players++;
  }
  return {
    admins,
    players,
    total: connectedClients.size,
  };
}

function getLobbyPayload(sessionId: string): LobbyUpdatedPayload | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  const teams = getTeamsForSession(sessionId);
  return {
    session,
    teams,
    registeredCount: teams.length,
    maxTeams: session.max_teams,
  };
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join("=").trim());
    }
  });
  return list;
}

function isAuthorizedAdminSocket(socket: { id: string; request?: { headers?: { cookie?: string } }; handshake?: { headers?: { cookie?: string } } }): boolean {
  // 1. In-memory check: if socket was already verified and granted admin role
  const client = connectedClients.get(socket.id);
  if (client && client.role === "admin") {
    return true;
  }

  // 2. Cookie header verification from HTTP request or WebSocket handshake
  const cookieHeader = socket.request?.headers?.cookie || socket.handshake?.headers?.cookie;
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies["admin_session"];
  if (!sessionToken) return false;
  const validation = validateAdminSession(sessionToken);
  return validation.valid;
}

async function startServer() {
  try {
    // Initialize SQLite database
    getDb();

    // Prepare Next.js
    const app = next({ dev, hostname, port });
    const handle = app.getRequestHandler();
    await app.prepare();

    // Create unified Node HTTP server
    const httpServer = createServer(async (req, res) => {
      try {
        // Let Socket.IO handle socket.io polling/websocket endpoints
        if (req.url && req.url.startsWith("/socket.io")) {
          return;
        }

        await handle(req, res);
      } catch (err) {
        console.error("HTTP handler error:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    // Delegate websocket upgrades: Socket.IO handles /socket.io, Next.js handles Turbopack HMR /_next/...
    const upgradeHandler = app.getUpgradeHandler();
    httpServer.on("upgrade", (req, socket, head) => {
      if (req.url && req.url.startsWith("/socket.io")) {
        return;
      }
      upgradeHandler(req, socket, head);
    });

    // Initialize Socket.IO server on the same HTTP server
    const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["polling", "websocket"],
      allowUpgrades: true,
      destroyUpgrade: false, // Critical: do NOT destroy non-Socket.IO upgrades (Turbopack HMR)
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    // Power-up state broadcast helper
    function broadcastPowerUpStates(sessionId: string, questionId: string) {
      const spellState = questionSpellsMap.get(sessionId);
      const activeSpells = spellState ? spellState.activeSpells : [];

      for (const [sId, c] of connectedClients.entries()) {
        if (c.sessionId === sessionId) {
          if (c.role === "admin") {
            io.to(sId).emit("powerup:state_updated", { activeSpells });
          } else if (c.role === "player" && c.teamId) {
            const teamStatus = getTeamStatusForQuestion(sessionId, questionId, c.teamId);
            io.to(sId).emit("powerup:state_updated", { activeSpells, teamStatus });

            // Push updated question choices if invisibility altered options
            const active = activeQuizMap.get(sessionId);
            if (active && active.questionId === questionId) {
              const q = getQuestionById(questionId);
              if (q) {
                const questions = getQuestions(sessionId);
                const qIndex = questions.findIndex((item) => item.id === q.id);
                const clientQ = createSanitizedClientQuestion(
                  q,
                  sessionId,
                  active.startedAt,
                  active.deadline,
                  qIndex >= 0 ? qIndex + 1 : 1,
                  questions.length,
                  c.teamId
                );
                io.to(sId).emit("quiz:started", clientQ);
              }
            }
          } else {
            io.to(sId).emit("powerup:state_updated", { activeSpells });
          }
        }
      }
    }

    // Quiz conclusion helper: terminates timer, evaluates scores, and broadcasts results
    function handleEndQuiz(sessionId: string, questionId: string) {
      const active = activeQuizMap.get(sessionId);
      if (active?.timer) {
        clearTimeout(active.timer);
        active.timer = null;
      }

      // Reset question spells upon question end (spells last only for current question)
      resetQuestionSpells(sessionId, questionId);
      broadcastPowerUpStates(sessionId, questionId);

      const results = finalizeQuestionScores(sessionId, questionId);
      if (results) {
        if (active) {
          active.lastResults = results;
        }
        console.log(
          `[Quiz] Question ${questionId} ended. Results: ${results.summary.correctCount}/${results.summary.submittedCount} correct.`
        );
        io.emit("quiz:ended", results);

        // Broadcast updated lobby with new scores
        const lobbyData = getLobbyPayload(sessionId);
        if (lobbyData) {
          io.emit("lobby:updated", lobbyData);
        }
      }
    }

    // Clincher conclusion helper: evaluates submissions, checks tie/won status, crowns champion or sets up next round
    function handleEndClincherRound(sessionId: string): ClincherRoundResult | null {
      const activeClincher = activeClincherMap.get(sessionId);
      if (!activeClincher) return lastClincherResultMap.get(sessionId) || null;

      if (activeClincher.timer) {
        clearTimeout(activeClincher.timer);
        activeClincher.timer = null;
      }

      const result = resolveClincherRound(sessionId, activeClincher.clincherRoundId);
      activeClincher.lastRoundResult = result;
      lastClincherResultMap.set(sessionId, result);

      console.log(`[Clincher] Round ${result.roundNumber} ended in ${sessionId}: outcome=${result.status}, winner=${result.winnerTeamName || "NONE"}`);

      // Broadcast round result
      io.emit("clincher:ended", result);

      const updatedLeaderboard = getLeaderboard(sessionId);

      if (result.status === "won" && result.winnerTeamId) {
        // A unique champion has been crowned!
        const winnerEntry = updatedLeaderboard.entries.find((e) => e.teamId === result.winnerTeamId);
        if (winnerEntry) {
          io.emit("clincher:champion_crowned", { winner: winnerEntry, leaderboard: updatedLeaderboard });
        }
        io.emit("leaderboard:updated", updatedLeaderboard);
        activeClincherMap.delete(sessionId);
      } else {
        // Tie persists! Keep activeClincherMap state with surviving team IDs for next round
        activeClincher.contendingTeamIds = result.survivingTeamIds;
        io.emit("leaderboard:updated", updatedLeaderboard);
      }

      // Update lobby payload
      const lobbyData = getLobbyPayload(sessionId);
      if (lobbyData) io.emit("lobby:updated", lobbyData);

      return result;
    }


    const networkInterfaces = getSortedNetworkInterfaces();
    const primaryIp = getPrimaryIpAddress();

    io.on("connection", (socket) => {
      const activeSession = getActiveSession();

      connectedClients.set(socket.id, {
        id: socket.id,
        role: "spectator",
        connectedAt: Date.now(),
      });

      // Send initial connection packet with current active session
      socket.emit("server:connected", {
        socketId: socket.id,
        serverTimestamp: Date.now(),
        serverIp: primaryIp,
        activeClients: getClientCounts(),
        currentSession: activeSession,
      });

      // If active session exists, send initial lobby state
      if (activeSession) {
        const lobbyData = getLobbyPayload(activeSession.id);
        if (lobbyData) {
          socket.emit("lobby:updated", lobbyData);
        }

        // If a quiz is currently active, transmit client question
        const activeQuiz = activeQuizMap.get(activeSession.id);
        if (activeQuiz) {
          const q = getQuestionById(activeQuiz.questionId);
          if (q) {
            const questions = getQuestions(activeSession.id);
            const qIndex = questions.findIndex((item) => item.id === q.id);
            const clientQ = createClientQuestion(
              q,
              activeSession.id,
              activeQuiz.startedAt,
              activeQuiz.deadline,
              qIndex >= 0 ? qIndex + 1 : 1,
              questions.length
            );
            socket.emit("quiz:started", clientQ);
          }
        }
      }

      // Handle role registration with server-side session authentication
      socket.on("client:register", (payload) => {
        const client = connectedClients.get(socket.id);
        if (!client) return;

        // Deduplicate: If client is already registered with identical role, name, team, and session, skip
        const isSameRole = client.role === payload.role;
        const isSameName = client.name === payload.name;
        const isSameTeam = client.teamId === payload.teamId;
        const isSameSession = client.sessionId === payload.sessionId;

        if (isSameRole && isSameName && isSameTeam && isSameSession) {
          return;
        }

        if (payload.role === "admin") {
          // Never trust client claim; verify server session cookie
          if (isAuthorizedAdminSocket(socket)) {
            client.role = "admin";
            client.name = payload.name;
            socket.join("admins");
            console.log(`[Security] Authenticated admin session granted to socket ${socket.id} (${payload.name || "Presenter"})`);
          } else {
            client.role = "spectator";
            socket.emit("admin:auth_error", { message: "Unauthorized: Administrator session required." });
            console.warn(`[Security] Rejected unauthorized admin role claim from socket ${socket.id}`);
          }
        } else if (payload.role === "player") {
          client.role = "player";
          if (payload.name) client.name = payload.name;
          if (payload.teamId) client.teamId = payload.teamId;
          if (payload.sessionId) client.sessionId = payload.sessionId;
          socket.join("players");
          if (client.sessionId) {
            socket.join(`session_${client.sessionId}`);
          }
          if (client.teamId) {
            socket.join(`team_${client.teamId}`);
            if (client.sessionId) {
              const myPu = getTeamPowerUp(client.sessionId, client.teamId);
              if (myPu) {
                socket.emit("powerup:assigned", myPu);
              }
            }
          }
          console.log(`[Socket] Registered client ${socket.id} as player${client.name ? ` (${client.name})` : ""}${client.teamId ? ` [team: ${client.teamId}]` : ""}`);
        } else {
          client.role = "spectator";
          console.log(`[Socket] Registered client ${socket.id} as spectator`);
        }

        io.emit("server:clients_updated", getClientCounts());

        // Proactively rehydrate session state for newly registered or navigating client
        const activeSession = (payload.sessionId && getSessionById(payload.sessionId)) || getActiveSession();
        if (activeSession) {
          socket.emit("server:connected", {
            socketId: socket.id,
            serverTimestamp: Date.now(),
            serverIp: primaryIp,
            activeClients: getClientCounts(),
            currentSession: activeSession,
          });

          const lobbyData = getLobbyPayload(activeSession.id);
          if (lobbyData) {
            socket.emit("lobby:updated", lobbyData);
          }

          // If a quiz is currently running, sync active question
          const activeQuiz = activeQuizMap.get(activeSession.id);
          if (activeQuiz) {
            const q = getQuestionById(activeQuiz.questionId);
            if (q) {
              const questions = getQuestions(activeSession.id);
              const qIndex = questions.findIndex((item) => item.id === q.id);
              const clientQ = createSanitizedClientQuestion(
                q,
                activeSession.id,
                activeQuiz.startedAt,
                activeQuiz.deadline,
                qIndex >= 0 ? qIndex + 1 : 1,
                questions.length,
                payload.role === "player" ? payload.teamId : undefined
              );
              socket.emit("quiz:started", clientQ);
            }
          }

          // If clincher round is running, sync clincher state
          const activeClincher = activeClincherMap.get(activeSession.id);
          if (activeClincher) {
            const clincherQ = getQuestionById(activeClincher.questionId);
            if (clincherQ) {
              const clientClincherQ = createClientQuestion(
                clincherQ,
                activeSession.id,
                activeClincher.startedAt,
                activeClincher.deadline,
                activeClincher.roundNumber,
                activeClincher.roundNumber
              );
              socket.emit("clincher:started", {
                roundNumber: activeClincher.roundNumber,
                question: clientClincherQ,
                deadline: activeClincher.deadline,
                startedAt: activeClincher.startedAt,
                timeLimit: activeClincher.timeLimit,
                contendingTeamIds: activeClincher.contendingTeamIds,
                allowPowerUps: activeClincher.allowPowerUps,
              });
            }
          }

          // Sync current leaderboard
          const lb = getLeaderboard(activeSession.id);
          if (lb) {
            socket.emit("leaderboard:updated", lb);
          }

          // If authenticated admin, also sync full power-ups table and question bank
          if (client.role === "admin") {
            const allPus = getAllTeamPowerUps(activeSession.id);
            if (allPus.length > 0) {
              socket.emit("powerup:all_assigned", allPus);
            }
          }
        }
      });

      // Fetch lobby state for a session
      socket.on("session:get_state", (payload, callback) => {
        const targetSessionId = payload.sessionId || getActiveSession()?.id;
        if (!targetSessionId) {
          if (callback) callback(null);
          return;
        }
        const data = getLobbyPayload(targetSessionId);
        if (callback) callback(data);
      });

      // Admin: Create new game session (Strictly authenticated)
      socket.on("session:create", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke session:create from socket ${socket.id}`);
          if (callback) {
            callback({
              id: "",
              title: "Unauthorized",
              status: "lobby",
              is_registration_open: 0,
              max_teams: 5,
              current_question_id: null,
              quiz_started_at: null,
              quiz_deadline: null,
              quiz_state: "idle",
              created_at: new Date().toISOString(),
              error: "Unauthorized: Administrator session required.",
            });
          }
          return;
        }

        const newSession = createNewSession(payload.title);
        console.log(`[Session] Admin created new session: ${newSession.id} (${newSession.title})`);

        const lobbyData = getLobbyPayload(newSession.id);
        if (lobbyData) {
          io.emit("lobby:updated", lobbyData);
        }

        if (callback) callback(newSession);
      });

      // Admin: Open / Close registration (Strictly authenticated)
      socket.on("session:toggle_registration", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke session:toggle_registration from socket ${socket.id}`);
          if (callback) callback(false);
          return;
        }

        const success = setRegistrationOpen(payload.sessionId, payload.isOpen);
        console.log(`[Session] Registration for ${payload.sessionId} set to ${payload.isOpen ? "OPEN" : "CLOSED"}`);

        // If registration was closed, auto-assign power-ups to all registered teams if not yet assigned
        if (!payload.isOpen) {
          const currentTeams = getTeamsForSession(payload.sessionId);
          const existingPu = getAllTeamPowerUps(payload.sessionId);
          if (currentTeams.length > 0 && existingPu.length === 0) {
            const assignments = assignPowerUpsToTeams(payload.sessionId, true);
            io.to("admins").emit("powerup:all_assigned", assignments);
            for (const [sId, c] of connectedClients.entries()) {
              if (c.role === "player" && c.teamId && c.sessionId === payload.sessionId) {
                const myAssignment = assignments.find((a) => a.teamId === c.teamId);
                if (myAssignment) io.to(sId).emit("powerup:assigned", myAssignment);
              }
            }
            for (const a of assignments) {
              io.to(`team_${a.teamId}`).emit("powerup:assigned", a);
            }
            console.log(`[PowerUp] Auto-assigned power-ups to ${assignments.length} teams upon closing registration`);
          }
        }

        const lobbyData = getLobbyPayload(payload.sessionId);
        if (lobbyData) {
          io.emit("lobby:updated", lobbyData);
        }

        if (callback) callback(success);
      });

      // Player: Register new team in session
      socket.on("team:register", (payload, callback) => {
        const result = registerTeam(payload.sessionId, payload.teamName, payload.leaderName);

        if (result.success && result.team) {
          const client = connectedClients.get(socket.id);
          if (client) {
            client.role = "player";
            client.name = result.team.name;
            client.teamId = result.team.id;
            client.sessionId = payload.sessionId;
          }
          socket.join("players");
          socket.join(`session_${payload.sessionId}`);
          socket.join(`team_${result.team.id}`);

          console.log(`[Lobby] Team registered: "${result.team.name}" (Slot ${result.team.slotNumber}, Leader: ${result.team.leaderName}) in ${payload.sessionId}`);

          const lobbyData = getLobbyPayload(payload.sessionId);
          if (lobbyData) {
            io.emit("lobby:updated", lobbyData);
          }
          io.emit("server:clients_updated", getClientCounts());

          // Auto-assign power-ups when exactly 5 teams are registered OR if powerups were already distributed
          const currentTeams = getTeamsForSession(payload.sessionId);
          const existingAssignments = getAllTeamPowerUps(payload.sessionId);
          const registeredTeamId = result.team.id;

          if (currentTeams.length === 5 || (existingAssignments.length > 0 && !existingAssignments.some((a) => a.teamId === registeredTeamId))) {
            const assignments = assignPowerUpsToTeams(payload.sessionId);
            // CRITICAL: Only broadcast complete power-up table to authenticated admins
            io.to("admins").emit("powerup:all_assigned", assignments);
            for (const [sId, c] of connectedClients.entries()) {
              if (c.role === "player" && c.teamId && c.sessionId === payload.sessionId) {
                const myAssignment = assignments.find((a) => a.teamId === c.teamId);
                if (myAssignment) {
                  io.to(sId).emit("powerup:assigned", myAssignment);
                }
              }
            }
            for (const a of assignments) {
              io.to(`team_${a.teamId}`).emit("powerup:assigned", a);
            }
          }
        } else {
          console.log(`[Lobby] Registration rejected for "${payload.teamName}": ${result.error}`);
        }

        socket.emit("team:registered", result);
        if (callback) callback(result);
      });

      // Player: Reconnect existing team identity using token
      socket.on("team:reconnect", (payload, callback) => {
        const result = reconnectTeam(payload.sessionId, payload.teamId, payload.token);

        let activeQuizQ: ClientQuizQuestion | null = null;
        let hasSubmitted = false;
        let submittedChoice: QuizChoice | null = null;

        if (result.success && result.team) {
          const client = connectedClients.get(socket.id);
          if (client) {
            client.role = "player";
            client.name = result.team.name;
            client.teamId = result.team.id;
            client.sessionId = payload.sessionId;
          }
          socket.join("players");
          socket.join(`session_${payload.sessionId}`);
          socket.join(`team_${result.team.id}`);

          console.log(`[Lobby] Team reconnected: "${result.team.name}" (Slot ${result.team.slotNumber}) in ${payload.sessionId}`);

          const lobbyData = getLobbyPayload(payload.sessionId);
          if (lobbyData) {
            io.emit("lobby:updated", lobbyData);
          }
          io.emit("server:clients_updated", getClientCounts());

          // Send power-up assignment for reconnected team
          const myAssignment = getTeamPowerUp(payload.sessionId, payload.teamId);
          if (myAssignment) {
            socket.emit("powerup:assigned", myAssignment);
          }

          // Check if active quiz in progress for reconnecting player
          const active = activeQuizMap.get(payload.sessionId);
          if (active) {
            const q = getQuestionById(active.questionId);
            if (q) {
              const questions = getQuestions(payload.sessionId);
              const qIndex = questions.findIndex((item) => item.id === q.id);
              activeQuizQ = createSanitizedClientQuestion(
                q,
                payload.sessionId,
                active.startedAt,
                active.deadline,
                qIndex >= 0 ? qIndex + 1 : 1,
                questions.length,
                payload.teamId
              );

              const teamSub = getTeamSubmission(payload.sessionId, q.id, payload.teamId);
              if (teamSub) {
                hasSubmitted = true;
                submittedChoice = teamSub.selected_choice as QuizChoice;
              }
            }

            // Sync current question spell and restriction state
            const teamStatus = getTeamStatusForQuestion(payload.sessionId, active.questionId, payload.teamId);
            const spellState = questionSpellsMap.get(payload.sessionId);
            socket.emit("powerup:state_updated", {
              activeSpells: spellState ? spellState.activeSpells : [],
              teamStatus,
            });
          }
        } else {
          console.log(`[Lobby] Reconnection rejected for team ${payload.teamId}: ${result.error}`);
        }

        const reconnectPayload = {
          ...result,
          activeQuiz: activeQuizQ,
          hasSubmitted,
          submittedChoice,
        };

        socket.emit("team:reconnected", reconnectPayload);
        if (callback) callback(reconnectPayload);
      });


      // Admin: Kick / remove team from lobby (Strictly authenticated)
      socket.on("admin:kick_team", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke admin:kick_team from socket ${socket.id}`);
          if (callback) callback(false);
          return;
        }

        const success = removeTeam(payload.sessionId, payload.teamId);
        if (success) {
          console.log(`[Lobby] Admin removed team ${payload.teamId} from ${payload.sessionId}`);
          const lobbyData = getLobbyPayload(payload.sessionId);
          if (lobbyData) {
            io.emit("lobby:updated", lobbyData);
          }
        }
        if (callback) callback(success);
      });

      // Admin: Rename a team (Strictly authenticated)
      socket.on("admin:rename_team", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke admin:rename_team from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Administrator session required." });
          return;
        }

        const res = renameTeam(payload.sessionId, payload.teamId, payload.newName);
        if (res.success) {
          console.log(`[Lobby] Admin renamed team ${payload.teamId} to "${payload.newName}" in ${payload.sessionId}`);
          const lobbyData = getLobbyPayload(payload.sessionId);
          if (lobbyData) {
            io.emit("lobby:updated", lobbyData);
          }
        }
        if (callback) callback(res);
      });

      // Admin: Reset all registrations (Strictly authenticated)
      socket.on("admin:reset_registration", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke admin:reset_registration from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Administrator session required." });
          return;
        }

        const success = resetSessionTeams(payload.sessionId);
        if (success) {
          console.log(`[Lobby] Admin reset all registrations in ${payload.sessionId}`);
          const lobbyData = getLobbyPayload(payload.sessionId);
          if (lobbyData) {
            io.emit("lobby:updated", lobbyData);
          }
        }
        if (callback) callback({ success });
      });

      // Latency measurement (ping/pong)
      socket.on("client:ping", (payload) => {
        const now = Date.now();
        const latency = Math.max(0, now - payload.clientTimestamp);
        socket.emit("server:pong", {
          clientTimestamp: payload.clientTimestamp,
          serverTimestamp: now,
          latencyMs: latency,
        });
      });

      // Administrator test broadcast (Strictly authenticated)
      socket.on("admin:test_broadcast", (payload) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke admin:test_broadcast from socket ${socket.id}`);
          return;
        }

        console.log(`[Socket] Admin broadcast test: "${payload.message}"`);
        io.emit("server:broadcast_test", {
          message: payload.message,
          timestamp: Date.now(),
          from: "Admin (Presenter)",
        });
      });

      // Player buzzer test
      socket.on("player:test_buzzer", (payload) => {
        const senderName = payload.playerName || "Team Player";
        console.log(`[Socket] Player test buzzer triggered by ${senderName}`);
        io.emit("server:broadcast_test", {
          message: `🔔 Buzzer signal received from ${senderName}!`,
          timestamp: Date.now(),
          from: senderName,
        });
      });

      // =======================================================
      //  QUIZ MANAGEMENT & REAL-TIME ENGINE EVENTS
      // =======================================================

      // Question Bank Management (Strictly authenticated to prevent question/answer leakage)
      socket.on("quiz:get_questions", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke quiz:get_questions from socket ${socket.id}`);
          if (callback) callback([]);
          return;
        }

        const questions = getQuestions(payload.sessionId);
        if (callback) callback(questions);
      });

      socket.on("quiz:save_question", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke quiz:save_question from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Administrator session required." });
          return;
        }

        try {
          const saved = saveQuestion(payload.question);
          console.log(`[Quiz] Saved question: ${saved.id} ("${saved.questionText.slice(0, 30)}...")`);
          if (callback) callback({ success: true, question: saved });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (callback) callback({ success: false, error: msg });
        }
      });

      socket.on("quiz:delete_question", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke quiz:delete_question from socket ${socket.id}`);
          if (callback) callback(false);
          return;
        }

        const success = deleteQuestion(payload.questionId);
        console.log(`[Quiz] Deleted question ${payload.questionId}: ${success}`);
        if (callback) callback(success);
      });

      // Admin: Clear all questions in question bank (Strictly authenticated)
      socket.on("quiz:clear_questions", (_payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke quiz:clear_questions from socket ${socket.id}`);
          if (callback) callback(false);
          return;
        }

        const success = clearAllQuestions();
        console.log(`[Quiz] All questions in repository cleared: ${success}`);
        if (callback) callback(success);
      });

      // Admin: Reorder questions (Strictly authenticated)
      socket.on("quiz:reorder_questions", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke quiz:reorder_questions from socket ${socket.id}`);
          if (callback) callback(false);
          return;
        }

        const success = reorderQuestions(payload.questionIds);
        if (callback) callback(success);
      });

      // Activate Surprise Quiz (Strictly authenticated)
      socket.on("quiz:activate_surprise", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke quiz:activate_surprise from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Administrator session required." });
          return;
        }

        const sessionId = payload.sessionId;
        const session = getSessionById(sessionId);
        if (!session) {
          if (callback) callback({ success: false, error: "Game session not found." });
          return;
        }

        // Clear existing timer if any
        const existing = activeQuizMap.get(sessionId);
        if (existing?.timer) {
          clearTimeout(existing.timer);
        }

        const questions = getQuestions(sessionId);
        if (questions.length === 0) {
          if (callback) callback({ success: false, error: "No prepared questions available in question bank." });
          return;
        }

        let selectedQ: QuizQuestion | undefined;
        if (payload.questionId) {
          selectedQ = questions.find((q) => q.id === payload.questionId);
        }

        if (!selectedQ) {
          selectedQ = questions[0];
        }

        // Auto-assign power-ups to all registered teams if unassigned so teams have their spells
        const sessionTeams = getTeamsForSession(sessionId);
        const existingPu = getAllTeamPowerUps(sessionId);
        if (sessionTeams.length > 0 && existingPu.length === 0) {
          const assignments = assignPowerUpsToTeams(sessionId, true);
          io.to("admins").emit("powerup:all_assigned", assignments);
          for (const [sId, c] of connectedClients.entries()) {
            if (c.role === "player" && c.teamId && c.sessionId === sessionId) {
              const myAssignment = assignments.find((a) => a.teamId === c.teamId);
              if (myAssignment) io.to(sId).emit("powerup:assigned", myAssignment);
            }
          }
          for (const a of assignments) {
            io.to(`team_${a.teamId}`).emit("powerup:assigned", a);
          }
          console.log(`[PowerUp] Auto-assigned power-ups to ${assignments.length} teams before question activation`);
        }

        const startedAt = Date.now();
        const deadline = startedAt + selectedQ.timeLimit * 1000;

        setSessionActiveQuiz(sessionId, selectedQ.id, startedAt, deadline);

        // Reset spells for new question (effects apply only to current question)
        resetQuestionSpells(sessionId, selectedQ.id);

        const qIndex = questions.findIndex((q) => q.id === selectedQ!.id);
        const clientQ = createClientQuestion(
          selectedQ,
          sessionId,
          startedAt,
          deadline,
          qIndex >= 0 ? qIndex + 1 : 1,
          questions.length
        );

        // Schedule server-authoritative timer for expiration
        const durationMs = selectedQ.timeLimit * 1000;
        const timer = setTimeout(() => {
          handleEndQuiz(sessionId, selectedQ!.id);
        }, durationMs);

        activeQuizMap.set(sessionId, {
          sessionId,
          questionId: selectedQ.id,
          startedAt,
          deadline,
          timer,
          lastResults: null,
        });

        console.log(
          `[Quiz] 🚨 SURPRISE QUIZ ACTIVATED in ${sessionId}: "${selectedQ.questionText}" (${selectedQ.timeLimit}s, ${selectedQ.points}pts)`
        );

        // Broadcast question to all connected clients (Admin, Players, Spectators)
        io.emit("quiz:started", clientQ);

        // Broadcast clean power-up state for new question
        broadcastPowerUpStates(sessionId, selectedQ.id);

        // Broadcast lobby update
        const lobbyData = getLobbyPayload(sessionId);
        if (lobbyData) {
          io.emit("lobby:updated", lobbyData);
        }

        if (callback) callback({ success: true });
      });

      // Administrator manually ends active quiz early (Strictly authenticated)
      socket.on("quiz:end_question", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke quiz:end_question from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Administrator session required." });
          return;
        }

        const active = activeQuizMap.get(payload.sessionId);
        if (!active) {
          if (callback) callback({ success: false, error: "No quiz question is currently active." });
          return;
        }

        handleEndQuiz(payload.sessionId, active.questionId);
        if (callback) callback({ success: true });
      });

      // Player submits answer
      socket.on("quiz:submit_answer", (payload, callback) => {
        // Modular power-up eligibility check
        const eligibility = isTeamEligibleToAnswer(payload.teamId, payload.questionId);
        if (!eligibility.allowed) {
          if (callback) callback({ success: false, error: eligibility.reason || "Team is not allowed to answer." });
          return;
        }

        // Check if team is locked down by a Lockdown spell
        const spellState = questionSpellsMap.get(payload.sessionId);
        if (spellState && spellState.questionId === payload.questionId && spellState.lockedDownTeamIds.has(payload.teamId)) {
          if (callback)
            callback({
              success: false,
              error: "Your team is locked down by a Lockdown Spell for this question!",
            });
          return;
        }

        // Check if team requires solving a riddle first
        if (spellState && spellState.questionId === payload.questionId && spellState.activeRiddle) {
          if (!spellState.activeRiddle.exemptTeamIds.has(payload.teamId)) {
            const rStatus = getTeamRiddleStatus(payload.sessionId, payload.questionId, payload.teamId);
            if (!rStatus.isSolved) {
              if (callback)
                callback({
                  success: false,
                  error: "You must solve the active riddle before submitting your answer!",
                });
              return;
            }
          }
        }

        const chosenAnswer = payload.choice || (payload as { selectedChoice?: QuizChoice }).selectedChoice || "";
        const result = recordSubmission(
          payload.sessionId,
          payload.teamId,
          payload.token,
          payload.questionId,
          chosenAnswer
        );

        if (result.success) {
          console.log(
            `[Quiz] Valid submission: Team ${payload.teamId} locked in choice [${chosenAnswer}] for question ${payload.questionId}`
          );

          // Broadcast submission progress to all clients without revealing choices
          const subs = getQuestionSubmissions(payload.sessionId, payload.questionId);
          const teams = getTeamsForSession(payload.sessionId);
          const progress: QuizProgressPayload = {
            questionId: payload.questionId,
            submittedCount: subs.length,
            totalTeams: teams.length,
            submittedTeamIds: subs.map((s) => s.team_id),
          };
          io.emit("quiz:progress", progress);

          if (callback)
            callback({
              success: true,
              selectedChoice: result.selectedChoice,
              submittedAt: result.submittedAt,
            });
        } else {
          console.log(`[Quiz] Submission rejected for Team ${payload.teamId}: ${result.error}`);
          if (callback) callback({ success: false, error: result.error });
        }
      });

      // Query current quiz state
      socket.on("quiz:get_state", (payload, callback) => {
        const active = activeQuizMap.get(payload.sessionId);
        let clientQ: ClientQuizQuestion | null = null;
        let hasSubmitted = false;
        let submittedChoice: QuizChoice | null = null;

        if (active) {
          const q = getQuestionById(active.questionId);
          if (q) {
            const questions = getQuestions(payload.sessionId);
            const qIndex = questions.findIndex((item) => item.id === q.id);
            clientQ = createSanitizedClientQuestion(
              q,
              payload.sessionId,
              active.startedAt,
              active.deadline,
              qIndex >= 0 ? qIndex + 1 : 1,
              questions.length,
              payload.teamId
            );

            if (payload.teamId) {
              const teamSub = getTeamSubmission(payload.sessionId, q.id, payload.teamId);
              if (teamSub) {
                hasSubmitted = true;
                submittedChoice = teamSub.selected_choice as QuizChoice;
              }
            }
          }
        }

        if (callback) {
          callback({
            isQuizActive: !!active && !!clientQ,
            currentQuestion: clientQ,
            hasSubmitted,
            submittedChoice,
            lastResult: active?.lastResults || null,
          });
        }
      });

      // =======================================================
      //  POWER-UP SYSTEM CONTROLS & SECURITY HANDLERS
      // =======================================================

      // Admin explicitly shuffles and re-randomizes power-ups for all teams (Strictly authenticated)
      socket.on("powerup:shuffle", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke powerup:shuffle from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Admin session required." });
          return;
        }

        const result = shufflePowerUpsToTeams(payload.sessionId);
        if (result.success) {
          console.log(
            `[PowerUp] Shuffled power-ups for session ${payload.sessionId}:`,
            result.assignments.map((a) => `${a.teamName}: ${a.powerUpType}`).join(", ")
          );
          // Broadcast full table of assignments to authenticated administrators
          io.to("admins").emit("powerup:all_assigned", result.assignments);
          // Broadcast individual assignment to each connected player
          for (const [sId, c] of connectedClients.entries()) {
            if (c.role === "player" && c.teamId && c.sessionId === payload.sessionId) {
              const myAssignment = result.assignments.find((a) => a.teamId === c.teamId);
              if (myAssignment) {
                io.to(sId).emit("powerup:assigned", myAssignment);
              }
            }
          }
          for (const a of result.assignments) {
            io.to(`team_${a.teamId}`).emit("powerup:assigned", a);
          }
        }
        if (callback) callback(result);
      });

      // Admin assigns power-ups to all registered teams (Strictly authenticated)
      socket.on("powerup:assign_all", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke powerup:assign_all from socket ${socket.id}`);
          if (callback) callback([]);
          return;
        }

        const isShuffle = Boolean((payload as { shuffle?: boolean })?.shuffle);
        const assignments = assignPowerUpsToTeams(payload.sessionId, isShuffle);
        // Isolate full table of assignments strictly to authenticated administrators
        io.to("admins").emit("powerup:all_assigned", assignments);
        for (const [sId, c] of connectedClients.entries()) {
          if (c.role === "player" && c.teamId && c.sessionId === payload.sessionId) {
            const myAssignment = assignments.find((a) => a.teamId === c.teamId);
            if (myAssignment) {
              io.to(sId).emit("powerup:assigned", myAssignment);
            }
          }
        }
        for (const a of assignments) {
          io.to(`team_${a.teamId}`).emit("powerup:assigned", a);
        }
        if (callback) callback(assignments);
      });

      // Administrator queries all power-up assignments (Strictly authenticated)
      socket.on("powerup:get_all", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke powerup:get_all from socket ${socket.id}`);
          if (callback) callback([]);
          return;
        }

        const assignments = getAllTeamPowerUps(payload.sessionId);
        if (callback) callback(assignments);
      });

      // Player queries their own power-up assignment
      socket.on("powerup:get_my", (payload, callback) => {
        const assignment = getTeamPowerUp(payload.sessionId, payload.teamId);
        if (callback) callback(assignment);
      });

      // Player activates their assigned power-up during an active question
      socket.on("powerup:activate", (payload, callback) => {
        const { sessionId, teamId, token, questionId } = payload;

        const activeClincher = activeClincherMap.get(sessionId);
        if (activeClincher && !activeClincher.allowPowerUps) {
          if (callback) callback({ success: false, error: "Power-ups are disabled during the Clincher round." });
          return;
        }

        const active = activeQuizMap.get(sessionId);
        if (!active || active.questionId !== questionId) {
          if (callback) callback({ success: false, error: "Power-up can only be activated during an active question." });
          return;
        }

        const teamRecord = getTeamById(teamId);
        if (!teamRecord || teamRecord.session_id !== sessionId || teamRecord.token !== token) {
          if (callback) callback({ success: false, error: "Unauthorized power-up activation attempt." });
          return;
        }

        const teams = getTeamsForSession(sessionId);
        const team = teams.find((t) => t.id === teamId);
        if (!team) {
          if (callback) callback({ success: false, error: "Team not found in session." });
          return;
        }

        const myPowerUp = getTeamPowerUp(sessionId, teamId);
        if (!myPowerUp) {
          if (callback) callback({ success: false, error: "No power-up assigned to this team." });
          return;
        }

        if (myPowerUp.isUsed) {
          if (callback) callback({ success: false, error: "This power-up has already been used this game." });
          return;
        }

        // Atomically consume power-up in SQLite to prevent duplicate or race condition activations
        const marked = markPowerUpUsed(sessionId, teamId, questionId);
        if (!marked) {
          if (callback) callback({ success: false, error: "Power-up is already consumed or in an invalid state." });
          return;
        }

        // Ensure active question spell state exists
        let spellState = questionSpellsMap.get(sessionId);
        if (!spellState || spellState.questionId !== questionId) {
          resetQuestionSpells(sessionId, questionId);
          spellState = questionSpellsMap.get(sessionId)!;
        }

        const opposingTeams = teams.filter((t) => t.id !== teamId);
        let spellEffect: ActiveSpellEffect;
        let answerRevealChoice: QuizChoice | undefined = undefined;

        if (myPowerUp.powerUpType === "back_to_sender") {
          spellState.shieldedTeamIds.add(teamId);

          // Counter-reflect any active spells on this question that target this team
          for (const existingSpell of spellState.activeSpells) {
            if (!existingSpell.isReflected && existingSpell.affectedTeamIds.includes(teamId)) {
              existingSpell.isReflected = true;
              existingSpell.reflectedByTeamId = teamId;
              existingSpell.reflectedByTeamName = team.name;
              existingSpell.outcome = "reflected";

              // Apply penalties directly to original caster
              if (existingSpell.powerUpType === "lockdown") {
                spellState.lockedDownTeamIds.delete(teamId);
                spellState.lockedDownTeamIds.add(existingSpell.casterTeamId);
              } else if (existingSpell.powerUpType === "invisibility") {
                spellState.invisibilityAffectedTeamIds.delete(teamId);
                spellState.invisibilityAffectedTeamIds.add(existingSpell.casterTeamId);
              } else if (existingSpell.powerUpType === "riddle" && spellState.activeRiddle) {
                spellState.activeRiddle.exemptTeamIds.add(teamId);
                spellState.activeRiddle.exemptTeamIds.delete(existingSpell.casterTeamId);
              }
            }
          }

          const effId = recordSpellEffect(
            sessionId,
            questionId,
            teamId,
            "back_to_sender",
            "shielded",
            false,
            null,
            null
          );

          spellEffect = {
            id: effId,
            casterTeamId: teamId,
            casterTeamName: team.name,
            powerUpType: "back_to_sender",
            questionId,
            activatedAt: Date.now(),
            isReflected: false,
            outcome: "shielded",
            affectedTeamIds: [teamId],
          };
          spellState.activeSpells.push(spellEffect);

        } else if (myPowerUp.powerUpType === "invisibility") {
          const reflector = opposingTeams.find((t) => spellState!.shieldedTeamIds.has(t.id));
          if (reflector) {
            // Reflected! Caster loses choices, reflector sees choices normally
            spellState.invisibilityAffectedTeamIds.add(teamId);
            for (const opp of opposingTeams) {
              if (opp.id !== reflector.id) {
                spellState.invisibilityAffectedTeamIds.add(opp.id);
              }
            }
            const effId = recordSpellEffect(
              sessionId,
              questionId,
              teamId,
              "invisibility",
              "reflected",
              true,
              reflector.id,
              null
            );
            spellEffect = {
              id: effId,
              casterTeamId: teamId,
              casterTeamName: team.name,
              powerUpType: "invisibility",
              questionId,
              activatedAt: Date.now(),
              isReflected: true,
              reflectedByTeamId: reflector.id,
              reflectedByTeamName: reflector.name,
              outcome: "reflected",
              affectedTeamIds: Array.from(spellState.invisibilityAffectedTeamIds),
            };
          } else {
            for (const opp of opposingTeams) {
              spellState.invisibilityAffectedTeamIds.add(opp.id);
            }
            const effId = recordSpellEffect(
              sessionId,
              questionId,
              teamId,
              "invisibility",
              "applied",
              false,
              null,
              null
            );
            spellEffect = {
              id: effId,
              casterTeamId: teamId,
              casterTeamName: team.name,
              powerUpType: "invisibility",
              questionId,
              activatedAt: Date.now(),
              isReflected: false,
              outcome: "applied",
              affectedTeamIds: opposingTeams.map((t) => t.id),
            };
          }
          spellState.activeSpells.push(spellEffect);

        } else if (myPowerUp.powerUpType === "lockdown") {
          const reflector = opposingTeams.find((t) => spellState!.shieldedTeamIds.has(t.id));
          if (reflector) {
            // Reflected! Caster locked down, reflector is exempt
            spellState.lockedDownTeamIds.add(teamId);
            for (const opp of opposingTeams) {
              if (opp.id !== reflector.id) {
                spellState.lockedDownTeamIds.add(opp.id);
              }
            }
            const effId = recordSpellEffect(
              sessionId,
              questionId,
              teamId,
              "lockdown",
              "reflected",
              true,
              reflector.id,
              null
            );
            spellEffect = {
              id: effId,
              casterTeamId: teamId,
              casterTeamName: team.name,
              powerUpType: "lockdown",
              questionId,
              activatedAt: Date.now(),
              isReflected: true,
              reflectedByTeamId: reflector.id,
              reflectedByTeamName: reflector.name,
              outcome: "reflected",
              affectedTeamIds: Array.from(spellState.lockedDownTeamIds),
            };
          } else {
            for (const opp of opposingTeams) {
              spellState.lockedDownTeamIds.add(opp.id);
            }
            const effId = recordSpellEffect(
              sessionId,
              questionId,
              teamId,
              "lockdown",
              "applied",
              false,
              null,
              null
            );
            spellEffect = {
              id: effId,
              casterTeamId: teamId,
              casterTeamName: team.name,
              powerUpType: "lockdown",
              questionId,
              activatedAt: Date.now(),
              isReflected: false,
              outcome: "applied",
              affectedTeamIds: opposingTeams.map((t) => t.id),
            };
          }
          spellState.activeSpells.push(spellEffect);

        } else if (myPowerUp.powerUpType === "riddle") {
          const riddle = getRandomRiddle() || {
            id: "riddle_default",
            questionText: "What has to be broken before you can use it?",
            acceptedAnswers: ["egg", "an egg"],
            hint: "Breakfast food",
          };

          spellState.activeRiddle = {
            riddleId: riddle.id,
            riddleClient: {
              id: riddle.id,
              questionText: riddle.questionText,
              hint: riddle.hint,
            },
            exemptTeamIds: new Set([teamId]),
          };

          const reflector = opposingTeams.find((t) => spellState!.shieldedTeamIds.has(t.id));
          if (reflector) {
            // Reflected! Reflector exempt, Caster must solve riddle
            spellState.activeRiddle.exemptTeamIds.add(reflector.id);
            spellState.activeRiddle.exemptTeamIds.delete(teamId);

            const effId = recordSpellEffect(
              sessionId,
              questionId,
              teamId,
              "riddle",
              "reflected",
              true,
              reflector.id,
              riddle.id
            );
            spellEffect = {
              id: effId,
              casterTeamId: teamId,
              casterTeamName: team.name,
              powerUpType: "riddle",
              questionId,
              activatedAt: Date.now(),
              isReflected: true,
              reflectedByTeamId: reflector.id,
              reflectedByTeamName: reflector.name,
              outcome: "reflected",
              affectedTeamIds: teams.filter((t) => !spellState!.activeRiddle!.exemptTeamIds.has(t.id)).map((t) => t.id),
              riddle: spellState.activeRiddle.riddleClient,
            };
          } else {
            const effId = recordSpellEffect(
              sessionId,
              questionId,
              teamId,
              "riddle",
              "applied",
              false,
              null,
              riddle.id
            );
            spellEffect = {
              id: effId,
              casterTeamId: teamId,
              casterTeamName: team.name,
              powerUpType: "riddle",
              questionId,
              activatedAt: Date.now(),
              isReflected: false,
              outcome: "applied",
              affectedTeamIds: opposingTeams.map((t) => t.id),
              riddle: spellState.activeRiddle.riddleClient,
            };
          }
          spellState.activeSpells.push(spellEffect);

        } else if (myPowerUp.powerUpType === "answer_reveal") {
          const q = getQuestionById(questionId);
          answerRevealChoice = q ? q.correctAnswer : undefined;

          // PRIVATELY reveal correct answer strictly to the caster
          if (q) {
            socket.emit("powerup:answer_revealed", {
              questionId,
              correctAnswer: q.correctAnswer,
              points: q.points,
            });
          }

          const effId = recordSpellEffect(
            sessionId,
            questionId,
            teamId,
            "answer_reveal",
            "applied",
            false,
            null,
            null
          );
          spellEffect = {
            id: effId,
            casterTeamId: teamId,
            casterTeamName: team.name,
            powerUpType: "answer_reveal",
            questionId,
            activatedAt: Date.now(),
            isReflected: false,
            outcome: "applied",
            affectedTeamIds: [teamId],
          };
          spellState.activeSpells.push(spellEffect);
        } else {
          if (callback) callback({ success: false, error: "Unknown power-up type." });
          return;
        }

        console.log(`[PowerUp] ${team.name} activated ${myPowerUp.powerUpName} on question ${questionId}. Outcome: ${spellEffect.outcome}`);

        // Broadcast notification of activation (does NOT contain any answers)
        io.emit("powerup:activated", {
          spell: spellEffect,
          message: `${team.name} unleashed ${myPowerUp.powerUpName}!`,
        });

        // Broadcast updated states to all connected clients
        broadcastPowerUpStates(sessionId, questionId);

        if (callback) {
          callback({
            success: true,
            spell: spellEffect,
            answerReveal: answerRevealChoice,
          });
        }
      });

      // Player submits riddle answer
      socket.on("powerup:solve_riddle", (payload, callback) => {
        const { sessionId, teamId, token, questionId, riddleId, answer } = payload;
        const teamRecord = getTeamById(teamId);
        if (!teamRecord || teamRecord.session_id !== sessionId || teamRecord.token !== token) {
          if (callback) callback({ success: false, error: "Unauthorized riddle attempt." });
          return;
        }

        const teams = getTeamsForSession(sessionId);
        const team = teams.find((t) => t.id === teamId);
        if (!team) {
          if (callback) callback({ success: false, error: "Team not found in session." });
          return;
        }

        const res = checkAndSolveRiddle(sessionId, questionId, teamId, riddleId, answer);
        if (res.success) {
          console.log(`[Riddle] Team ${team.name} correctly solved riddle ${riddleId}!`);
          socket.emit("powerup:riddle_unlocked", { questionId, success: true });
          const teamStatus = getTeamStatusForQuestion(sessionId, questionId, teamId);
          const spellState = questionSpellsMap.get(sessionId);
          socket.emit("powerup:state_updated", {
            activeSpells: spellState ? spellState.activeSpells : [],
            teamStatus,
          });
        } else {
          console.log(`[Riddle] Team ${team.name} submitted incorrect riddle answer: "${answer}"`);
        }
        if (callback) callback(res);
      });

      // Admin resolves stuck question restrictions safely without score mutation (Strictly authenticated)
      socket.on("powerup:admin_resolve_stuck", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke powerup:admin_resolve_stuck from socket ${socket.id}`);
          if (callback) callback({ success: false, message: "Unauthorized: Administrator session required." });
          return;
        }

        const { sessionId } = payload;
        const active = activeQuizMap.get(sessionId);
        if (!active) {
          if (callback) callback({ success: false, message: "No active question to resolve." });
          return;
        }

        const spellState = questionSpellsMap.get(sessionId);
        if (spellState) {
          spellState.lockedDownTeamIds.clear();
          spellState.activeRiddle = null;
          spellState.invisibilityAffectedTeamIds.clear();
        }

        resolveStuckQuestionDb(sessionId, active.questionId);
        console.log(`[Admin] Stuck question restrictions safely resolved for session ${sessionId}, question ${active.questionId}`);

        broadcastPowerUpStates(sessionId, active.questionId);
        if (callback) callback({ success: true, message: "Active question restrictions safely resolved without score changes." });
      });

      // =======================================================
      //  LEADERBOARD & CLINCHER ROUND SOCKET LISTENERS
      // =======================================================

      // Admin ends presentation game and generates final standings (Strictly authenticated)
      socket.on("session:end_game", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke session:end_game from socket ${socket.id}`);
          if (callback) {
            callback({
              sessionId: payload.sessionId,
              sessionTitle: "",
              isFinished: true,
              entries: [],
              hasTieForFirst: false,
              tiedFirstPlaceTeamIds: [],
              winner: null,
            });
          }
          return;
        }

        const lb = endGameSession(payload.sessionId);
        console.log(`[Game] Admin ended game for session ${payload.sessionId}. Winner: ${lb.winner?.teamName || "TIE"}`);
        io.emit("session:game_ended", lb);
        io.emit("leaderboard:updated", lb);
        const lobbyData = getLobbyPayload(payload.sessionId);
        if (lobbyData) io.emit("lobby:updated", lobbyData);
        if (callback) callback(lb);
      });

      // Get authoritative final leaderboard
      socket.on("session:get_leaderboard", (payload, callback) => {
        const lb = getLeaderboard(payload.sessionId);
        if (callback) callback(lb);
      });

      // Start Clincher round for tied teams (Strictly authenticated)
      socket.on("clincher:start_round", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke clincher:start_round from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Administrator session required." });
          return;
        }

        const { sessionId, questionId, timeLimit, allowPowerUps } = payload;
        const existingClincher = activeClincherMap.get(sessionId);
        if (existingClincher?.timer) {
          clearTimeout(existingClincher.timer);
        }

        let contenders: string[] | undefined = undefined;
        if (existingClincher && existingClincher.contendingTeamIds.length > 0) {
          contenders = existingClincher.contendingTeamIds;
        }

        const roundRecord = createClincherRound(
          sessionId,
          questionId,
          timeLimit || 15,
          allowPowerUps || false,
          contenders
        );

        const q = getQuestionById(roundRecord.question_id);
        if (!q) {
          if (callback) callback({ success: false, error: "Clincher question not found." });
          return;
        }

        const contendingIds: string[] = JSON.parse(roundRecord.contending_team_ids);
        const clientQ = createClientQuestion(
          q,
          sessionId,
          roundRecord.started_at,
          roundRecord.deadline,
          roundRecord.round_number,
          roundRecord.round_number
        );

        const durationMs = roundRecord.time_limit * 1000;
        const timer = setTimeout(() => {
          handleEndClincherRound(sessionId);
        }, durationMs);

        const clincherState: ActiveClincherState = {
          sessionId,
          clincherRoundId: roundRecord.id,
          roundNumber: roundRecord.round_number,
          questionId: roundRecord.question_id,
          contendingTeamIds: contendingIds,
          allowPowerUps: roundRecord.allow_powerups === 1,
          startedAt: roundRecord.started_at,
          deadline: roundRecord.deadline,
          timeLimit: roundRecord.time_limit,
          timer,
          lastRoundResult: null,
        };
        activeClincherMap.set(sessionId, clincherState);

        const clincherPayload: ClincherStatePayload = {
          roundNumber: roundRecord.round_number,
          question: clientQ,
          contendingTeamIds: contendingIds,
          allowPowerUps: roundRecord.allow_powerups === 1,
          startedAt: roundRecord.started_at,
          deadline: roundRecord.deadline,
          timeLimit: roundRecord.time_limit,
          lastRoundResult: null,
        };

        console.log(`[Clincher] ⚔️ CLINCHER ROUND ${roundRecord.round_number} ACTIVATED in ${sessionId} for ${contendingIds.length} teams: "${q.questionText}"`);
        io.emit("clincher:started", clincherPayload);

        const lobbyData = getLobbyPayload(sessionId);
        if (lobbyData) io.emit("lobby:updated", lobbyData);

        if (callback) callback({ success: true, clincher: clincherPayload });
      });

      // Submit answer for active clincher round
      socket.on("clincher:submit_answer", (payload, callback) => {
        const { sessionId, teamId, token, questionId, choice } = payload;
        const activeClincher = activeClincherMap.get(sessionId);
        if (!activeClincher || activeClincher.questionId !== questionId) {
          if (callback) callback({ success: false, error: "This clincher question is no longer active." });
          return;
        }

        const res = recordClincherSubmission(sessionId, activeClincher.clincherRoundId, teamId, token, choice);
        if (res.success) {
          console.log(`[Clincher] Team ${teamId} locked in choice [${choice}] for clincher round ${activeClincher.roundNumber}`);
          const subs = getClincherSubmissionsForRound(activeClincher.clincherRoundId);
          io.emit("clincher:progress", {
            roundNumber: activeClincher.roundNumber,
            submittedCount: subs.length,
            totalContenders: activeClincher.contendingTeamIds.length,
          });

          // End round early if all contending teams have submitted
          if (subs.length >= activeClincher.contendingTeamIds.length) {
            handleEndClincherRound(sessionId);
          }
        }
        if (callback) callback(res);
      });

      // Admin ends active clincher round early (Strictly authenticated)
      socket.on("clincher:end_round", (payload, callback) => {
        if (!isAuthorizedAdminSocket(socket)) {
          console.warn(`[Security] Unauthorized attempt to invoke clincher:end_round from socket ${socket.id}`);
          if (callback) callback({ success: false, error: "Unauthorized: Administrator session required." });
          return;
        }

        const result = handleEndClincherRound(payload.sessionId);
        if (callback) callback({ success: true, result: result || lastClincherResultMap.get(payload.sessionId) || undefined });
      });

      // Query active clincher state
      socket.on("clincher:get_state", (payload, callback) => {
        const activeClincher = activeClincherMap.get(payload.sessionId);
        if (!activeClincher) {
          if (callback) callback(null);
          return;
        }
        const q = getQuestionById(activeClincher.questionId);
        if (!q) {
          if (callback) callback(null);
          return;
        }
        const clientQ = createClientQuestion(
          q,
          payload.sessionId,
          activeClincher.startedAt,
          activeClincher.deadline,
          activeClincher.roundNumber,
          activeClincher.roundNumber,
          payload.teamId
        );
        if (callback) {
          callback({
            roundNumber: activeClincher.roundNumber,
            question: clientQ,
            contendingTeamIds: activeClincher.contendingTeamIds,
            allowPowerUps: activeClincher.allowPowerUps,
            startedAt: activeClincher.startedAt,
            deadline: activeClincher.deadline,
            timeLimit: activeClincher.timeLimit,
            lastRoundResult: activeClincher.lastRoundResult || null,
          });
        }
      });


      // Disconnect handling
      socket.on("disconnect", () => {
        const client = connectedClients.get(socket.id);
        if (client?.teamId && client?.sessionId) {
          // Mark team as disconnected in database
          updateTeamConnection(client.teamId, false);
          console.log(`[Lobby] Team ${client.name || client.teamId} went offline`);

          // Broadcast updated lobby with offline status
          const lobbyData = getLobbyPayload(client.sessionId);
          if (lobbyData) {
            io.emit("lobby:updated", lobbyData);
          }
        }

        connectedClients.delete(socket.id);
        io.emit("server:clients_updated", getClientCounts());
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });

    httpServer.listen(port, hostname, () => {
      console.log("\n=======================================================");
      console.log("  🎮 CLASSROOM QUIZ BATTLE - LOCAL SERVER ONLINE");
      console.log("=======================================================");
      console.log(`  Localhost (laptop):    http://localhost:${port}`);
      if (networkInterfaces.length > 0) {
        console.log(`  Wi-Fi IP (for phones): http://${primaryIp}:${port}  <-- USE THIS ON SMARTPHONES`);
        if (networkInterfaces.length > 1) {
          for (let i = 1; i < networkInterfaces.length; i++) {
            const iface = networkInterfaces[i];
            const tag = iface.isVirtual ? "(virtual/host-only adapter - DO NOT USE FOR PHONES)" : "(secondary network)";
            console.log(`  Other adapter [${iface.name}]: http://${iface.address}:${port} ${tag}`);
          }
        }
      } else {
        console.log("  Wi-Fi network: No external Wi-Fi IP detected (connected to localhost only)");
      }
      console.log("-------------------------------------------------------");
      console.log("  Admin URL:             /admin");
      console.log("  Player URL:            /player");
      console.log("=======================================================\n");
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
