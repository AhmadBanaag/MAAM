import type { GameSession, TeamLobbyInfo } from "@/lib/db";

export type ClientRole = "admin" | "player" | "spectator";
export type QuizChoice = "A" | "B" | "C" | "D";

export interface ClientRegisterPayload {
  role: ClientRole;
  name?: string;
  teamId?: string;
  sessionId?: string;
}

export interface PingPayload {
  clientTimestamp: number;
}

export interface PongPayload {
  clientTimestamp: number;
  serverTimestamp: number;
  latencyMs: number;
}

export interface ServerConnectedPayload {
  socketId: string;
  serverTimestamp: number;
  serverIp: string;
  activeClients: {
    admins: number;
    players: number;
    total: number;
  };
  currentSession: GameSession | null;
}

export interface ClientsUpdatedPayload {
  admins: number;
  players: number;
  total: number;
}

export interface BroadcastTestPayload {
  message: string;
  timestamp: number;
  from: string;
}

export interface TeamRegisterRequest {
  sessionId: string;
  teamName: string;
  leaderName: string;
}

export interface TeamRegisterResponse {
  success: boolean;
  team?: TeamLobbyInfo;
  token?: string;
  error?: string;
}

export interface TeamReconnectRequest {
  sessionId: string;
  teamId: string;
  token: string;
}

export interface TeamReconnectResponse {
  success: boolean;
  team?: TeamLobbyInfo;
  error?: string;
  activeQuiz?: ClientQuizQuestion | null;
  hasSubmitted?: boolean;
  submittedChoice?: QuizChoice | null;
}

export interface LobbyUpdatedPayload {
  session: GameSession;
  teams: TeamLobbyInfo[];
  registeredCount: number;
  maxTeams: number;
}

// ----------------- Quiz Types -----------------

export interface QuizQuestion {
  id: string;
  sessionId?: string | null;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: QuizChoice;
  timeLimit: number; // in seconds
  points: number;
  orderNum: number;
  category?: string;
  explanation?: string;
  createdAt?: string;
}

// Player / Spectator safe question (NEVER contains correctAnswer)
export interface ClientQuizQuestion {
  id: string;
  sessionId: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  timeLimit: number;
  points: number;
  startedAt: number;
  deadline: number;
  questionNumber: number;
  totalQuestions: number;
}

export interface QuizSubmitRequest {
  sessionId: string;
  teamId: string;
  token: string;
  questionId: string;
  choice: QuizChoice;
}

export interface QuizSubmitResponse {
  success: boolean;
  selectedChoice?: QuizChoice;
  submittedAt?: number;
  error?: string;
}

export interface TeamSubmissionSummary {
  teamId: string;
  teamName: string;
  slotNumber: number;
  selectedChoice: QuizChoice | "NONE";
  isCorrect: boolean;
  pointsAwarded: number;
  submittedAt: number;
}

export interface QuestionResultsPayload {
  questionId: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: QuizChoice;
  submissions: TeamSubmissionSummary[];
  updatedTeams: TeamLobbyInfo[];
  summary: {
    totalTeams: number;
    submittedCount: number;
    correctCount: number;
  };
}

export interface QuizProgressPayload {
  questionId: string;
  submittedCount: number;
  totalTeams: number;
  submittedTeamIds: string[];
}

export interface ActiveQuizStatePayload {
  isQuizActive: boolean;
  currentQuestion: ClientQuizQuestion | null;
  hasSubmitted?: boolean;
  submittedChoice?: QuizChoice | null;
  lastResult: QuestionResultsPayload | null;
}

// ----------------- Power-Up Types -----------------

export type PowerUpType =
  | "invisibility"
  | "lockdown"
  | "back_to_sender"
  | "riddle"
  | "answer_reveal";

export interface PowerUpDefinition {
  type: PowerUpType;
  name: string;
  description: string;
  iconName: string;
}

export const POWER_UP_DEFINITIONS: Record<PowerUpType, PowerUpDefinition> = {
  invisibility: {
    type: "invisibility",
    name: "Invisibility Spell",
    description: "Hides answer choice text from opposing teams. They must guess blindly with A, B, C, or D.",
    iconName: "EyeOff",
  },
  lockdown: {
    type: "lockdown",
    name: "Lockdown Spell",
    description: "Completely blocks all opposing teams from submitting an answer for the current question.",
    iconName: "Lock",
  },
  back_to_sender: {
    type: "back_to_sender",
    name: "Back to Sender",
    description: "Shields you from opposing spells and reflects the spell penalty back to the original caster.",
    iconName: "ShieldAlert",
  },
  riddle: {
    type: "riddle",
    name: "Riddle Spell",
    description: "Forces all opposing teams to solve a tricky riddle before they can unlock the question.",
    iconName: "HelpCircle",
  },
  answer_reveal: {
    type: "answer_reveal",
    name: "Answer Reveal",
    description: "Privately reveals the correct answer for the active question exclusively to your team.",
    iconName: "Sparkles",
  },
};

