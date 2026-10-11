import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type {
  QuizQuestion,
  QuizChoice,
  QuestionResultsPayload,
  TeamSubmissionSummary,
  PowerUpType,
  TeamPowerUpAssignment,
  LeaderboardEntry,
  FinalLeaderboardPayload,
  ClincherRoundResult,
  ClincherSubmissionSummary,
} from "@/types/socket";
import { POWER_UP_DEFINITIONS } from "@/types/socket";

export interface GameSession {
  id: string;
  title: string;
  status: "lobby" | "registration_closed" | "quiz_active" | "quiz_ended" | "clincher_active" | "finished";
  is_registration_open: number; // 1 or 0
  max_teams: number;
  current_question_id: string | null;
  quiz_started_at: number | null;
  quiz_deadline: number | null;
  quiz_state: "idle" | "active" | "ended";
  clincher_winner_id?: string | null;
  error?: string;
  created_at: string;
}

export interface ClincherRoundRecord {
  id: string;
  session_id: string;
  round_number: number;
  question_id: string;
  time_limit: number;
  allow_powerups: number;
  contending_team_ids: string;
  started_at: number;
  deadline: number;
  status: "active" | "tied" | "won";
  winner_team_id: string | null;
  created_at: string;
}

export interface ClincherSubmissionRecord {
  id: string;
  session_id: string;
  clincher_round_id: string;
  round_number: number;
  question_id: string;
  team_id: string;
  selected_choice: QuizChoice;
  is_correct: number;
  submitted_at: number;
  latency_ms: number;
  created_at: string;
}

export interface TeamPowerUpRecord {
  id: string;
  session_id: string;
  team_id: string;
  powerup_type: PowerUpType;
  is_used: number;
  used_at: number | null;
  used_question_id: string | null;
  created_at: string;
}

export interface RiddleRecord {
  id: string;
  question_text: string;
  accepted_answers: string;
  hint: string | null;
  created_at: string;
}

export interface QuestionPowerUpEffectRecord {
  id: string;
  session_id: string;
  question_id: string;
  caster_team_id: string;
  powerup_type: PowerUpType;
  activated_at: number;
  is_reflected: number;
  reflected_by_team_id: string | null;
  outcome: string;
  riddle_id: string | null;
  created_at: string;
}

export interface TeamRiddleStatusRecord {
  id: string;
  session_id: string;
  question_id: string;
  team_id: string;
  is_solved: number;
  attempts: number;
  solved_at: number | null;
  created_at: string;
}

export interface TeamRecord {
  id: string;
  session_id: string;
  name: string;
  normalized_name: string;
  leader_name: string;
  token: string;
  slot_number: number;
  color: string;
  score: number;
  is_connected: number;
  created_at: string;
}

export interface TeamLobbyInfo {
  id: string;
  sessionId: string;
  name: string;
  leaderName: string;
  slotNumber: number;
  color: string;
  score: number;
  isConnected: boolean;
  createdAt: string;
}

export interface QuestionRecord {
  id: string;
  session_id: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  time_limit: number;
  points: number;
  order_num: number;
  category?: string | null;
  explanation?: string | null;
  created_at: string;
}

export interface SubmissionRecord {
  id: string;
  session_id: string;
  question_id: string;
  team_id: string;
  selected_choice: "A" | "B" | "C" | "D";
  is_correct: number;
  points_awarded: number;
  submitted_at: number;
  latency_ms: number;
  created_at: string;
}

const TEAM_COLORS = [
  "border-indigo-500 bg-indigo-500/10 text-indigo-400 fill-indigo-500",
  "border-emerald-500 bg-emerald-500/10 text-emerald-400 fill-emerald-500",
  "border-amber-500 bg-amber-500/10 text-amber-400 fill-amber-500",
  "border-cyan-500 bg-cyan-500/10 text-cyan-400 fill-cyan-500",
  "border-purple-500 bg-purple-500/10 text-purple-400 fill-purple-500",
];

const DEFAULT_QUESTIONS = [
  {
    question_text: "Which network protocol is connectionless and prioritized for low latency real-time communication?",
    option_a: "TCP (Transmission Control Protocol)",
    option_b: "UDP (User Datagram Protocol)",
    option_c: "HTTP/1.1",
    option_d: "FTP (File Transfer Protocol)",
    correct_answer: "B" as const,
    time_limit: 25,
    points: 100,
  },
  {
    question_text: "What is the primary role of the ACID properties in database management systems?",
    option_a: "Maximizing storage compression",
    option_b: "Guaranteeing reliable transaction processing",
    option_c: "Encrypting network socket traffic",
    option_d: "Generating dynamic web interfaces",
    correct_answer: "B" as const,
    time_limit: 30,
    points: 100,
  },
  {
    question_text: "Which data structure uses LIFO (Last In, First Out) ordering for element retrieval?",
    option_a: "Queue",
    option_b: "Array",
    option_c: "Stack",
    option_d: "Binary Search Tree",
    correct_answer: "C" as const,
    time_limit: 20,
    points: 100,
  },
  {
    question_text: "In IPv4 networking, which address range is reserved for private local networks (Class C)?",
    option_a: "192.168.0.0/16",
    option_b: "127.0.0.0/8",
    option_c: "8.8.8.0/24",
    option_d: "224.0.0.0/4",
    correct_answer: "A" as const,
    time_limit: 25,
    points: 100,
  },
  {
    question_text: "What technology enables full-duplex, bidirectional communication over a single persistent TCP connection?",
    option_a: "DNS Over HTTPS",
    option_b: "HTTP Long-Polling",
    option_c: "WebSockets",
    option_d: "REST API Polling",
    correct_answer: "C" as const,
    time_limit: 25,
    points: 100,
  },
];

const DEFAULT_RIDDLES = [
  {
    id: "riddle_1",
    question_text: "I have keys, but no locks. I have space, but no room. You can enter, but you can't go outside. What am I?",
    accepted_answers: JSON.stringify(["keyboard", "a keyboard", "computer keyboard"]),
    hint: "You use it to type every day.",
  },
  {
    id: "riddle_2",
    question_text: "What comes once in a minute, twice in a moment, but never in a thousand years?",
    accepted_answers: JSON.stringify(["the letter m", "m", "letter m"]),
    hint: "Look closely at the spelling of the words.",
  },
  {
    id: "riddle_3",
    question_text: "The more of this there is, the less you see. What is it?",
    accepted_answers: JSON.stringify(["darkness", "dark"]),
    hint: "It disappears when you flip a light switch.",
  },
  {
    id: "riddle_4",
    question_text: "What has to be broken before you can use it?",
    accepted_answers: JSON.stringify(["egg", "an egg", "glowstick", "glow stick"]),
    hint: "Common at breakfast time.",
  },
  {
    id: "riddle_5",
    question_text: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
    accepted_answers: JSON.stringify(["echo", "an echo"]),
    hint: "You hear it bounce back in a canyon or empty hall.",
  },
];

let dbInstance: Database.Database | null = null;


export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "quiz-battle.db");
  const db = new Database(dbPath);

  // Enable WAL mode for high concurrency
  db.pragma("journal_mode = WAL");

  // Check if legacy table structure needs upgrade
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='teams'").get();
    if (tableCheck) {
      const teamCols = db.prepare("PRAGMA table_info(teams)").all() as Array<{ name: string }>;
      if (!teamCols.some((col) => col.name === "session_id")) {
        // Upgrade legacy stub table from Phase 1
        db.exec("DROP TABLE IF EXISTS teams");
      }
    }
  } catch (e) {
    console.error("Migration inspect error:", e);
  }

  // Create tables with session & team constraints
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'lobby',
      is_registration_open INTEGER DEFAULT 1,
      max_teams INTEGER DEFAULT 5,
      current_question_id TEXT DEFAULT NULL,
      quiz_started_at INTEGER DEFAULT NULL,
      quiz_deadline INTEGER DEFAULT NULL,
      quiz_state TEXT DEFAULT 'idle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      token TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      is_connected INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
      UNIQUE(session_id, normalized_name),
      UNIQUE(session_id, slot_number)
    );

    CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(session_id);
    CREATE INDEX IF NOT EXISTS idx_teams_token ON teams(token);

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      session_id TEXT DEFAULT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      time_limit INTEGER NOT NULL DEFAULT 30,
      points INTEGER NOT NULL DEFAULT 100,
      order_num INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      selected_choice TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      points_awarded INTEGER NOT NULL,
      submitted_at INTEGER NOT NULL,
      latency_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
      UNIQUE(session_id, question_id, team_id)
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_session_q ON submissions(session_id, question_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id);

    CREATE TABLE IF NOT EXISTS team_powerups (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      powerup_type TEXT NOT NULL,
      is_used INTEGER DEFAULT 0,
      used_at INTEGER DEFAULT NULL,
      used_question_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
      UNIQUE(session_id, team_id),
      UNIQUE(session_id, powerup_type)
    );

    CREATE INDEX IF NOT EXISTS idx_team_powerups_session ON team_powerups(session_id);

    CREATE TABLE IF NOT EXISTS riddles (
      id TEXT PRIMARY KEY,
      question_text TEXT NOT NULL,
      accepted_answers TEXT NOT NULL,
      hint TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS question_powerup_effects (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      caster_team_id TEXT NOT NULL,
      powerup_type TEXT NOT NULL,
      activated_at INTEGER NOT NULL,
      is_reflected INTEGER DEFAULT 0,
      reflected_by_team_id TEXT DEFAULT NULL,
      outcome TEXT NOT NULL,
      riddle_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_powerup_effects_q ON question_powerup_effects(session_id, question_id);

    CREATE TABLE IF NOT EXISTS team_riddle_status (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      is_solved INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      solved_at INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
      UNIQUE(session_id, question_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS clincher_rounds (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      time_limit INTEGER NOT NULL,
      allow_powerups INTEGER DEFAULT 0,
      contending_team_ids TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      deadline INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      winner_team_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clincher_submissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      clincher_round_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      selected_choice TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      submitted_at INTEGER NOT NULL,
      latency_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (clincher_round_id) REFERENCES clincher_rounds (id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
      UNIQUE(clincher_round_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      ip_address TEXT DEFAULT NULL,
      user_agent TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      attempt_time INTEGER NOT NULL,
      success INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON admin_login_attempts(ip_address, attempt_time);
  `);


  // Migrate game_sessions if needed
  try {
    const sessionCols = db.prepare("PRAGMA table_info(game_sessions)").all() as Array<{ name: string }>;
    if (!sessionCols.some((col) => col.name === "is_registration_open")) {
      db.exec("ALTER TABLE game_sessions ADD COLUMN is_registration_open INTEGER DEFAULT 1");
    }
    if (!sessionCols.some((col) => col.name === "max_teams")) {
      db.exec("ALTER TABLE game_sessions ADD COLUMN max_teams INTEGER DEFAULT 5");
    }
    if (!sessionCols.some((col) => col.name === "current_question_id")) {
      db.exec("ALTER TABLE game_sessions ADD COLUMN current_question_id TEXT DEFAULT NULL");
    }
    if (!sessionCols.some((col) => col.name === "quiz_started_at")) {
      db.exec("ALTER TABLE game_sessions ADD COLUMN quiz_started_at INTEGER DEFAULT NULL");
    }
    if (!sessionCols.some((col) => col.name === "quiz_deadline")) {
      db.exec("ALTER TABLE game_sessions ADD COLUMN quiz_deadline INTEGER DEFAULT NULL");
    }
    if (!sessionCols.some((col) => col.name === "quiz_state")) {
      db.exec("ALTER TABLE game_sessions ADD COLUMN quiz_state TEXT DEFAULT 'idle'");
    }
    if (!sessionCols.some((col) => col.name === "clincher_winner_id")) {
      db.exec("ALTER TABLE game_sessions ADD COLUMN clincher_winner_id TEXT DEFAULT NULL");
    }

    const qCols = db.prepare("PRAGMA table_info(questions)").all() as Array<{ name: string }>;
    if (!qCols.some((col) => col.name === "category")) {
      db.exec("ALTER TABLE questions ADD COLUMN category TEXT DEFAULT 'General'");
    }
    if (!qCols.some((col) => col.name === "explanation")) {
      db.exec("ALTER TABLE questions ADD COLUMN explanation TEXT DEFAULT NULL");
    }
  } catch (err) {
    console.error("Migration error check:", err);
  }

  // Seed default questions if question bank is empty
  try {
    const qCount = (db.prepare("SELECT COUNT(*) as count FROM questions").get() as { count: number }).count;
    if (qCount === 0) {
      const insertQ = db.prepare(`
        INSERT INTO questions (
          id, session_id, question_text, option_a, option_b, option_c, option_d,
          correct_answer, time_limit, points, order_num
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      DEFAULT_QUESTIONS.forEach((q, index) => {
        const qId = `q_seed_${index + 1}`;
        insertQ.run(
          qId,
          q.question_text,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          q.correct_answer,
          q.time_limit,
          q.points,
          index + 1
        );
      });
      console.log(`[DB] Seeded ${DEFAULT_QUESTIONS.length} default classroom quiz questions.`);
    }
  } catch (err) {
    console.error("Seeding questions error:", err);
  }

  // Seed default riddles if riddle bank is empty
  try {
    const rCount = (db.prepare("SELECT COUNT(*) as count FROM riddles").get() as { count: number }).count;
    if (rCount === 0) {
      const insertRiddle = db.prepare(`
        INSERT INTO riddles (id, question_text, accepted_answers, hint)
        VALUES (?, ?, ?, ?)
      `);
      DEFAULT_RIDDLES.forEach((r) => {
        insertRiddle.run(r.id, r.question_text, r.accepted_answers, r.hint);
      });
      console.log(`[DB] Seeded ${DEFAULT_RIDDLES.length} default riddles.`);
    }
  } catch (err) {
    console.error("Seeding riddles error:", err);
  }

  // Ensure there is at least one active game session

  const activeSession = db.prepare("SELECT * FROM game_sessions WHERE status IN ('lobby', 'registration_closed', 'quiz_active', 'quiz_ended') ORDER BY created_at DESC LIMIT 1").get() as GameSession | undefined;
  if (!activeSession) {
    const newSessionId = `SESSION-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    db.prepare(`
      INSERT INTO game_sessions (id, title, status, is_registration_open, max_teams, quiz_state)
      VALUES (?, ?, 'lobby', 1, 5, 'idle')
    `).run(newSessionId, "Classroom Quiz Battle #1");
  }

  dbInstance = db;
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ----------------- Session Queries -----------------

export function createNewSession(title?: string): GameSession {
  const db = getDb();
  // Close any previously open sessions
  db.prepare("UPDATE game_sessions SET status = 'finished' WHERE status IN ('lobby', 'registration_closed')").run();

  const id = `SESSION-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const sessionTitle = title?.trim() || `Classroom Quiz Battle #${Date.now().toString().slice(-4)}`;

  db.prepare(`
    INSERT INTO game_sessions (id, title, status, is_registration_open, max_teams)
    VALUES (?, ?, 'lobby', 1, 5)
  `).run(id, sessionTitle);

  return getSessionById(id)!;
}

export function getActiveSession(): GameSession | null {
  const db = getDb();
  let session = db.prepare(`
    SELECT * FROM game_sessions 
    WHERE status != 'finished' 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get() as GameSession | undefined;

  if (!session) {
    session = db.prepare(`
      SELECT * FROM game_sessions 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get() as GameSession | undefined;
  }

  return session || null;
}

export function getSessionById(id: string): GameSession | null {
  const db = getDb();
  const session = db.prepare("SELECT * FROM game_sessions WHERE id = ?").get(id) as GameSession | undefined;
  return session || null;
}

export function setRegistrationOpen(sessionId: string, isOpen: boolean): boolean {
  const db = getDb();
  const newStatus = isOpen ? "lobby" : "registration_closed";
  const result = db.prepare(`
    UPDATE game_sessions 
    SET is_registration_open = ?, status = ?
    WHERE id = ?
  `).run(isOpen ? 1 : 0, newStatus, sessionId);

  return result.changes > 0;
}

// ----------------- Team Registration & Lobby -----------------

export function getTeamsForSession(sessionId: string): TeamLobbyInfo[] {
  const db = getDb();
  const teams = db.prepare(`
    SELECT * FROM teams 
    WHERE session_id = ? 
    ORDER BY slot_number ASC
  `).all(sessionId) as TeamRecord[];

  return teams.map(toLobbyInfo);
}

export function getTeamById(teamId: string): TeamRecord | null {
  const db = getDb();
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(teamId) as TeamRecord | undefined;
  return team || null;
}

export interface RegisterResult {
  success: boolean;
  team?: TeamLobbyInfo;
  token?: string;
  error?: string;
}

export function registerTeam(
  sessionId: string,
  rawName: string,
  rawLeader: string
): RegisterResult {
  const db = getDb();

  // 1. Validate inputs
  const name = rawName.trim();
  const leaderName = rawLeader.trim();

  if (!name || name.length < 2 || name.length > 30) {
    return { success: false, error: "Team name must be between 2 and 30 characters." };
  }

  if (!leaderName || leaderName.length < 2 || leaderName.length > 30) {
    return { success: false, error: "Leader name must be between 2 and 30 characters." };
  }

  // 2. Validate session
  const session = getSessionById(sessionId);
  if (!session) {
    return { success: false, error: "Game session not found or has expired." };
  }

  if (!session.is_registration_open || session.status === "registration_closed") {
    return { success: false, error: "Registration is currently closed by the presenter." };
  }

  if (session.status !== "lobby") {
    return { success: false, error: "Session has already started or finished." };
  }

  // 3. Check duplicate normalized team name
  const normalized = name.toLowerCase();
  const existingTeam = db.prepare(`
    SELECT id FROM teams 
    WHERE session_id = ? AND normalized_name = ?
  `).get(sessionId, normalized);

  if (existingTeam) {
    return { success: false, error: `Team name "${name}" is already taken in this session.` };
  }

  // 4. Check available slots
  const registeredCount = (db.prepare(`
    SELECT COUNT(*) as count FROM teams WHERE session_id = ?
  `).get(sessionId) as { count: number }).count;

  if (registeredCount >= session.max_teams) {
    return { success: false, error: `Session is full (maximum ${session.max_teams} teams registered).` };
  }

  // Find next available slot number (1 to 5)
  const existingSlots = (db.prepare(`
    SELECT slot_number FROM teams WHERE session_id = ?
  `).all(sessionId) as Array<{ slot_number: number }>).map((s) => s.slot_number);

  let nextSlot = 1;
  for (let s = 1; s <= session.max_teams; s++) {
    if (!existingSlots.includes(s)) {
      nextSlot = s;
      break;
    }
  }

  const teamId = `team_${crypto.randomBytes(6).toString("hex")}`;
  const token = crypto.randomBytes(16).toString("hex");
  const color = TEAM_COLORS[(nextSlot - 1) % TEAM_COLORS.length];

  try {
    db.prepare(`
      INSERT INTO teams (
        id, session_id, name, normalized_name, leader_name, 
        token, slot_number, color, score, is_connected
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).run(teamId, sessionId, name, normalized, leaderName, token, nextSlot, color);

    const createdTeam = getTeamById(teamId)!;

    return {
      success: true,
      team: toLobbyInfo(createdTeam),
      token,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed")) {
      return { success: false, error: "Team name or slot conflict occurred. Please try again." };
    }
    return { success: false, error: "Failed to register team. Please try again." };
  }
}

export function reconnectTeam(
  sessionId: string,
  teamId: string,
  token: string
): { success: boolean; team?: TeamLobbyInfo; error?: string } {
  const db = getDb();
  const team = db.prepare(`
    SELECT * FROM teams 
    WHERE id = ? AND session_id = ? AND token = ?
  `).get(teamId, sessionId, token) as TeamRecord | undefined;

  if (!team) {
    return { success: false, error: "Invalid team credentials or session expired." };
  }

  // Mark team as connected
  db.prepare("UPDATE teams SET is_connected = 1 WHERE id = ?").run(teamId);
  const updatedTeam = getTeamById(teamId)!;

  return {
    success: true,
    team: toLobbyInfo(updatedTeam),
  };
}

export function updateTeamConnection(teamId: string, isConnected: boolean): void {
  const db = getDb();
  db.prepare("UPDATE teams SET is_connected = ? WHERE id = ?").run(isConnected ? 1 : 0, teamId);
}

export function removeTeam(sessionId: string, teamId: string): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM teams WHERE id = ? AND session_id = ?").run(teamId, sessionId);
  return res.changes > 0;
}

export function renameTeam(sessionId: string, teamId: string, newName: string): { success: boolean; error?: string } {
  const db = getDb();
  const cleanName = newName.trim();
  if (cleanName.length < 2) {
    return { success: false, error: "Team name must be at least 2 characters." };
  }
  const normalized = cleanName.toLowerCase();
  const existing = db.prepare("SELECT id FROM teams WHERE session_id = ? AND normalized_name = ? AND id != ?").get(sessionId, normalized, teamId);
  if (existing) {
    return { success: false, error: `Team name "${cleanName}" is already taken in this session.` };
  }
  const res = db.prepare("UPDATE teams SET name = ?, normalized_name = ? WHERE id = ? AND session_id = ?").run(cleanName, normalized, teamId, sessionId);
  return { success: res.changes > 0 };
}

export function resetSessionTeams(sessionId: string): boolean {
  const db = getDb();
  db.prepare("DELETE FROM team_powerups WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM submissions WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM clincher_submissions WHERE session_id = ?").run(sessionId);
  const res = db.prepare("DELETE FROM teams WHERE session_id = ?").run(sessionId);
  return res.changes >= 0;
}

function toLobbyInfo(t: TeamRecord): TeamLobbyInfo {
  return {
    id: t.id,
    sessionId: t.session_id,
    name: t.name,
    leaderName: t.leader_name,
    slotNumber: t.slot_number,
    color: t.color,
    score: t.score,
    isConnected: t.is_connected === 1,
    createdAt: t.created_at,
  };
}

// ----------------- Quiz Questions Queries -----------------

export function getQuestions(sessionId?: string): QuizQuestion[] {
  const db = getDb();
  let rows: QuestionRecord[];
  if (sessionId) {
    rows = db.prepare("SELECT * FROM questions WHERE session_id = ? OR session_id IS NULL ORDER BY order_num ASC, created_at ASC").all(sessionId) as QuestionRecord[];
  } else {
    rows = db.prepare("SELECT * FROM questions ORDER BY order_num ASC, created_at ASC").all() as QuestionRecord[];
  }
  return rows.map(toQuizQuestion);
}

export function getQuestionById(id: string): QuizQuestion | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as QuestionRecord | undefined;
  return row ? toQuizQuestion(row) : null;
}

export function saveQuestion(q: Partial<QuizQuestion>): QuizQuestion {
  const db = getDb();
  const id = q.id || `q_${crypto.randomBytes(4).toString("hex")}`;
  const questionText = q.questionText?.trim() || "Untitled Question";
  const optionA = q.options?.A?.trim() || "Option A";
  const optionB = q.options?.B?.trim() || "Option B";
  const optionC = q.options?.C?.trim() || "Option C";
  const optionD = q.options?.D?.trim() || "Option D";
  const correctAnswer = (q.correctAnswer || "A") as QuizChoice;
  const timeLimit = Math.max(5, Math.min(180, q.timeLimit || 30));
  const points = Math.max(10, q.points || 100);
  const orderNum = q.orderNum || 0;
  const category = q.category?.trim() || "General";
  const explanation = q.explanation?.trim() || null;
  const sessionId = q.sessionId || null;

  const existing = db.prepare("SELECT id FROM questions WHERE id = ?").get(id);
  if (existing) {
    db.prepare(`
      UPDATE questions SET
        question_text = ?,
        option_a = ?,
        option_b = ?,
        option_c = ?,
        option_d = ?,
        correct_answer = ?,
        time_limit = ?,
        points = ?,
        order_num = ?,
        category = ?,
        explanation = ?
      WHERE id = ?
    `).run(questionText, optionA, optionB, optionC, optionD, correctAnswer, timeLimit, points, orderNum, category, explanation, id);
  } else {
    db.prepare(`
      INSERT INTO questions (
        id, session_id, question_text, option_a, option_b, option_c, option_d,
        correct_answer, time_limit, points, order_num, category, explanation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, questionText, optionA, optionB, optionC, optionD, correctAnswer, timeLimit, points, orderNum, category, explanation);
  }

  return getQuestionById(id)!;
}

export function deleteQuestion(id: string): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM questions WHERE id = ?").run(id);
  return res.changes > 0;
}

export function reorderQuestions(orderIds: string[]): boolean {
  const db = getDb();
  const stmt = db.prepare("UPDATE questions SET order_num = ? WHERE id = ?");
  db.transaction(() => {
    orderIds.forEach((id, idx) => {
      stmt.run(idx + 1, id);
    });
  })();
  return true;
}

// ----------------- Quiz State Management -----------------

export function setSessionActiveQuiz(
  sessionId: string,
  questionId: string,
  startedAt: number = Date.now(),
  deadline: number = startedAt + 30000
): boolean {
  const db = getDb();
  const res = db.prepare(`
    UPDATE game_sessions SET
      status = 'quiz_active',
      quiz_state = 'active',
      current_question_id = ?,
      quiz_started_at = ?,
      quiz_deadline = ?
    WHERE id = ?
  `).run(questionId, startedAt, deadline, sessionId);
  return res.changes > 0;
}

export function endSessionActiveQuiz(sessionId: string): boolean {
  const db = getDb();
  const res = db.prepare(`
    UPDATE game_sessions SET
      status = 'quiz_ended',
      quiz_state = 'ended'
    WHERE id = ?
  `).run(sessionId);
  return res.changes > 0;
}

export function resetSessionQuizState(sessionId: string): boolean {
  const db = getDb();
  const res = db.prepare(`
    UPDATE game_sessions SET
      status = 'lobby',
      quiz_state = 'idle',
      current_question_id = NULL,
      quiz_started_at = NULL,
      quiz_deadline = NULL
    WHERE id = ?
  `).run(sessionId);
  return res.changes > 0;
}

// ----------------- Submissions & Scoring -----------------

export interface SubmitAnswerResult {
  success: boolean;
  selectedChoice?: QuizChoice;
  submittedAt?: number;
  error?: string;
}

export function recordSubmission(
  sessionId: string,
  teamId: string,
  token: string,
  questionId: string,
  rawChoice: string
): SubmitAnswerResult {
  const db = getDb();

  // 1. Validate choice
  const choice = rawChoice.trim().toUpperCase() as QuizChoice;
  if (!["A", "B", "C", "D"].includes(choice)) {
    return { success: false, error: "Invalid answer choice. Must be A, B, C, or D." };
  }

  // 2. Validate session & quiz state
  const session = getSessionById(sessionId);
  if (!session) {
    return { success: false, error: "Session not found." };
  }

  if (session.quiz_state !== "active" || session.current_question_id !== questionId) {
    return { success: false, error: "This quiz question is no longer active." };
  }

  // 3. Deadline check with 1500ms network latency grace period
  const now = Date.now();
  if (session.quiz_deadline && now > session.quiz_deadline + 1500) {
    return { success: false, error: "Time has expired for this question." };
  }

  // 4. Validate team and token
  const team = db.prepare("SELECT * FROM teams WHERE id = ? AND session_id = ?").get(teamId, sessionId) as TeamRecord | undefined;
  if (!team) {
    return { success: false, error: "Unregistered team." };
  }

  if (team.token !== token) {
    return { success: false, error: "Unauthorized team token." };
  }

  // 5. Prevent duplicate submission
  const existingSub = db.prepare("SELECT id FROM submissions WHERE session_id = ? AND question_id = ? AND team_id = ?").get(sessionId, questionId, teamId);
  if (existingSub) {
    return { success: false, error: "Your team has already submitted an answer for this question." };
  }

  // 6. Grade submission on server
  const question = getQuestionById(questionId);
  if (!question) {
    return { success: false, error: "Question not found." };
  }

  const isCorrect = choice === question.correctAnswer;
  const pointsAwarded = isCorrect ? (question.points || 100) : 0;

  const subId = `sub_${crypto.randomBytes(6).toString("hex")}`;

  try {
    db.prepare(`
      INSERT INTO submissions (
        id, session_id, question_id, team_id, selected_choice,
        is_correct, points_awarded, submitted_at, latency_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subId,
      sessionId,
      questionId,
      teamId,
      choice,
      isCorrect ? 1 : 0,
      pointsAwarded,
      now,
      session.quiz_started_at ? now - session.quiz_started_at : 0
    );

    return {
      success: true,
      selectedChoice: choice,
      submittedAt: now,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed")) {
      return { success: false, error: "Your team has already submitted an answer for this question." };
    }
    return { success: false, error: "Failed to record submission." };
  }
}

export function getQuestionSubmissions(sessionId: string, questionId: string): SubmissionRecord[] {
  const db = getDb();
  return db.prepare("SELECT * FROM submissions WHERE session_id = ? AND question_id = ?").all(sessionId, questionId) as SubmissionRecord[];
}

export function getTeamSubmission(sessionId: string, questionId: string, teamId: string): SubmissionRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM submissions WHERE session_id = ? AND question_id = ? AND team_id = ?").get(sessionId, questionId, teamId) as SubmissionRecord | undefined;
  return row || null;
}

export function finalizeQuestionScores(sessionId: string, questionId: string): QuestionResultsPayload | null {
  const db = getDb();
  const question = getQuestionById(questionId);
  if (!question) return null;

  const teams = db.prepare("SELECT * FROM teams WHERE session_id = ? ORDER BY slot_number ASC").all(sessionId) as TeamRecord[];
  const subs = getQuestionSubmissions(sessionId, questionId);

  // Update team scores in SQLite
  const updateScoreStmt = db.prepare("UPDATE teams SET score = score + ? WHERE id = ?");
  const updateTransaction = db.transaction(() => {
    for (const sub of subs) {
      if (sub.points_awarded > 0) {
        updateScoreStmt.run(sub.points_awarded, sub.team_id);
      }
    }
    // Set session status to quiz_ended
    db.prepare("UPDATE game_sessions SET status = 'quiz_ended', quiz_state = 'ended' WHERE id = ?").run(sessionId);
  });

  updateTransaction();

  // Fetch updated teams
  const updatedTeams = getTeamsForSession(sessionId);

  // Build submission summaries for all registered teams
  let correctCount = 0;
  const teamSummaries: TeamSubmissionSummary[] = teams.map((team) => {
    const sub = subs.find((s) => s.team_id === team.id);
    if (sub && sub.is_correct === 1) {
      correctCount++;
    }
    return {
      teamId: team.id,
      teamName: team.name,
      slotNumber: team.slot_number,
      selectedChoice: sub ? (sub.selected_choice as QuizChoice) : "NONE",
      isCorrect: sub ? sub.is_correct === 1 : false,
      pointsAwarded: sub ? sub.points_awarded : 0,
      submittedAt: sub ? sub.submitted_at : 0,
    };
  });

  return {
    questionId: question.id,
    questionText: question.questionText,
    options: question.options,
    correctAnswer: question.correctAnswer,
    submissions: teamSummaries,
    updatedTeams,
    summary: {
      totalTeams: teams.length,
      submittedCount: subs.length,
      correctCount,
    },
  };
}

function toQuizQuestion(r: QuestionRecord): QuizQuestion {
  return {
    id: r.id,
    sessionId: r.session_id,
    questionText: r.question_text,
    options: {
      A: r.option_a,
      B: r.option_b,
      C: r.option_c,
      D: r.option_d,
    },
    correctAnswer: r.correct_answer,
    timeLimit: r.time_limit,
    points: r.points,
    orderNum: r.order_num,
    category: r.category || "General",
    explanation: r.explanation || undefined,
    createdAt: r.created_at,
  };
}

// =======================================================
//  POWER-UP SYSTEM & RIDDLE REPOSITORY
// =======================================================

const ALL_POWER_UP_TYPES: PowerUpType[] = [
  "invisibility",
  "lockdown",
  "back_to_sender",
  "riddle",
  "answer_reveal",
];

export function shufflePowerUpsToTeams(sessionId: string): {
  success: boolean;
  assignments: TeamPowerUpAssignment[];
  error?: string;
} {
  const db = getDb();
  const teams = getTeamsForSession(sessionId);
  if (teams.length === 0) {
    return { success: false, assignments: [], error: "No teams registered yet." };
  }

  // Check if any team has already used a power-up in this session
  const existing = getAllTeamPowerUps(sessionId);
  const anyUsed = existing.some((p) => p.isUsed);
  if (anyUsed) {
    return {
      success: false,
      assignments: existing,
      error: "Cannot shuffle power-ups because one or more teams have already used their spell.",
    };
  }

  // Cryptographically shuffle the 5 unique power-ups using Fisher-Yates
  const shuffledTypes = [...ALL_POWER_UP_TYPES];
  for (let i = shuffledTypes.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffledTypes[i], shuffledTypes[j]] = [shuffledTypes[j], shuffledTypes[i]];
  }

  const tx = db.transaction(() => {
    // Delete existing unused assignments for this session
    db.prepare("DELETE FROM team_powerups WHERE session_id = ?").run(sessionId);

    const insertAssignment = db.prepare(`
      INSERT INTO team_powerups (id, session_id, team_id, powerup_type, is_used)
      VALUES (?, ?, ?, ?, 0)
    `);

    teams.forEach((team, idx) => {
      const pType = shuffledTypes[idx % shuffledTypes.length];
      const id = `pu_${sessionId}_${team.id}`;
      insertAssignment.run(id, sessionId, team.id, pType);
    });
  });

  tx();
  return { success: true, assignments: getAllTeamPowerUps(sessionId) };
}

export function assignPowerUpsToTeams(sessionId: string, forceShuffle = false): TeamPowerUpAssignment[] {
  if (forceShuffle) {
    const res = shufflePowerUpsToTeams(sessionId);
    return res.assignments;
  }

  const db = getDb();
  const teams = getTeamsForSession(sessionId);
  if (teams.length === 0) return [];

  // Check if assignments already exist for this session
  const existing = getAllTeamPowerUps(sessionId);
  if (existing.length === teams.length && existing.length > 0) {
    return existing; // Strictly maintain existing assignments across refreshes/reconnections
  }

  // Cryptographically shuffle the 5 unique power-ups using Fisher-Yates
  const shuffledTypes = [...ALL_POWER_UP_TYPES];
  for (let i = shuffledTypes.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffledTypes[i], shuffledTypes[j]] = [shuffledTypes[j], shuffledTypes[i]];
  }

  const insertAssignment = db.prepare(`
    INSERT INTO team_powerups (id, session_id, team_id, powerup_type, is_used)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(session_id, team_id) DO NOTHING
  `);

  const tx = db.transaction(() => {
    teams.forEach((team, idx) => {
      const pType = shuffledTypes[idx % shuffledTypes.length];
      const id = `pu_${sessionId}_${team.id}`;
      insertAssignment.run(id, sessionId, team.id, pType);
    });
  });

  tx();
  return getAllTeamPowerUps(sessionId);
}

export function getAllTeamPowerUps(sessionId: string): TeamPowerUpAssignment[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT tp.team_id, tp.powerup_type, tp.is_used, tp.used_at, tp.used_question_id,
           t.name as team_name, t.slot_number
    FROM team_powerups tp
    JOIN teams t ON t.id = tp.team_id
    WHERE tp.session_id = ?
    ORDER BY t.slot_number ASC
  `).all(sessionId) as Array<{
    team_id: string;
    powerup_type: PowerUpType;
    is_used: number;
    used_at: number | null;
    used_question_id: string | null;
    team_name: string;
    slot_number: number;
  }>;

  return rows.map((r) => {
    const def = POWER_UP_DEFINITIONS[r.powerup_type];
    return {
      teamId: r.team_id,
      teamName: r.team_name,
      slotNumber: r.slot_number,
      powerUpType: r.powerup_type,
      powerUpName: def ? def.name : r.powerup_type,
      description: def ? def.description : "",
      isUsed: r.is_used === 1,
      usedAt: r.used_at,
      usedQuestionId: r.used_question_id,
    };
  });
}

export function getTeamPowerUp(sessionId: string, teamId: string): TeamPowerUpAssignment | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT tp.team_id, tp.powerup_type, tp.is_used, tp.used_at, tp.used_question_id,
           t.name as team_name, t.slot_number
    FROM team_powerups tp
    JOIN teams t ON t.id = tp.team_id
    WHERE tp.session_id = ? AND tp.team_id = ?
  `).get(sessionId, teamId) as {
    team_id: string;
    powerup_type: PowerUpType;
    is_used: number;
    used_at: number | null;
    used_question_id: string | null;
    team_name: string;
    slot_number: number;
  } | undefined;

  if (!r) return null;
  const def = POWER_UP_DEFINITIONS[r.powerup_type];
  return {
    teamId: r.team_id,
    teamName: r.team_name,
    slotNumber: r.slot_number,
    powerUpType: r.powerup_type,
    powerUpName: def ? def.name : r.powerup_type,
    description: def ? def.description : "",
    isUsed: r.is_used === 1,
    usedAt: r.used_at,
    usedQuestionId: r.used_question_id,
  };
}

export function markPowerUpUsed(
  sessionId: string,
  teamId: string,
  questionId: string
): boolean {
  const db = getDb();
  const info = db.prepare(`
    UPDATE team_powerups
    SET is_used = 1, used_at = ?, used_question_id = ?
    WHERE session_id = ? AND team_id = ? AND is_used = 0
  `).run(Date.now(), questionId, sessionId, teamId);

  return info.changes > 0;
}

export function recordSpellEffect(
  sessionId: string,
  questionId: string,
  casterTeamId: string,
  powerupType: PowerUpType,
  outcome: "applied" | "reflected" | "shielded",
  isReflected: boolean,
  reflectedByTeamId?: string | null,
  riddleId?: string | null
): string {
  const db = getDb();
  const id = `eff_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  db.prepare(`
    INSERT INTO question_powerup_effects (
      id, session_id, question_id, caster_team_id, powerup_type,
      activated_at, is_reflected, reflected_by_team_id, outcome, riddle_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sessionId,
    questionId,
    casterTeamId,
    powerupType,
    Date.now(),
    isReflected ? 1 : 0,
    reflectedByTeamId || null,
    outcome,
    riddleId || null
  );
  return id;
}

export function getSpellEffectsForQuestion(sessionId: string, questionId: string): QuestionPowerUpEffectRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM question_powerup_effects
    WHERE session_id = ? AND question_id = ?
    ORDER BY activated_at ASC
  `).all(sessionId, questionId) as QuestionPowerUpEffectRecord[];
}

export function getAllSpellEffects(sessionId: string): QuestionPowerUpEffectRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM question_powerup_effects
    WHERE session_id = ?
    ORDER BY activated_at DESC
  `).all(sessionId) as QuestionPowerUpEffectRecord[];
}

export function getRandomRiddle(): { id: string; questionText: string; acceptedAnswers: string[]; hint?: string } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM riddles ORDER BY RANDOM() LIMIT 1
  `).get() as RiddleRecord | undefined;

  if (!row) return null;
  let acceptedAnswers: string[] = [];
  try {
    acceptedAnswers = JSON.parse(row.accepted_answers);
  } catch {
    acceptedAnswers = [row.accepted_answers];
  }
  return {
    id: row.id,
    questionText: row.question_text,
    acceptedAnswers,
    hint: row.hint || undefined,
  };
}

export function getRiddleById(riddleId: string): { id: string; questionText: string; acceptedAnswers: string[]; hint?: string } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM riddles WHERE id = ?
  `).get(riddleId) as RiddleRecord | undefined;

  if (!row) return null;
  let acceptedAnswers: string[] = [];
  try {
    acceptedAnswers = JSON.parse(row.accepted_answers);
  } catch {
    acceptedAnswers = [row.accepted_answers];
  }
  return {
    id: row.id,
    questionText: row.question_text,
    acceptedAnswers,
    hint: row.hint || undefined,
  };
}

export function checkAndSolveRiddle(
  sessionId: string,
  questionId: string,
  teamId: string,
  riddleId: string,
  rawAnswer: string
): { success: boolean; error?: string } {
  const db = getDb();
  const riddle = getRiddleById(riddleId);
  if (!riddle) {
    return { success: false, error: "Riddle not found." };
  }

  const normalizedInput = rawAnswer.trim().toLowerCase();
  const isMatch = riddle.acceptedAnswers.some(
    (ans) => ans.trim().toLowerCase() === normalizedInput
  );

  const id = `rstat_${sessionId}_${questionId}_${teamId}`;
  if (isMatch) {
    db.prepare(`
      INSERT INTO team_riddle_status (id, session_id, question_id, team_id, is_solved, attempts, solved_at)
      VALUES (?, ?, ?, ?, 1, 1, ?)
      ON CONFLICT(session_id, question_id, team_id) DO UPDATE SET
        is_solved = 1,
        attempts = attempts + 1,
        solved_at = COALESCE(solved_at, excluded.solved_at)
    `).run(id, sessionId, questionId, teamId, Date.now());

    return { success: true };
  } else {
    db.prepare(`
      INSERT INTO team_riddle_status (id, session_id, question_id, team_id, is_solved, attempts)
      VALUES (?, ?, ?, ?, 0, 1)
      ON CONFLICT(session_id, question_id, team_id) DO UPDATE SET
        attempts = attempts + 1
    `).run(id, sessionId, questionId, teamId);

    return { success: false, error: "Incorrect riddle answer. Try again!" };
  }
}

export function getTeamRiddleStatus(
  sessionId: string,
  questionId: string,
  teamId: string
): { isSolved: boolean; attempts: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT is_solved, attempts FROM team_riddle_status
    WHERE session_id = ? AND question_id = ? AND team_id = ?
  `).get(sessionId, questionId, teamId) as { is_solved: number; attempts: number } | undefined;

  return {
    isSolved: row ? row.is_solved === 1 : false,
    attempts: row ? row.attempts : 0,
  };
}

export function resolveStuckQuestionDb(sessionId: string, questionId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE question_powerup_effects
    SET outcome = 'resolved_by_admin'
    WHERE session_id = ? AND question_id = ?
  `).run(sessionId, questionId);
}

// =======================================================
//  FINAL LEADERBOARD & GAME COMPLETION ENGINE
// =======================================================

export function getLeaderboard(sessionId: string): FinalLeaderboardPayload {
  const db = getDb();
  const session = getSessionById(sessionId);
  const sessionTitle = session?.title || "Classroom Quiz Battle";
  const isFinished = session?.status === "finished";

  // 1. Fetch all teams for this session
  const teams = db.prepare(`
    SELECT * FROM teams WHERE session_id = ? ORDER BY slot_number ASC
  `).all(sessionId) as TeamRecord[];

  // 2. Fetch all normal submissions (excluding clincher rounds)
  const submissions = db.prepare(`
    SELECT * FROM submissions WHERE session_id = ?
  `).all(sessionId) as SubmissionRecord[];

  // 3. Count unique regular questions asked in this session
  const distinctQuestions = new Set<string>();
  submissions.forEach((s) => distinctQuestions.add(s.question_id));
  const totalQuestions = Math.max(distinctQuestions.size, 1);

  // 4. Compute stats per team
  const entries: LeaderboardEntry[] = teams.map((t) => {
    const teamSubs = submissions.filter((s) => s.team_id === t.id);
    const correctCount = teamSubs.filter((s) => s.is_correct === 1).length;
    const answeredCount = teamSubs.filter((s) => s.selected_choice !== null).length;

    return {
      rank: 1, // Will be computed after sorting
      teamId: t.id,
      teamName: t.name,
      leaderName: t.leader_name,
      slotNumber: t.slot_number,
      color: t.color,
      totalScore: t.score,
      correctCount,
      answeredCount,
      totalQuestions,
      isTiedForFirst: false,
      isClincherWinner: session?.clincher_winner_id === t.id,
    };
  });

  // 5. Check if a Clincher Winner has been established
  if (session?.clincher_winner_id) {
    const clincherWinner = entries.find((e) => e.teamId === session.clincher_winner_id);
    const others = entries.filter((e) => e.teamId !== session.clincher_winner_id);
    others.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.slotNumber - b.slotNumber;
    });

    if (clincherWinner) {
      clincherWinner.rank = 1;
      clincherWinner.isClincherWinner = true;
      let nextRank = 2;
      for (let i = 0; i < others.length; i++) {
        if (i > 0 && others[i].totalScore === others[i - 1].totalScore) {
          others[i].rank = others[i - 1].rank;
        } else {
          others[i].rank = nextRank;
        }
        nextRank++;
      }

      const sortedEntries = [clincherWinner, ...others];
      return {
        sessionId,
        sessionTitle,
        isFinished,
        entries: sortedEntries,
        hasTieForFirst: false,
        tiedFirstPlaceTeamIds: [],
        winner: clincherWinner,
        clincherRound: null,
      };
    }
  }

  // 6. Standard competition ranking without clincher resolution
  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    return a.slotNumber - b.slotNumber;
  });

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].totalScore === entries[i - 1].totalScore) {
      entries[i].rank = entries[i - 1].rank;
    } else {
      entries[i].rank = i + 1;
    }
  }

  const firstPlaceEntries = entries.filter((e) => e.rank === 1);
  const hasTieForFirst = firstPlaceEntries.length > 1;
  const tiedFirstPlaceTeamIds = hasTieForFirst ? firstPlaceEntries.map((e) => e.teamId) : [];

  entries.forEach((e) => {
    e.isTiedForFirst = hasTieForFirst && e.rank === 1;
  });

  const winner = !hasTieForFirst && entries.length > 0 ? entries[0] : null;

  return {
    sessionId,
    sessionTitle,
    isFinished,
    entries,
    hasTieForFirst,
    tiedFirstPlaceTeamIds,
    winner,
    clincherRound: null,
  };
}

export function endGameSession(sessionId: string): FinalLeaderboardPayload {
  const db = getDb();
  db.prepare(`
    UPDATE game_sessions
    SET status = 'finished', quiz_state = 'ended'
    WHERE id = ?
  `).run(sessionId);

  return getLeaderboard(sessionId);
}

// =======================================================
//  CLINCHER ROUND (TIE-BREAKER) ENGINE
// =======================================================

const DEFAULT_CLINCHER_QUESTIONS = [
  {
    id: "q_clincher_1",
    question_text: "CLINCHER: In cryptography, what does AES stand for?",
    option_a: "Advanced Encryption Standard",
    option_b: "Asymmetric Encryption System",
    option_c: "Automated Encoding Schema",
    option_d: "Authenticated Entropy Security",
    correct_answer: "A" as const,
    time_limit: 15,
    points: 0,
  },
  {
    id: "q_clincher_2",
    question_text: "CLINCHER: Which data structure operates on a First-In-First-Out (FIFO) basis?",
    option_a: "Stack",
    option_b: "Queue",
    option_c: "Binary Search Tree",
    option_d: "Hash Map",
    correct_answer: "B" as const,
    time_limit: 15,
    points: 0,
  },
  {
    id: "q_clincher_3",
    question_text: "CLINCHER: What is the average time complexity of searching in a balanced Binary Search Tree?",
    option_a: "O(1)",
    option_b: "O(n)",
    option_c: "O(log n)",
    option_d: "O(n log n)",
    correct_answer: "C" as const,
    time_limit: 15,
    points: 0,
  },
];

export function getClincherQuestions(sessionId?: string): QuizQuestion[] {
  const db = getDb();
  // Ensure default clincher questions exist
  const insertClincher = db.prepare(`
    INSERT OR IGNORE INTO questions (
      id, session_id, question_text, option_a, option_b, option_c, option_d,
      correct_answer, time_limit, points, order_num
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 999)
  `);

  DEFAULT_CLINCHER_QUESTIONS.forEach((q) => {
    insertClincher.run(
      q.id,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_answer,
      q.time_limit,
      q.points
    );
  });

  if (sessionId) {
    return db.prepare(`
      SELECT * FROM questions
      WHERE (session_id = ? OR session_id IS NULL) AND question_text LIKE 'CLINCHER%'
      ORDER BY order_num ASC
    `).all(sessionId).map(toQuizQuestion as (r: unknown) => QuizQuestion);
  }

  return db.prepare(`
    SELECT * FROM questions
    WHERE question_text LIKE 'CLINCHER%'
    ORDER BY order_num ASC
  `).all().map(toQuizQuestion as (r: unknown) => QuizQuestion);
}

export function createClincherRound(
  sessionId: string,
  questionId?: string,
  timeLimit: number = 15,
  allowPowerUps: boolean = false,
  contendingTeamIds?: string[]
): ClincherRoundRecord {
  const db = getDb();

  // 1. Determine contending teams: if not specified, fetch all rank 1 teams
  let contenders = contendingTeamIds;
  if (!contenders || contenders.length === 0) {
    const lb = getLeaderboard(sessionId);
    contenders = lb.tiedFirstPlaceTeamIds;
    if (contenders.length === 0 && lb.entries.length > 0) {
      contenders = [lb.entries[0].teamId];
    }
  }

  // 2. Determine round number
  const roundCount = (db.prepare(`
    SELECT COUNT(*) as count FROM clincher_rounds WHERE session_id = ?
  `).get(sessionId) as { count: number }).count;
  const roundNumber = roundCount + 1;

  // 3. Determine question
  let targetQuestionId = questionId;
  if (!targetQuestionId) {
    const clincherQuestions = getClincherQuestions(sessionId);
    // Find one not yet used in previous clincher rounds
    const usedQIds = db.prepare(`
      SELECT question_id FROM clincher_rounds WHERE session_id = ?
    `).all(sessionId) as Array<{ question_id: string }>;
    const usedSet = new Set(usedQIds.map((u) => u.question_id));
    const unused = clincherQuestions.find((q) => !usedSet.has(q.id));
    targetQuestionId = unused ? unused.id : (clincherQuestions[0]?.id || "q_clincher_1");
  }

  const roundId = `clincher_${sessionId}_r${roundNumber}_${Date.now()}`;
  const now = Date.now();
  const deadline = now + timeLimit * 1000;

  db.prepare(`
    INSERT INTO clincher_rounds (
      id, session_id, round_number, question_id, time_limit,
      allow_powerups, contending_team_ids, started_at, deadline, status, winner_team_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL)
  `).run(
    roundId,
    sessionId,
    roundNumber,
    targetQuestionId,
    timeLimit,
    allowPowerUps ? 1 : 0,
    JSON.stringify(contenders),
    now,
    deadline
  );

  // Update session state
  db.prepare(`
    UPDATE game_sessions
    SET status = 'clincher_active',
        quiz_state = 'active',
        current_question_id = ?,
        quiz_started_at = ?,
        quiz_deadline = ?
    WHERE id = ?
  `).run(targetQuestionId, now, deadline, sessionId);

  return db.prepare("SELECT * FROM clincher_rounds WHERE id = ?").get(roundId) as ClincherRoundRecord;
}

export function getActiveClincherRound(sessionId: string): ClincherRoundRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM clincher_rounds
    WHERE session_id = ? AND status = 'active'
    ORDER BY round_number DESC
    LIMIT 1
  `).get(sessionId) as ClincherRoundRecord | undefined;

  return row || null;
}

export function recordClincherSubmission(
  sessionId: string,
  clincherRoundId: string,
  teamId: string,
  token: string,
  choice: QuizChoice
): { success: boolean; error?: string; selectedChoice?: QuizChoice } {
  const db = getDb();

  const round = db.prepare("SELECT * FROM clincher_rounds WHERE id = ? AND session_id = ?").get(clincherRoundId, sessionId) as ClincherRoundRecord | undefined;
  if (!round || round.status !== "active") {
    return { success: false, error: "This clincher round is no longer active." };
  }

  // Validate contending teams
  let contendingTeamIds: string[] = [];
  try {
    contendingTeamIds = JSON.parse(round.contending_team_ids);
  } catch {
    contendingTeamIds = [];
  }

  if (!contendingTeamIds.includes(teamId)) {
    return { success: false, error: "Your team is not in contention for this clincher round." };
  }

  // Validate team token
  const team = getTeamById(teamId);
  if (!team || team.session_id !== sessionId || team.token !== token) {
    return { success: false, error: "Unauthorized team credentials." };
  }

  // Deadline check (+1500ms grace period)
  const now = Date.now();
  if (now > round.deadline + 1500) {
    return { success: false, error: "Clincher time has expired for this round." };
  }

  // Check duplicate submission
  const existing = db.prepare(`
    SELECT id FROM clincher_submissions WHERE clincher_round_id = ? AND team_id = ?
  `).get(clincherRoundId, teamId);
  if (existing) {
    return { success: false, error: "Your team has already locked in an answer for this clincher round." };
  }

  // Check answer against question
  const question = getQuestionById(round.question_id);
  if (!question) {
    return { success: false, error: "Clincher question not found." };
  }

  const isCorrect = choice === question.correctAnswer;
  const subId = `csub_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const latency = now - round.started_at;

  db.prepare(`
    INSERT INTO clincher_submissions (
      id, session_id, clincher_round_id, round_number, question_id,
      team_id, selected_choice, is_correct, submitted_at, latency_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subId,
    sessionId,
    clincherRoundId,
    round.round_number,
    round.question_id,
    teamId,
    choice,
    isCorrect ? 1 : 0,
    now,
    latency
  );

  return { success: true, selectedChoice: choice };
}

export function getClincherSubmissionsForRound(clincherRoundId: string): ClincherSubmissionRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM clincher_submissions
    WHERE clincher_round_id = ?
    ORDER BY submitted_at ASC
  `).all(clincherRoundId) as ClincherSubmissionRecord[];
}

export function resolveClincherRound(
  sessionId: string,
  clincherRoundId: string
): ClincherRoundResult {
  const db = getDb();
  const round = db.prepare("SELECT * FROM clincher_rounds WHERE id = ?").get(clincherRoundId) as ClincherRoundRecord | undefined;
  if (!round) {
    throw new Error("Clincher round not found.");
  }

  const question = getQuestionById(round.question_id);
  const submissions = getClincherSubmissionsForRound(clincherRoundId);
  const allTeams = getTeamsForSession(sessionId);

  let contendingTeamIds: string[] = [];
  try {
    contendingTeamIds = JSON.parse(round.contending_team_ids);
  } catch {
    contendingTeamIds = [];
  }

  const contendingTeams = allTeams.filter((t) => contendingTeamIds.includes(t.id));

  // Build summaries
  const summaries: ClincherSubmissionSummary[] = contendingTeams.map((team) => {
    const sub = submissions.find((s) => s.team_id === team.id);
    return {
      teamId: team.id,
      teamName: team.name,
      slotNumber: team.slotNumber,
      selectedChoice: sub ? sub.selected_choice : "NONE",
      isCorrect: sub ? sub.is_correct === 1 : false,
      submittedAt: sub ? sub.submitted_at : 0,
    };
  });

  const correctSummaries = summaries.filter((s) => s.isCorrect);

  let status: "won" | "tied";
  let winnerTeamId: string | null = null;
  let winnerTeamName: string | null = null;
  let survivingTeamIds: string[] = [];
  let message: string;

  if (correctSummaries.length === 1) {
    // Exactly ONE team answered correctly -> Clincher Champion!
    status = "won";
    winnerTeamId = correctSummaries[0].teamId;
    winnerTeamName = correctSummaries[0].teamName;
    survivingTeamIds = [winnerTeamId];
    message = `🏆 CLINCHER CHAMPION: ${winnerTeamName} answered correctly and wins the Tournament!`;

    // Update clincher_rounds and session
    db.prepare(`
      UPDATE clincher_rounds
      SET status = 'won', winner_team_id = ?
      WHERE id = ?
    `).run(winnerTeamId, clincherRoundId);

    db.prepare(`
      UPDATE game_sessions
      SET clincher_winner_id = ?,
          status = 'finished',
          quiz_state = 'ended'
      WHERE id = ?
    `).run(winnerTeamId, sessionId);

  } else if (correctSummaries.length > 1) {
    // Multiple teams answered correctly -> Tie persists among those who got it right!
    status = "tied";
    survivingTeamIds = correctSummaries.map((s) => s.teamId);
    message = `Tie persists! ${correctSummaries.length} teams answered correctly and advance to Clincher Round ${round.round_number + 1}.`;

    db.prepare(`
      UPDATE clincher_rounds
      SET status = 'tied'
      WHERE id = ?
    `).run(clincherRoundId);

    db.prepare(`
      UPDATE game_sessions
      SET quiz_state = 'ended'
      WHERE id = ?
    `).run(sessionId);

  } else {
    // 0 teams answered correctly -> All currently contending teams remain in contention!
    status = "tied";
    survivingTeamIds = contendingTeamIds;
    message = `No team answered correctly! All contending teams advance to Clincher Round ${round.round_number + 1}.`;

    db.prepare(`
      UPDATE clincher_rounds
      SET status = 'tied'
      WHERE id = ?
    `).run(clincherRoundId);

    db.prepare(`
      UPDATE game_sessions
      SET quiz_state = 'ended'
      WHERE id = ?
    `).run(sessionId);
  }

  return {
    roundNumber: round.round_number,
    questionId: round.question_id,
    questionText: question ? question.questionText : "Clincher Tie-Breaker Question",
    correctAnswer: question ? question.correctAnswer : "A",
    status,
    winnerTeamId,
    winnerTeamName,
    contendingTeamIds,
    survivingTeamIds,
    submissions: summaries,
    message,
  };
}

// ============================================================================
//  ADMIN AUTHENTICATION & SECURE SESSION MANAGEMENT (OFFLINE LAN)
// ============================================================================

export interface AdminUserRecord {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: number;
  updated_at: number;
}

export interface AdminSessionRecord {
  id: string;
  session_token: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
  last_active_at: number;
  expires_at: number;
}

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/**
 * Hash a password using Node.js crypto scrypt (secure, offline, robust).
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return { hash: derivedKey.toString("hex"), salt };
}

/**
 * Constant-time password verification to prevent timing attacks.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(hash, "hex");
    if (derivedKey.length !== keyBuffer.length) return false;
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

/**
 * Returns the total number of configured admin accounts.
 */
export function getAdminCount(): number {
  const db = getDb();
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM admin_users").get() as { count: number } | undefined;
    return row ? row.count : 0;
  } catch {
    return 0;
  }
}

/**
 * Returns whether an initial admin account has already been created.
 */
export function hasAdminAccount(): boolean {
  return getAdminCount() > 0;
}

/**
 * Creates the initial admin account. Only permitted if no admin account exists.
 */
export function createInitialAdmin(
  username: string,
  password: string
): { success: boolean; error?: string; user?: { id: string; username: string } } {
  const db = getDb();

  if (hasAdminAccount()) {
    return {
      success: false,
      error: "Setup disabled: An administrator account already exists. Public registration is not permitted.",
    };
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 3) {
    return { success: false, error: "Username must be at least 3 characters long." };
  }

  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }

  const { hash, salt } = hashPassword(password);
  const userId = `admin_${crypto.randomBytes(6).toString("hex")}`;
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, cleanUsername, hash, salt, now, now);

    console.log(`[Security] Initial administrator account created for username "${cleanUsername}".`);
    return { success: true, user: { id: userId, username: cleanUsername } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create administrator account: ${msg}` };
  }
}