export interface TeamPowerUpAssignment {
  teamId: string;
  teamName: string;
  slotNumber: number;
  powerUpType: PowerUpType;
  powerUpName: string;
  description: string;
  isUsed: boolean;
  usedAt?: number | null;
  usedQuestionId?: string | null;
}

export interface RiddleClientData {
  id: string;
  questionText: string;
  hint?: string;
}

export interface ActiveSpellEffect {
  id: string;
  casterTeamId: string;
  casterTeamName: string;
  powerUpType: PowerUpType;
  questionId: string;
  activatedAt: number;
  isReflected: boolean;
  reflectedByTeamId?: string | null;
  reflectedByTeamName?: string | null;
  outcome: "applied" | "reflected" | "shielded";
  affectedTeamIds: string[];
  riddle?: RiddleClientData;
}

export interface TeamPowerUpStatus {
  isLockedDown: boolean;
  lockedDownReason?: string;
  isInvisibilityActive: boolean;
  isRiddleActive: boolean;
  isRiddleSolved: boolean;
  activeRiddle?: RiddleClientData;
  hasBackToSenderShield: boolean;
}

// ----------------- Leaderboard & Clincher Types -----------------

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  leaderName: string;
  slotNumber: number;
  color: string;
  totalScore: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  isTiedForFirst: boolean;
  isClincherWinner?: boolean;
}

export interface FinalLeaderboardPayload {
  sessionId: string;
  sessionTitle: string;
  isFinished: boolean;
  entries: LeaderboardEntry[];
  hasTieForFirst: boolean;
  tiedFirstPlaceTeamIds: string[];
  winner: LeaderboardEntry | null;
  clincherRound?: ClincherStatePayload | null;
}

export interface ClincherRoundConfig {
  sessionId: string;
  questionId?: string;
  timeLimit?: number;
  allowPowerUps?: boolean;
}

export interface ClincherSubmissionSummary {
  teamId: string;
  teamName: string;
  slotNumber: number;
  selectedChoice: QuizChoice | "NONE";
  isCorrect: boolean;
  submittedAt: number;
}

export interface ClincherRoundResult {
  roundNumber: number;
  questionId: string;
  questionText: string;
  correctAnswer: QuizChoice;
  status: "tied" | "won";
  winnerTeamId?: string | null;
  winnerTeamName?: string | null;
  contendingTeamIds: string[];
  survivingTeamIds: string[];
  submissions: ClincherSubmissionSummary[];
  message: string;
}

export interface ClincherStatePayload {
  roundNumber: number;
  question: ClientQuizQuestion;
  contendingTeamIds: string[];
  allowPowerUps: boolean;
  startedAt: number;
  deadline: number;
  timeLimit: number;
  lastRoundResult?: ClincherRoundResult | null;
}

export interface ClincherSubmitRequest {
  sessionId: string;
  teamId: string;
  token: string;
  questionId: string;
  choice: QuizChoice;
}

// ----------------- Socket Events -----------------

export interface ServerToClientEvents {
  "server:connected": (payload: ServerConnectedPayload) => void;
  "server:pong": (payload: PongPayload) => void;
  "server:clients_updated": (payload: ClientsUpdatedPayload) => void;
  "server:broadcast_test": (payload: BroadcastTestPayload) => void;
  "lobby:updated": (payload: LobbyUpdatedPayload) => void;
  "team:registered": (payload: TeamRegisterResponse) => void;
  "team:reconnected": (payload: TeamReconnectResponse) => void;
  "server:error": (payload: { message: string }) => void;
  "admin:auth_error": (payload: { message: string }) => void;

  // Quiz Events
  "quiz:started": (payload: ClientQuizQuestion) => void;
  "quiz:progress": (payload: QuizProgressPayload) => void;
  "quiz:ended": (payload: QuestionResultsPayload) => void;
  "quiz:state": (payload: ActiveQuizStatePayload) => void;

  // Power-Up Events
  "powerup:assigned": (payload: TeamPowerUpAssignment) => void;
  "powerup:all_assigned": (payload: TeamPowerUpAssignment[]) => void;
  "powerup:activated": (payload: { spell: ActiveSpellEffect; message: string }) => void;
  "powerup:answer_revealed": (payload: { questionId: string; correctAnswer: QuizChoice; points: number }) => void;
  "powerup:riddle_unlocked": (payload: { questionId: string; success: boolean }) => void;
  "powerup:state_updated": (payload: { activeSpells: ActiveSpellEffect[]; teamStatus?: TeamPowerUpStatus }) => void;

  // Leaderboard & Clincher Events
  "leaderboard:updated": (payload: FinalLeaderboardPayload) => void;
  "session:game_ended": (payload: FinalLeaderboardPayload) => void;
  "clincher:started": (payload: ClincherStatePayload) => void;
  "clincher:progress": (payload: { roundNumber: number; submittedCount: number; totalContenders: number }) => void;
  "clincher:ended": (payload: ClincherRoundResult) => void;
  "clincher:champion_crowned": (payload: { winner: LeaderboardEntry; leaderboard: FinalLeaderboardPayload }) => void;
}

export interface ClientToServerEvents {
  "client:register": (payload: ClientRegisterPayload) => void;
  "client:ping": (payload: PingPayload) => void;
  "admin:test_broadcast": (payload: { message: string }) => void;
  "player:test_buzzer": (payload: { playerName?: string }) => void;
  "session:create": (payload: { title?: string }, callback?: (session: GameSession) => void) => void;
  "session:toggle_registration": (payload: { sessionId: string; isOpen: boolean }, callback?: (success: boolean) => void) => void;
  "session:get_state": (payload: { sessionId?: string }, callback?: (state: LobbyUpdatedPayload | null) => void) => void;
  "team:register": (payload: TeamRegisterRequest, callback?: (response: TeamRegisterResponse) => void) => void;
  "team:reconnect": (payload: TeamReconnectRequest, callback?: (response: TeamReconnectResponse) => void) => void;
  "admin:kick_team": (payload: { sessionId: string; teamId: string }, callback?: (success: boolean) => void) => void;
  "admin:rename_team": (payload: { sessionId: string; teamId: string; newName: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  "admin:reset_registration": (payload: { sessionId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;

  // Quiz Management & Controls
  "quiz:get_questions": (payload: { sessionId?: string }, callback: (questions: QuizQuestion[]) => void) => void;
  "quiz:save_question": (payload: { question: Partial<QuizQuestion> }, callback: (result: { success: boolean; question?: QuizQuestion; error?: string }) => void) => void;
  "quiz:delete_question": (payload: { questionId: string }, callback: (success: boolean) => void) => void;
  "quiz:clear_questions": (payload: Record<string, never>, callback?: (success: boolean) => void) => void;
  "quiz:reorder_questions": (payload: { questionIds: string[] }, callback?: (success: boolean) => void) => void;
  "quiz:activate_surprise": (payload: { sessionId: string; questionId?: string }, callback?: (result: { success: boolean; error?: string }) => void) => void;
  "quiz:end_question": (payload: { sessionId: string }, callback?: (result: { success: boolean; error?: string }) => void) => void;
  "quiz:submit_answer": (payload: QuizSubmitRequest, callback?: (response: QuizSubmitResponse) => void) => void;
  "quiz:get_state": (payload: { sessionId: string; teamId?: string }, callback?: (state: ActiveQuizStatePayload) => void) => void;

  // Power-Up Controls
  "powerup:assign_all": (payload: { sessionId: string; shuffle?: boolean }, callback?: (assignments: TeamPowerUpAssignment[]) => void) => void;
  "powerup:shuffle": (payload: { sessionId: string }, callback?: (res: { success: boolean; assignments?: TeamPowerUpAssignment[]; error?: string }) => void) => void;
  "powerup:get_all": (payload: { sessionId: string }, callback?: (assignments: TeamPowerUpAssignment[]) => void) => void;
  "powerup:get_my": (payload: { sessionId: string; teamId: string; token: string }, callback?: (assignment: TeamPowerUpAssignment | null) => void) => void;
  "powerup:activate": (payload: { sessionId: string; teamId: string; token: string; questionId: string }, callback?: (res: { success: boolean; error?: string; spell?: ActiveSpellEffect; answerReveal?: QuizChoice }) => void) => void;
  "powerup:solve_riddle": (payload: { sessionId: string; teamId: string; token: string; questionId: string; riddleId: string; answer: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  "powerup:admin_resolve_stuck": (payload: { sessionId: string }, callback?: (res: { success: boolean; message: string }) => void) => void;

  // Leaderboard & Clincher Controls
  "session:end_game": (payload: { sessionId: string }, callback?: (payload: FinalLeaderboardPayload) => void) => void;
  "session:get_leaderboard": (payload: { sessionId: string }, callback?: (payload: FinalLeaderboardPayload) => void) => void;
  "clincher:start_round": (payload: ClincherRoundConfig, callback?: (res: { success: boolean; error?: string; clincher?: ClincherStatePayload }) => void) => void;
  "clincher:submit_answer": (payload: ClincherSubmitRequest, callback?: (res: { success: boolean; error?: string; selectedChoice?: QuizChoice }) => void) => void;
  "clincher:end_round": (payload: { sessionId: string }, callback?: (res: { success: boolean; error?: string; result?: ClincherRoundResult }) => void) => void;
  "clincher:get_state": (payload: { sessionId: string; teamId?: string }, callback?: (state: ClincherStatePayload | null) => void) => void;
}