/**
 * Verify administrator credentials with rate limit check and timing attack mitigation.
 */
export function verifyAdminCredentials(
  username: string,
  password: string
): { success: boolean; user?: { id: string; username: string }; error?: string } {
  const db = getDb();
  const cleanUsername = username.trim();

  const user = db
    .prepare("SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)")
    .get(cleanUsername) as AdminUserRecord | undefined;

  if (!user) {
    // Perform dummy scrypt to normalize execution time against username enumeration
    const dummySalt = "00000000000000000000000000000000";
    try {
      crypto.scryptSync(password || "dummy", dummySalt, 64);
    } catch {}
    return { success: false, error: "Invalid credentials" };
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    return { success: false, error: "Invalid credentials" };
  }

  return { success: true, user: { id: user.id, username: user.username } };
}

/**
 * Record a login attempt for rate limiting and auditing.
 */
export function recordLoginAttempt(ip: string, success: boolean): void {
  const db = getDb();
  const id = `att_${crypto.randomBytes(8).toString("hex")}`;
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO admin_login_attempts (id, ip_address, attempt_time, success)
      VALUES (?, ?, ?, ?)
    `).run(id, ip || "unknown", now, success ? 1 : 0);

    // Prune entries older than 24 hours to prevent table bloat
    const cutoff = now - 24 * 60 * 60 * 1000;
    db.prepare("DELETE FROM admin_login_attempts WHERE attempt_time < ?").run(cutoff);
  } catch (err) {
    console.error("[Security] Error recording login attempt:", err);
  }
}

/**
 * Checks if the given IP address is currently rate-limited due to excessive failed login attempts.
 */
export function checkLoginRateLimit(ip: string): { limited: boolean; retryAfterSeconds?: number } {
  const db = getDb();
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const targetIp = ip || "unknown";

  try {
    const row = db
      .prepare(`
        SELECT COUNT(*) as failedCount, MAX(attempt_time) as lastAttempt
        FROM admin_login_attempts
        WHERE ip_address = ? AND success = 0 AND attempt_time > ?
      `)
      .get(targetIp, windowStart) as { failedCount: number; lastAttempt: number | null } | undefined;

    if (row && row.failedCount >= MAX_FAILED_LOGIN_ATTEMPTS && row.lastAttempt) {
      const remainingMs = row.lastAttempt + RATE_LIMIT_WINDOW_MS - now;
      if (remainingMs > 0) {
        return {
          limited: true,
          retryAfterSeconds: Math.ceil(remainingMs / 1000),
        };
      }
    }
  } catch (err) {
    console.error("[Security] Rate limit check error:", err);
  }

  return { limited: false };
}

/**
 * Creates a cryptographically random, server-stored admin session.
 */
export function createAdminSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): { token: string; expiresAt: number } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = `sess_${crypto.randomBytes(12).toString("hex")}`;
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  // Invalidate any expired sessions
  cleanupExpiredSessions();

  db.prepare(`
    INSERT INTO admin_sessions (id, session_token, user_id, ip_address, user_agent, created_at, last_active_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, token, userId, ipAddress || null, userAgent ? userAgent.slice(0, 255) : null, now, now, expiresAt);

  return { token, expiresAt };
}

/**
 * Validates an admin session token against the SQLite store.
 */
export function validateAdminSession(
  token: string
): { valid: boolean; user?: { id: string; username: string }; error?: string } {
  if (!token || typeof token !== "string" || token.length < 32) {
    return { valid: false, error: "Missing or malformed session token" };
  }

  const db = getDb();
  const now = Date.now();

  try {
    const row = db
      .prepare(`
        SELECT s.id, s.user_id, s.expires_at, u.username
        FROM admin_sessions s
        JOIN admin_users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > ?
      `)
      .get(token, now) as { id: string; user_id: string; expires_at: number; username: string } | undefined;

    if (!row) {
      return { valid: false, error: "Session invalid or expired" };
    }

    // Touch last_active_at
    db.prepare("UPDATE admin_sessions SET last_active_at = ? WHERE id = ?").run(now, row.id);

    return {
      valid: true,
      user: { id: row.user_id, username: row.username },
    };
  } catch (err) {
    console.error("[Security] Session validation error:", err);
    return { valid: false, error: "Database error during session validation" };
  }
}

/**
 * Invalidate a session upon logout.
 */
export function invalidateAdminSession(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const db = getDb();
  try {
    const res = db.prepare("DELETE FROM admin_sessions WHERE session_token = ?").run(token);
    return res.changes > 0;
  } catch {
    return false;
  }
}

/**
 * Invalidate all sessions for a user (e.g. on password change).
 */
export function invalidateAllUserSessions(userId: string): number {
  const db = getDb();
  try {
    const res = db.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(userId);
    return res.changes;
  } catch {
    return 0;
  }
}

/**
 * Prune all expired sessions from the database.
 */
export function cleanupExpiredSessions(): number {
  const db = getDb();
  const now = Date.now();
  try {
    const res = db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(now);
    return res.changes;
  } catch {
    return 0;
  }
}
